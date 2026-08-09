/**
 * FrameTimingScreen — Stage 1 of the `cv-framerate-test` skill.
 *
 * An isolated screen that runs an EMPTY frame processor and reports whether the
 * camera pipeline is keeping up. No model, no resizing. It measures the
 * plumbing: VisionCamera v5 + worklets + the Windows -> CI -> AltStore path.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS A STAGING TEMPLATE, NOT LIVE APP CODE.
 *
 * It lives under .claude/skills/ and is excluded from tsconfig.json on purpose:
 * it imports `react-native-worklets`, which is not installed yet (see
 * research/computer-vision/frame-processor-stack-v5.md). Type-checking it today
 * would fail the CLAUDE.md section 4 gate for a reason that isn't a real defect.
 *
 * To use: install the worklets packages, copy this into src/screens/, and route
 * to it temporarily from src/App.tsx. Remove the routing afterwards.
 * ---------------------------------------------------------------------------
 *
 * WRITTEN AGAINST THE REAL v5 API, verified by reading the .d.ts files in
 * node_modules on 2026-08-09. VisionCamera v5 is a Nitro rewrite and its API
 * differs completely from v4 -- most tutorials online are v4 and will mislead
 * you:
 *
 *   v4 (wrong)                        v5 (correct)
 *   useFrameProcessor(...)            useFrameOutput({ onFrame })
 *   <Camera frameProcessor={fp} />    <Camera outputs={[frameOutput]} />
 *   react-native-worklets-core        react-native-worklets
 *   NitroModules.box(model)           not needed
 *
 * `useFrameProcessor` does not exist in v5 at all.
 */

import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  type FrameDroppedReason,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-worklets';

import { colors } from '../theme/colors';

/** Report to the JS thread at most this often, to keep work off the hot path. */
const REPORT_INTERVAL_MS = 500;

export type FrameStats = {
  readonly delivered: number;
  readonly dropped: number;
  readonly overBudget: number;
  readonly fps: number;
  readonly elapsedSec: number;
};

const EMPTY_STATS: FrameStats = {
  delivered: 0,
  dropped: 0,
  overBudget: 0,
  fps: 0,
  elapsedSec: 0,
};

export function FrameTimingScreen(): React.ReactElement {
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [stats, setStats] = useState<FrameStats>(EMPTY_STATS);

  // Refs, not state: written on every frame, must never render from the
  // camera thread.
  const delivered = useRef<number>(0);
  const dropped = useRef<number>(0);
  const overBudget = useRef<number>(0);
  const startedAt = useRef<number>(Date.now());
  const lastReportAt = useRef<number>(0);

  const republish = useCallback(() => {
    const now = Date.now();
    if (now - lastReportAt.current < REPORT_INTERVAL_MS) return;
    lastReportAt.current = now;

    const elapsedMs = now - startedAt.current;
    setStats({
      delivered: delivered.current,
      dropped: dropped.current,
      overBudget: overBudget.current,
      fps: elapsedMs > 0 ? (delivered.current * 1000) / elapsedMs : 0,
      elapsedSec: Math.round(elapsedMs / 1000),
    });
  }, []);

  // Counting happens on the JS thread deliberately. `performance.now()` is NOT
  // guaranteed to exist inside a worklet -- the worklet runtime is a separate
  // JS context -- so timing arithmetic in the worklet body is a trap. Counting
  // deliveries against wall-clock on the JS side avoids the question entirely.
  const countFrame = useCallback(() => {
    delivered.current += 1;
    republish();
  }, [republish]);

  // The real over-budget signal, and it's free. VisionCamera reports
  // 'out-of-buffers' precisely when onFrame ran longer than one frame interval.
  // That's a better measure of "too slow" than any timer we could write.
  const countDrop = useCallback(
    (reason: FrameDroppedReason) => {
      dropped.current += 1;
      if (reason === 'out-of-buffers') {
        overBudget.current += 1;
      }
      republish();
    },
    [republish],
  );

  const frameOutput = useFrameOutput({
    // 'rgb' on purpose: TFLite converts YUV->RGB internally anyway, so having
    // the camera pipeline do it is cheaper than doing it ourselves in Stage 2.
    pixelFormat: 'rgb',
    onFrame: (frame) => {
      'worklet';
      // Stage 1 measures the plumbing, so this body stays empty. Stage 2
      // inserts resize + model.runSync() HERE and nowhere else, so the delta
      // against this baseline is attributable to inference alone.
      runOnJS(countFrame)();

      // MANDATORY in v5. Failing to dispose stalls the pipeline and causes
      // the very frame drops this screen is trying to measure.
      frame.dispose();
    },
    onFrameDropped: (reason) => {
      'worklet';
      runOnJS(countDrop)(reason);
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>Camera permission required.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>No back camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]}
      />
      <View style={styles.overlay}>
        <Text style={styles.heading}>Stage 1 — empty processor</Text>
        <Stat label="fps" value={stats.fps.toFixed(1)} />
        <Stat label="dropped" value={String(stats.dropped)} />
        <Stat label="over budget" value={String(stats.overBudget)} />
        <Text style={styles.meta}>
          {stats.delivered} frames · {stats.elapsedSec}s
        </Text>
        <Text style={styles.hint}>
          Run 5+ minutes. Thermal throttling is the point — a cold reading proves nothing.
          "over budget" counts out-of-buffers drops: onFrame took longer than one frame.
        </Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  messageText: { color: colors.text, fontSize: 18 },
  overlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  heading: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statLabel: { color: colors.text, fontSize: 20, opacity: 0.7 },
  // Tabular figures so numbers don't jitter as they update — this is read at a
  // glance from a distance (see .claude/agents/ux-reviewer.md).
  statValue: { color: colors.text, fontSize: 28, fontVariant: ['tabular-nums'] },
  meta: { color: colors.text, fontSize: 14, opacity: 0.6, marginTop: 8 },
  hint: { color: colors.text, fontSize: 12, opacity: 0.5, marginTop: 12 },
});
