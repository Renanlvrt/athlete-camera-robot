import { useEffect, useRef } from 'react';

import { computeGimbalCorrection } from '../tracking/computeGimbalCorrection';
import { defaultGimbalTuning, type GimbalTuning } from '../tracking/types';
import type { PrimaryAthleteResult } from '../tracking/types';
import { useBleConnection, type BleConnectionState } from '../ble/useBleConnection';

/**
 * useGimbalControl
 *
 * Single responsibility: the actual control loop. Ties together, in order,
 * what `src/tracking/` and `src/ble/` each already do in isolation:
 *
 *   locked athlete → computeGimbalCorrection → BLE send
 *
 * Takes the already-resolved `PrimaryAthleteResult` from
 * `src/hooks/useLockedAthlete.ts` rather than raw `boxes` and re-deciding who
 * to follow itself (2026-08-16) — it used to call `selectPrimaryAthlete`
 * independently of `TrackingOverlay.tsx`'s own separate call on the same
 * frame's boxes, which meant the two could disagree about who was locked.
 * There is now exactly one call to `selectPrimaryAthlete`
 * (`useLockedAthlete.ts`), and this hook and the overlay both consume its
 * output — see `src/App.tsx`.
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
 * — the underlying decision it applies (`computeGimbalCorrection`) is already
 * independently unit-tested in `src/tracking/`. What's untested here is the
 * composition + timing itself, which needs a real device to observe
 * meaningfully.
 */

const SEND_INTERVAL_MS = 1000 / 15;

export interface GimbalControlResult {
  /** The underlying BLE link state, so a screen can show it — see `src/screens/BleStatusBadge.tsx`. */
  readonly bleState: BleConnectionState;
  /** Manually tear down and restart the BLE scan/connect cycle — see `useBleConnection.ts`'s own doc comment. */
  readonly retryBle: () => void;
}

export function useGimbalControl(
  primary: PrimaryAthleteResult,
  tuning: GimbalTuning = defaultGimbalTuning,
): GimbalControlResult {
  const { state, send, retry } = useBleConnection();
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (state.status !== 'connected') return;
    if (primary.status !== 'locked') return;

    const now = Date.now();
    if (now - lastSentAtRef.current < SEND_INTERVAL_MS) return;

    send(computeGimbalCorrection(primary.athlete, tuning));
    lastSentAtRef.current = now;
  }, [primary, state.status, tuning, send]);

  return { bleState: state, retryBle: retry };
}
