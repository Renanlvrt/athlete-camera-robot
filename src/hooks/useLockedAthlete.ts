import { useRef } from 'react';

import { selectPrimaryAthlete } from '../tracking/selectPrimaryAthlete';
import type { PersonBox, PrimaryAthleteResult } from '../tracking/types';

/**
 * useLockedAthlete
 *
 * Single responsibility: own the ONE piece of state `selectPrimaryAthlete.ts`
 * deliberately doesn't — which athlete was locked last frame, and how long
 * ago that was — so both `TrackingOverlay.tsx` (what to draw) and
 * `useGimbalControl.ts` (what to send) agree on the same lock instead of each
 * calling `selectPrimaryAthlete` independently and potentially disagreeing.
 * Previously they did exactly that independently, which combined with the
 * pure function's old no-memory "largest wins every frame" heuristic is what
 * produced the reported "seems all random" multi-athlete behaviour.
 *
 * Two things this hook adds on top of the pure `selectPrimaryAthlete`:
 * 1. Remembers the last-locked box across renders (a ref, not `useState` —
 *    this hook's return value already changes whenever `boxes` does, so
 *    there is no need to also trigger a render from writing the memory).
 * 2. A short GRACE PERIOD: if the athlete can't be matched to anything this
 *    frame (fully occluded for a moment, briefly out of frame), keep the
 *    memory of where they were for up to `LOCK_MEMORY_MS` before giving up,
 *    so that when detection resumes, continuity-matching in
 *    `selectPrimaryAthlete` can still find the SAME person rather than
 *    handing the lock to whoever else happens to be biggest that frame. This
 *    hook still honestly reports `'no-athletes'` during the gap itself (it
 *    does not fabricate a box) — only the memory used for re-matching persists.
 *
 * UNVERIFIED ON HARDWARE, same caveat as `useGimbalControl.ts`: this is
 * `Date.now()`-driven glue with no dedicated unit test (the matching logic it
 * calls is already covered in `src/tracking/selectPrimaryAthlete.test.ts`).
 * `LOCK_MEMORY_MS` is a starting guess, not a measured value — tune from a
 * real field test if occlusion gaps longer than this still cause hand-offs.
 */

/**
 * How long to keep offering the last-known lock position for continuity
 * matching after a frame with no match, before treating the athlete as
 * genuinely gone and falling back to fresh (largest-box) acquisition.
 */
const LOCK_MEMORY_MS = 1000;

export function useLockedAthlete(boxes: readonly PersonBox[]): PrimaryAthleteResult {
  const previousLockRef = useRef<PersonBox | undefined>(undefined);
  const lastLockedAtRef = useRef<number>(0);

  const result = selectPrimaryAthlete(boxes, previousLockRef.current);
  const now = Date.now();

  if (result.status === 'locked') {
    previousLockRef.current = result.athlete;
    lastLockedAtRef.current = now;
  } else if (now - lastLockedAtRef.current > LOCK_MEMORY_MS) {
    // Genuinely gone (or nothing has ever been locked) — stop trying to
    // match a stale position. The next detection re-acquires fresh.
    previousLockRef.current = undefined;
  }
  // else: within the grace window — leave previousLockRef as-is so the next
  // frame's detections still get a chance to continuity-match against it.

  return result;
}
