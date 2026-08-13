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

export interface DecodeDetectionsOptions {
  /** Minimum score to keep a detection at all. */
  readonly minScore?: number;
  /** Which class id counts as "person" for this model. */
  readonly personClassId?: number;
  /**
   * True when the source frame is mirrored (the front/selfie camera) — see
   * `Frame.isMirrored` in `react-native-vision-camera`. When set, each box's
   * `x` is flipped (`1 - x - width`) so downstream code always sees
   * coordinates in the same left-right sense as what's actually displayed,
   * regardless of which physical camera produced the frame. Front-camera
   * frames come out of the model still mirrored — this is not a rare edge
   * case, it's the normal case for that camera.
   */
  readonly isMirrored?: boolean;
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
  const isMirrored = options.isMirrored ?? false;

  const result: PersonBox[] = [];

  for (let i = 0; i < MAX_DETECTIONS; i += 1) {
    const classId = classes[i];
    const score = scores[i];
    if (classId === undefined || score === undefined) continue;
    if (Math.round(classId) !== personClassId) continue;
    if (!(score >= minScore)) continue; // also rejects NaN scores

    const ymin = boxes[i * 4 + 0];
    const xmin = boxes[i * 4 + 1];
    const ymax = boxes[i * 4 + 2];
    const xmax = boxes[i * 4 + 3];
    if (ymin === undefined || xmin === undefined || ymax === undefined || xmax === undefined) {
      continue;
    }

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
