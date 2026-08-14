/**
 * decodeDetections.ts
 *
 * Single responsibility: turn the raw output tensors of the bundled
 * SSD-MobileNet-V1 TFLite model (`assets/models/person-detection.tflite`)
 * into `PersonBox[]` this app understands.
 *
 * Written against the exact tensor layout confirmed in
 * `research/computer-vision/person-detection-model-asset.md` for
 * `coco_ssd_mobilenet_v1_1.0_quant_2018_06_29` (the `TFLite_Detection_PostProcess`
 * output convention). Four output tensors, fixed at MAX_DETECTIONS slots, **NMS
 * already applied by the model itself** — this function does not do its own NMS:
 *
 *   [0] detection_boxes   float32 [1, N, 4]  -- [ymin, xmin, ymax, xmax], normalised 0..1
 *   [1] detection_classes float32 [1, N]     -- 0-indexed class id (cast to int)
 *   [2] detection_scores  float32 [1, N]     -- confidence 0..1
 *   [3] num_detections    float32 [1]        -- always fills N; NOT reliable for
 *                                                trimming, filter by score instead
 *
 * Pure function over plain number arrays — no native/model objects — so it is
 * unit-testable on Windows with synthetic tensor data, same as everything else
 * in src/tracking/. The caller (src/hooks/useAthleteDetection.ts) is responsible
 * for turning the model's raw `ArrayBuffer[]` output into these plain arrays.
 */

import type { PersonBox } from './types';

/** Fixed by this model's graph: always exactly this many detection slots. */
export const MAX_DETECTIONS = 10;

/**
 * Class id for "person" in this model's label map.
 *
 * Confirmed directly against the shipped `labelmap.txt` — see
 * `research/computer-vision/person-detection-model-asset.md`, "Person class
 * index". If this model file is ever swapped for a different export, re-check
 * this constant before trusting detections silently.
 */
export const PERSON_CLASS_ID = 0;

/** Below this score, a detection is treated as noise and dropped. App-level tuning choice — not a spec value from the model itself. */
const DEFAULT_MIN_SCORE = 0.5;

/**
 * Mirrors `react-native-vision-camera`'s `CameraOrientation` type
 * (`node_modules/react-native-vision-camera/lib/specs/common-types/CameraOrientation.d.ts`)
 * structurally, without importing it — this file stays free of native
 * package imports on purpose (see the file doc comment above) so it keeps
 * working as a plain, portable function.
 *
 * Meaning, straight from that file: the raw pixel buffer is rotated by this
 * much relative to the desired "upright" output. `'up'` = no rotation.
 * `'right'` = buffer is +90° relative to upright. `'left'` = buffer is -90°.
 * `'down'` = buffer is 180°.
 */
export type BufferOrientation = 'up' | 'right' | 'down' | 'left';

export interface DecodeDetectionsOptions {
  /** Minimum score to keep a detection at all. */
  readonly minScore?: number;
  /** Which class id counts as "person" for this model. */
  readonly personClassId?: number;
  /**
   * How the raw sensor buffer is rotated relative to upright — pass
   * `frame.orientation` straight through. Defaults to `'up'` (no rotation).
   *
   * The model runs on the RAW buffer (see
   * `src/hooks/useAthleteDetection.ts`'s doc comment on the resizer's
   * `'stretch'` scale mode), so a box's (x, y) coordinates are in the raw
   * buffer's rotated space, not display space, whenever this isn't `'up'`.
   * Applied BEFORE `isMirrored` — rotation is a buffer-geometry fact, mirroring
   * is a separate camera-facing fact, and composing them in the wrong order
   * would only happen to look right when one of the two is a no-op.
   *
   * Real on-device report, 2026-08-14: back camera showed a box wrong on
   * BOTH axes (side and up/down) while front camera was correct — exactly
   * the signature of an uncorrected 180°/`'down'` orientation on the back
   * sensor while the front sensor reports `'up'`. This option (and the
   * rotation math below) is the fix; before this it only corrected the
   * frame's aspect ratio for a 90° case, never the box's own position, and
   * never handled 180° at all.
   */
  readonly orientation?: BufferOrientation;
  /**
   * True when the source frame is mirrored (the front/selfie camera). The
   * caller decides this — `src/hooks/useAthleteDetection.ts` derives it from
   * the resolved `CameraDevice.position`, deliberately NOT from
   * `Frame.isMirrored` (see that file's doc comment for why: a real
   * on-device report showed a mirrored box on the back camera, which
   * `Frame.isMirrored` should never report true for). When set, each box's
   * `x` is flipped (`1 - x - width`) so downstream code always sees
   * coordinates in the same left-right sense as what's actually displayed,
   * regardless of which physical camera produced the frame.
   */
  readonly isMirrored?: boolean;
}

/**
 * Rotate a raw-buffer-space box to upright ("up") space.
 *
 * Derived directly from `CameraOrientation`'s documented semantics (see the
 * type above) by tracking where each of a box's 4 corners lands under the
 * inverse rotation, then taking min/max — not by guessing a formula. Every
 * case has a dedicated test in `decodeDetections.test.ts` using a simple
 * corner-hugging box, which is the easiest shape to reason about by hand.
 */
function orientBox(
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number,
  orientation: BufferOrientation,
): { xmin: number; ymin: number; xmax: number; ymax: number } {
  switch (orientation) {
    case 'up':
      return { xmin, ymin, xmax, ymax };
    case 'down':
      // 180°: point reflection through the center.
      return { xmin: 1 - xmax, ymin: 1 - ymax, xmax: 1 - xmin, ymax: 1 - ymin };
    case 'right':
      // Buffer is +90° relative to upright; undo by rotating -90° (CCW).
      return { xmin: ymin, ymin: 1 - xmax, xmax: ymax, ymax: 1 - xmin };
    case 'left':
      // Buffer is -90° relative to upright; undo by rotating +90° (CW).
      return { xmin: 1 - ymax, ymin: xmin, xmax: 1 - ymin, ymax: xmax };
  }
}

/**
 * @param boxes `detection_boxes`, flattened: 4 numbers per detection, `[ymin, xmin, ymax, xmax]`.
 * @param classes `detection_classes`, one number per detection.
 * @param scores `detection_scores`, one number per detection.
 */
export function decodeDetections(
  boxes: ArrayLike<number>,
  classes: ArrayLike<number>,
  scores: ArrayLike<number>,
  options: DecodeDetectionsOptions = {},
): PersonBox[] {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const personClassId = options.personClassId ?? PERSON_CLASS_ID;
  const orientation = options.orientation ?? 'up';
  const isMirrored = options.isMirrored ?? false;

  const result: PersonBox[] = [];

  for (let i = 0; i < MAX_DETECTIONS; i += 1) {
    const classId = classes[i];
    const score = scores[i];
    if (classId === undefined || score === undefined) continue;
    if (Math.round(classId) !== personClassId) continue;
    if (!(score >= minScore)) continue; // also rejects NaN scores

    const rawYmin = boxes[i * 4 + 0];
    const rawXmin = boxes[i * 4 + 1];
    const rawYmax = boxes[i * 4 + 2];
    const rawXmax = boxes[i * 4 + 3];
    if (
      rawYmin === undefined ||
      rawXmin === undefined ||
      rawYmax === undefined ||
      rawXmax === undefined
    ) {
      continue;
    }

    const { xmin, ymin, xmax, ymax } = orientBox(rawXmin, rawYmin, rawXmax, rawYmax, orientation);

    const width = xmax - xmin;
    const height = ymax - ymin;
    // Guards NaN and degenerate/inverted boxes in one check: NaN comparisons
    // are always false, so a non-finite or zero/negative extent is dropped.
    if (!(width > 0) || !(height > 0)) continue;

    const x = isMirrored ? 1 - xmin - width : xmin;
    result.push({ x, y: ymin, width, height, confidence: score });
  }

  return result;
}
