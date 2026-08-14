import { useEffect, useRef } from 'react';

import { selectPrimaryAthlete } from '../tracking/selectPrimaryAthlete';
import { computeGimbalCorrection } from '../tracking/computeGimbalCorrection';
import { defaultGimbalTuning, type GimbalTuning } from '../tracking/types';
import type { PersonBox } from '../tracking/types';
import { useBleConnection, type BleConnectionState } from '../ble/useBleConnection';

/**
 * useGimbalControl
 *
 * Single responsibility: the actual control loop. Ties together, in order,
 * what `src/tracking/` and `src/ble/` each already do in isolation:
 *
 *   detected boxes → selectPrimaryAthlete → computeGimbalCorrection → BLE send
 *
 * Owns exactly one piece of NEW logic that doesn't belong in either of those
 * pure folders: RATE-LIMITING. PRD §7 / `research/hardware/microbit-ble-link.md`
 * are explicit that sending a correction on every camera frame (≈30/sec) would
 * congest the BLE link and can destabilize the connection — this hook sends
 * at most once per `SEND_INTERVAL_MS` (~15Hz, the middle of the documented
 * 10-20Hz range), tracked with a plain ref rather than `setInterval` so a
 * send only ever happens right after a fresh detection, never on a stale one.
 *
 * Does not render anything, does not own the BLE connection itself (that's
 * `useBleConnection.ts` — this hook just calls its `send`).
 *
 * UNVERIFIED ON HARDWARE, same as `src/ble/`: the rate-limit guard has no
 * dedicated unit test because it's driven by `Date.now()` and a React effect
 * — the underlying decisions it composes (`selectPrimaryAthlete`,
 * `computeGimbalCorrection`) are already independently unit-tested in
 * `src/tracking/`. What's untested here is the composition + timing itself,
 * which needs a real device to observe meaningfully.
 */

const SEND_INTERVAL_MS = 1000 / 15;

export interface GimbalControlResult {
  /** The underlying BLE link state, so a screen can show it — see `src/screens/BleStatusBadge.tsx`. */
  readonly bleState: BleConnectionState;
}

export function useGimbalControl(
  boxes: readonly PersonBox[],
  tuning: GimbalTuning = defaultGimbalTuning,
): GimbalControlResult {
  const { state, send } = useBleConnection();
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (state.status !== 'connected') return;

    const now = Date.now();
    if (now - lastSentAtRef.current < SEND_INTERVAL_MS) return;

    const primary = selectPrimaryAthlete(boxes);
    if (primary.status !== 'locked') return;

    send(computeGimbalCorrection(primary.athlete, tuning));
    lastSentAtRef.current = now;
  }, [boxes, state.status, tuning, send]);

  return { bleState: state };
}
