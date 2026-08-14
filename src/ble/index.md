# src/ble/ — index

The BLE transport to the robot's micro:bit. Owns the connection lifecycle (scan, connect,
discover, reconnect-signal) and the wire encoding of a gimbal correction — nothing else. Does
**not** decide *when* to send or *what* correction to send (that's `src/tracking/`'s
`computeGimbalCorrection.ts` plus `src/hooks/useGimbalControl.ts`, the rate-limiting control-loop
hook that calls this folder's `send()`), and does not render anything.

Written 2026-08-14, entirely against real API surfaces confirmed in `node_modules/` (`CLAUDE.md`
§4.1) and this project's own prior research (`research/hardware/ble-plx-app-side-implementation.md`,
`research/hardware/microbit-ble-link.md`). **Nothing in this folder has touched real hardware
yet** — per `CLAUDE.md` §5.2, that requires a human running `.claude/skills/ble-ping/` against
the actual micro:bit, which hasn't happened. Every status below is "implemented, not proven."

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `base64.ts` | file | Pure `Uint8Array` → Base64 string encoder, hand-rolled (Hermes has no `Buffer`) | ✅ verified — 15 tests, cross-checked against Node's own `Buffer` as ground truth |
| `base64.test.ts` | file | Empty input, 12 byte-length cases matched against `Buffer.toString('base64')`, exact padding shape for a 4-byte packet, purity | ✅ verified |
| `encodeGimbalPacket.ts` | file | `GimbalCorrection` (degrees) → the fixed 4-byte wire packet (two big-endian signed int16 deltas, tenths of a degree) | ✅ verified — 8 tests |
| `encodeGimbalPacket.test.ts` | file | Length, round-trip via independent `DataView` decode (positive/negative/mixed), NaN/Infinity → 0, extreme-value clamping, purity | ✅ verified |
| `useBleConnection.ts` | file | Owns a `BleManager`, scans for the Nordic UART service, connects to the first match, discovers characteristics, exposes `state` (a discriminated union including `'connection-lost'` vs `'error'`) and a fire-and-forget `send(correction)` | ⚠️ needs verification — `tsc --noEmit` passes, written directly against `node_modules/react-native-ble-plx/src/index.d.ts`, but **has never connected to a real micro:bit**. No unit test exists for this file — a hook that's 95% native-BLE side effects isn't meaningfully unit-testable the way the two pure files above are; its correctness claim rests entirely on matching the real library's types, not on a test suite. |

## Design decisions worth knowing

- **Deltas, not absolute angles, on the wire.** `research/hardware/microbit-ble-link.md`'s
  original proposal was unsigned absolute angles (0–1800 = 0.0–180.0°) — discovered inconsistent
  with `computeGimbalCorrection.ts` (which deliberately outputs signed deltas) while writing
  `encodeGimbalPacket.ts`, and corrected in that research file, `docs/PRD.md` §7, and here. The
  micro:bit is expected to add each delta to its own running absolute position and apply its own
  mechanical clamps — the phone never knows or sends an absolute angle.
- **Base64 is hand-rolled, not a polyfill dependency.** Every `react-native-ble-plx` write method
  requires it; Hermes has no `Buffer`. See `base64.ts`'s doc comment and
  `research/hardware/ble-plx-app-side-implementation.md`'s "base64 trap" section.
- **Nordic UART service, first-match connect.** Simplest thing that can be debugged first
  (`research/hardware/microbit-ble-link.md`) — no device-name filtering yet, fine for "exactly
  one robot in range."
- **`send()` never throws and never blocks the caller on connection state.** It silently no-ops
  if not connected, and a failed in-flight write is swallowed (occasional "without response"
  drops are expected per PRD §7's rate-limiting note) — a real link problem surfaces through
  `state` becoming `'connection-lost'`, not through `send()`'s return value.
- **`'connection-lost'` vs a deliberate disconnect are different states**, per
  `onDeviceDisconnected`'s `error` argument — `null` means this app called
  `cancelDeviceConnection` itself (e.g. unmount teardown), non-null means the link actually
  dropped (out of range, micro:bit brownout — see `research/hardware/power-brownout-risk.md`).

## Depends on
`react`, `react-native-ble-plx` (`BleManager`, `State`, `BleError`/`Device`/`Subscription`
types), `../tracking/types.ts` (`GimbalCorrection`).

## Depended on by
`src/hooks/useGimbalControl.ts` — the control-loop hook that calls `selectPrimaryAthlete` +
`computeGimbalCorrection` + this folder's `send()`, rate-limited to ~15Hz. Wired into
`src/App.tsx` (called unconditionally alongside the other hooks) and surfaced to the user via
`src/screens/BleStatusBadge.tsx`.
