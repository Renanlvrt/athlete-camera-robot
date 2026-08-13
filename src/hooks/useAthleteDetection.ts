import { useCallback, useRef, useState } from 'react';
import { useFrameOutput, type CameraFrameOutput } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';
import { useResizer } from 'react-native-vision-camera-resizer';
import { useTensorflowModel } from 'react-native-fast-tflite';

import { decodeDetections } from '../tracking/decodeDetections';
import type { PersonBox } from '../tracking/types';

/**
 * useAthleteDetection
 *
 * Single responsibility: run the bundled person-detection model against the
 * live camera feed and expose the current frame's detections as plain state.
 *
 * This hook owns every native/model concern (frame output config, GPU resize,
 * TFLite inference) so that `src/screens/CameraPreviewScreen.tsx` can stay a
 * pure renderer, per `src/screens/index.md`'s rule that screens take data as
 * props and own no business logic.
 *
 * WRITTEN AGAINST THE REAL v5 API — verified against the .d.ts files in
 * node_modules on 2026-08-12, following the same pattern proven in
 * `.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx`:
 * `useFrameOutput({ onFrame })`, not the v4 `useFrameProcessor`; counting and
 * state updates happen on the JS thread via `runOnJS`, never inside the
 * worklet itself, because refs written from a worklet do not reliably flow
 * back to the JS thread.
 *
 * Model: `assets/models/person-detection.tflite` — a quantized SSD-MobileNet-V1,
 * 300x300 uint8 RGB input, 4 output tensors with NMS already applied. Format
 * confirmed in `research/computer-vision/person-detection-model-asset.md`; the
 * exact decode is `src/tracking/decodeDetections.ts`.
 *
 * The resizer is configured with `scaleMode: 'stretch'`, which — because it
 * does not crop or letterbox — makes the model's normalised output
 * coordinates equal to full CAMERA FRAME normalised coordinates directly,
 * with no extra transform for the box itself. The frame's `width`/`height`
 * are RAW SENSOR BUFFER dimensions, though, and are not automatically
 * rotated to match display orientation (`Frame.orientation`, see
 * `node_modules/react-native-vision-camera/lib/specs/instances/Frame.nitro.d.ts`).
 * `publishFrameSize` below corrects for this by swapping width/height when
 * `orientation` is `'left'`/`'right'` before computing the aspect ratio that
 * `src/screens/frameLayout.ts` uses to place the overlay box — getting this
 * wrong is the most likely explanation for a wildly oversized/mispositioned
 * box, since `frameLayout.ts`'s `'cover'`-fit math amplifies any aspect-ratio
 * error into a large positioning error.
 *
 * FRONT CAMERA: `frame.isMirrored` is passed straight through to
 * `decodeDetections`'s `isMirrored` option, which flips each box's `x`
 * before it's ever stored in state — every downstream consumer
 * (`src/tracking/`, `src/screens/`) sees already-correct, un-mirrored
 * coordinates and doesn't need to know which camera produced them. See
 * `src/hooks/useCameraSetup.ts` for the front/back toggle this supports.
 */

const MODEL_INPUT_SIZE = 300;

export type DetectionStatus = 'loading' | 'error' | 'ready';

export interface AthleteDetectionResult {
  readonly status: DetectionStatus;
  readonly error?: Error;
  /** Every person detected in the most recent processed frame. */
  readonly boxes: readonly PersonBox[];
  /** Pass this straight to `<Camera outputs={[frameOutput]} />`. */
  readonly frameOutput: CameraFrameOutput;
  /** The camera frame's width/height ratio, from the first frame seen. Undefined until then. */
  readonly frameAspectRatio: number | undefined;
}

export function useAthleteDetection(): AthleteDetectionResult {
  const plugin = useTensorflowModel(require('../../assets/models/person-detection.tflite'), [
    'core-ml',
  ]);
  const resizerState = useResizer({
    width: MODEL_INPUT_SIZE,
    height: MODEL_INPUT_SIZE,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  });

  const [boxes, setBoxes] = useState<readonly PersonBox[]>([]);
  const [frameAspectRatio, setFrameAspectRatio] = useState<number | undefined>(undefined);
  const hasSetAspectRatio = useRef(false);

  const publishDetections = useCallback(
    (rawBoxes: number[], rawClasses: number[], rawScores: number[], isMirrored: boolean) => {
      setBoxes(decodeDetections(rawBoxes, rawClasses, rawScores, { isMirrored }));
    },
    [],
  );

  const publishFrameSize = useCallback((width: number, height: number, isRotated: boolean) => {
    if (hasSetAspectRatio.current || width <= 0 || height <= 0) return;
    hasSetAspectRatio.current = true;
    // A 'left'/'right' orientation means the raw buffer is rotated 90°
    // relative to how it will actually be displayed — swap the dimensions so
    // the aspect ratio matches what's on screen, not the raw sensor buffer.
    //
    // NOT YET SUFFICIENT ON ITS OWN if orientation really is rotated: this
    // only corrects the ASPECT RATIO used for the 'cover'-fit scale in
    // frameLayout.ts. The detection box's own (x, y) coordinates from
    // decodeDetections.ts are still in the RAW buffer's coordinate space —
    // if orientation ever comes back 'left'/'right' on the real device, the
    // box's position (not just the overall scale) would also need a 90°
    // coordinate rotation before frameLayout.ts's math, which isn't
    // implemented yet. This can't be exercised or verified from a laptop
    // webcam (no orientation-metadata rotation there) — if the box is still
    // wrong after this fix, log `frame.orientation` on-device and check here
    // first before assuming anything else.
    setFrameAspectRatio(isRotated ? height / width : width / height);
  }, []);

  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  const resizer = resizerState.state === 'ready' ? resizerState.resizer : undefined;

  const frameOutput = useFrameOutput({
    // 'yuv' because the GPU resizer requires 'yuv-420-8-bit-full' input on iOS.
    pixelFormat: 'yuv',
    onFrame: (frame) => {
      'worklet';
      const isRotated = frame.orientation === 'left' || frame.orientation === 'right';
      runOnJS(publishFrameSize)(frame.width, frame.height, isRotated);

      if (resizer == null || model == null) {
        frame.dispose();
        return;
      }

      const resized = resizer.resize(frame);
      const pixelBuffer = resized.getPixelBuffer();
      resized.dispose();

      // All 4 output tensors are float32 regardless of the uint8-quantized
      // input — see research/computer-vision/person-detection-model-asset.md.
      const outputs = model.runSync([pixelBuffer]);
      const rawBoxes = Array.from(new Float32Array(outputs[0]));
      const rawClasses = Array.from(new Float32Array(outputs[1]));
      const rawScores = Array.from(new Float32Array(outputs[2]));
      runOnJS(publishDetections)(rawBoxes, rawClasses, rawScores, frame.isMirrored);

      frame.dispose();
    },
  });

  let status: DetectionStatus = 'loading';
  let error: Error | undefined;
  if (plugin.state === 'error') {
    status = 'error';
    error = plugin.error;
  } else if (resizerState.state === 'error') {
    status = 'error';
    error = resizerState.error;
  } else if (model != null && resizer != null) {
    status = 'ready';
  }

  return { status, error, boxes, frameOutput, frameAspectRatio };
}
