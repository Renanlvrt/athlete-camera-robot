import { StyleSheet, Text, View } from 'react-native';
import type { CameraPosition } from 'react-native-vision-camera';

import type { BufferOrientation } from '../tracking/decodeDetections';

interface DebugReadoutProps {
  readonly cameraPosition: CameraPosition;
  readonly rawOrientation: BufferOrientation | undefined;
  readonly isMirrored: boolean;
  readonly boxCount: number;
  readonly frameAspectRatio: number | undefined;
}

/**
 * DebugReadout
 *
 * TEMPORARY diagnostic overlay, added 2026-08-16 — DELETE this file and its
 * one call site in `CameraPreviewScreen.tsx` once `orientBox`'s rotation math
 * (`src/tracking/decodeDetections.ts`) is confirmed correct on real hardware
 * for BOTH cameras.
 *
 * Why this exists: two rounds of orientation-rotation fixes each looked
 * correct on paper (unit tests passing, careful EXIF-spec-derived math) and
 * were STILL wrong on the real device — see `docs/VERIFICATION_REPORT.md`'s
 * 2026-08-14 and 2026-08-16 entries. A third blind re-derivation isn't
 * warranted; this surfaces the actual raw values that math depends on
 * (`Frame.orientation`, which camera, whether mirroring is applied, how many
 * boxes survived `decodeDetections`' degenerate-box filter, and the aspect
 * ratio `frameLayout.ts` is using) so the next real-device report is
 * measured data, not another guess.
 *
 * Kept as its own component rather than folded into `TrackingOverlay.tsx` so
 * it's obvious at a glance what's temporary/diagnostic vs. permanent UI, and
 * trivial to remove later without touching the real overlay's logic.
 */
export function DebugReadout({
  cameraPosition,
  rawOrientation,
  isMirrored,
  boxCount,
  frameAspectRatio,
}: DebugReadoutProps): React.ReactElement {
  const arText = frameAspectRatio !== undefined ? frameAspectRatio.toFixed(2) : '?';
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>
        {`DEBUG cam=${cameraPosition} orient=${rawOrientation ?? '?'} mirrored=${isMirrored ? 'Y' : 'N'} boxes=${boxCount} ar=${arText}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // 150, not a rounder-looking 110/120: CameraControls.tsx's record button
    // cluster (status text + 72px button, anchored at its OWN bottom: 40)
    // extends up to roughly bottom: 136 — this needs to clear that with
    // margin, not just avoid an exact collision.
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  text: {
    color: '#00ff00',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
