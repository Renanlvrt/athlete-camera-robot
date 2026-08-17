import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useFrameOutput,
  type CameraFrameOutput,
  type CameraPosition,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';
import { useResizer } from 'react-native-vision-camera-resizer';
import { useTensorflowModel } from 'react-native-fast-tflite';

import { decodeDetections, type BufferOrientation } from '../tracking/decodeDetections';
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
 * `publishFrameSize` below corrects for this — as of 2026-08-16 (later), by
 * always taking `min(width, height) / max(width, height)`, which is
 * guaranteed correct for the aspect ratio `src/screens/frameLayout.ts` uses
 * to place the overlay box PRECISELY BECAUSE `app.json` locks
 * `"orientation": "portrait"` (the display shape is always portrait, no
 * exceptions) — not by trying to infer a width/height swap from
 * `Frame.orientation`, which a real report showed relates to "portrait"
 * OPPOSITELY for the front vs back camera on this device (front and back
 * produced reciprocal aspect ratios, 1.78 and 0.56, from the same
 * orientation-based swap rule). Getting this aspect ratio wrong is the most
 * likely explanation for a wildly oversized/mispositioned box, since
 * `frameLayout.ts`'s `'cover'`-fit math amplifies any aspect-ratio error
 * into a large positioning error — confirmed exactly this on 2026-08-16.
 *
 * FRONT CAMERA: the caller passes `cameraPosition` — the RESOLVED
 * `CameraDevice.position` once known (falling back to the requested
 * `facing` before the device resolves; see `src/App.tsx`), never
 * `Frame.isMirrored`. This is a deliberate correction: an earlier version
 * used `Frame.isMirrored`, but a real on-device report showed a mirrored
 * box on the BACK camera — a state `Frame.isMirrored` should never report
 * true for, per VisionCamera's own docs. Rather than debug a native flag
 * with no way to log its real device-side value, `cameraPosition` is
 * simple, deterministic, and fully within this app's own control: back
 * camera is defined to never mirror, front camera always does. See
 * `docs/VERIFICATION_REPORT.md`'s 2026-08-13 entries for the full history.
 *
 * BACK-CAMERA ROTATION (fixed 2026-08-14): `frame.orientation` is now passed
 * straight through to `decodeDetections` every frame, which rotates the raw
 * box (x, y) into upright space before mirroring — see
 * `src/tracking/decodeDetections.ts`'s `orientBox`. This closes the gap the
 * previous version left open (only the frame's aspect ratio was corrected
 * for a 90° rotation; the box's own position never was, and 180° wasn't
 * handled at all). A real on-device report showed the back camera's box
 * wrong on both axes simultaneously — the signature of exactly this gap.
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
  /**
   * The raw `Frame.orientation` value from the most recently processed
   * frame — surfaced purely as a DIAGNOSTIC (2026-08-16), after two rounds
   * of orientation-rotation fixes that each looked correct on paper and
   * derivation but were still wrong on the real device. Rather than guess a
   * third time, this lets `TrackingOverlay.tsx` show the real value on
   * screen so the next report is measured data, not another inference. Undo
   * once `orientBox`'s formulas are confirmed correct for both cameras on
   * real hardware — see `src/tracking/decodeDetections.ts`.
   */
  readonly rawOrientation: BufferOrientation | undefined;
  /**
   * The SAME detections as `boxes`, but with NO rotation correction and NO
   * mirror correction applied — i.e. exactly what the model output, decoded
   * with `decodeDetections`' defaults. TEMPORARY DIAGNOSTIC (2026-08-16,
   * later still): after three straight rounds of the rotation math
   * (`orientBox`) looking correct on paper and being wrong on-device — most
   * recently a real report that horizontal motion is showing up as vertical
   * motion on screen AND in the gimbal-correction sent to the micro:bit —
   * guessing a fourth formula isn't the move. Drawing this alongside the
   * normal (corrected) box lets the developer see directly which one
   * actually tracks real left/right motion correctly, which tells us whether
   * `orientBox` needs to be REMOVED (if this raw box is the one that's
   * correct — meaning the pipeline was never actually delivering rotated
   * coordinates in the first place) or just has its formula direction wrong
   * (if neither is right, or the corrected one is right) — see
   * `src/screens/TrackingOverlay.tsx`. Delete alongside `DebugReadout.tsx`
   * once orientation is confirmed correct.
   */
  readonly rawUncorrectedBoxes: readonly PersonBox[];
}

/**
 * @param cameraPosition Which physical camera is (or will be) active —
 *   `setup.device.position` once resolved, else the requested `facing`. Only
 *   `'front'` triggers mirror-correction; every other value (`'back'`,
 *   `'external'`, `'unspecified'`) is treated as not mirrored.
 */
export function useAthleteDetection(cameraPosition: CameraPosition): AthleteDetectionResult {
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
  const [rawUncorrectedBoxes, setRawUncorrectedBoxes] = useState<readonly PersonBox[]>([]);
  const [frameAspectRatio, setFrameAspectRatio] = useState<number | undefined>(undefined);
  const [rawOrientation, setRawOrientation] = useState<BufferOrientation | undefined>(undefined);
  const hasSetAspectRatio = useRef(false);

  const isMirrored = cameraPosition === 'front';

  // BUG FIXED 2026-08-16: `hasSetAspectRatio` used to latch permanently true
  // on the very first processed frame and never reset — so toggling the
  // front/back camera mid-session (this hook is never remounted by that
  // toggle, see src/App.tsx) kept using the FIRST camera's aspect ratio
  // forever, silently wrong for whichever camera was switched to after.
  // Reset both the aspect ratio and the diagnostic orientation reading
  // whenever the resolved camera actually changes, so they're always
  // recomputed fresh for the camera currently in use.
  useEffect(() => {
    hasSetAspectRatio.current = false;
    setFrameAspectRatio(undefined);
    setRawOrientation(undefined);
  }, [cameraPosition]);

  const publishDetections = useCallback(
    (
      rawBoxes: number[],
      rawClasses: number[],
      rawScores: number[],
      orientation: BufferOrientation,
    ) => {
      setBoxes(decodeDetections(rawBoxes, rawClasses, rawScores, { isMirrored, orientation }));
      // No orientation/isMirrored — the raw, untransformed decode. See this
      // field's own doc comment in AthleteDetectionResult above.
      setRawUncorrectedBoxes(decodeDetections(rawBoxes, rawClasses, rawScores));
      setRawOrientation(orientation);
    },
    [isMirrored],
  );

  const publishFrameSize = useCallback((width: number, height: number) => {
    if (hasSetAspectRatio.current || width <= 0 || height <= 0) return;
    hasSetAspectRatio.current = true;
    // FIXED 2026-08-16 (later): this used to decide whether to swap
    // width/height based on `frame.orientation === 'left' | 'right'`,
    // assuming both cameras' raw buffers relate to "portrait" the same way.
    // A real on-device report disproved that: back camera (orientation
    // 'left') correctly produced ar=0.56 (portrait) via that swap, but front
    // camera (orientation 'right') produced ar=1.78 (LANDSCAPE) via the
    // exact same swap — the two numbers are reciprocals of each other,
    // meaning the front and back sensors' raw buffers relate to "portrait"
    // OPPOSITELY, so one fixed swap rule can't be right for both.
    //
    // Sidesteps needing to trust that relationship at all: `app.json` locks
    // `"orientation": "portrait"`, so the DISPLAYED shape is always portrait
    // (width < height) by construction, regardless of camera or
    // `Frame.orientation` quirks — so just always divide the smaller raw
    // dimension by the larger one. This is grounded in something verified
    // independently (the portrait lock), not another assumption about
    // camera-sensor rotation.
    //
    // The box's own (x, y) rotation is handled separately, in
    // decodeDetections.ts's orientBox (see publishDetections below) — this
    // function only corrects the aspect ratio used for frameLayout.ts's
    // 'cover'-fit scale.
    setFrameAspectRatio(Math.min(width, height) / Math.max(width, height));
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
      runOnJS(publishDetections)(rawBoxes, rawClasses, rawScores, frame.orientation);

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

  return {
    status,
    error,
    boxes,
    frameOutput,
    frameAspectRatio,
    rawOrientation,
    rawUncorrectedBoxes,
  };
}
