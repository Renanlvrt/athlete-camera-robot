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
 * KNOWN SIMPLIFICATION, not yet proven on hardware: the resizer is configured
 * with `scaleMode: 'stretch'`, which — because it does not crop or letterbox —
 * makes the model's normalised output coordinates equal to full CAMERA FRAME
 * normalised coordinates directly, with no extra transform. This assumes the
 * frame is already in the app's display orientation (`Frame.orientation ===
 * 'up'`), true for the common case of a portrait-locked app matching
 * `app.json`'s `"orientation": "portrait"`. If detections on-device look
 * present but the overlay box is rotated 90° from the person, check this
 * assumption first — see `src/screens/frameLayout.ts`.
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
    (rawBoxes: number[], rawClasses: number[], rawScores: number[]) => {
      setBoxes(decodeDetections(rawBoxes, rawClasses, rawScores));
    },
    [],
  );

  const publishFrameSize = useCallback((width: number, height: number) => {
    if (hasSetAspectRatio.current || width <= 0 || height <= 0) return;
    hasSetAspectRatio.current = true;
    setFrameAspectRatio(width / height);
  }, []);

  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  const resizer = resizerState.state === 'ready' ? resizerState.resizer : undefined;

  const frameOutput = useFrameOutput({
    // 'yuv' because the GPU resizer requires 'yuv-420-8-bit-full' input on iOS.
    pixelFormat: 'yuv',
    onFrame: (frame) => {
      'worklet';
      runOnJS(publishFrameSize)(frame.width, frame.height);

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
      runOnJS(publishDetections)(rawBoxes, rawClasses, rawScores);

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
