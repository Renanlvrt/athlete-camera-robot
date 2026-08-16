# Why `connectToDevice()` hangs forever on iOS with no error

> **See also `ios-ble-pairing-mismatch.md`** (also written 2026-08-16, apparently in parallel with
> this file — discovered on re-reading `RESEARCH_LOG.md` before appending). That file covers, in
> much greater depth, the **stale-iOS-bonding-cache hypothesis** (this device's earlier
> MicroPython/pre-`pairing_mode:0` history leaving an invalid pairing record on the phone) — read
> it for that angle, including a citation of micro:bit's own support docs describing this exact
> MicroPython→MakeCode transition as a known trigger. This file's distinct contribution is the
> **library/OS-level mechanism** that explains why such a failure — from *any* cause, stale
> bonding or otherwise — would present as a silent, permanent hang instead of a visible error:
> `connectToDevice` has no default timeout on iOS. The two files' hypotheses are not exclusive;
> read both. Neither confirms which is actually happening on the real iPhone.

- **Researched:** 2026-08-16
- **Confidence:** high on the mechanism (why the promise can hang with no rejection — confirmed
  directly against `node_modules`'s `.d.ts`, the library's own wiki, and Apple's own
  CoreBluetooth documentation/forums); medium-low on which specific trigger is causing THIS
  peripheral's callback to never fire (two plausible, non-exclusive triggers identified;
  neither confirmable without the physical iPhone).
- **Expires:** Once a human has (a) tried `connectToDevice` with an explicit `timeout` and
  reports what error/code actually comes back, and (b) checked the real iPhone's
  Settings → Bluetooth for a stale pairing entry for this micro:bit. Either result answers the
  open question below; until then this is diagnosis, not confirmed root cause.
- **Sources:**
  - `node_modules/react-native-ble-plx/src/index.d.ts` (v3.5.1, this project's installed
    version), `ConnectionOptions.timeout` doc comment, lines ~180-215 — "Number of milliseconds
    after connection is automatically timed out" (i.e. opt-in; no default is documented).
    `connectToDevice(deviceIdentifier, options?)` — `options` is genuinely optional and this
    project's `src/ble/useBleConnection.ts` calls it with none.
  - https://github.com/dotintent/react-native-ble-plx/wiki/Device-Connecting — the library's own
    wiki, verbatim: **"iOS by default does _not_ timeout the connect request."**
  - https://developer.apple.com/documentation/corebluetooth/cbcentralmanager — Apple's own docs
    on `connect(_:options:)`: connection attempts do not time out by design; the system calls
    back only on success (`didConnect`) or a transient failure (`didFailToConnect`).
  - https://developer.apple.com/forums/thread/105652 — Apple Developer Forums thread with
    empirical data: `didFailToConnectPeripheral` fired for well under 1% of failed connection
    attempts across iOS 11/12 in the reporting developer's data, i.e. in practice most failures
    are silent, not just theoretically possible to be silent.
  - https://github.com/dotintent/react-native-ble-plx/issues/163 — "connectToDevice doesn't time
    out on iOS" — real report of exactly this class of symptom (iOS connect hangs far longer
    than Android's, in one case ~10 minutes with no callback).
  - https://github.com/dotintent/react-native-ble-plx/issues/1135 — "Inconsistency in
    connectToDevice Timeout Behavior Between iOS and Android" — confirms the option exists and
    behaves differently per platform, open/unresolved as of this research.
  - https://github.com/randdusing/cordova-plugin-bluetoothle/issues/603 — a sibling
    CoreBluetooth-wrapping plugin (different library, same underlying OS API) reporting
    `connect()` "never returns in any of the callbacks, it hangs forever" specifically for a
    **previously-paired** peripheral where the OS's bonding state and the peripheral's current
    state disagree — the closest documented match to a connect()-level (not
    discovery/read/write-level) permanent hang tied to pairing state.
  - `research/hardware/microbit-ble-link.md` (this project, 2026-08-15) — established that
    MakeCode's Bluetooth extension **defaults to requiring pairing** unless explicitly
    configured `pairing_mode: 0`, and that this firmware's config does set it to 0 now.

## Conclusion

The hang has a **mechanical explanation that needs no exotic theory**: `connectToDevice()` is
called with no `options` in `src/ble/useBleConnection.ts`, and on iOS specifically,
react-native-ble-plx applies **no default timeout at all** — this is documented by the library
itself ("iOS by default does _not_ timeout the connect request") and is consistent with Apple's
own CoreBluetooth docs, which state connect attempts never time out and only call back on success
or a *transient* failure — silently never calling back at all for other failure classes, which
Apple's own forum data shows happening the large majority of the time in practice. The immediate,
directly-actionable fix is to pass an explicit `timeout` so the promise is guaranteed to settle
one way or the other within a bounded time, converting "hangs forever, invisible" into "fails
after N seconds, visible and retriable" — that alone does not explain *why* the native callback
isn't firing, but it is a prerequisite for ever finding out, since right now the app has no way to
even observe that a failure occurred.

A second, non-exclusive, **hardware-only-testable** hypothesis for the underlying cause: this
project's own research already established that MakeCode's Bluetooth extension defaults to
requiring pairing unless explicitly disabled, and that this firmware's current config disables it
(`pairing_mode: 0`). If, at any point earlier in development, this exact micro:bit was flashed
with firmware that had NOT yet had that fix applied (i.e. pairing_mode defaulted to on) and the
real iPhone attempted to connect to it during that window, iOS could have formed a bonding record
for that peripheral — keyed by the micro:bit's Bluetooth address, which is a fixed hardware ID
derived from silicon and **does not change when firmware is reflashed**. A stale bond that the
now-unpaired-mode firmware doesn't recognize is a documented (in a sibling library, not
ble-plx itself) trigger for `connect()` hanging forever with literally no callback on either side
— which matches this bug's symptom more precisely than a generic "iOS connect can be slow"
explanation would.

## Detail

### Why `bleak` on Windows doesn't show this

Windows's BLE stack (WinRT `BluetoothLEDevice`, which `bleak` wraps) has different default
connection-timeout and pairing-negotiation behavior than CoreBluetooth, and — critically —
Windows has no cached bonding state for this exact peripheral to conflict with (it was never
paired to this micro:bit before). This is not itself evidence against either hypothesis above; a
platform difference in default timeout, and the total absence of a stale-bond scenario, are both
individually sufficient to explain why the identical peripheral behaves fine from Python/Windows
and hangs from the iPhone. It does rule out the peripheral's firmware being flatly broken —
something bleak got 20/20 clean connects against is not non-functional BLE firmware.

### Answering the four sub-questions directly

**1. Does `connectToDevice` need an explicit `timeout` to ever surface a failure on iOS?**
Yes, confirmed from three independent angles: the type definition (`timeout` is optional, no
default stated), the library's own wiki ("iOS by default does _not_ timeout the connect
request" — this is the single most direct answer to this question found anywhere in this
research), and Apple's own docs (connect attempts do not time out at the OS level either).
Without passing `{ timeout: N }`, there is **no mechanism anywhere in the stack** — not the app,
not the library, not the OS — that will force the promise to settle. `didFailToConnectPeripheral`
is real and does exist, but per Apple's own forum data it fires for well under 1% of failed
connection attempts; the overwhelming majority of iOS connection failures are, empirically,
silent. This is not a bug in react-native-ble-plx so much as an accurate reflection of an OS API
that itself has no timeout.

**2. Could `discoverAllServicesAndCharacteristicsForDevice` be relevant even though the hang is
before that point?** No evidence found that discovery-stage quirks explain a hang that happens
strictly *during* `connectToDevice` itself (confirmed by the reported symptom: the promise from
`connectToDevice` — not the one after it — never settles). Several other reported issues
(`discoverAllServicesAndCharacteristics() hangs and disconnects on IOS`, issue #1082) describe a
real, separate failure mode at the discovery stage, but that is a distinct bug class from this
one and not relevant here since the code never reaches that call.

**3. Known GitHub issues matching this exact pattern?** Yes — `dotintent/react-native-ble-plx`
issues #163 and #1135 both describe iOS-specific `connectToDevice` timeout/hang behavior,
unresolved as open questions in the library itself (see Sources). Neither is specific to
MakeCode/micro:bit peripherals; both are generic to "connecting to non-trivial BLE peripherals
from iOS via this library."

**4. Could iOS silently attempt pairing/encryption negotiation and hang if it doesn't match what
the peripheral expects, even though the firmware sets `pairing_mode: 0`?** This is plausible but
**less directly confirmed than the timeout explanation**, and importantly, the classic documented
version of this failure (in a sibling library, `cordova-plugin-bluetoothle` issue #603) is
specifically about a **previously-paired** peripheral, not a fresh no-pairing-required one — i.e.
it's not that `pairing_mode: 0` is insufficient in general, it's that a **stale bond from before
that config existed** could be the actual trigger, which is a materially different and more
specific claim than "no-pairing config doesn't work on iOS." General CoreBluetooth pairing
mechanics (per Apple forum threads found during this research) also indicate that security/pairing
negotiation is normally triggered by access to a *protected characteristic*, which happens at
discovery/read/write time, **after** a bare GATT connect succeeds — meaning the plain connect()
step this bug is stuck on would not typically be where a characteristic-security mismatch first
surfaces. The stale-bond scenario is the one documented exception to that general rule, because a
mismatched bond can affect the ATT-level connection handshake itself, not just characteristic
access.

### What this research could NOT determine

- **Which of the two hypotheses (or something else entirely) is actually happening on the real
  iPhone.** Both predict the same observed symptom (`connectToDevice` hangs, no error), and
  research from documentation/GitHub issues cannot distinguish them — only the physical device
  can.
- **What error code, if any, `connectToDevice({ timeout: N })` would actually return** once given
  a bounded time to fail — whether it's a generic timeout error (meaning the underlying native
  callback genuinely never fires and the library's own timer is the only thing that ever
  resolves the promise) or whether adding a timeout causes it to actually surface a `BleError`
  from CoreBluetooth that was there all along but unobserved. This distinguishes "OS never calls
  back at all" from "OS does call back with an error but nothing in the JS layer was listening
  for it before" — the type definitions don't say which, and no issue found gives a definitive
  answer for a custom/non-MFi peripheral specifically.
- **Whether this exact iPhone has a stale Bluetooth bond for this exact micro:bit.** Only
  checking iOS Settings → Bluetooth on the physical device can answer this — this is a
  `hardware-tester` task, not a research one.
