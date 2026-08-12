/**
 * computeTrackingReadout.ts
 *
 * Single responsibility: turn a locked athlete's box into what a HUMAN reads on
 * screen — how far off-centre, which direction, and whether that's "close
 * enough" to call it centred.
 *
 * Deliberately separate from `computeGimbalCorrection.ts`, even though both
 * start from the same offset-from-centre math. That file answers "how many
 * degrees should the servo move" — a control-system question, tuned for the
 * robot (gain, maxStep, brownout safety). This file answers "what should a
 * human see" — a display question, tuned for legibility at a glance. Their
 * threshold constants (CENTER_BUFFER here, `deadband` there) start at similar
 * values by coincidence, not because they must track each other.
 */

import type { PersonBox } from './types';

/** Centre of the frame in normalised coordinates. */
const FRAME_CENTRE = 0.5;

/**
 * How close to centre counts as "locked" for the on-screen indicator.
 * UNVALIDATED — a reasonable-looking starting guess, same status as
 * `defaultGimbalTuning` in `types.ts`. Tune once someone is actually watching
 * the screen and can judge whether "green" fires too early or too late.
 */
export const CENTER_BUFFER = 0.08;

export interface TrackingReadout {
  /** Horizontal offset from centre, roughly -0.5 (left edge) .. 0.5 (right edge). */
  readonly offsetX: number;
  /** Vertical offset from centre, roughly -0.5 (top edge) .. 0.5 (bottom edge). Positive = below centre. */
  readonly offsetY: number;
  /** Straight-line distance from centre, 0 .. ~0.707 (a corner). */
  readonly distance: number;
  /**
   * Compass-style bearing FROM the frame centre TO the athlete, in degrees,
   * 0..360. 0 = straight up, 90 = right, 180 = down, 270 = left. This is
   * "which way the subject has drifted", not the standard maths convention
   * (0 = right, counter-clockwise) — chosen because it reads more naturally
   * next to a camera preview than a maths angle would.
   */
  readonly angleDegrees: number;
  /** True when `distance` is within the buffer of dead centre. */
  readonly isCentered: boolean;
}

/** Wrap `deg` into [0, 360). */
function normalizeDegrees(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Compute the on-screen tracking readout for the currently-locked athlete.
 *
 * Non-finite inputs (NaN/Infinity, which a malformed model output can
 * produce) return a readout with `isCentered: false` rather than propagating
 * garbage — showing "not centred" on bad data is safe; showing a false
 * "locked" green is not.
 *
 * @param athlete The locked athlete, in normalised frame coordinates.
 * @param buffer Distance threshold for `isCentered`. Defaults to `CENTER_BUFFER`.
 */
export function computeTrackingReadout(
  athlete: PersonBox,
  buffer: number = CENTER_BUFFER,
): TrackingReadout {
  const boxCentreX = athlete.x + athlete.width / 2;
  const boxCentreY = athlete.y + athlete.height / 2;

  if (!Number.isFinite(boxCentreX) || !Number.isFinite(boxCentreY)) {
    return { offsetX: 0, offsetY: 0, distance: 0, angleDegrees: 0, isCentered: false };
  }

  const offsetX = boxCentreX - FRAME_CENTRE;
  const offsetY = boxCentreY - FRAME_CENTRE;
  const distance = Math.hypot(offsetX, offsetY);

  // atan2(x, -y): zero radians points up (negative y), rotating toward +x (right)
  // as the angle increases — a compass bearing, not the maths convention.
  const angleDegrees = normalizeDegrees((Math.atan2(offsetX, -offsetY) * 180) / Math.PI);

  return {
    offsetX,
    offsetY,
    distance,
    angleDegrees,
    isCentered: distance <= buffer,
  };
}
