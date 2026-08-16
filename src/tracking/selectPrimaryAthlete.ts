/**
 * selectPrimaryAthlete.ts
 *
 * Single responsibility: given every person the model saw this frame, decide
 * which ONE the gimbal should follow.
 *
 * Pure function, no state, no side effects — so it is fully unit-testable on
 * Windows with no hardware.
 */

import type { PersonBox, PrimaryAthleteResult } from './types';

/**
 * Minimum confidence for a detection to be considered at all.
 *
 * Low-confidence boxes from a small quantized model are frequently noise —
 * background objects, partial bodies at the frame edge. Following one makes the
 * camera lurch away from the real subject, which is far more visible in footage
 * than briefly following nobody.
 */
export const MIN_CONFIDENCE = 0.4;

/** Area of a box in normalised units. */
function area(box: PersonBox): number {
  return box.width * box.height;
}

/**
 * Intersection-over-union of two boxes, 0 (no overlap) to 1 (identical).
 * Standard object-tracking similarity metric — used here to answer "is this
 * detection probably the same athlete as last frame's lock?", not to do NMS
 * (the model's `TFLite_Detection_PostProcess` op already does that).
 */
function intersectionOverUnion(a: PersonBox, b: PersonBox): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const intersectionArea = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const unionArea = area(a) + area(b) - intersectionArea;
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/** Distance between two boxes' centers, in normalised units. */
function centerDistance(a: PersonBox, b: PersonBox): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Below this IoU with the previous lock, two boxes aren't considered "close
 * enough overlap" alone. Deliberately loose (not 0.5) because an occluded
 * athlete's box can shrink a lot frame-to-frame (legs cut off, only a
 * shoulder visible) while still clearly being the same person in the same
 * spot — see `CONTINUITY_CENTER_DISTANCE` below, which catches that case via
 * position instead of overlap.
 */
const CONTINUITY_IOU_THRESHOLD = 0.15;
/**
 * Below this center-to-center distance (normalised units), two boxes count as
 * "the same spot" even if their IoU is low — the fallback for the
 * shrunk-under-occlusion case above.
 */
const CONTINUITY_CENTER_DISTANCE = 0.2;

/**
 * Find whichever current detection is most likely a continuation of
 * `previousLock`, by IoU (primary signal) with center-distance as a secondary
 * one for boxes that shrank a lot (occlusion) but didn't move. Returns
 * `undefined` if nothing in `boxes` plausibly continues the previous lock —
 * the caller then falls back to fresh acquisition.
 */
function findContinuedLock(
  boxes: readonly PersonBox[],
  previousLock: PersonBox,
): { readonly index: number; readonly box: PersonBox } | undefined {
  let bestIndex = -1;
  let bestIoU = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    if (box === undefined) continue;
    if (box.confidence < MIN_CONFIDENCE) continue;

    const iou = intersectionOverUnion(box, previousLock);
    const distance = centerDistance(box, previousLock);
    const isMatch = iou >= CONTINUITY_IOU_THRESHOLD || distance <= CONTINUITY_CENTER_DISTANCE;
    if (!isMatch) continue;

    // Prefer the highest-overlap candidate; break ties (including the
    // "matched by distance only, iou 0" case) by whichever is closest.
    if (iou > bestIoU || (iou === bestIoU && distance < bestDistance)) {
      bestIoU = iou;
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? { index: bestIndex, box: boxes[bestIndex] as PersonBox } : undefined;
}

/**
 * Pick the primary athlete to track.
 *
 * Two-tier strategy:
 * 1. **Continuity, if a `previousLock` is given.** If the previously-locked
 *    athlete has a plausible continuation among this frame's boxes (see
 *    `findContinuedLock`), keep following THAT one — even if a different box
 *    is now larger. This is what fixes the "picks a seemingly random athlete
 *    each frame" complaint with multiple similarly-sized people in frame: the
 *    old MVP heuristic re-ran "largest wins" from scratch every single frame
 *    with no memory, so two athletes trading off which one's box is
 *    momentarily bigger made the lock visibly flip back and forth. It's also
 *    what keeps the lock on someone through a brief partial occlusion (legs
 *    cut off, box shrunk) instead of handing the lock to whoever else is
 *    biggest that frame.
 * 2. **Largest sufficiently-confident box, otherwise.** The original MVP
 *    heuristic — used to acquire a lock in the first place (`previousLock`
 *    undefined) and to RE-acquire one once continuity genuinely fails (the
 *    locked athlete actually left frame or stayed lost past the caller's
 *    grace period — see `src/hooks/useLockedAthlete.ts`, which owns that
 *    timing). Largest is a rough proxy for closest, and closest is usually
 *    the subject being filmed.
 *
 * `docs/PRD.md` §4.2 marks "refined multi-athlete selection (tap-to-select,
 * re-identification)" as FUTURE — this continuity match is deliberately NOT
 * that: it has no notion of athlete identity/appearance, just "which box is
 * geometrically closest to where the lock last was." Requested explicitly in
 * the current conversation (2026-08-16) as the fix for both the random-flip
 * complaint and for staying locked through occlusion, which is why it's in
 * scope now despite that FUTURE marking on the heavier appearance-based
 * approaches.
 *
 * Still a pure function — no `Date.now()`, no state of its own. The caller
 * decides what counts as "the previous lock" (and how long to keep offering
 * it after a frame with no match) — see `useLockedAthlete.ts`.
 *
 * @param boxes Every detection from the current frame. May be empty.
 * @param previousLock The athlete locked onto as of the last call, if any.
 * @returns The locked athlete and its index in `boxes`, or `no-athletes`.
 */
export function selectPrimaryAthlete(
  boxes: readonly PersonBox[],
  previousLock?: PersonBox,
): PrimaryAthleteResult {
  if (previousLock !== undefined) {
    const continued = findContinuedLock(boxes, previousLock);
    if (continued !== undefined) {
      return { status: 'locked', athlete: continued.box, index: continued.index };
    }
  }

  let bestIndex = -1;
  let bestArea = -1;

  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    if (box === undefined) continue;
    if (box.confidence < MIN_CONFIDENCE) continue;

    const boxArea = area(box);
    // Strict `>` means that on an exact tie the EARLIER box wins. Deterministic
    // tie-breaking matters: a tie resolved differently each frame would make
    // the gimbal oscillate between two equally-sized athletes.
    if (boxArea > bestArea) {
      bestArea = boxArea;
      bestIndex = i;
    }
  }

  const best = bestIndex >= 0 ? boxes[bestIndex] : undefined;
  if (best === undefined) {
    return { status: 'no-athletes' };
  }

  return { status: 'locked', athlete: best, index: bestIndex };
}
