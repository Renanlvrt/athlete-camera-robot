import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors } from '../theme/colors';
import { computeTrackingReadout } from '../tracking/computeTrackingReadout';
import type { PrimaryAthleteResult } from '../tracking/types';
import type { DetectionStatus } from '../hooks/useAthleteDetection';
import { clampBadgePosition, computeLineStyle, mapFrameBoxToViewRect } from './frameLayout';

interface TrackingOverlayProps {
  /**
   * Which athlete is locked, already decided upstream by
   * `src/hooks/useLockedAthlete.ts` — this component no longer calls
   * `selectPrimaryAthlete` itself (2026-08-16), so it always agrees with
   * whatever `useGimbalControl.ts` is actually sending to the robot instead
   * of possibly picking a different athlete from the same frame's boxes.
   */
  readonly primary: PrimaryAthleteResult;
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
  primary,
  frameAspectRatio,
  status,
}: TrackingOverlayProps): React.ReactElement {
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setViewSize({ width, height });
  };

  const readout =
    primary.status === 'locked' ? computeTrackingReadout(primary.athlete) : undefined;
  const statusColor = readout?.isCentered ? colors.locked : colors.tracking;

  const boxRect =
    primary.status === 'locked' && frameAspectRatio !== undefined && viewSize.width > 0
      ? mapFrameBoxToViewRect(primary.athlete, frameAspectRatio, viewSize)
      : undefined;

  const badgeRect = boxRect !== undefined ? clampBadgePosition(boxRect, viewSize) : undefined;

  // Dashed line from the box's center to the screen's center — a visual
  // "here's the correction vector" cue that's readable at a glance even
  // without reading the numbers, per the operator's own framing: "so that we
  // know this even when filming".
  const centerLine =
    boxRect !== undefined && viewSize.width > 0
      ? computeLineStyle(
          { x: boxRect.x + boxRect.width / 2, y: boxRect.y + boxRect.height / 2 },
          { x: viewSize.width / 2, y: viewSize.height / 2 },
        )
      : undefined;

  // Draw order matters: the panel first, the box (+ badge) LAST, so the box
  // stays visible on top even when it overlaps the panel's screen region —
  // it was previously drawn first and its badge could render invisibly
  // underneath the panel. Found via .claude/skills/webcam-detection-preview/,
  // see docs/VERIFICATION_REPORT.md 2026-08-13.
  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout} pointerEvents="none">
      <View style={styles.panel}>
        {readout !== undefined ? (
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
            <View style={styles.vectorRow}>
              <Text style={styles.vectorText}>
                {readout.offsetY < 0 ? '↑' : '↓'} {Math.round(Math.abs(readout.offsetY) * 100)}%
              </Text>
              <Text style={styles.vectorText}>
                {readout.offsetX < 0 ? '←' : '→'} {Math.round(Math.abs(readout.offsetX) * 100)}%
              </Text>
            </View>
          </>
        ) : status === 'loading' ? (
          <Text style={styles.hint}>Loading model…</Text>
        ) : status === 'error' ? (
          <Text style={styles.hint}>Model failed to load.</Text>
        ) : (
          <Text style={styles.hint}>No athlete detected.</Text>
        )}
      </View>

      {centerLine !== undefined && (
        <View
          style={[
            styles.centerLine,
            {
              left: centerLine.left,
              top: centerLine.top,
              width: centerLine.width,
              borderBottomColor: statusColor,
              transform: [{ rotate: `${centerLine.rotateDeg}deg` }],
            },
          ]}
        />
      )}
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
        />
      )}
      {badgeRect !== undefined && (
        <Text
          style={[
            styles.confidenceLabel,
            { left: badgeRect.left, top: badgeRect.top, backgroundColor: statusColor },
          ]}
        >
          {Math.round(primary.status === 'locked' ? primary.athlete.confidence * 100 : 0)}%
        </Text>
      )}
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
  centerLine: {
    position: 'absolute',
    height: 0,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
  },
  confidenceLabel: {
    position: 'absolute',
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
  // Small/compact by design — this is the up/down + left/right decomposition
  // of the same "offset" stat above, not a headline number.
  vectorRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  vectorText: {
    color: colors.text,
    fontSize: 13,
    opacity: 0.8,
    fontVariant: ['tabular-nums'],
  },
});
