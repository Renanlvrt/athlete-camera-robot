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
 * Pick the primary athlete to track.
 *
 * MVP heuristic: **the largest sufficiently-confident box wins.** Largest is a
 * rough proxy for closest, and closest is usually the subject being filmed.
 *
 * `docs/PRD.md` §4.2 explicitly says to keep this loose for the MVP and lists
 * the better approaches (tap-to-select, appearance re-identification) as
 * FUTURE — do not build those here.
 *
 * Known weakness, accepted for now: with two athletes at similar distance this
 * will flip between them as their boxes fluctuate, making the camera twitch.
 * If that shows up in a field test, the cheapest fix is hysteresis — keep
 * following the current athlete until another is beating it by some margin —
 * which needs state and therefore belongs in the hook, not in this function.
 *
 * @param boxes Every detection from the current frame. May be empty.
 * @returns The locked athlete and its index in `boxes`, or `no-athletes`.
 */
export function selectPrimaryAthlete(boxes: readonly PersonBox[]): PrimaryAthleteResult {
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
