# Phone ↔ micro:bit BLE link

- **Researched:** 2026-08-09 (corrected same day — see the correction note below)
- **Confidence:** high on the library choice (verified against the registry and the library's
  own README); **medium** on the GATT approach; the packet format below is a *proposal*, not yet
  tested against hardware.
- **Expires:** On first real hardware test — replace the proposal with what actually worked and
  log it in `testing/`.
- **Sources:**
  - https://github.com/dotintent/react-native-ble-plx/blob/master/README.md
  - `npm view react-native-ble-plx` — version 3.5.1, peers `react: *`, `react-native: *`
  - `npm install --dry-run` against this project, 2026-08-09

## Conclusion

Use **`react-native-ble-plx`** (v3.5.1) and its **own built-in Expo config plugin**. Do **not**
install `@config-plugins/react-native-ble-plx`. On the micro:bit side, start with the Nordic UART
service and write a fixed 4-byte gimbal command to it.

## ⚠️ Correction — the obvious answer is out of date

The first version of this file recommended `@config-plugins/react-native-ble-plx`, because that
is what search results overwhelmingly say. **It does not work on this project:**

```
npm error Could not resolve dependency:
npm error peer expo@"^49" from @config-plugins/react-native-ble-plx@7.0.0
```

That community plugin peers on **Expo 49**; this project is on **Expo 57**. It exists because
`react-native-ble-plx` historically shipped no plugin of its own. **It now does** — v3.x
includes a built-in one, and its README says to reference it directly. The community package is
effectively obsolete for modern Expo.

This is the second time in one session that the majority answer online was a major version
behind (the first was the VisionCamera config plugin —
`../phone-integration/expo-cng-constraints.md`). It's why `CLAUDE.md` §4.1 exists. Checking
`npm view` and running `npm install --dry-run` took under a minute and settled it definitively.

## Detail

### App side

```bash
npx expo install react-native-ble-plx
```

```json
{
  "plugins": [
    ["react-native-ble-plx", {
      "modes": ["central"],
      "bluetoothAlwaysPermission": "Connect to the camera robot over Bluetooth"
    }]
  ]
}
```

Verified 2026-08-09: `react-native-ble-plx@3.5.1` alone resolves cleanly against this project's
dependency tree (`npm install --dry-run`, no ERESOLVE). Confirm the plugin's accepted options
against the current README before relying on the exact keys above — those were not verified.

The phone is **central**, the micro:bit is **peripheral** — the app scans and connects, not the
other way round. `isBackgroundEnabled` is not needed: filming happens with the app in the
foreground.

Two notes:
- This cannot run in **Expo Go**. It needs a custom dev build, which is what the CI pipeline
  produces anyway.
- Config plugin changes require a **rebuild and re-prebuild** to take effect — i.e. a full CI
  round. Get the plugin config right the first time; see the install-discipline note in
  `../computer-vision/frame-processor-stack-v5.md`.

### micro:bit side

The micro:bit has built-in BLE, but its stock services are awkward here:

- The **Bluetooth UART service** is the path of least resistance — send a short ASCII or binary
  string, parse it in MakeCode/MicroPython. Easiest to debug, slightly wasteful.
- A **custom GATT characteristic** is tidier and lower-overhead, but more work on the micro:bit.

**Recommendation: start with UART**, because the first thing that matters is proving the link is
alive at all (`ble-ping`), not efficiency. Optimize only if latency measurements justify it —
and PRD §2.3 already notes BLE latency (~20–50 ms) is expected to be dominated by CV latency, so
it probably won't.

One real constraint: MakeCode's Bluetooth extension and the radio extension **conflict** —
enabling Bluetooth costs a large chunk of the micro:bit's limited flash, and on a v1 board may
not fit alongside much else. Worth confirming which micro:bit revision is on hand.

### Proposed command packet

Fixed **4 bytes**, no delimiters, no parsing ambiguity:

```
[roll_hi, roll_lo, pitch_hi, pitch_lo]
```

Two big-endian uint16s, each an angle in tenths of a degree (0–1800 = 0.0–180.0°). Fixed width
means the receiver never has to handle partial messages or scan for terminators.

This closes one of `docs/PRD.md` §7's open questions — **provisionally**. It is a proposal from
research, not a tested protocol. Confirm with `ble-ping` before treating it as settled.

### Send rate — important

**Do not send one packet per camera frame.** At 30fps that's 30 writes/sec of mostly-redundant
data, which will congest the link and can destabilize the connection. Rate-limit to **10–20 Hz**
and only send when the target angle has actually changed by more than a small deadband. The
servos cannot respond meaningfully faster than that anyway.
