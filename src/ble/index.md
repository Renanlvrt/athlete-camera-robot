# src/ble/ — index

The BLE transport to the robot's micro:bit. Owns the connection lifecycle (scan, connect,
discover, reconnect-signal) and the wire encoding of a gimbal correction — nothing else. Does
**not** decide *when* to send or *what* correction to send (that's `src/tracking/`'s
`computeGimbalCorrection.ts` plus `src/hooks/useGimbalControl.ts`, the rate-limiting control-loop
hook that calls this folder's `send()`), and does not render anything.

Written 2026-08-14 against real API surfaces confirmed in `node_modules/` (`CLAUDE.md` §4.1) and
this project's own prior research. **2026-08-15 update:** the underlying GATT layout this file
assumes (service/characteristic UUIDs, which one to write vs. subscribe to, and that a
"no pairing required" firmware config is required) is now confirmed against a REAL micro:bit —
`.claude/skills/ble-ping/scripts/bench_ping.py` completed a real 20/20-ping round trip. Two
real bugs were found and fixed this way: the RX/TX characteristic UUIDs were reversed from what
the Nordic UART spec's description alone suggested, and MakeCode's Bluetooth requires an
explicit no-pairing config or it never advertises at all — see the file's own doc comment and
`research/hardware/microbit-ble-link.md`. **This hook itself (`useBleConnection.ts`) still has
not run** — the bench test proved the protocol facts via a standalone Python script, not this
React Native code path, which can only be exercised inside the actual app (`CLAUDE.md` §5.2).
Treat the *protocol* as hardware-confirmed and the *hook* as still unproven.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `base64.ts` | file | Pure `Uint8Array` → Base64 string encoder, hand-rolled (Hermes has no `Buffer`) | ✅ verified — 15 tests, cross-checked against Node's own `Buffer` as ground truth |
| `base64.test.ts` | file | Empty input, 12 byte-length cases matched against `Buffer.toString('base64')`, exact padding shape for a 4-byte packet, purity | ✅ verified |
| `encodeGimbalPacket.ts` | file | `GimbalCorrection` (degrees) → the fixed 4-byte wire packet (two big-endian signed int16 deltas, tenths of a degree) | ✅ verified — 8 tests |
| `encodeGimbalPacket.test.ts` | file | Length, round-trip via independent `DataView` decode (positive/negative/mixed), NaN/Infinity → 0, extreme-value clamping, purity | ✅ verified |
| `useBleConnection.ts` | file | Owns a `BleManager`, scans broadly and matches by service UUID OR advertised name (`"BBC micro:bit"` prefix — added 2026-08-15, a UUID-only filter isn't reliably enough on its own), connects, discovers characteristics, exposes `state` and a fire-and-forget `send(correction)` that writes to the hardware-confirmed RX characteristic (`6E400003`). Auto-reconnects (flat 3s retry) after any unexpected drop. | ⚠️ needs verification — `tsc --noEmit` passes, written directly against `node_modules/react-native-ble-plx/src/index.d.ts`, and the GATT layout/protocol it implements is now hardware-confirmed (see above) — but **this specific hook has never run inside the actual app**, so the reconnect logic and the RN/ble-plx integration itself remain unproven. No unit test exists for this file — a hook that's ~95% native-BLE side effects isn't meaningfully unit-testable the way the two pure files above are. |

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
- **Nordic UART service, first-match connect, matched by UUID or name.** Simplest thing that can
  be debugged first (`research/hardware/microbit-ble-link.md`); scanning matches on EITHER the
  service UUID or an advertised name starting with `"BBC micro:bit"` (not UUID alone — see the
  file doc comment's "DEVICE SELECTION" note), fine for "exactly one robot in range."
- **RX/TX characteristic UUIDs are reversed from the "standard" description.** Confirmed via a
  real GATT dump 2026-08-15: write to `6E400003`, the micro:bit's outbound channel is `6E400002`
  using `indicate` (not `notify`). Getting this backwards is exactly the kind of bug that
  typechecks fine and silently fails at runtime — there's no way to have caught it without
  dumping the real device.
- **A "no pairing required" firmware config is required, or nothing advertises at all.**
  MakeCode's Bluetooth defaults to requiring pairing/whitelisting; a micro:bit running the
  default config never shows up in an open scan. This lives in the micro:bit-side firmware
  config, not in this hook, but explains why "the phone can't find the robot" could mean a
  firmware config gap rather than an app bug — see
  `.claude/skills/gimbal-control-firmware/`.
- **`send()` never throws and never blocks the caller on connection state.** It silently no-ops
  if not connected, and a failed in-flight write is swallowed (occasional "without response"
  drops are expected per PRD §7's rate-limiting note) — a real link problem surfaces through
  `state` becoming `'connection-lost'`, not through `send()`'s return value.
- **`'connection-lost'` vs a deliberate disconnect are different states**, per
  `onDeviceDisconnected`'s `error` argument — `null` means this app called
  `cancelDeviceConnection` itself (e.g. unmount teardown), non-null means the link actually
  dropped (out of range, micro:bit brownout — see `research/hardware/power-brownout-risk.md`).
- **`'connection-lost'` auto-retries, it isn't terminal.** A flat 3-second rescan loop starts
  automatically on any unexpected drop and keeps trying until it reconnects or the component
  unmounts — a transient drop during normal filming shouldn't require relaunching the app.

## Depends on
`react`, `react-native-ble-plx` (`BleManager`, `State`, `BleError`/`Device`/`Subscription`
types), `../tracking/types.ts` (`GimbalCorrection`).

## Depended on by
`src/hooks/useGimbalControl.ts` — the control-loop hook that calls `selectPrimaryAthlete` +
`computeGimbalCorrection` + this folder's `send()`, rate-limited to ~15Hz. Wired into
`src/App.tsx` (called unconditionally alongside the other hooks) and surfaced to the user via
`src/screens/BleStatusBadge.tsx`.
