/**
 * FrameTimingScreen — Stage 1 of the `cv-framerate-test` skill.
 *
 * An isolated screen that runs an EMPTY frame processor and reports how long
 * each frame takes. No model, no resizing. It measures the plumbing:
 * VisionCamera v5 + worklets + the Windows -> CI -> AltStore -> device path.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS A STAGING TEMPLATE, NOT LIVE APP CODE.
 *
 * It lives under .claude/skills/ and is excluded from tsconfig.json on purpose:
 * it imports `react-native-worklets` and `react-native-vision-camera-worklets`,
 * which are NOT yet installed (see
 * research/computer-vision/frame-processor-stack-v5.md). Type-checking it today
 * would fail the CLAUDE.md section 4 gate for a reason that isn't a real defect.
 *
 * To use: install those packages, copy this into src/screens/, and route to it
 * temporarily from src/App.tsx. Remove the routing afterwards -- CLAUDE.md
 * section 2 forbids leaving old approaches lying around in the working tree.
 * ---------------------------------------------------------------------------
 *
 * Stage 2 (adding the TFLite model) is described in SKILL.md. Keep this file as
 * the empty-processor baseline so the delta is attributable to inference.
 */

import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useFrameProcessor } from 'react-native-vision-camera-worklets';
import { runOnJS } from 'react-native-worklets';

import { colors } from '../theme/colors';

/** How many recent frame durations to keep for the rolling statistics. */
const WINDOW_SIZE = 300;

/** Report to the JS thread at most this often, to keep reporting off the hot path. */
const REPORT_INTERVAL_MS = 500;

export type FrameStats = {
  readonly frames: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  readonly elapsedSec: number;
};

const EMPTY_STATS: FrameStats = {
  frames: 0,
  medianMs: 0,
  p95Ms: 0,
  worstMs: 0,
  elapsedSec: 0,
};

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 0;
}

export function FrameTimingScreen(): React.ReactElement {
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [stats, setStats] = useState<FrameStats>(EMPTY_STATS);

  // Kept in refs, not state: these are written on every frame and must never
  // trigger a React render from the camera thread.
  const durations = useRef<number[]>([]);
  const totalFrames = useRef<number>(0);
  const startedAt = useRef<number>(Date.now());
  const lastReportAt = useRef<number>(0);

  const publish = useCallback((durationMs: number) => {
    totalFrames.current += 1;

    const window = durations.current;
    window.push(durationMs);
    if (window.length > WINDOW_SIZE) {
      window.shift();
    }

    const now = Date.now();
    if (now - lastReportAt.current < REPORT_INTERVAL_MS) {
      return;
    }
    lastReportAt.current = now;

    const sorted = [...window].sort((a, b) => a - b);
    setStats({
      frames: totalFrames.current,
      medianMs: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      worstMs: sorted[sorted.length - 1] ?? 0,
      elapsedSec: Math.round((now - startedAt.current) / 1000),
    });
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const began = performance.now();

      // Stage 1 measures the plumbing, so this body stays empty on purpose.
      // Stage 2 inserts resize + model.runSync() HERE and nowhere else, so the
      // delta against this baseline is attributable to inference alone.
      //
      // Touch the frame so the call isn't optimized away entirely.
      const _ = frame.width;

      runOnJS(publish)(performance.now() - began);
    },
    [publish],
  );

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
        frameProcessor={frameProcessor}
      />
      <View style={styles.overlay}>
        <Text style={styles.heading}>Stage 1 — empty processor</Text>
        <Stat label="median" value={stats.medianMs} />
        <Stat label="p95" value={stats.p95Ms} />
        <Stat label="worst" value={stats.worstMs} />
        <Text style={styles.meta}>
          {stats.frames} frames · {stats.elapsedSec}s
        </Text>
        <Text style={styles.hint}>
          Run 5+ minutes. Thermal throttling is the point — a cold reading proves nothing.
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toFixed(1)} ms</Text>
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
  // Tabular figures so the numbers don't jitter as they update — this is read
  // at a glance from a distance (see .claude/agents/ux-reviewer.md).
  statValue: { color: colors.text, fontSize: 28, fontVariant: ['tabular-nums'] },
  meta: { color: colors.text, fontSize: 14, opacity: 0.6, marginTop: 8 },
  hint: { color: colors.text, fontSize: 12, opacity: 0.5, marginTop: 12 },
});
