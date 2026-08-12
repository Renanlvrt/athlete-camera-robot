import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors } from '../theme/colors';
import { computeTrackingReadout } from '../tracking/computeTrackingReadout';
import { selectPrimaryAthlete } from '../tracking/selectPrimaryAthlete';
import type { PersonBox } from '../tracking/types';
import type { DetectionStatus } from '../hooks/useAthleteDetection';
import { mapFrameBoxToViewRect } from './frameLayout';

interface TrackingOverlayProps {
  readonly boxes: readonly PersonBox[];
  readonly frameAspectRatio: number | undefined;
  readonly status: DetectionStatus;
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Bucket a 0..360 bearing into one of 8 compass labels, for a glance-readable direction. */
function compassLabel(angleDegrees: number): string {
  const index = Math.round(angleDegrees / 45) % COMPASS_LABELS.length;
  return COMPASS_LABELS[index] ?? '?';
}

/**
 * TrackingOverlay
 *
 * Single responsibility: given this frame's detections, draw the locked
 * athlete's bounding box and a distance/bearing readout, and signal "centred"
 * with color. Pure rendering over props — per `src/screens/index.md`, all the
 * deciding (which athlete, how far off, whether that counts as centred)
 * happens in `src/tracking/`; this component only maps that decision to pixels.
 *
 * Renders as a sibling overlay on top of `<Camera>`, per
 * `src/screens/index.md`'s "Rule for growing this folder".
 */
export function TrackingOverlay({
  boxes,
  frameAspectRatio,
  status,
}: TrackingOverlayProps): React.ReactElement {
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setViewSize({ width, height });
  };

  const primary = selectPrimaryAthlete(boxes);
  const readout =
    primary.status === 'locked' ? computeTrackingReadout(primary.athlete) : undefined;
  const statusColor = readout?.isCentered ? colors.locked : colors.tracking;

  const boxRect =
    primary.status === 'locked' && frameAspectRatio !== undefined && viewSize.width > 0
      ? mapFrameBoxToViewRect(primary.athlete, frameAspectRatio, viewSize)
      : undefined;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout} pointerEvents="none">
      {boxRect !== undefined && (
        <View
          style={[
            styles.box,
            {
              left: boxRect.x,
              top: boxRect.y,
              width: boxRect.width,
              height: boxRect.height,
              borderColor: statusColor,
            },
          ]}
        >
          <Text style={[styles.confidenceLabel, { backgroundColor: statusColor }]}>
            {Math.round(primary.status === 'locked' ? primary.athlete.confidence * 100 : 0)}%
          </Text>
        </View>
      )}

      <View style={styles.panel}>
        {status === 'loading' && <Text style={styles.hint}>Loading model…</Text>}
        {status === 'error' && <Text style={styles.hint}>Model failed to load.</Text>}
        {status === 'ready' && readout === undefined && (
          <Text style={styles.hint}>No athlete detected.</Text>
        )}
        {status === 'ready' && readout !== undefined && (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {readout.isCentered ? 'CENTERED' : 'TRACKING'}
              </Text>
            </View>
            <Stat label="offset" value={`${Math.round(readout.distance * 100)}%`} />
            <Stat
              label="bearing"
              value={`${Math.round(readout.angleDegrees)}° ${compassLabel(readout.angleDegrees)}`}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
  },
  confidenceLabel: {
    position: 'absolute',
    top: -22,
    left: -3,
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  panel: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.overlayPanel,
  },
  hint: {
    color: colors.text,
    fontSize: 16,
    opacity: 0.7,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  statLabel: { color: colors.text, fontSize: 16, opacity: 0.7, textTransform: 'uppercase' },
  // Tabular figures so numbers don't jitter as they update — read at a
  // glance from a distance (see .claude/agents/ux-reviewer.md).
  statValue: { color: colors.text, fontSize: 20, fontVariant: ['tabular-nums'] },
});
