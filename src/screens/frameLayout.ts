/**
 * frameLayout.ts
 *
 * Single responsibility: map a detection box from CAMERA FRAME coordinates
 * (normalised 0..1, origin top-left of the full sensor frame — see
 * `src/tracking/types.ts`) into VIEW coordinates (pixels, origin top-left of
 * the on-screen preview `View`) — the one piece of geometry every overlay in
 * this folder needs and none of `src/tracking/` should own (that folder's
 * own `index.md` explicitly disclaims "drawing anything").
 *
 * Why this is needed at all: `<Camera>` renders with its default `resizeMode`
 * of `'cover'` (fill the view, centre-crop the longer axis) whenever the
 * frame's aspect ratio doesn't match the view's. A detection box computed
 * against the FULL frame therefore does not line up with the CROPPED preview
 * unless this transform is applied — this is the standard "CSS object-fit:
 * cover" mapping, inverted.
 *
 * KNOWN SIMPLIFICATION, not yet proven on hardware: `src/hooks/useAthleteDetection.ts`
 * corrects the ASPECT RATIO passed in here for a 90°-rotated frame
 * (`Frame.orientation === 'left'/'right'`), but the detection box's own
 * (x, y) coordinates from `decodeDetections.ts` are NOT rotated to match —
 * they're still in the raw sensor buffer's coordinate space. If on-device
 * the box is reasonably sized but positioned wrong (not just "too big"),
 * this un-rotated-coordinates gap is the first thing to check — see
 * `src/hooks/useAthleteDetection.ts`'s `publishFrameSize`.
 */

import type { PersonBox } from '../tracking/types';

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

/** A rectangle in view pixels. */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Map a normalised frame-space box onto the pixel rectangle it occupies in a
 * `'cover'`-fitted preview `View`.
 *
 * @param box A detection box, normalised 0..1 in full-frame coordinates.
 * @param frameAspectRatio The camera frame's width/height. Must be > 0.
 * @param view The preview `View`'s measured size, in pixels. Must be > 0 on both axes.
 * @returns A zeroed rect if any input is non-finite or non-positive, rather
 *   than propagating NaN into a native layout call.
 */
export function mapFrameBoxToViewRect(
  box: PersonBox,
  frameAspectRatio: number,
  view: ViewSize,
): ViewRect {
  if (
    !(frameAspectRatio > 0) ||
    !(view.width > 0) ||
    !(view.height > 0) ||
    !Number.isFinite(box.x) ||
    !Number.isFinite(box.y) ||
    !Number.isFinite(box.width) ||
    !Number.isFinite(box.height)
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Treat the frame as an `frameAspectRatio` x `1` rectangle — only the
  // ratio matters for a 'cover' fit, not the actual pixel dimensions.
  const scale = Math.max(view.width / frameAspectRatio, view.height);
  const scaledFrameWidth = frameAspectRatio * scale;
  const scaledFrameHeight = scale;
  const offsetX = (view.width - scaledFrameWidth) / 2;
  const offsetY = (view.height - scaledFrameHeight) / 2;

  return {
    x: offsetX + box.x * scaledFrameWidth,
    y: offsetY + box.y * scaledFrameHeight,
    width: box.width * scaledFrameWidth,
    height: box.height * scaledFrameHeight,
  };
}

/** A point in view pixels. */
export interface ViewPoint {
  readonly left: number;
  readonly top: number;
}

/** Assumed on-screen footprint of the confidence badge, for clamping. */
const BADGE_WIDTH = 50;
const BADGE_HEIGHT = 24;
const BADGE_INSET = 6;

/**
 * Where to draw the box's confidence badge, clamped to stay fully on-screen.
 *
 * A box computed by `mapFrameBoxToViewRect` can legitimately extend past the
 * view's edges (a subject close to the camera, or near a frame boundary) —
 * without clamping, a badge positioned relative to the box's raw top-left
 * corner can end up at a negative or off-canvas coordinate, invisible.
 * Found via `.claude/skills/webcam-detection-preview/` — see
 * `docs/VERIFICATION_REPORT.md`, 2026-08-13.
 *
 * @returns A zeroed point if `view` is not yet laid out (non-positive).
 */
export function clampBadgePosition(box: ViewRect, view: ViewSize): ViewPoint {
  if (!(view.width > 0) || !(view.height > 0)) {
    return { left: 0, top: 0 };
  }
  return {
    left: Math.max(0, Math.min(box.x, view.width - BADGE_WIDTH)),
    top: Math.max(BADGE_INSET, Math.min(box.y + BADGE_INSET, view.height - BADGE_HEIGHT)),
  };
}

/** A point in view pixels, for line-geometry math (as opposed to `ViewPoint`, which names its
 * fields `left`/`top` to drop straight into a style object). */
export interface CenterPoint {
  readonly x: number;
  readonly y: number;
}

/** The absolute style props needed to render a straight `View`-based line between two points. */
export interface LineStyle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Degrees, for a `transform: [{ rotate: '${rotateDeg}deg' }]`. */
  readonly rotateDeg: number;
}

/**
 * Compute the position/length/rotation for a `View` styled as a thin
 * horizontal line (e.g. `{ height: 0, borderBottomWidth: N }`) that, once
 * rotated, spans exactly from `from` to `to`.
 *
 * Relies on RN's default rotation behaviour (around the element's own
 * center) rather than `transformOrigin`, which isn't reliably supported
 * everywhere: a horizontal segment of length `distance`, centred on the
 * midpoint of `from`/`to` and rotated by the angle between them, has
 * endpoints at exactly `from` and `to` — ordinary rotation geometry, not an
 * approximation.
 */
export function computeLineStyle(from: CenterPoint, to: CenterPoint): LineStyle {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const rotateDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    left: midX - distance / 2,
    top: midY,
    width: distance,
    rotateDeg,
  };
}
