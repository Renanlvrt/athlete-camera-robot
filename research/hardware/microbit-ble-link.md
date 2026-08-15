# Phone ↔ micro:bit BLE link

- **Researched:** 2026-08-09; **hardware-confirmed 2026-08-15** — see "✅ CONFIRMED ON REAL
  HARDWARE" below, which supersedes the app-side-only confidence notes from 2026-08-09.
- **Confidence:** high on the library choice (verified against the registry and the library's
  own README); **high, hardware-confirmed** on the GATT/firmware approach as of 2026-08-15 (was
  "medium, proposal" before); the packet format is still app-side-only confirmed (typecheck +
  unit tests), not yet exercised end-to-end through the real app.
- **Expires:** When the phone-side app has actually sent a real gimbal packet and moved a servo
  — log that in `testing/`. The bench-level BLE facts below (pairing, characteristic UUIDs,
  MicroPython vs MakeCode) are unlikely to change; the end-to-end app path is still open.
- **Sources:**
  - https://github.com/dotintent/react-native-ble-plx/blob/master/README.md
  - `npm view react-native-ble-plx` — version 3.5.1, peers `react: *`, `react-native: *`
  - `npm install --dry-run` against this project, 2026-08-09
  - Real hardware: a BBC micro:bit (Unique ID prefix `9905`, confirmed V2), bench-tested
    2026-08-15 via `.claude/skills/ble-ping/scripts/bench_ping.py` (20/20 pings, real GATT dump)
  - https://microbit-micropython.readthedocs.io/en/v2-docs/ble.html (official docs — confirms
    standard MicroPython has no usable BLE UART)
  - https://support.microbit.org/support/solutions/articles/19000080745 ("no pairing required"
    MakeCode project setting)

## ✅ CONFIRMED ON REAL HARDWARE, 2026-08-15 — read this section first

Everything below this point was **proposal, not fact** until tonight. A real end-to-end BLE bench
test (`ble-ping`, 20/20 pings, see `testing/REAL_HARDWARE_TEST_LOG.md`) found three real bugs,
none of which research alone could have caught:

1. **Standard MicroPython for the micro:bit has NO working `bluetooth.UART`.** Confirmed against
   the official docs: only BLE-based firmware *flashing* is implemented for user-facing
   MicroPython; there is no general serial/UART service exposed to Python code, on V1 **or V2**.
   `import bluetooth; bluetooth.UART(...)` — the approach this file originally proposed and
   `ble-ping`/`gimbal-control-firmware`'s first-draft firmware used — compiles and runs, but
   never advertises anything. This is NOT a flash-capacity issue (the original v1-vs-v2 flash
   concern below); it's a missing feature, full stop.
   **Fix: use MakeCode (Static TypeScript) instead.** Its `bluetooth` package has a real,
   working UART implementation. Built via the `pxt` CLI — no browser required, and confirmed to
   produce a correct build once the config below is right (there was never an actual gap between
   the CLI and the web editor; both compile the same source against the same target).
2. **MakeCode's Bluetooth defaults to requiring pairing.** A micro:bit running
   `bluetooth.startUartService()` with default settings compiles, runs, and does not crash — but
   never advertises for an open scan. This is the MakeCode web editor's Project Settings toggle
   "No pairing required: anyone can connect via Bluetooth"; from the CLI it's set via
   `pxt.json`:
   ```json
   "yotta": {
     "config": {
       "microbit-dal": {
         "bluetooth": { "enabled": 1, "open": 1, "pairing_mode": 0, "whitelist": 0, "security_level": null }
       }
     }
   }
   ```
   Found by reading `node_modules/pxt-microbit/built/target.json`'s own bundled config presets
   directly (`CLAUDE.md` §4.1) after the default (`pairing_mode: 1, whitelist: 1`) was suspected
   from the MakeCode support docs. This key name (`microbit-dal`) is shared between the legacy
   V1 (yotta) and current V2 (codal) build engines in this target — no separate "codal" block
   was needed.
3. **MakeCode's UART characteristic UUIDs are reversed from the "standard" Nordic UART
   description.** Confirmed by dumping the real GATT table off the device:
   ```
   Service 6e400001-...:
     6e400002-...  properties=['indicate']                        <- SUBSCRIBE here (their TX)
     6e400003-...  properties=['write', 'write-without-response']  <- WRITE here (their RX)
   ```
   This is the reverse of the RX=6e400002-write / TX=6e400003-notify layout the Nordic UART
   spec's plain-English description (and this file, and `src/ble/useBleConnection.ts`) assumed
   before this test. Also note: **`indicate`, not `notify`** — `indicate` requires a
   confirmation round-trip per message, which is the most likely explanation for the latency
   below.
4. **The gimbal packet is binary — do not use MakeCode's delimiter-triggered UART pattern for
   it.** The common MakeCode pattern (`bluetooth.onUartDataReceived(delimiter, ...)` +
   `uartReadUntil(delimiter)`) fires on a specific byte value appearing in the stream — fine for
   text, unsafe for a 4-byte binary packet where that byte value (e.g. `0x0A`, `10`) can
   legitimately be part of the payload (any delta of exactly ±1.0°, ±25.6°, etc.). Verified
   empirically: a payload of four `0x0A` bytes echoed correctly using
   `bluetooth.uartReadBuffer()` polled directly in a loop (no delimiter at all), which would NOT
   have survived delimiter-based framing. `.claude/skills/gimbal-control-firmware/scripts/main.ts`
   uses this polling approach.

**Real measured latency (bench, 20 pings):** min 34.6ms, median ~513ms, max ~534ms. The large gap
between best-case and typical is consistent with `indicate`'s per-message confirmation handshake
(point 3 above) rather than radio-level noise — the first ping (before any connection-parameter
renegotiation) was the fast one. **This has not yet been evaluated against PRD §7's 10-20Hz
send-rate requirement** — worth revisiting once the real app path is exercised, since ~500ms
per confirmed message is far slower than a naive read of "10-20Hz" would assume works.

**Device discovery also needed a fallback.** On Windows, the service UUID sometimes only appears
in a scan-response packet that isn't reliably merged into what a scanning API reports — confirmed
by dumping raw BLE advertisement data, which showed the primary advertisement typically carries
only the device name. `bench_ping.py` and `src/ble/useBleConnection.ts` both now match on EITHER
the service UUID or an advertised name starting with `"BBC micro:bit"` (MakeCode's fixed,
non-configurable device name pattern), not UUID alone.

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

**Decided and confirmed: UART**, because the first thing that matters is proving the link is
alive at all (`ble-ping`), not efficiency — and this is now proven working end-to-end at the
bench level (see the confirmed-facts section above). Optimize only if the ~500ms `indicate`
latency measured above turns out to actually matter for the real control loop; PRD §2.3's
original ~20-50ms latency estimate was for the radio itself, not for `indicate`'s confirmation
overhead, which wasn't anticipated at planning time.

One real constraint, still relevant even though the language toolchain changed: MakeCode's
Bluetooth extension and the `radio` package still **conflict** (can't use both) and Bluetooth
still costs a meaningful chunk of flash. This project's bench-tested board is confirmed **V2**
(Unique ID prefix `9905`, ample flash) — the V1 flash-capacity concern below is real but doesn't
apply to the hardware actually in hand.

### Command packet — confirmed working via a binary-safe polling approach, not delimiters

Fixed **4 bytes**, no delimiters, no parsing ambiguity:

```
[roll_hi, roll_lo, pitch_hi, pitch_lo]
```

**Firmware-side receive confirmed 2026-08-15**: do not use MakeCode's usual
`onUartDataReceived(delimiter, ...)` pattern for this — see point 4 in the confirmed-facts
section above for why a binary payload breaks delimiter framing, and
`.claude/skills/gimbal-control-firmware/scripts/main.ts` for the polling approach that was
verified instead. This closes one of `docs/PRD.md` §7's open questions — the byte layout itself
was always a reasonable proposal; what changed 2026-08-15 is knowing HOW to receive it correctly
on the firmware side.

#### ⚠️ Correction, 2026-08-14 — signed deltas, not unsigned absolute angles

The original version of this section specified "two big-endian **uint16**s, each an angle in
tenths of a degree (**0–1800 = 0.0–180.0°**)" — i.e. unsigned absolute angles. That is
**inconsistent with `src/tracking/computeGimbalCorrection.ts`**, written and ✅-verified after
this research note, which was deliberately designed to output **deltas** (`GimbalCorrection.
rollDelta`/`pitchDelta`), not absolute angles — see that file's doc comment: "the phone does not
know the true servo position... the micro:bit owns absolute position and applies these
increments against its own clamps." A delta can be negative (e.g. "move 3° left"); an unsigned
0–1800 range cannot represent that at all.

Caught while building `src/ble/encodeGimbalPacket.ts` (task: wiring the control loop to BLE for
the first time) — nothing had implemented this packet before, so nothing was silently broken,
but writing the encoder is what forced reconciling the two documents.

**Corrected format:** two big-endian **signed int16**s (two's complement), each a **delta** in
tenths of a degree. Range ±3276.7°, vastly more than ever needed — `defaultGimbalTuning.maxStep`
(`src/tracking/types.ts`) caps real deltas at ±5.0° (±50 in this encoding) — the wide range is
just "plain signed 16-bit integer," not a deliberately chosen limit. The micro:bit firmware reads
each half as a signed big-endian 16-bit integer, divides by 10 for degrees, and **adds it to its
own running absolute position** (then clamps to the mechanical limits from
`.claude/skills/servo-bounds-test/`) — the phone never sends or knows an absolute angle.

The transport this rides on (BLE UART, binary-safe receive) is now hardware-confirmed (see
above). The actual roll/pitch-delta decode-and-drive path is still only confirmed via the app's
own unit tests (`src/ble/encodeGimbalPacket.test.ts`) and a clean `pxt build` of
`gimbal-control-firmware`'s TypeScript — the first real servo-control test (after
`servo-bounds-test`) is what confirms this end to end.

### Send rate — important

**Do not send one packet per camera frame.** At 30fps that's 30 writes/sec of mostly-redundant
data, which will congest the link and can destabilize the connection. Rate-limit to **10–20 Hz**
and only send when the target angle has actually changed by more than a small deadband. The
servos cannot respond meaningfully faster than that anyway.

**On the ~500ms latency measured above — likely not as bad as it sounds for this specific use
case.** That number was measured for a full round trip (write + wait for an `indicate`
confirmation back), which is what the ping-echo test does. The actual gimbal control loop
(`useGimbalControl.ts`) only ever WRITES — it's fire-and-forget, `writeCharacteristicWithoutResponseForDevice`,
no reply expected — and the RX characteristic's `write-without-response` property (confirmed in
the same GATT dump) has no confirmation handshake at all. Whether one-way writes are actually
fast is a distinct, still-open question from the round-trip number above — worth measuring
directly (e.g. time N one-way writes back-to-back) before assuming either the good or bad case.
