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
`research/hardware/microbit-ble-link.md`. **2026-08-15, later same day:** the hook was installed
on the real phone and run for the first time — it reached an `'error'` state rather than
`'connected'`. The exact cause is still unknown (the badge only showed a generic label at the
time, with no error detail) — this is exactly the gap `BleStatusBadge`'s tap-to-retry +
error-message display (added right after, same day) exists to close for the *next* report.
Treat the protocol as hardware-confirmed (via the standalone bench script) and this hook's own
integration as **actively broken or unconfirmed, not merely untested** — first real signal was
negative, not absent.

**2026-08-16 update:** a THIRD real-phone symptom — stuck at `'connecting'` forever, never
reaching `'connected'` OR `'error'` — root-caused via a 3-way parallel research push (see
`research/hardware/react-native-ble-plx-ios-connect-api.md`,
`research/hardware/ios-ble-connect-hang.md`, `research/hardware/ios-ble-pairing-mismatch.md`):
`connectToDevice` was being called with no `timeout`, and unlike Android, iOS's CoreBluetooth has
no OS-level connect timeout of its own — confirmed against the real upstream native source
(`MultiPlatformBleAdapter`'s `BleModule.swift`, fetched directly since it's a CocoaPod dependency
not present in this repo's `node_modules`). Fixed by passing `{ timeout: CONNECT_TIMEOUT_MS }`
(15s) — see that constant's own doc comment. This makes a stalled attempt surface as a visible,
retryable `'error'` instead of hanging silently, but does NOT by itself explain why CoreBluetooth
stalls in the first place — the leading suspect for that (medium confidence) is a stale iOS
Bluetooth bond left over from this exact micro:bit's earlier MicroPython-firmware life (same
hardware Bluetooth address survives reflashing); if the timeout fix alone doesn't reach
`'connected'`, the next thing to try is iOS Settings > Bluetooth > "Forget This Device" for the
micro:bit, then retry. Not yet confirmed on the real phone as of this entry.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `base64.ts` | file | Pure `Uint8Array` → Base64 string encoder, hand-rolled (Hermes has no `Buffer`) | ✅ verified — 15 tests, cross-checked against Node's own `Buffer` as ground truth |
| `base64.test.ts` | file | Empty input, 12 byte-length cases matched against `Buffer.toString('base64')`, exact padding shape for a 4-byte packet, purity | ✅ verified |
| `encodeGimbalPacket.ts` | file | `GimbalCorrection` (degrees) → the fixed 4-byte wire packet (two big-endian signed int16 deltas, tenths of a degree) | ✅ verified — 8 tests |
| `encodeGimbalPacket.test.ts` | file | Length, round-trip via independent `DataView` decode (positive/negative/mixed), NaN/Infinity → 0, extreme-value clamping, purity | ✅ verified |
| `useBleConnection.ts` | file | Owns a `BleManager`, scans broadly and matches by service UUID OR advertised name (`"BBC micro:bit"` prefix — added 2026-08-15, a UUID-only filter isn't reliably enough on its own), connects (with an explicit `CONNECT_TIMEOUT_MS` = 15s, added 2026-08-16 — see below), discovers characteristics, exposes `state` and a fire-and-forget `send(correction)` that writes to the hardware-confirmed RX characteristic (`6E400003`). Auto-reconnects (flat 3s retry) after any unexpected drop, plus a manual `retry()` that tears down and restarts the whole cycle — `retry()` explicitly awaits the old device's `cancelDeviceConnection` before starting a new attempt (fixed 2026-08-15 same day, see below). | ⚠️ needs verification — **three real attempts, three real failures found and fixed, still not confirmed working end to end**: attempt 1 reached `'error'` with no detail (fixed by showing `state.error.message` + adding tap-to-retry); attempt 2 showed the badge stuck on `'connected'` while nothing actually worked (traced to `retry()` racing a new `connectToDevice` against the old connection's not-yet-finished teardown, fixed by awaiting the teardown first); attempt 3 (2026-08-16) got stuck at `'connecting'` forever with no error at all (traced to a missing `timeout` — iOS's CoreBluetooth has no connect timeout of its own, fixed by supplying one). None of the three fixes has been re-confirmed on the phone yet. Do not treat this hook as working until a report comes back `'connected'` **and stays accurate** through at least one disconnect/reconnect cycle. |

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
`src/hooks/useGimbalControl.ts` — the control-loop hook that takes the already-locked athlete
(from `src/hooks/useLockedAthlete.ts`) and calls `computeGimbalCorrection` + this folder's
`send()`, rate-limited to ~15Hz, and passes `retry` straight through as `retryBle`. Wired into
`src/App.tsx` (called unconditionally alongside the other hooks) and surfaced to the user via
`src/screens/BleStatusBadge.tsx`, which calls `retry` when tapped.
