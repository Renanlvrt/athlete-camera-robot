import { StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import type { BleConnectionState } from '../ble/useBleConnection';

interface BleStatusBadgeProps {
  readonly state: BleConnectionState;
}

const LABEL: Record<BleConnectionState['status'], string> = {
  'waiting-for-bluetooth': 'BLE: OFF',
  unauthorized: 'BLE: NOT AUTHORIZED',
  scanning: 'BLE: SCANNING…',
  connecting: 'BLE: CONNECTING…',
  connected: 'BLE: CONNECTED',
  'connection-lost': 'BLE: LOST — RECONNECTING…',
  error: 'BLE: ERROR',
};

/**
 * BleStatusBadge
 *
 * Single responsibility: show the robot BLE link's current state as a
 * small, always-visible label. Pure rendering over props, same pattern as
 * every other `src/screens/` component — no polling, no BLE logic; that
 * lives in `src/hooks/useGimbalControl.ts` / `src/ble/useBleConnection.ts`.
 *
 * Placed top-left to mirror `CameraControls.tsx`'s facing toggle (top-right)
 * — the two are the "is the robot/camera set up correctly" glance targets,
 * deliberately kept apart from the tracking readout panel.
 */
export function BleStatusBadge({ state }: BleStatusBadgeProps): React.ReactElement {
  return <Text style={styles.text}>{LABEL[state.status]}</Text>;
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    top: 60,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.overlayPanel,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    overflow: 'hidden',
  },
});
