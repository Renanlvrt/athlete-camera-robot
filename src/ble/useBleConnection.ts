import { useCallback, useEffect, useRef, useState } from 'react';
import { BleManager, State, type BleError, type Device, type Subscription } from 'react-native-ble-plx';

import type { GimbalCorrection } from '../tracking/types';
import { encodeGimbalPacket } from './encodeGimbalPacket';
import { bytesToBase64 } from './base64';

/**
 * useBleConnection
 *
 * Single responsibility: own the BLE transport to the robot's micro:bit —
 * scan, connect, discover services, and expose one `send(correction)` call.
 * Does NOT decide when to send or at what rate; that's the caller's job
 * (see the future control-loop hook that wires this to
 * `computeGimbalCorrection.ts`) — PRD §7 requires rate-limiting to 10-20Hz,
 * never per-frame, and that scheduling logic doesn't belong in a transport
 * hook.
 *
 * WRITTEN AGAINST THE REAL API — every method/type used here is confirmed
 * directly in `node_modules/react-native-ble-plx/src/index.d.ts`
 * (`CLAUDE.md` §4.1), matching `research/hardware/ble-plx-app-side-implementation.md`'s
 * researched shape.
 *
 * Nordic UART service: the path of least resistance for a first working
 * link (`research/hardware/microbit-ble-link.md`) — easy to debug on the
 * micro:bit side, optimize only if `ble-ping` measurements say to.
 *
 * CHARACTERISTIC UUIDS ARE SWAPPED FROM THE "STANDARD" CONVENTION — CONFIRMED
 * ON REAL HARDWARE, 2026-08-15. Dumping the actual GATT table off a
 * MakeCode-flashed micro:bit (via `.claude/skills/ble-ping/scripts/bench_ping.py`,
 * which passed 20/20 real pings) showed `6e400002` has `indicate` (not
 * `write`) and `6e400003` has `write`/`write-without-response` (not
 * `notify`) — the reverse of the layout this file originally assumed from
 * the Nordic UART spec description alone. `NORDIC_UART_RX_CHARACTERISTIC_UUID`
 * below is the real, hardware-confirmed write target. Whether this reversal
 * is MakeCode-specific or a wider micro:bit-firmware convention is
 * unconfirmed — re-dump the GATT table if the firmware implementation ever
 * changes (see `bench_ping.py`'s own comment for the dump snippet).
 *
 * DEVICE SELECTION: also confirmed 2026-08-15 to need a NAME fallback, not
 * service-UUID filtering alone — on Windows, the service UUID sometimes
 * only appears in a separate scan-response packet that isn't reliably
 * captured by every BLE scan API. iOS's Core Bluetooth stack is different
 * and may not have this issue, but scanning broadly and filtering by EITHER
 * signal is strictly more robust than trusting one, so this hook does both.
 * Matches the first device seen — fine for "exactly one robot in range,"
 * this project's actual situation. Revisit only if multiple micro:bits are
 * ever in range at once — not a real problem yet.
 *
 * AUTO-RECONNECT (added 2026-08-14): a real BLE link can drop for reasons
 * that are expected to be transient during normal filming — the gimbal
 * physically moving the phone, someone walking a few steps out of range,
 * a momentary radio hiccup. Treating `'connection-lost'` as terminal would
 * mean every one of those requires relaunching the app. Instead, a dropped
 * connection (`onDeviceDisconnected` firing with a non-null error) schedules
 * a rescan after `RECONNECT_DELAY_MS`, which repeats indefinitely until
 * either it reconnects or the component unmounts. Deliberately a flat delay,
 * not exponential backoff — simplest thing that recovers the common
 * transient case; revisit only if real testing shows this thrashes battery
 * or logs against a genuinely-gone robot (e.g. powered off, out of range for
 * the rest of the session).
 *
 * UNVERIFIED — CANNOT BE VERIFIED WITHOUT REAL HARDWARE (`CLAUDE.md` §5.2).
 * This hook has never connected to a real micro:bit. It typechecks and is
 * written directly against the real API, but "an agent may never mark a
 * hardware behaviour as working" — that requires `.claude/skills/ble-ping/`
 * run by a human. Treat every status here as implemented, not proven.
 */

/** Nordic UART Service — Nordic Semiconductor's own spec, a stable public UUID. */
export const NORDIC_UART_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
/**
 * Where the phone WRITES gimbal commands — `6E400003`, confirmed against a
 * real GATT dump (see the file doc comment above). NOT `6E400002` — that's
 * the reversed layout the Nordic UART spec's description alone would
 * suggest, and what this constant pointed to before 2026-08-15.
 */
export const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
/** Where the micro:bit sends data back (`indicate`, not `notify`) — not yet subscribed to by this hook; documented for the next feature that needs it. */
export const NORDIC_UART_TX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

/** Flat retry interval after a dropped connection — see the doc comment above on AUTO-RECONNECT. */
const RECONNECT_DELAY_MS = 3000;

export type BleConnectionState =
  | { readonly status: 'waiting-for-bluetooth' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'scanning' }
  | { readonly status: 'connecting' }
  | { readonly status: 'connected' }
  /** Transient — a rescan is already scheduled/in flight, no action needed from the caller. */
  | { readonly status: 'connection-lost'; readonly error: BleError }
  | { readonly status: 'error'; readonly error: Error };

export interface BleConnectionResult {
  readonly state: BleConnectionState;
  /**
   * Encodes and writes a gimbal correction without waiting for a response.
   * Silently no-ops if not currently connected — the caller (the control
   * loop) is expected to just skip sending while disconnected, not treat it
   * as an error each frame. A write that fails in flight (e.g. a dropped
   * "without response" packet) is likewise not surfaced here — occasional
   * drops are expected per PRD §7's rate-limiting note; a real link problem
   * shows up as `'connection-lost'` via `state` instead.
   */
  readonly send: (correction: GimbalCorrection) => void;
  /**
   * Manual retry — tears down and restarts the whole scan/connect cycle from
   * scratch. Added 2026-08-15 in response to a real report of the app
   * showing `'error'` with no way to recover short of relaunching. Safe to
   * call from any state, including `'connected'` (drops and reconnects).
   * This is what `BleStatusBadge` calls when tapped.
   */
  readonly retry: () => void;
}

export function useBleConnection(): BleConnectionResult {
  const managerRef = useRef<BleManager | undefined>(undefined);
  if (managerRef.current == null) {
    managerRef.current = new BleManager();
  }
  const deviceRef = useRef<Device | undefined>(undefined);

  const [state, setState] = useState<BleConnectionState>({ status: 'waiting-for-bluetooth' });
  // Bumping this re-runs the effect below (full teardown via its cleanup,
  // then a fresh start) — the mechanism behind manual retry.
  const [retryGeneration, setRetryGeneration] = useState(0);

  useEffect(() => {
    const manager = managerRef.current as BleManager;
    let disconnectSubscription: Subscription | undefined;
    let cancelled = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = async (device: Device): Promise<void> => {
      setState({ status: 'connecting' });
      try {
        const connected = await manager.connectToDevice(device.id);
        if (cancelled) return;
        await manager.discoverAllServicesAndCharacteristicsForDevice(connected.id);
        if (cancelled) return;
        deviceRef.current = connected;
        setState({ status: 'connected' });
        disconnectSubscription = manager.onDeviceDisconnected(connected.id, (error) => {
          deviceRef.current = undefined;
          // error === null means THIS app called cancelDeviceConnection
          // (deliberate teardown, e.g. unmount) — nothing to surface, no retry.
          if (error != null && !cancelled) {
            setState({ status: 'connection-lost', error });
            reconnectTimeout = setTimeout(startScanning, RECONNECT_DELAY_MS);
          }
        });
      } catch (thrown) {
        if (!cancelled) {
          const error = thrown instanceof Error ? thrown : new Error(String(thrown));
          setState({ status: 'error', error });
        }
      }
    };

    const startScanning = (): void => {
      if (cancelled) return;
      setState({ status: 'scanning' });
      // Broad scan (no UUID filter) + manual match on EITHER signal — see
      // the file doc comment's "DEVICE SELECTION" note on why a UUID-only
      // filter isn't trusted alone.
      manager.startDeviceScan(null, null, (error, device) => {
        if (cancelled) return;
        if (error != null) {
          setState({ status: 'error', error });
          return;
        }
        if (device == null) return;
        const serviceUUIDs = device.serviceUUIDs?.map((u) => u.toLowerCase()) ?? [];
        const hasService = serviceUUIDs.includes(NORDIC_UART_SERVICE_UUID.toLowerCase());
        const name = device.name ?? device.localName ?? '';
        const hasName = name.startsWith('BBC micro:bit');
        if (!hasService && !hasName) return;
        manager.stopDeviceScan();
        void connect(device);
      });
    };

    const stateSubscription = manager.onStateChange((bleState) => {
      if (cancelled) return;
      if (bleState === State.Unauthorized) {
        setState({ status: 'unauthorized' });
        return;
      }
      if (bleState !== State.PoweredOn) {
        setState({ status: 'waiting-for-bluetooth' });
        return;
      }
      startScanning();
    }, true);

    return () => {
      cancelled = true;
      if (reconnectTimeout != null) clearTimeout(reconnectTimeout);
      stateSubscription.remove();
      disconnectSubscription?.remove();
      manager.stopDeviceScan().catch(() => {});
      const device = deviceRef.current;
      if (device != null) {
        manager.cancelDeviceConnection(device.id).catch(() => {});
      }
    };
  }, [retryGeneration]);

  const retry = useCallback(() => {
    // Immediate feedback on tap, rather than waiting for the torn-down-and-
    // restarted effect's first onStateChange callback to fire.
    setState({ status: 'waiting-for-bluetooth' });
    setRetryGeneration((generation) => generation + 1);
  }, []);

  const send = useCallback((correction: GimbalCorrection) => {
    const manager = managerRef.current;
    const device = deviceRef.current;
    if (manager == null || device == null) return;
    const packet = bytesToBase64(encodeGimbalPacket(correction));
    manager
      .writeCharacteristicWithoutResponseForDevice(
        device.id,
        NORDIC_UART_SERVICE_UUID,
        NORDIC_UART_RX_CHARACTERISTIC_UUID,
        packet,
      )
      .catch(() => {
        // See the doc comment on `send` above for why this is intentionally silent.
      });
  }, []);

  return { state, send, retry };
}
