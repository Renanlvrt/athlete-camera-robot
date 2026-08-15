import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import type { BleConnectionState } from '../ble/useBleConnection';

interface BleStatusBadgeProps {
  readonly state: BleConnectionState;
  /** Manually restart the scan/connect cycle — called when the badge is tapped. */
  readonly onRetry: () => void;
}

const LABEL: Record<BleConnectionState['status'], string> = {
  'waiting-for-bluetooth': 'BLE: OFF',
  unauthorized: 'BLE: NOT AUTHORIZED',
  scanning: 'BLE: SCANNING…',
  connecting: 'BLE: CONNECTING…',
  connected: 'BLE: CONNECTED',
  'connection-lost': 'BLE: LOST — RECONNECTING…',
  error: 'BLE: ERROR — TAP TO RETRY',
};

/**
 * BleStatusBadge
 *
 * Single responsibility: show the robot BLE link's current state as a
 * small, always-visible label, and let the user manually restart the
 * connection by tapping it. Pure rendering + one callback prop, same
 * pattern as every other `src/screens/` component — the actual retry
 * mechanism lives in `src/ble/useBleConnection.ts`, this just calls it.
 *
 * TAPPABLE ON PURPOSE (added 2026-08-15, real report): a real device
 * showed `'error'` with no way to recover except relaunching the app.
 * Tapping the badge is always allowed, in every state, not just `'error'`
 * — e.g. tapping while `'connected'` deliberately drops and reconnects,
 * useful if the link feels stuck without having visibly errored.
 *
 * The `'error'` state now also shows the actual error message underneath
 * the status line — `state.error.message` is real diagnostic text from
 * `react-native-ble-plx`/Core Bluetooth, not something this component
 * invents. Previously this just said "BLE: ERROR" with no detail, which
 * made a real failure impossible to diagnose from a report alone.
 *
 * Placed top-left to mirror `CameraControls.tsx`'s facing toggle (top-right)
 * — the two are the "is the robot/camera set up correctly" glance targets,
 * deliberately kept apart from the tracking readout panel.
 */
export function BleStatusBadge({ state, onRetry }: BleStatusBadgeProps): React.ReactElement {
  const errorDetail =
    (state.status === 'error' || state.status === 'connection-lost') && state.error.message
      ? state.error.message
      : undefined;

  return (
    <Pressable style={styles.wrap} onPress={onRetry} hitSlop={12}>
      <Text style={styles.text}>{LABEL[state.status]}</Text>
      {errorDetail !== undefined && (
        <Text style={styles.detailText} numberOfLines={2}>
          {errorDetail}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    left: 16,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.overlayPanel,
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailText: {
    color: colors.text,
    fontSize: 10,
    marginTop: 4,
    opacity: 0.8,
  },
});
