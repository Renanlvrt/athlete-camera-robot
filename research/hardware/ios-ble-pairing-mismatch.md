# Is `pairing_mode: 0` sufficient to stop iOS from attempting BLE pairing/bonding?

- **Researched:** 2026-08-16
- **Confidence:** medium overall. **High** on the general mechanism (iOS bonding is
  peripheral-security-driven, not central-initiated; stale bonds require a manual "Forget This
  Device") — corroborated by Apple's own developer forums, Nordic DevZone, and micro:bit's own
  official support docs describing the near-identical MicroPython→MakeCode scenario. **Low** on
  whether this is *the* cause of today's specific hang, because that requires reading this
  exact iPhone's actual state (iOS Settings > Bluetooth, and/or a Console.app / Xcode device log
  capture during a connection attempt) — something only a human with the physical phone can do.
- **Expires:** When the phone-side hang is reproduced with a packet capture / `Console.app` log
  from the real iPhone (see "What would settle this" below), or when a human confirms/denies
  that "Forget This Device" changes the behavior. Also revisit if the micro:bit firmware is
  reflashed again — a NEW re-flash creates a NEW opportunity for the same stale-bond mismatch.
- **Sources:**
  - https://tech.microbit.org/software/runtime/ (DAL/CODAL overview)
  - https://github.com/lancaster-university/microbit-v2-samples/blob/master/codal.ble.json
    (CODAL's own BLE security config keys: `MICROBIT_BLE_PAIRING_MODE`,
    `MICROBIT_BLE_SECURITY_LEVEL`)
  - https://github.com/microsoft/pxt-microbit/blob/master/pxtarget.json (confirms `pxt-microbit`
    builds both an `mbdal` (V1, yotta) and `mbcodal` (V2, codal-microbit-v2) variant from the
    same target, and that the `yotta` config block in `pxt.json` is translated into `config.h`
    defines for **either** engine — same JSON schema, not V1-only)
  - https://punchthrough.com/core-bluetooth-guide/ (Punch Through's CoreBluetooth guide —
    pairing/bonding triggers)
  - https://devzone.nordicsemi.com/f/nordic-q-a/8507/getting-an-ios-central-app-to-bond
  - https://developer.apple.com/forums/thread/805282 ("Pairing failing after forgetting the
    device")
  - https://devzone.nordicsemi.com/f/nordic-q-a/31011/ios-and-nrf51822-pairing-after-erasing-bonding-info-problem
    (near-identical nRF/iOS report: peripheral bond info erased → iOS still holds the old bond →
    reconnection fails until the user manually forgets the device; "This is a security feature
    that cannot be avoided")
  - https://support.microbit.org/support/solutions/articles/19000026073-how-to-re-instate-bluetooth-after-previously-using-micropython
    — **official micro:bit support doc describing this project's exact history**
    (MicroPython → MakeCode) and its exact symptom
  - https://support.microbit.org/support/solutions/articles/19000080745 ("No pairing required"
    MakeCode project setting — already cited in `microbit-ble-link.md`; does NOT mention stale
    bonds, confirmed by fetching it directly)
  - https://forum.makecode.com/t/cant-connect-microbit-to-bluetooth/36312 (community thread,
    iPhone specifically reported as failing; "removing previously paired devices from the
    operating system's Bluetooth settings" listed as a fix that helped some users)
  - `src/ble/useBleConnection.ts` (read for context — confirms the app's `connect()` awaits
    `manager.connectToDevice()` then `discoverAllServicesAndCharacteristicsForDevice()`, and that
    an iOS-native stall at either step would surface as exactly "stuck on `connecting`, no
    resolve, no reject," matching the reported symptom)

## Conclusion

`pairing_mode: 0` / `open: 1` is a real, correctly-targeted setting — CODAL's own source
confirms `open: 1` means "no pairing is required and `security_level` is ignored," applied at
the GAP/GATT level on the micro:bit side, for both the V1 (yotta) and V2 (codal) build engines
pxt-microbit compiles against. **But it is a peripheral-side declaration that only prevents a
NEW pairing negotiation from being required — it cannot force iOS to discard an OLD one.** The
much more likely explanation for "stuck at connecting forever, no error" is a **stale
bonding/pairing record on the iPhone itself**, left over from this exact device's earlier
MicroPython-era Bluetooth identity (or any earlier flash/pairing attempt) — this is a
well-documented, cross-vendor iOS behavior (not micro:bit-specific), and micro:bit's own support
site independently documents this precise MicroPython→MakeCode transition as a known trigger for
it. **Recommended first fix: on the iPhone, go to Settings > Bluetooth, find the micro:bit
entry (it may show as "BBC micro:bit [name]" or just be absent/greyed out if iOS considers it
"not connectable"), tap the (i) and "Forget This Device," then retry the app's connection from
a cold state.** This costs a couple of minutes and needs no code or firmware change.

## Detail

### 1. How `pairing_mode`/`open`/`security_level` actually work on the micro:bit side

CODAL's own sample config (`codal.ble.json` in `microbit-v2-samples`) confirms the underlying
C++-level macros these yotta-style JSON keys compile down to: `MICROBIT_BLE_PAIRING_MODE`,
`MICROBIT_BLE_SECURITY_LEVEL` (values like `SECURITY_MODE_ENCRYPTION_NO_MITM` /
`SECURITY_MODE_ENCRYPTION_WITH_MITM`), plus an `open` flag. Per the search-derived summary of
that config's own documentation: `open: 1` means "no pairing is required and the
`security_level` property is ignored if this value is specified." This is applied by the
**peripheral** (the micro:bit) at connection/GATT-permission level — it is not something the
central negotiates or overrides. `pxtarget.json` in `pxt-microbit` confirms the same `pxt.json`
`yotta` config block is compiled for both the legacy `mbdal` (V1) and current `mbcodal` (V2,
`codal-microbit-v2`) build variants — so the existing `microbit-ble-link.md` claim that this key
applies to the actual V2 board in hand is correct, not a V1-only artifact.

**This confirms the firmware-side setting is doing what it's supposed to do for a genuinely new
central.** It does not, by itself, explain a hang against a central (this iPhone) that has prior
history with this exact device.

### 2. Does iOS's CoreBluetooth initiate pairing on its own, independent of what the peripheral requires?

No evidence found that it does. Every source checked (Punch Through's CoreBluetooth guide,
Nordic DevZone's iOS-bonding thread, Apple's own developer forums) describes bonding on iOS as
**reactive**, not proactive: "the pairing/bonding process can be triggered either at the point
of connection or by attempting to read, write, or subscribe to an encrypted characteristic,"
and this depends on **the peripheral's declared security requirements** for that
characteristic/connection, not a blanket iOS policy of "encrypt everything not explicitly
marked open." iOS exposes no explicit "bond now" API — bonding happens transparently, driven by
what the peripheral's GATT/SMP layer asks for. This means: if the micro:bit's `open: 1` /
`pairing_mode: 0` config is actually correctly compiled in and running (confirmed possible per
point 1), a **first-time** connection from a **never-before-seen** central should not trigger
an iOS pairing prompt or an encryption requirement — consistent with the fact that this exact
firmware/config combination already bench-passed 20/20 pings from a Windows/`bleak` central
(different central identity, no prior bonding history with this micro:bit).

One nuance worth flagging: `indicate` on `6E400002` is a **transport property**
(confirmation-per-message), not a security property — nothing found ties `indicate` specifically
to a security/encryption requirement on iOS. Apple's `.indicateEncryptionRequired` characteristic
option is an opt-in the *peripheral* code has to explicitly request; MakeCode's stock
`bluetooth.startUartService()` is not expected to set it (no evidence found either way from
MakeCode's own docs — **this specific claim is inferred, not directly confirmed**, since
MakeCode's Bluetooth extension source wasn't inspected in this pass). If it turns out MakeCode's
UART indicate characteristic does default to requiring encryption regardless of `open`, that
would be a second, independent explanation worth a follow-up — but nothing found in this pass
suggests that's the case, and the `open: 1` doc language ("no pairing is required... regardless
of `security_level`") reads as an unconditional override, not a per-characteristic one.

### 3. The stale-bonding-cache hypothesis — the strongest lead found

This is well supported, from three independent angles:

- **General iOS/CoreBluetooth behavior**, confirmed on Apple's own developer forums and Nordic's
  DevZone (a near-identical nRF51822 case): once iOS has bonded with a peripheral's Bluetooth
  address/identity, and that peripheral's keys are later erased or regenerated (e.g. by
  reflashing), iOS does **not** automatically detect the old bond is invalid. Per the Nordic
  thread: *"If a previously paired device loses the pairing keys, it must explicitly be removed
  by the user first in order to be able to create a secured connection again. This is a security
  feature that cannot be avoided... An accessory which has lost its keys is otherwise
  indistinguishable from a second accessory which might be trying to spoof the first one."*
  Critically, **iOS gives apps no programmatic way to clear this** — "iOS does not allow developer
  apps to clear a peripheral's bonding status from the cache," only the user can, via
  Settings > Bluetooth > (i) > Forget This Device.
- **micro:bit's own official support documentation independently describes this project's exact
  history as a known trigger.** The article "How to re-instate Bluetooth after previously using
  MicroPython" states that flashing MicroPython removes the DFU/pairing code, and that
  re-flashing MakeCode later "will remove all record of any previous Bluetooth pairing on the
  micro:bit itself" while **"the phone/tablet side will still remember the pairing, but this
  will now be invalid."** This project's actual history (per `microbit-ble-link.md`: MicroPython
  first, found completely broken, then switched to MakeCode) is precisely this scenario — if the
  phone was ever connected to (or attempted a connection to) this same micro:bit's Bluetooth
  address during the MicroPython phase, or during any earlier MakeCode build/config iteration,
  it may hold a now-invalid bonding record for it.
- **A community report of the exact platform split** (`forum.makecode.com`, "Can't connect
  Microbit to Bluetooth") lists iPhone specifically among the failing platforms, with "removing
  previously paired devices from the operating system's Bluetooth settings" as one of the fixes
  users report trying.

**Why this produces a silent, permanent hang rather than a visible error**: if iOS's
CoreBluetooth radio-level connection (`connectToDevice`) succeeds (the physical link comes up —
this is a lower-level operation than bonding), but the OS then tries to use/re-establish
encryption using a stale key during a subsequent GATT operation (`discoverAllServicesAndCharacteristicsForDevice`
in `src/ble/useBleConnection.ts`), the failure happens **inside iOS's Bluetooth daemon**, below
the level `react-native-ble-plx`'s JS bridge observes — it would not necessarily surface as a
rejected promise or an `onDeviceDisconnected` callback, just... nothing happening. That matches
"never succeeds, never errors" exactly, and matches `useBleConnection.ts`'s own state machine
(`'connecting'` is only left by `connectToDevice` resolving/rejecting or
`discoverAllServicesAndCharacteristicsForDevice` resolving/rejecting/throwing — if the native
call itself never settles, the JS state is stuck by construction, not by an app bug).

### What would settle this (needs the physical phone — route to `hardware-tester`)

1. **iOS Settings > Bluetooth**: does a "BBC micro:bit [xxxxx]" entry already exist there, in
   any state (paired, connected, not-connected, or greyed out)? Its mere presence, prior to any
   deliberate pairing action, is itself strong evidence for the stale-bond hypothesis.
2. If present: tap it, "Forget This Device," fully close the RN app (not just background it,
   since `BleManager` holds native state), relaunch, and retry the connection.
3. If that fixes it, this is confirmed as the root cause and needs no firmware or app-code
   change — just a one-time device hygiene step, worth documenting in `testing/` as a required
   step after any future micro:bit re-flash.
4. If forgetting the device does **not** fix it, the more targeted next step is a `Console.app`
   log capture (Mac required, or a jailbreak-free on-device log via Xcode's Devices window if a
   Mac is reachable even briefly) filtered on `bluetoothd` during a connection attempt — this
   would show explicitly whether iOS is attempting an SMP pairing/encryption exchange at all,
   which would either confirm or rule out the security-mismatch theory outright rather than
   leaving it inferred.

### What this note could NOT determine

- Whether a "BBC micro:bit" entry currently exists in this specific iPhone's Bluetooth settings —
  requires physical access to the phone.
- Whether MakeCode's `bluetooth.startUartService()` sets `.indicateEncryptionRequired` (or the
  CODAL-level equivalent) on the `indicate` characteristic by default, independent of the
  `open`/`pairing_mode` project setting — inferred as unlikely from the "unconditional override"
  reading of `open: 1`'s own documentation, but not directly confirmed against MakeCode's
  Bluetooth extension source.
- Whether this exact hang has occurred against a **freshly-forgotten, never-bonded** phone/micro:bit
  pair — if the developer has another iPhone (or resets Bluetooth on this one first) and the hang
  reproduces even then, the stale-bond hypothesis is disproven and the cause is elsewhere (e.g.
  the "MakeCode indicate defaults to encryption" possibility above, or an unrelated
  `react-native-ble-plx` iOS bridge bug — see `dotintent/react-native-ble-plx` issue #568 for a
  precedent of iOS promises not resolving/rejecting on writes, a structurally similar symptom).
