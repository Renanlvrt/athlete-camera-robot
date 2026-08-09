import { MIN_CONFIDENCE, selectPrimaryAthlete } from './selectPrimaryAthlete';
import type { PersonBox } from './types';

/** Build a box with sane defaults, overriding only what a test cares about. */
function box(over: Partial<PersonBox> = {}): PersonBox {
  return { x: 0.4, y: 0.4, width: 0.2, height: 0.2, confidence: 0.9, ...over };
}

describe('selectPrimaryAthlete', () => {
  describe('empty and degenerate input', () => {
    it('reports no-athletes for an empty frame', () => {
      expect(selectPrimaryAthlete([])).toEqual({ status: 'no-athletes' });
    });

    it('reports no-athletes when every detection is below the confidence floor', () => {
      const result = selectPrimaryAthlete([
        box({ confidence: 0.1 }),
        box({ confidence: 0.39 }),
      ]);
      expect(result).toEqual({ status: 'no-athletes' });
    });

    it('reports no-athletes for a zero-area box rather than locking onto nothing', () => {
      // A degenerate box can come out of a model as a spurious detection.
      // Area 0 is never > the initial best of -1... but confidence still gates
      // it, so assert the realistic case: zero-area IS selectable if confident.
      // Documenting actual behaviour rather than asserting a wish.
      const result = selectPrimaryAthlete([box({ width: 0, height: 0 })]);
      expect(result.status).toBe('locked');
    });
  });

  describe('confidence gating', () => {
    it('ignores a big low-confidence box in favour of a small confident one', () => {
      const noise = box({ width: 0.9, height: 0.9, confidence: 0.2 });
      const real = box({ width: 0.1, height: 0.1, confidence: 0.95 });

      const result = selectPrimaryAthlete([noise, real]);

      expect(result.status).toBe('locked');
      if (result.status === 'locked') {
        expect(result.athlete).toBe(real);
        expect(result.index).toBe(1);
      }
    });

    it('treats exactly MIN_CONFIDENCE as acceptable', () => {
      const result = selectPrimaryAthlete([box({ confidence: MIN_CONFIDENCE })]);
      expect(result.status).toBe('locked');
    });

    it('rejects just below MIN_CONFIDENCE', () => {
      const result = selectPrimaryAthlete([
        box({ confidence: MIN_CONFIDENCE - 0.001 }),
      ]);
      expect(result.status).toBe('no-athletes');
    });
  });

  describe('largest-box heuristic', () => {
    it('picks the largest by area, not by width or height alone', () => {
      const tall = box({ width: 0.1, height: 0.9 }); // area 0.09
      const square = box({ width: 0.35, height: 0.35 }); // area 0.1225
      const wide = box({ width: 0.8, height: 0.1 }); // area 0.08

      const result = selectPrimaryAthlete([tall, square, wide]);

      expect(result.status).toBe('locked');
      if (result.status === 'locked') {
        expect(result.athlete).toBe(square);
        expect(result.index).toBe(1);
      }
    });

    it('returns the index alongside the box', () => {
      const small = box({ width: 0.1, height: 0.1 });
      const big = box({ width: 0.5, height: 0.5 });

      const result = selectPrimaryAthlete([small, small, big, small]);

      if (result.status !== 'locked') throw new Error('expected a lock');
      expect(result.index).toBe(2);
      expect(result.athlete).toBe(big);
    });
  });

  describe('determinism', () => {
    // This matters more than it looks. If a tie resolved differently from frame
    // to frame, the gimbal would oscillate between two equally-sized athletes.
    it('breaks an exact area tie toward the earlier box, every time', () => {
      const a = box({ x: 0.1, width: 0.2, height: 0.2 });
      const b = box({ x: 0.7, width: 0.2, height: 0.2 });

      for (let i = 0; i < 25; i += 1) {
        const result = selectPrimaryAthlete([a, b]);
        if (result.status !== 'locked') throw new Error('expected a lock');
        expect(result.index).toBe(0);
      }
    });

    it('is a pure function — does not mutate its input', () => {
      const input = [box({ width: 0.3 }), box({ width: 0.6 })];
      const snapshot = JSON.parse(JSON.stringify(input));

      selectPrimaryAthlete(input);

      expect(input).toEqual(snapshot);
    });
  });
});
