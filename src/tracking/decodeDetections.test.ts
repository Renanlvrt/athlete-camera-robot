import { decodeDetections, MAX_DETECTIONS, PERSON_CLASS_ID } from './decodeDetections';

/**
 * Build synthetic model output tensors, already flattened the way
 * `model.runSync()` would deliver them. Every slot defaults to an empty,
 * zero-score, non-person detection so a test only has to specify the slots
 * it cares about.
 */
function detectionSet(
  entries: Array<{
    slot: number;
    classId: number;
    score: number;
    box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  }>,
): { boxes: number[]; classes: number[]; scores: number[] } {
  const boxes = new Array(MAX_DETECTIONS * 4).fill(0);
  const classes = new Array(MAX_DETECTIONS).fill(-1);
  const scores = new Array(MAX_DETECTIONS).fill(0);

  for (const entry of entries) {
    classes[entry.slot] = entry.classId;
    scores[entry.slot] = entry.score;
    boxes[entry.slot * 4 + 0] = entry.box[0];
    boxes[entry.slot * 4 + 1] = entry.box[1];
    boxes[entry.slot * 4 + 2] = entry.box[2];
    boxes[entry.slot * 4 + 3] = entry.box[3];
  }

  return { boxes, classes, scores };
}

describe('decodeDetections', () => {
  it('returns an empty array when every slot is empty', () => {
    const { boxes, classes, scores } = detectionSet([]);
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('decodes a single confident person into a normalised top-left PersonBox', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.91, box: [0.2, 0.3, 0.6, 0.7] },
    ]);

    const result = decodeDetections(boxes, classes, scores);

    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(0.3);
    expect(result[0]?.y).toBeCloseTo(0.2);
    expect(result[0]?.width).toBeCloseTo(0.4);
    expect(result[0]?.height).toBeCloseTo(0.4);
    expect(result[0]?.confidence).toBe(0.91);
  });

  it('ignores detections of a non-person class', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: 3 /* car, per labelmap.txt */, score: 0.95, box: [0.1, 0.1, 0.5, 0.5] },
    ]);
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('drops a person detection below the score threshold', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.2, box: [0.1, 0.1, 0.5, 0.5] },
    ]);
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('keeps a detection exactly at the score threshold', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.5, box: [0.1, 0.1, 0.5, 0.5] },
    ]);
    expect(decodeDetections(boxes, classes, scores, { minScore: 0.5 })).toHaveLength(1);
  });

  it('respects a custom minScore and personClassId', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: 7, score: 0.6, box: [0.1, 0.1, 0.5, 0.5] },
    ]);
    expect(decodeDetections(boxes, classes, scores, { minScore: 0.9 })).toEqual([]);
    expect(decodeDetections(boxes, classes, scores, { personClassId: 7 })).toHaveLength(1);
  });

  it('decodes multiple simultaneous person detections, preserving slot order', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.0, 0.0, 0.2, 0.2] },
      { slot: 1, classId: PERSON_CLASS_ID, score: 0.8, box: [0.5, 0.5, 0.9, 0.9] },
    ]);

    const result = decodeDetections(boxes, classes, scores);

    expect(result).toHaveLength(2);
    expect(result[0]?.confidence).toBe(0.9);
    expect(result[1]?.confidence).toBe(0.8);
  });

  it('drops a degenerate zero-area box', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.3, 0.3, 0.3, 0.3] },
    ]);
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('drops an inverted box (ymax < ymin) rather than producing a negative size', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.6, 0.6, 0.2, 0.2] },
    ]);
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('drops a NaN box rather than throwing or producing NaN output', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [NaN, 0.1, 0.5, 0.5] },
    ]);
    expect(() => decodeDetections(boxes, classes, scores)).not.toThrow();
    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  it('never reads past MAX_DETECTIONS slots even if the arrays are longer', () => {
    const boxes = new Array((MAX_DETECTIONS + 1) * 4).fill(0);
    const classes = new Array(MAX_DETECTIONS + 1).fill(0);
    const scores = new Array(MAX_DETECTIONS + 1).fill(0);
    // Plant a confident person only in the out-of-range slot.
    classes[MAX_DETECTIONS] = PERSON_CLASS_ID;
    scores[MAX_DETECTIONS] = 0.99;
    boxes[MAX_DETECTIONS * 4] = 0.1;
    boxes[MAX_DETECTIONS * 4 + 1] = 0.1;
    boxes[MAX_DETECTIONS * 4 + 2] = 0.5;
    boxes[MAX_DETECTIONS * 4 + 3] = 0.5;

    expect(decodeDetections(boxes, classes, scores)).toEqual([]);
  });

  describe('isMirrored', () => {
    it('leaves x unchanged when isMirrored is false (default)', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.2, 0.3, 0.6, 0.7] },
      ]);
      const result = decodeDetections(boxes, classes, scores);
      expect(result[0]?.x).toBeCloseTo(0.3);
    });

    it('flips x to the mirrored position when isMirrored is true', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.2, 0.3, 0.6, 0.7] },
      ]);
      // width = 0.7 - 0.3 = 0.4; mirrored x = 1 - 0.3 - 0.4 = 0.3 (symmetric box, unchanged here)
      const result = decodeDetections(boxes, classes, scores, { isMirrored: true });
      expect(result[0]?.x).toBeCloseTo(0.3);
    });

    it('mirrors an asymmetric box to the opposite side of the frame', () => {
      // A box hugging the left edge (x=0, width=0.2) should end up hugging
      // the right edge (x=0.8) once mirrored.
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.4, 0.0, 0.6, 0.2] },
      ]);
      const result = decodeDetections(boxes, classes, scores, { isMirrored: true });
      expect(result[0]?.x).toBeCloseTo(0.8);
      expect(result[0]?.width).toBeCloseTo(0.2);
    });

    it('mirroring twice is not the same as not mirroring — only y is ever left alone', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.4, 0.1, 0.6, 0.3] },
      ]);
      const mirrored = decodeDetections(boxes, classes, scores, { isMirrored: true })[0];
      const notMirrored = decodeDetections(boxes, classes, scores, { isMirrored: false })[0];
      expect(mirrored?.y).toBe(notMirrored?.y);
      expect(mirrored?.x).not.toBe(notMirrored?.x);
    });
  });

  describe('orientation', () => {
    // A box hugging the top-left corner, deliberately asymmetric
    // (width !== height) so a width/height swap bug would be caught.
    const cornerBox: [number, number, number, number] = [0.0, 0.0, 0.5, 0.3]; // [ymin,xmin,ymax,xmax]

    it('leaves the box unchanged for orientation "up" (default)', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      const withDefault = decodeDetections(boxes, classes, scores)[0];
      const withExplicitUp = decodeDetections(boxes, classes, scores, { orientation: 'up' })[0];
      for (const result of [withDefault, withExplicitUp]) {
        expect(result?.x).toBeCloseTo(0);
        expect(result?.y).toBeCloseTo(0);
        expect(result?.width).toBeCloseTo(0.3);
        expect(result?.height).toBeCloseTo(0.5);
      }
    });

    it('rotates 180° for orientation "down" — point reflection, no dimension swap', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      const result = decodeDetections(boxes, classes, scores, { orientation: 'down' })[0];
      expect(result?.x).toBeCloseTo(0.7);
      expect(result?.y).toBeCloseTo(0.5);
      expect(result?.width).toBeCloseTo(0.3);
      expect(result?.height).toBeCloseTo(0.5);
    });

    it('rotates for orientation "right" (EXIF tag 6), swapping width/height', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      const result = decodeDetections(boxes, classes, scores, { orientation: 'right' })[0];
      expect(result?.x).toBeCloseTo(0.5);
      expect(result?.y).toBeCloseTo(0);
      expect(result?.width).toBeCloseTo(0.5);
      expect(result?.height).toBeCloseTo(0.3);
    });

    it('rotates for orientation "left" (EXIF tag 8), swapping width/height', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      const result = decodeDetections(boxes, classes, scores, { orientation: 'left' })[0];
      expect(result?.x).toBeCloseTo(0);
      expect(result?.y).toBeCloseTo(0.7);
      expect(result?.width).toBeCloseTo(0.5);
      expect(result?.height).toBeCloseTo(0.3);
    });

    it('"right" and "left" land the same corner-hugging box on opposite corners', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      const right = decodeDetections(boxes, classes, scores, { orientation: 'right' })[0];
      const left = decodeDetections(boxes, classes, scores, { orientation: 'left' })[0];
      expect(right?.x).not.toBeCloseTo(left?.x ?? NaN);
      expect(right?.y).not.toBeCloseTo(left?.y ?? NaN);
    });

    it('applies rotation before mirroring (composes, does not conflict)', () => {
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: cornerBox },
      ]);
      // Rotate 'right' alone: x=0.5, width=0.5 -> mirrored: x = 1 - 0.5 - 0.5 = 0
      const result = decodeDetections(boxes, classes, scores, {
        orientation: 'right',
        isMirrored: true,
      })[0];
      expect(result?.x).toBeCloseTo(0);
      expect(result?.y).toBeCloseTo(0);
      expect(result?.width).toBeCloseTo(0.5);
      expect(result?.height).toBeCloseTo(0.3);
    });

    it('drops a box that becomes degenerate only after rotation, without throwing', () => {
      // A zero-width raw box stays zero-width under any rotation.
      const { boxes, classes, scores } = detectionSet([
        { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.2, 0.3, 0.2, 0.6] },
      ]);
      expect(() =>
        decodeDetections(boxes, classes, scores, { orientation: 'left' }),
      ).not.toThrow();
      expect(decodeDetections(boxes, classes, scores, { orientation: 'left' })).toEqual([]);
    });
  });

  it('is a pure function — does not mutate its input', () => {
    const { boxes, classes, scores } = detectionSet([
      { slot: 0, classId: PERSON_CLASS_ID, score: 0.9, box: [0.1, 0.1, 0.5, 0.5] },
    ]);
    const boxesSnapshot = [...boxes];
    const classesSnapshot = [...classes];
    const scoresSnapshot = [...scores];

    decodeDetections(boxes, classes, scores);

    expect(boxes).toEqual(boxesSnapshot);
    expect(classes).toEqual(classesSnapshot);
    expect(scores).toEqual(scoresSnapshot);
  });
});
