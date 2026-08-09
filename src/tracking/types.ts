/**
 * types.ts
 *
 * Single responsibility: the shared vocabulary of the tracking pipeline.
 * Pure types only — no logic, no imports from React or any native module.
 *
 * Keeping these free of native imports is what lets every function in this
 * folder be unit-tested on Windows with no device attached. That is the whole
 * reason the tracking maths lives here rather than inside a hook.
 */

/**
 * A detected person, in NORMALISED frame coordinates.
 *
 * Normalised (0..1) rather than pixels on purpose: the model input resolution,
 * the camera resolution, and the preview resolution are all different and all
 * subject to change. Anything downstream that reasons in pixels would silently
 * break when one of them does.
 *
 * Origin is top-left, matching how both VisionCamera and the TFLite detection
 * outputs report boxes.
 */
export interface PersonBox {
  /** Left edge, 0..1 from the left of the frame. */
  readonly x: number;
  /** Top edge, 0..1 from the top of the frame. */
  readonly y: number;
  /** Width as a fraction of frame width, 0..1. */
  readonly width: number;
  /** Height as a fraction of frame height, 0..1. */
  readonly height: number;
  /** Model confidence, 0..1. */
  readonly confidence: number;
}

/**
 * Where the gimbal should move, as a DELTA from its current position.
 *
 * Deltas, not absolute angles, because the phone does not know the true servo
 * position — it only knows which way the subject drifted. The micro:bit owns
 * absolute position and applies these increments against its own clamps.
 */
export interface GimbalCorrection {
  /** Degrees to change the roll axis by. Positive = clockwise from the camera's view. */
  readonly rollDelta: number;
  /** Degrees to change the pitch axis by. Positive = tilt up. */
  readonly pitchDelta: number;
}

/**
 * Result of asking "who should we be filming?".
 *
 * A discriminated union rather than `PersonBox | null` so callers are forced to
 * handle the empty case explicitly — `CLAUDE.md` §3.5, no silent failure.
 */
export type PrimaryAthleteResult =
  | { readonly status: 'locked'; readonly athlete: PersonBox; readonly index: number }
  | { readonly status: 'no-athletes' };

/** Tuning constants for the proportional controller. */
export interface GimbalTuning {
  /**
   * Degrees of correction per 1.0 of normalised offset. Higher = more
   * aggressive tracking, and more likely to oscillate.
   */
  readonly gain: number;
  /**
   * Offsets smaller than this are treated as zero. Without a deadband the
   * gimbal jitters continuously around centre, chasing detection noise —
   * which wastes servo life and looks bad on camera.
   */
  readonly deadband: number;
  /**
   * Maximum degrees per update, per axis. This is a BROWNOUT MITIGATION, not
   * just a smoothing nicety: a full-speed slam draws peak current and can
   * reset the micro:bit. See research/hardware/power-brownout-risk.md.
   */
  readonly maxStep: number;
}

/**
 * Defaults. Deliberately conservative — under-shooting looks like slightly lazy
 * tracking, over-shooting looks like a broken robot and risks a brownout.
 *
 * UNVALIDATED against real hardware. These are starting points to be tuned
 * during the first field test, not measured values.
 */
export const defaultGimbalTuning: GimbalTuning = {
  gain: 30,
  deadband: 0.05,
  maxStep: 5,
};
