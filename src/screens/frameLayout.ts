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
 * KNOWN SIMPLIFICATION, not yet proven on hardware: this assumes the frame's
 * reported `width`/`height` already match the preview's visual orientation
 * (VisionCamera `Frame.orientation === 'up'`), which is the common case for a
 * portrait-locked app (see `app.json`'s `"orientation": "portrait"`). If
 * on-device the overlay box appears rotated 90° from the person it's
 * supposedly tracking, this is the first thing to check — see
 * `src/hooks/useAthleteDetection.ts`.
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
