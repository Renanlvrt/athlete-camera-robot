# `react-native-ble-plx` `connectToDevice` — real API surface, and why it can hang forever on iOS

- **Researched:** 2026-08-16
- **Confidence:** high on the API surface itself (read directly from the installed `.d.ts`
  and the installed native `.m`/`.h` bridge, per `CLAUDE.md` §4.1); high on the root-cause
  mechanism (confirmed against the actual upstream Swift source of the library that
  implements iOS connection, not a tutorial); **medium** on "this is definitely the whole
  bug" — see Unknowns at the end, this is an audit of the library's API, not a hardware
  observation, and two other agents are independently investigating CoreBluetooth-level and
  micro:bit-firmware-level causes of the same symptom in parallel.
- **Expires:** if `node_modules/react-native-ble-plx/package.json` version changes from
  `3.5.1`, or if `dotintent/MultiPlatformBleAdapter` (the actual iOS/Android native
  implementation, see below) cuts a new release — re-check both changelogs. Also expires the
  moment someone actually adds `{ timeout: N }` on real hardware and observes whether it
  changes the stuck-at-`'connecting'` behavior — that hardware result supersedes this file's
  inference.
- **Sources:**
  - `node_modules/react-native-ble-plx/package.json` (installed version: **3.5.1**, `types`
    field: `src/index.d.ts`)
  - `node_modules/react-native-ble-plx/src/index.d.ts` (read directly — lines 180-215 for
    `ConnectionOptions`, line 1210 for `connectToDevice`'s signature)
  - `node_modules/react-native-ble-plx/ios/BlePlx.m` (the actual installed Objective-C RN
    bridge — confirms `connectToDevice` is a thin pass-through to a `BleClientManager`
    instance with no iOS-side logic of its own)
  - `node_modules/react-native-ble-plx/ios/BlePlx-Swift.h` (generated interface header —
    confirms the real implementation is the external `MultiplatformBleAdapter` Swift module,
    not anything shipped as source in this npm package)
  - `node_modules/react-native-ble-plx/react-native-ble-plx.podspec` (line 18:
    `s.dependency "MultiplatformBleAdapter", "0.2.0"` — the actual native implementation is a
    separate CocoaPod, fetched by `pod install` on the macOS CI runner, not present in this
    repo's `node_modules` at all since npm never fetches Pods)
  - https://github.com/dotintent/react-native-ble-plx (no `CHANGELOG.md` entries or `ios/`
    source past `3.5.1`, confirmed against `npm view` `dist-tags.latest` = `3.5.1` — **this
    IS the newest version**, there is no newer fix to upgrade to)
  - https://github.com/dotintent/MultiPlatformBleAdapter — the real repo, `iOS/classes/BleModule.swift`,
    containing the actual `connectToDevice`/timeout/CoreBluetooth-callback wiring
  - https://github.com/dotintent/react-native-ble-plx/issues/163 ("connectToDevice doesn't
    time out on iOS")
  - https://github.com/dotintent/react-native-ble-plx/issues/1135 ("Inconsistency in
    connectToDevice Timeout Behavior Between iOS and Android")
  - https://github.com/dotintent/react-native-ble-plx/issues/331 ("Disconnect events ignored
    if received before connection succeeds on iOS")
  - https://github.com/dotintent/react-native-ble-plx/wiki/Device-Connecting (official wiki:
    "iOS by default does _not_ timeout the connect request")
  - https://github.com/dotintent/react-native-ble-plx/blob/master/CHANGELOG.md (checked for
    any iOS-connect-hang fix after 3.5.1 — none exists, 3.5.1 is current)

## Conclusion

`connectToDevice(deviceId, options?)` takes an **optional second `ConnectionOptions` argument**
with `autoConnect` (Android-only), `requestMTU`, `refreshGatt` (Android-only), and `timeout`
(milliseconds). **`src/ble/useBleConnection.ts` calls it with no second argument at all**, so no
timeout is ever armed. This project's library docs and the upstream library's own wiki both
state plainly that **iOS's CoreBluetooth does not time out a `connect()` call on its own** — so
with no JS-supplied `timeout`, a connection attempt that CoreBluetooth silently never completes
(a real, previously-reported failure mode, not a hypothetical) has nothing that will ever force
the JS promise to resolve or reject. This is a **plausible full explanation** for the exact
symptom reported (stuck at `'connecting'` forever, neither branch of the `try`/`catch` ever
runs) — it is the single most actionable, cheapest-to-try fix available, and costs nothing to
add regardless of what the other two research threads find.

## Detail

### 1. Full `connectToDevice` signature and `ConnectionOptions`

From `node_modules/react-native-ble-plx/src/index.d.ts`:

```ts
connectToDevice(deviceIdentifier: DeviceId, options?: ConnectionOptions): Promise<Device>
```

```ts
/**
 * Connection specific options to be passed before connection happen. [Not used]
 */
export interface ConnectionOptions {
  /** [Android only] autoConnect */
  autoConnect?: boolean
  /** Whether MTU size will be negotiated to this value. Not guaranteed. */
  requestMTU?: number
  /** [Android only] Whether action will be taken to reset services cache (refreshGatt). */
  refreshGatt?: RefreshGattMoment
  /**
   * Number of milliseconds after which connection is automatically timed out. In case of a
   * race condition where connection is established right after timeout, device will be
   * disconnected immediately. Timeout may happen earlier than specified due to OS-specific
   * behavior.
   */
  timeout?: number
}
```

Notable: the interface's own doc comment says **"[Not used]"** at the top, which is stale/
misleading boilerplate left over from an older version of the file — the per-field docs
(`autoConnect`, `refreshGatt` explicitly marked `[Android only]`; `timeout` and `requestMTU`
carry no such platform restriction) and the confirmed upstream Swift source (§3 below) both show
`timeout` **is** implemented and respected on iOS too, contradicting that top-level comment.
Trust the field-level docs and the real source over the interface's summary line — another small
instance of `CLAUDE.md` §4.1's "don't trust the first thing you read" lesson, this time inside
the library's own types rather than a tutorial.

Return type: `Promise<Device>`. No iOS-specific behavior, timeout default, or failure-mode
documentation appears anywhere else near this declaration in the `.d.ts` — the file is
generated/hand-maintained API surface only, not a behavior guide.

### 2. No newer version fixes this — 3.5.1 is current

`npm view react-native-ble-plx dist-tags.latest` (checked live via the npm registry API) =
`3.5.1`, matching what's installed. There is no `CHANGELOG.md` in `node_modules` itself, but the
upstream repo's `CHANGELOG.md` was fetched directly and its most recent entries are:

| Version | Date | Relevant to this bug? |
|---|---|---|
| 3.5.1 | 2026-02-17 | No — Android null-pointer-crash guard only |
| 3.5.0 | 2025-02-07 | Not identified as connect-related |
| 3.4.0 | 2024-12-20 | **Android-only**: fixed timeout closing an already-established connection early — this is the opposite platform and opposite symptom from ours |
| 3.1.2 | 2023-10-26 | iOS advertising-data fields, not connect-hang |
| 3.1.0 | 2023-10-17 | Merged the `MultiPlatformBleAdapter` source into this repo's release process (see §3) |

**There is no version to upgrade to.** This project is already on the newest release.

### 3. Where the real iOS connect logic actually lives — and does it respect `timeout`?

This is the least obvious finding and the reason a plain grep of `node_modules` alone would have
been misleading. `node_modules/react-native-ble-plx/ios/` contains only 4 files:
`BlePlx.m`, `BlePlx.h`, `BlePlx-Bridging-Header.h`, `BlePlx-Swift.h` — **no `.swift` source
file**, confirmed via `Glob`. Grepping the whole package for `timeout` or `didFailToConnect`
returns **zero matches** — because the actual connection logic is not shipped in this npm
package at all.

`BlePlx.m` (read in full) is a thin Objective-C bridge: every `RCT_EXPORT_METHOD` (including
`connectToDevice:options:resolver:rejecter:`) does nothing but forward straight to
`[_manager connectToDevice:options:resolve:reject:]`, where `_manager` is a `BleClientManager*`.
`BlePlx-Swift.h` is a **generated** Objective-C interface header (auto-produced by the Swift
compiler for ObjC interop) whose own top comment reads `defined_in="MultiplatformBleAdapter"` —
confirming `BleClientManager` is not this repo's code, it's an external Swift module. The
podspec (`react-native-ble-plx.podspec`, line 18) confirms this explicitly:
`s.dependency "MultiplatformBleAdapter", "0.2.0"`.

That real implementation lives in a **separate repository**, `dotintent/MultiPlatformBleAdapter`
(`iOS/classes/BleModule.swift`), fetched by `pod install` at iOS-build time on the macOS CI
runner — never present in this Windows sandbox's `node_modules`, and not inspectable locally.
Fetched directly from GitHub instead. It confirms:

- **`timeout` IS wired up and respected on iOS**, via an RxSwift operator wrapped around the
  connection observable:
  ```swift
  if let timeout = timeout {
      let timeoutInterval = RxTimeInterval.milliseconds(Int(timeout))
      connectionObservable = connectionObservable.timeout(
          timeoutInterval, scheduler: ConcurrentDispatchQueueScheduler(queue: queue))
  }
  ```
  When the timer fires, RxSwift's `.timeout()` operator emits an error into the same
  `onError` handler that a real CoreBluetooth failure would use, which calls `error.bleError.
  callReject(promise)` — i.e. a timeout produces a normal, catchable JS rejection, not a crash
  or a different code path.
- **Without a `timeout` supplied (this project's current call), nothing wraps the observable in
  a deadline at all.** The promise then depends entirely on CoreBluetooth itself eventually
  calling back — and per the library's own wiki (fetched directly, quoted in Sources) and two
  long-standing upstream issues (#163, #1135), **"iOS by default does _not_ timeout the connect
  request"** — a stalled native connection attempt can hang for minutes or indefinitely with no
  callback fired on either side.
- A related, separately-reported gap (issue #331): if a disconnect event arrives from iOS
  *before* the connection observable resolves (e.g. right at the edge of range), the library's
  `safeConnectToDevice` in this version wasn't yet subscribed to disconnect events, so that
  signal is silently dropped instead of rejecting the promise — a second, independent way the
  promise can go unsettled that a `timeout` value would still catch (as a backstop) even if it
  doesn't fix the underlying gap directly.

So: **omitting `timeout` is not merely "a reasonable default that happens to be slow" — it
removes the only mechanism this library has on iOS for ever forcing the promise to settle.**
Android has its own OS-level ~5s/~30s connect timeout as a backstop (per issue #163's
discussion) even without a JS-supplied value; iOS has none. This matches why the same code path
reportedly works fine in a Windows/`bleak` sandbox (that's a different BLE stack with different
timeout defaults entirely) but hangs specifically on the iPhone.

### 4. GitHub issues and README — is this a documented known limitation?

Yes, on both counts:

- **Issue #163**, "connectToDevice doesn't time out on iOS": on iOS, connection attempts can
  wait far longer than Android's OS-enforced ~5s failure, consistent with no default timeout.
- **Issue #1135**, "Inconsistency in connectToDevice Timeout Behavior Between iOS and Android":
  confirms that when `timeout` IS supplied, iOS honors it as a connection-attempt-duration limit
  (matching the Swift source read above) — the inconsistency reported there is on the *Android*
  side (timeout was being misapplied as a max connection lifetime, not just attempt duration),
  not evidence against using `timeout` on iOS.
- **Issue #331**, "Disconnect events ignored if received before connection succeeds on iOS":
  a second, narrower iOS-only gap in the same area (see §3).
- The project's own wiki page, **"Device Connecting"**, states outright: *"iOS by default does
  not timeout the connect request"* and effectively recommends supplying a timeout / building
  your own deadline around the call.

### 5. Does `didFailToConnect` always reject the JS promise?

Per the `MultiPlatformBleAdapter` Swift source (fetched directly, see §3), the module does not
handle CoreBluetooth's `centralManager(_:didFailToConnect:error:)` delegate callback directly at
all — it's abstracted away inside `RxBluetoothKit`'s `Peripheral.connect()`/`.establishConnection()`
observable, which this module subscribes to with three arms: `onNext` (caches the peripheral),
`onError` (rejects), and `onCompleted`/`onDisposed` (resolves, or rejects with
`BleError.cancelled()` if disposed without ever completing). **In the normal case this does
reject the promise** whenever RxBluetoothKit itself surfaces a CoreBluetooth failure as an
`onError`. The identified gap is narrower than "callbacks are silently swallowed across the
board": it's specifically that (a) with no `timeout`, there is no forcing function if
CoreBluetooth itself never calls back at all (not a rejection being dropped — a rejection that
never gets triggered), and (b) per issue #331, a disconnect arriving in a specific timing window
before the connection observable settles could historically be missed by the disconnect
subscription rather than routed into `onError`. Neither is "the library eats a real
`didFailToConnect` error" — they're both "nothing in the chain ever fires for a stalled native
attempt."

## Unknowns — what this audit could not determine

- **Whether adding `{ timeout: N }` actually fixes the real iPhone's stuck state** — that
  requires running the modified code on the physical device (`CLAUDE.md` §5.2); this file only
  establishes that the mechanism plausibly explains the symptom and that the fix is real,
  low-risk, and library-supported.
- **Whether issue #331's disconnect-timing gap applies here** — would require reproducing at the
  edge of BLE range, not something this audit can determine from source alone.
- **Whether the CoreBluetooth-level or micro:bit-firmware-level causes the two parallel research
  threads are investigating are the actual root cause instead of (or in addition to) this.** This
  file is one plausible, well-sourced contributor, not a proven sole cause — a missing `timeout`
  would explain "hangs forever with no error" regardless of *why* CoreBluetooth itself is stuck,
  so it's worth adding even if another thread finds a different root trigger, but it doesn't
  explain a WHY on the CoreBluetooth/firmware side by itself.
