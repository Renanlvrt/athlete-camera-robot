/**
 * computeGimbalCorrection.ts
 *
 * Single responsibility: turn "the athlete is off-centre by this much" into
 * "move the servos by this many degrees."
 *
 * Pure function — fully unit-testable on Windows with no hardware. This is
 * deliberate: it is the only part of the control loop that can be proven
 * correct before the robot exists.
 *
 * PROPORTIONAL CONTROL ONLY. `docs/PRD.md` §5.1 is explicit that PID is a
 * future refinement and §6 lists it as a non-goal — the real-world behaviour
 * isn't understood well enough yet to tune a PID meaningfully. Do not add
 * integral or derivative terms here without the user asking.
 */

import type { GimbalCorrection, GimbalTuning, PersonBox } from './types';
import { defaultGimbalTuning } from './types';

/** Centre of the frame in normalised coordinates. */
const FRAME_CENTRE = 0.5;

/** Clamp `value` into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Apply deadband then proportional gain then a step limit, to one axis.
 *
 * Order matters. Deadband first so tiny jitter produces exactly zero rather
 * than a tiny non-zero that still commands a servo write. Step limit last so
 * it caps the final commanded movement regardless of gain.
 */
function correctAxis(offset: number, tuning: GimbalTuning): number {
  if (Math.abs(offset) < tuning.deadband) {
    return 0;
  }
  const proportional = offset * tuning.gain;
  return clamp(proportional, -tuning.maxStep, tuning.maxStep);
}

/**
 * Compute how far to move each gimbal axis to re-centre the athlete.
 *
 * Returns **deltas**, not absolute angles — the phone does not know the true
 * servo position. The micro:bit owns absolute position and applies its own
 * mechanical clamps (which come from `.claude/skills/servo-bounds-test/`).
 *
 * ## Sign convention
 * - Athlete **right** of centre → positive `rollDelta` (pan/rotate toward them).
 * - Athlete **above** centre → positive `pitchDelta` (tilt up).
 *
 * Note the vertical flip: box `y` grows *downward* (top-left origin) while
 * pitch grows *upward*, so the sign is inverted. Getting this wrong makes the
 * gimbal chase the athlete off-screen instead of following them, and it is the
 * single most likely bug in this file — hence the explicit test for it.
 *
 * ## Safety
 * `maxStep` caps per-update movement. This is a brownout mitigation, not just
 * smoothing: full-speed multi-servo slams draw peak current and can reset the
 * micro:bit mid-track. See `research/hardware/power-brownout-risk.md`.
 *
 * Non-finite inputs (NaN/Infinity, which a malformed model output can produce)
 * return a zero correction rather than propagating garbage to the servos.
 *
 * @param athlete The locked athlete, in normalised frame coordinates.
 * @param tuning Gain, deadband, and step limit. Defaults are conservative and
 *   **unvalidated on real hardware**.
 */
export function computeGimbalCorrection(
  athlete: PersonBox,
  tuning: GimbalTuning = defaultGimbalTuning,
): GimbalCorrection {
  const centreX = athlete.x + athlete.width / 2;
  const centreY = athlete.y + athlete.height / 2;

  // Refuse to act on garbage. A NaN reaching the servos is worse than not
  // moving: it would be sent over BLE and interpreted as some arbitrary angle.
  if (!Number.isFinite(centreX) || !Number.isFinite(centreY)) {
    return { rollDelta: 0, pitchDelta: 0 };
  }

  const offsetX = centreX - FRAME_CENTRE;
  // Inverted: screen y grows downward, pitch grows upward.
  const offsetY = FRAME_CENTRE - centreY;

  return {
    rollDelta: correctAxis(offsetX, tuning),
    pitchDelta: correctAxis(offsetY, tuning),
  };
}
