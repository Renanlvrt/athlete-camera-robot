import { computeGimbalCorrection } from './computeGimbalCorrection';
import type { GimbalTuning, PersonBox } from './types';
import { defaultGimbalTuning } from './types';

/** A box centred on a given point, with a fixed small size. */
function boxAt(centreX: number, centreY: number, size = 0.2): PersonBox {
  return {
    x: centreX - size / 2,
    y: centreY - size / 2,
    width: size,
    height: size,
    confidence: 0.9,
  };
}

/** Generous limits, so tests can observe raw proportional output. */
const loose: GimbalTuning = { gain: 100, deadband: 0, maxStep: 1000 };

describe('computeGimbalCorrection', () => {
  describe('centred subject', () => {
    it('commands no movement when the athlete is dead centre', () => {
      expect(computeGimbalCorrection(boxAt(0.5, 0.5), loose)).toEqual({
        rollDelta: 0,
        pitchDelta: 0,
      });
    });
  });

  describe('sign convention', () => {
    // The most likely bug in this file. A flipped sign makes the gimbal chase
    // the athlete OFF screen instead of following them, and on real hardware
    // that reads as "tracking is broken" rather than "one sign is wrong".
    it('moves positively in roll when the athlete is to the RIGHT', () => {
      expect(computeGimbalCorrection(boxAt(0.8, 0.5), loose).rollDelta).toBeGreaterThan(0);
    });

    it('moves negatively in roll when the athlete is to the LEFT', () => {
      expect(computeGimbalCorrection(boxAt(0.2, 0.5), loose).rollDelta).toBeLessThan(0);
    });

    it('tilts UP (positive pitch) when the athlete is ABOVE centre', () => {
      // y is small = high on screen. Screen y grows downward, pitch grows
      // upward, so this must invert.
      expect(computeGimbalCorrection(boxAt(0.5, 0.2), loose).pitchDelta).toBeGreaterThan(0);
    });

    it('tilts DOWN (negative pitch) when the athlete is BELOW centre', () => {
      expect(computeGimbalCorrection(boxAt(0.5, 0.8), loose).pitchDelta).toBeLessThan(0);
    });
  });

  describe('proportionality', () => {
    it('corrects further for a larger offset', () => {
      const near = computeGimbalCorrection(boxAt(0.6, 0.5), loose).rollDelta;
      const far = computeGimbalCorrection(boxAt(0.9, 0.5), loose).rollDelta;
      expect(far).toBeGreaterThan(near);
    });

    it('scales linearly with gain', () => {
      const target = boxAt(0.75, 0.5);
      const single = computeGimbalCorrection(target, { gain: 10, deadband: 0, maxStep: 1000 });
      const double = computeGimbalCorrection(target, { gain: 20, deadband: 0, maxStep: 1000 });
      expect(double.rollDelta).toBeCloseTo(single.rollDelta * 2, 6);
    });

    it('computes offset from the box CENTRE, not its top-left corner', () => {
      // A box whose left edge sits at centre but whose middle is right of it
      // must produce a positive correction.
      const offset: PersonBox = {
        x: 0.5, y: 0.4, width: 0.2, height: 0.2, confidence: 0.9,
      };
      expect(computeGimbalCorrection(offset, loose).rollDelta).toBeGreaterThan(0);
    });
  });

  describe('deadband', () => {
    it('ignores jitter smaller than the deadband', () => {
      const tuning: GimbalTuning = { gain: 100, deadband: 0.05, maxStep: 1000 };
      // 0.02 off centre — inside the 0.05 deadband.
      const result = computeGimbalCorrection(boxAt(0.52, 0.52), tuning);
      expect(result).toEqual({ rollDelta: 0, pitchDelta: 0 });
    });

    it('acts once the offset clears the deadband', () => {
      const tuning: GimbalTuning = { gain: 100, deadband: 0.05, maxStep: 1000 };
      expect(computeGimbalCorrection(boxAt(0.6, 0.5), tuning).rollDelta).toBeGreaterThan(0);
    });

    it('applies the deadband per-axis, not to both together', () => {
      const tuning: GimbalTuning = { gain: 100, deadband: 0.05, maxStep: 1000 };
      // Well off-centre horizontally, essentially centred vertically.
      const result = computeGimbalCorrection(boxAt(0.9, 0.51), tuning);
      expect(result.rollDelta).toBeGreaterThan(0);
      expect(result.pitchDelta).toBe(0);
    });
  });

  describe('step limiting — brownout mitigation', () => {
    // Not cosmetic. A full-speed multi-servo slam draws peak current and can
    // reset the micro:bit. See research/hardware/power-brownout-risk.md.
    it('never exceeds maxStep however extreme the offset', () => {
      const tuning: GimbalTuning = { gain: 1000, deadband: 0, maxStep: 5 };
      const result = computeGimbalCorrection(boxAt(1.0, 0.0), tuning);
      expect(result.rollDelta).toBeLessThanOrEqual(5);
      expect(result.pitchDelta).toBeLessThanOrEqual(5);
    });

    it('clamps negative directions symmetrically', () => {
      const tuning: GimbalTuning = { gain: 1000, deadband: 0, maxStep: 5 };
      const result = computeGimbalCorrection(boxAt(0.0, 1.0), tuning);
      expect(result.rollDelta).toBeGreaterThanOrEqual(-5);
      expect(result.pitchDelta).toBeGreaterThanOrEqual(-5);
      expect(result.rollDelta).toBe(-5);
      expect(result.pitchDelta).toBe(-5);
    });

    it('holds the cap with the shipped defaults at a worst-case offset', () => {
      const result = computeGimbalCorrection(boxAt(1.0, 1.0), defaultGimbalTuning);
      expect(Math.abs(result.rollDelta)).toBeLessThanOrEqual(defaultGimbalTuning.maxStep);
      expect(Math.abs(result.pitchDelta)).toBeLessThanOrEqual(defaultGimbalTuning.maxStep);
    });
  });

  describe('malformed input', () => {
    // A quantized model can emit NaN. Sending that over BLE would be
    // interpreted as an arbitrary angle by the micro:bit.
    it('returns zero correction for NaN coordinates', () => {
      const bad: PersonBox = {
        x: NaN, y: 0.5, width: 0.2, height: 0.2, confidence: 0.9,
      };
      expect(computeGimbalCorrection(bad, loose)).toEqual({ rollDelta: 0, pitchDelta: 0 });
    });

    it('returns zero correction for Infinity', () => {
      const bad: PersonBox = {
        x: 0.5, y: 0.5, width: Infinity, height: 0.2, confidence: 0.9,
      };
      expect(computeGimbalCorrection(bad, loose)).toEqual({ rollDelta: 0, pitchDelta: 0 });
    });

    it('always returns finite numbers for any finite input', () => {
      for (let cx = 0; cx <= 1; cx += 0.1) {
        for (let cy = 0; cy <= 1; cy += 0.1) {
          const r = computeGimbalCorrection(boxAt(cx, cy), defaultGimbalTuning);
          expect(Number.isFinite(r.rollDelta)).toBe(true);
          expect(Number.isFinite(r.pitchDelta)).toBe(true);
        }
      }
    });
  });

  describe('convergence — the property that actually matters', () => {
    // Simulates the closed loop: does repeatedly applying the correction bring
    // the athlete toward centre, or does it oscillate/diverge? This is the
    // cheapest possible proxy for "will the real gimbal behave sanely", and it
    // runs on Windows with no hardware.
    it('drives a stationary athlete toward centre without overshooting forever', () => {
      const tuning: GimbalTuning = { gain: 30, deadband: 0.02, maxStep: 5 };
      // Camera aim, in normalised units. Athlete fixed at 0.9.
      const athleteAt = 0.9;
      let aim = 0.5;
      let lastDistance = Math.abs(athleteAt - aim);

      for (let step = 0; step < 200; step += 1) {
        // Athlete's apparent position relative to current aim.
        const apparent = 0.5 + (athleteAt - aim);
        const { rollDelta } = computeGimbalCorrection(boxAt(apparent, 0.5), tuning);
        if (rollDelta === 0) break;
        // 1 degree of servo ~= 0.01 normalised frame units (rough stand-in).
        aim += rollDelta * 0.01;
        const distance = Math.abs(athleteAt - aim);
        // Never allow the error to grow — that would be divergence.
        expect(distance).toBeLessThanOrEqual(lastDistance + 1e-9);
        lastDistance = distance;
      }

      expect(Math.abs(athleteAt - aim)).toBeLessThan(0.05);
    });
  });
});
