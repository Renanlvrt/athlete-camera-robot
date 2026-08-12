import { CENTER_BUFFER, computeTrackingReadout } from './computeTrackingReadout';
import type { PersonBox } from './types';

/** Build a box with sane defaults, overriding only what a test cares about. */
function box(over: Partial<PersonBox> = {}): PersonBox {
  return { x: 0.4, y: 0.4, width: 0.2, height: 0.2, confidence: 0.9, ...over };
}

describe('computeTrackingReadout', () => {
  describe('dead centre', () => {
    it('reports zero offset and distance for a box exactly on centre', () => {
      const result = computeTrackingReadout(box({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }));
      expect(result.offsetX).toBeCloseTo(0);
      expect(result.offsetY).toBeCloseTo(0);
      expect(result.distance).toBeCloseTo(0);
      expect(result.isCentered).toBe(true);
    });
  });

  describe('bearing convention: 0=up, 90=right, 180=down, 270=left', () => {
    it('points up for an athlete above centre', () => {
      const result = computeTrackingReadout(box({ x: 0.4, y: 0.0, width: 0.2, height: 0.1 }));
      expect(result.angleDegrees).toBeCloseTo(0);
    });

    it('points right for an athlete right of centre', () => {
      const result = computeTrackingReadout(box({ x: 0.8, y: 0.4, width: 0.2, height: 0.2 }));
      expect(result.angleDegrees).toBeCloseTo(90);
    });

    it('points down for an athlete below centre', () => {
      const result = computeTrackingReadout(box({ x: 0.4, y: 0.9, width: 0.2, height: 0.1 }));
      expect(result.angleDegrees).toBeCloseTo(180);
    });

    it('points left for an athlete left of centre', () => {
      const result = computeTrackingReadout(box({ x: 0.0, y: 0.4, width: 0.2, height: 0.2 }));
      expect(result.angleDegrees).toBeCloseTo(270);
    });

    it('always returns a bearing in [0, 360)', () => {
      const result = computeTrackingReadout(box({ x: 0.0, y: 0.4, width: 0.2, height: 0.2 }));
      expect(result.angleDegrees).toBeGreaterThanOrEqual(0);
      expect(result.angleDegrees).toBeLessThan(360);
    });
  });

  describe('centred buffer', () => {
    it('is centred exactly at the buffer boundary', () => {
      // Push the box centre out along +x only, to exactly CENTER_BUFFER distance.
      const result = computeTrackingReadout(
        box({ x: 0.5 + CENTER_BUFFER - 0.1, y: 0.4, width: 0.2, height: 0.2 }),
      );
      expect(result.distance).toBeCloseTo(CENTER_BUFFER);
      expect(result.isCentered).toBe(true);
    });

    it('is not centred just past the buffer boundary', () => {
      const result = computeTrackingReadout(
        box({ x: 0.5 + CENTER_BUFFER + 0.01 - 0.1, y: 0.4, width: 0.2, height: 0.2 }),
      );
      expect(result.isCentered).toBe(false);
    });

    it('accepts a custom buffer', () => {
      const nearCentre = box({ x: 0.42, y: 0.4, width: 0.2, height: 0.2 });
      expect(computeTrackingReadout(nearCentre, 0.5).isCentered).toBe(true);
      expect(computeTrackingReadout(nearCentre, 0.001).isCentered).toBe(false);
    });
  });

  describe('malformed input', () => {
    it('never reports centred for a NaN box, and does not throw', () => {
      const result = computeTrackingReadout(box({ width: NaN }));
      expect(result.isCentered).toBe(false);
      expect(Number.isNaN(result.distance)).toBe(false);
    });

    it('never reports centred for an infinite box', () => {
      const result = computeTrackingReadout(box({ x: Infinity }));
      expect(result.isCentered).toBe(false);
    });
  });

  describe('purity', () => {
    it('does not mutate its input', () => {
      const input = box();
      const snapshot = { ...input };
      computeTrackingReadout(input);
      expect(input).toEqual(snapshot);
    });
  });
});
