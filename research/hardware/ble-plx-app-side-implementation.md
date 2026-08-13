# react-native-ble-plx: the actual app-side API to build `src/ble/` against

- **Researched:** 2026-08-13
- **Confidence:** high — every method/type/enum below is quoted or paraphrased directly from
  `node_modules/react-native-ble-plx/src/index.d.ts` (2084 lines, read in full), not a tutorial.
  The Nordic UART Service UUIDs are a stable public Bluetooth SIG-adjacent standard (Nordic
  Semiconductor's own spec), unlikely to drift.
- **Expires:** On `react-native-ble-plx` major version bump, or once `ble-ping`/real hardware
  proves a different GATT approach is needed. Re-check the `.d.ts` directly before trusting this
  if the installed version differs from `3.5.1` (see `package.json`).
- **Sources:**
  - `node_modules/react-native-ble-plx/src/index.d.ts` (read directly, full file)
  - Nordic UART Service spec (public, stable): `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` (service),
    `6E400002-...` (RX, phone writes here), `6E400003-...` (TX, phone subscribes here)
  - `research/hardware/microbit-ble-link.md` (library/protocol choice — this file only adds the
    concrete app-side implementation shape on top of that decision)

## Purpose of this file

`microbit-ble-link.md` already decided **what** to use (`react-native-ble-plx`, UART service, a
4-byte packet). This file is the **how** — the exact method calls, written against the real
`.d.ts`, so that whoever builds `src/ble/` once the micro:bit/PCA9685 hardware is in hand doesn't
have to re-derive the API from scratch or trust a blog post. This is research only — **no
`src/ble/` code was written**, per this project's rule that new source folders get their own
`index.md` and single-responsibility design as they're actually built (`CLAUDE.md` §7), and per
the standing rule that hardware-dependent work isn't started until there's a way to verify it.

## The real connection lifecycle, method-by-method

All of these are methods on a single `BleManager` instance (`new BleManager()`, one per app
lifetime — construct it once, e.g. in a hook's `useRef`, not per-render).

1. **`onStateChange(listener, emitCurrentState?)`** — fires with a `State` enum value
   (`'PoweredOn'`, `'PoweredOff'`, `'Unauthorized'`, etc.). Gate everything else on
   `state === 'PoweredOn'` — scanning before that silently fails on some platforms rather than
   queuing. The library's own example calls this with `emitCurrentState: true` and removes the
   subscription once `'PoweredOn'` fires — a one-shot "wait until ready" pattern, not a
   permanent listener.
2. **`startDeviceScan(UUIDs, options, listener)`** — pass the Nordic UART service UUID as the
   filter (`[NORDIC_UART_SERVICE_UUID]`), not `null` (which scans *everything* nearby — slower,
   noisier, and a real battery/privacy concern). `listener` fires once per scanned advertisement;
   look for the expected device name to disambiguate if multiple micro:bits are ever in range.
3. **`stopDeviceScan()`** — call as soon as the target device is found. Scanning continuously in
   the background is unnecessary battery drain for this app (filming is a foreground activity).
4. **`connectToDevice(deviceIdentifier, options?)`** → `Promise<Device>`.
5. **`discoverAllServicesAndCharacteristicsForDevice(deviceIdentifier)`** — **must** be called
   after connecting and before any read/write/monitor call; those will fail against
   undiscovered characteristics.
6. **`writeCharacteristicWithoutResponseForDevice(deviceIdentifier, serviceUUID, characteristicUUID, base64Value)`**
   — this is almost certainly the right write variant for the gimbal command packet: PRD §7's
   already-decided send-rate (10-20 Hz, not per-frame) means occasional dropped writes are fine,
   and "without response" avoids waiting a full write-acknowledgment round trip before the next
   frame can be processed. `writeCharacteristicWithResponseForDevice` exists too, if
   `ble-ping`'s real testing shows drops are a problem in practice — don't decide this
   without that data.
7. **`monitorCharacteristicForDevice(deviceIdentifier, serviceUUID, characteristicUUID, listener)`**
   — for reading the micro:bit's TX/notify characteristic (an echo/ack, or telemetry back to the
   phone later). Returns a `Subscription` — must call `.remove()` on unmount/disconnect or it
   leaks.
8. **`onDeviceDisconnected(deviceIdentifier, listener)`** — fires with `error: null` if *this app*
   called `cancelDeviceConnection()`, or a non-null `BleError` if the link dropped unexpectedly
   (out of range, micro:bit reset/brownout — see `power-brownout-risk.md`). **This is the signal
   to distinguish "we hung up" from "it dropped"** — a future `useBleConnection.ts` needs both a
   `'disconnected'` state and a `'connection-lost'` state, not just one, so the UI/reconnect logic
   can react differently (auto-retry on unexpected loss, don't retry on deliberate disconnect).
9. **`cancelDeviceConnection(deviceIdentifier)`** — call on unmount/screen-exit for a clean
   teardown.

## The base64 trap — plan for it now, don't discover it during a hardware session

Every write/read/monitor method in this API takes/returns values as **`Base64` (a `string` type
alias)**, never raw bytes directly — confirmed directly in the `.d.ts` (`export type Base64 =
string`, used throughout the write/read/monitor signatures). React Native's JS runtime (Hermes)
has **no built-in `Buffer` global** the way Node.js does — reaching for `Buffer.from(...)` without
a polyfill installed will throw `ReferenceError: Buffer is not defined` at runtime, not at
typecheck time (it'll likely still typecheck if `@types/node` is present, which is exactly the
kind of gap that only shows up on-device — another reason this is worth flagging in research now).

**Recommendation: don't add a `buffer` polyfill dependency for this.** The packet is always
exactly 4 bytes (`microbit-ble-link.md`'s `[roll_hi, roll_lo, pitch_hi, pitch_lo]`) — a hand-rolled
base64 encode for a small fixed-size `Uint8Array` is ~10 lines of pure, dependency-free,
unit-testable JS (standard base64 alphabet table + bit-shifting), consistent with this project's
existing preference for a small manual implementation over a new native/JS dependency (the same
call made for the dashed-line renderer over `react-native-svg` — see
`docs/VERIFICATION_REPORT.md`, 2026-08-13 evening entry). This belongs in `src/ble/` as its own
pure, tested module (e.g. `encodePacket.ts`) when that folder is actually built — flagging the
need here so it isn't rediscovered as a runtime crash during the first real connection test.

## Permissions — different pattern than the camera

`useCameraSetup.ts` explicitly calls `requestPermission()` (`useCameraPermission` from
VisionCamera) because iOS camera access needs an explicit app-triggered prompt. **Bluetooth on iOS
does not work the same way** — there's no equivalent `useBlePermission()` call in `ble-plx`'s API.
The system permission prompt is triggered *automatically* by iOS the first time the app actually
tries to use `CBCentralManager` (i.e., the first `startDeviceScan()` or `connectToDevice()` call),
driven by the `NSBluetoothAlwaysUsageDescription` string already configured via `app.json`'s
`react-native-ble-plx` plugin entry (`bluetoothAlwaysPermission`, per `microbit-ble-link.md`). A
future `useBleConnection.ts` should **not** try to replicate `useCameraSetup.ts`'s
"requesting-permission" status pattern by calling some non-existent permission-request function —
instead, treat an `'Unauthorized'` `State` from `onStateChange` as the signal that permission was
denied, and surface that as its own status.

## Sketch of the future hook's shape (documentation only, not implemented)

Not code to copy-paste — a shape to sanity-check against once this is actually built, matching
this project's established hook patterns (`useAthleteDetection.ts`, `useVideoRecording.ts`):

```
type BleConnectionStatus =
  | { status: 'waiting-for-bluetooth' }        // BleManager state isn't 'PoweredOn' yet
  | { status: 'unauthorized' }                 // State === 'Unauthorized'
  | { status: 'scanning' }
  | { status: 'connecting' }
  | { status: 'connected'; device: Device }
  | { status: 'connection-lost'; error: BleError }  // onDeviceDisconnected fired with an error
  | { status: 'error'; error: BleError }

// + a send(correction: GimbalCorrection) function that encodes and calls
//   writeCharacteristicWithoutResponseForDevice, rate-limited to 10-20Hz per
//   microbit-ble-link.md — the rate-limiting logic itself is pure and belongs
//   in src/tracking/ or src/ble/, unit-testable without hardware.
```

## What still can't be resolved by research

- **The actual GATT UUIDs the micro:bit program ends up using** — Nordic UART's standard UUIDs
  are the starting assumption, but the specific MakeCode/MicroPython BLE extension used may wrap
  or rename things. Confirm against whatever `ble-ping`'s micro:bit-side script actually
  implements.
- **Whether "without response" writes actually arrive reliably enough** in practice — needs
  `ble-ping` run for real, per `.claude/skills/ble-ping/`.
- **Real reconnect behavior** (how long `onDeviceDisconnected` takes to fire after an out-of-range
  or brownout event) — unmeasurable without hardware.
