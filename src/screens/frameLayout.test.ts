import { mapFrameBoxToViewRect } from './frameLayout';
import type { PersonBox } from '../tracking/types';

function box(over: Partial<PersonBox> = {}): PersonBox {
  return { x: 0, y: 0, width: 1, height: 1, confidence: 0.9, ...over };
}

describe('mapFrameBoxToViewRect', () => {
  it('maps the full frame onto the full view when aspect ratios match exactly', () => {
    const result = mapFrameBoxToViewRect(box(), 1, { width: 300, height: 300 });
    expect(result).toEqual({ x: 0, y: 0, width: 300, height: 300 });
  });

  it('crops the wider axis when the view is narrower (portrait view, wider frame)', () => {
    // Frame is a 2:1 landscape rectangle, view is a tall 100x400 portrait strip.
    // 'cover' scales to fill height (400), so the frame renders at 800x400,
    // centred horizontally with (800-100)/2 = 350px cropped off each side.
    const result = mapFrameBoxToViewRect(box(), 2, { width: 100, height: 400 });
    expect(result.x).toBeCloseTo(-350);
    expect(result.y).toBeCloseTo(0);
    expect(result.width).toBeCloseTo(800);
    expect(result.height).toBeCloseTo(400);
  });

  it('crops the taller axis when the view is shorter (landscape view, taller frame)', () => {
    // Frame is a 1:2 portrait rectangle (tall), view is a wide 400x100 strip.
    const result = mapFrameBoxToViewRect(box(), 0.5, { width: 400, height: 100 });
    // scale = max(400/0.5, 100) = max(800, 100) = 800
    // scaledFrameWidth = 0.5*800 = 400, scaledFrameHeight = 800
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo((100 - 800) / 2);
    expect(result.width).toBeCloseTo(400);
    expect(result.height).toBeCloseTo(800);
  });

  it('places a centred small box at the centre of the view', () => {
    const centred = box({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
    const result = mapFrameBoxToViewRect(centred, 1, { width: 200, height: 200 });
    expect(result).toEqual({ x: 80, y: 80, width: 40, height: 40 });
  });

  it('returns a zero rect for a non-positive frame aspect ratio', () => {
    expect(mapFrameBoxToViewRect(box(), 0, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(mapFrameBoxToViewRect(box(), -1, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('returns a zero rect for a zero-sized view (not yet laid out)', () => {
    expect(mapFrameBoxToViewRect(box(), 1, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('returns a zero rect rather than propagating a NaN box', () => {
    const result = mapFrameBoxToViewRect(box({ x: NaN }), 1, { width: 100, height: 100 });
    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
