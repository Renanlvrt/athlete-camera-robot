import { clampBadgePosition, computeLineStyle, mapFrameBoxToViewRect } from './frameLayout';
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

describe('clampBadgePosition', () => {
  const view = { width: 400, height: 800 };

  it('sits just inside a box that is fully within the view', () => {
    const result = clampBadgePosition({ x: 100, y: 100, width: 50, height: 50 }, view);
    expect(result.left).toBe(100);
    expect(result.top).toBe(106); // box.y + BADGE_INSET
  });

  it('clamps left to 0 for a box extending past the left edge', () => {
    const result = clampBadgePosition({ x: -300, y: 100, width: 50, height: 50 }, view);
    expect(result.left).toBe(0);
  });

  it('clamps left so the badge never extends past the right edge', () => {
    const result = clampBadgePosition({ x: 390, y: 100, width: 50, height: 50 }, view);
    expect(result.left).toBeLessThanOrEqual(view.width - 50);
  });

  it('clamps top to stay on-screen for a box above the frame (never negative)', () => {
    const result = clampBadgePosition({ x: 100, y: -500, width: 50, height: 50 }, view);
    expect(result.top).toBeGreaterThanOrEqual(0);
  });

  it('clamps top so the badge never extends past the bottom edge', () => {
    const result = clampBadgePosition({ x: 100, y: 790, width: 50, height: 50 }, view);
    expect(result.top).toBeLessThanOrEqual(view.height - 24);
  });

  it('returns the origin for a zero-sized view (not yet laid out)', () => {
    expect(clampBadgePosition({ x: 100, y: 100, width: 50, height: 50 }, { width: 0, height: 0 })).toEqual({
      left: 0,
      top: 0,
    });
  });
});

describe('computeLineStyle', () => {
  it('produces a zero-length line for two identical points', () => {
    const result = computeLineStyle({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(result.width).toBe(0);
    expect(result.left).toBe(50);
    expect(result.top).toBe(50);
  });

  it('computes the correct length for a horizontal line', () => {
    const result = computeLineStyle({ x: 0, y: 100 }, { x: 200, y: 100 });
    expect(result.width).toBeCloseTo(200);
    expect(result.rotateDeg).toBeCloseTo(0);
    expect(result.left).toBeCloseTo(0); // mid (100) - width/2 (100)
    expect(result.top).toBeCloseTo(100);
  });

  it('computes the correct length and angle for a vertical line', () => {
    const result = computeLineStyle({ x: 50, y: 0 }, { x: 50, y: 200 });
    expect(result.width).toBeCloseTo(200);
    expect(result.rotateDeg).toBeCloseTo(90);
  });

  it('rotating the computed segment around its own center reproduces both original endpoints', () => {
    // The actual geometric guarantee computeLineStyle relies on: take the
    // returned {left, top, width}, treat it as a horizontal segment from
    // (left, top) to (left+width, top), rotate every point around the
    // segment's OWN center by rotateDeg, and the two ends must land back on
    // the original `from`/`to` — this is exactly how RN's default
    // (center-origin) rotation renders it.
    const from = { x: 30, y: 400 };
    const to = { x: 320, y: 120 };
    const line = computeLineStyle(from, to);

    const centerX = line.left + line.width / 2;
    const centerY = line.top;
    const rad = (line.rotateDeg * Math.PI) / 180;

    function rotateAroundCenter(px: number, py: number): { x: number; y: number } {
      const dx = px - centerX;
      const dy = py - centerY;
      return {
        x: centerX + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: centerY + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    const endA = rotateAroundCenter(line.left, line.top);
    const endB = rotateAroundCenter(line.left + line.width, line.top);

    // The two rotated endpoints must match {from, to}, in either order.
    const matchesFrom = (p: { x: number; y: number }) =>
      Math.abs(p.x - from.x) < 0.01 && Math.abs(p.y - from.y) < 0.01;
    const matchesTo = (p: { x: number; y: number }) =>
      Math.abs(p.x - to.x) < 0.01 && Math.abs(p.y - to.y) < 0.01;

    expect((matchesFrom(endA) && matchesTo(endB)) || (matchesFrom(endB) && matchesTo(endA))).toBe(
      true,
    );
  });
});
