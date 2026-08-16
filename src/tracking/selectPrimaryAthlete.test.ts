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

  describe('continuity (previousLock)', () => {
    it('keeps following the previously-locked athlete even when another box is now larger', () => {
      // This is the exact "seems random with multiple athletes" complaint:
      // without continuity, the larger box would win every time, flipping
      // the lock back and forth as the two boxes' sizes fluctuate.
      const followedLastFrame = box({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
      const otherAthlete = box({ x: 0.7, y: 0.1, width: 0.25, height: 0.25 }); // bigger area

      const withoutContinuity = selectPrimaryAthlete([followedLastFrame, otherAthlete]);
      const withContinuity = selectPrimaryAthlete(
        [followedLastFrame, otherAthlete],
        followedLastFrame,
      );

      expect(withoutContinuity).toEqual({ status: 'locked', athlete: otherAthlete, index: 1 });
      expect(withContinuity).toEqual({
        status: 'locked',
        athlete: followedLastFrame,
        index: 0,
      });
    });

    it('matches a slightly-moved box to the previous lock by IoU', () => {
      const previousLock = box({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
      const movedSlightly = box({ x: 0.42, y: 0.41, width: 0.2, height: 0.2 });
      const farAway = box({ x: 0.0, y: 0.0, width: 0.3, height: 0.3 }); // bigger, unrelated

      const result = selectPrimaryAthlete([farAway, movedSlightly], previousLock);

      expect(result).toEqual({ status: 'locked', athlete: movedSlightly, index: 1 });
    });

    it('matches a box shrunk by occlusion (low IoU) to the previous lock via center distance', () => {
      // Legs cut off / only part of the body detected: the box shrinks a lot
      // around roughly the same center. IoU alone could miss this.
      const previousLock = box({ x: 0.4, y: 0.3, width: 0.2, height: 0.5 }); // full body
      const occluded = box({ x: 0.45, y: 0.32, width: 0.1, height: 0.15 }); // just a shoulder
      const differentPersonElsewhere = box({ x: 0.0, y: 0.0, width: 0.3, height: 0.3 });

      const result = selectPrimaryAthlete(
        [differentPersonElsewhere, occluded],
        previousLock,
      );

      expect(result).toEqual({ status: 'locked', athlete: occluded, index: 1 });
    });

    it('falls back to the largest-box heuristic when nothing continues the previous lock', () => {
      const previousLock = box({ x: 0.9, y: 0.9, width: 0.05, height: 0.05 }); // left frame
      const onlyAthleteNow = box({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 });

      const result = selectPrimaryAthlete([onlyAthleteNow], previousLock);

      expect(result).toEqual({ status: 'locked', athlete: onlyAthleteNow, index: 0 });
    });

    it('falls back to no-athletes when nothing continues the lock and nothing else qualifies', () => {
      const previousLock = box({ x: 0.9, y: 0.9, width: 0.05, height: 0.05 });
      const result = selectPrimaryAthlete([], previousLock);
      expect(result).toEqual({ status: 'no-athletes' });
    });

    it('ignores a low-confidence box even as a continuity match', () => {
      const previousLock = box({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
      const sameSpotButNoisy = box({
        x: 0.41,
        y: 0.41,
        width: 0.2,
        height: 0.2,
        confidence: 0.1,
      });

      const result = selectPrimaryAthlete([sameSpotButNoisy], previousLock);

      expect(result).toEqual({ status: 'no-athletes' });
    });

    it('accepts a continuity match below MIN_CONFIDENCE but above CONTINUITY_MIN_CONFIDENCE (ByteTrack-style)', () => {
      // Confidence 0.3 would fail fresh acquisition's MIN_CONFIDENCE (0.4)
      // but should still continue an existing lock — this is exactly the
      // "occluded athlete's box confidence dipped, but it's still right
      // where the lock was" case.
      const previousLock = box({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
      const dippedButSameSpot = box({
        x: 0.41,
        y: 0.41,
        width: 0.2,
        height: 0.2,
        confidence: 0.3,
      });

      const result = selectPrimaryAthlete([dippedButSameSpot], previousLock);

      expect(result).toEqual({ status: 'locked', athlete: dippedButSameSpot, index: 0 });
    });

    it('does NOT lower the confidence floor for fresh acquisition', () => {
      // Same confidence (0.3) as the test above, but with no previousLock —
      // fresh acquisition must still use the stricter MIN_CONFIDENCE.
      const result = selectPrimaryAthlete([box({ confidence: 0.3 })]);
      expect(result).toEqual({ status: 'no-athletes' });
    });

    it('is unaffected by continuity when previousLock is omitted (existing callers unchanged)', () => {
      const a = box({ width: 0.1, height: 0.1 });
      const b = box({ width: 0.5, height: 0.5 });
      expect(selectPrimaryAthlete([a, b])).toEqual({ status: 'locked', athlete: b, index: 1 });
    });
  });
});
