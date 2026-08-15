---
name: ble-ping
description: >
  Connects to the BBC micro:bit over BLE and sends/receives a test payload to prove the link is
  alive, first from the Windows laptop (bench) and then from the iPhone app. Use whenever
  verifying the phone-robot link before testing anything downstream of it — servo control,
  gimbal tracking, or any "the robot isn't responding" debugging, where the first question is
  always whether BLE is up at all.
---

# BLE Ping

Proves the phone↔micro:bit link independently of any CV or control code. When tracking
"doesn't work," this is the skill that tells you whether the problem is even in the link.

Background and the (corrected) packet format: `research/hardware/microbit-ble-link.md`.

## ✅ Bench test passed for real, 2026-08-15 — read this before assuming anything is broken

The bench half of this skill has actually been run: 20/20 pings echoed, median latency ~513ms
(see `testing/REAL_HARDWARE_TEST_LOG.md`). Getting there required finding and fixing three real
bugs that no amount of research alone would have caught:

1. **Standard MicroPython for micro:bit has no working `bluetooth.UART`.** The original version
   of this skill's firmware was MicroPython and is confirmed non-functional — checked directly
   against the official micro:bit MicroPython docs. `scripts/main.ts` is now MakeCode instead.
2. **MakeCode's Bluetooth defaults to requiring pairing.** Without the "no pairing required"
   config, a micro:bit running this firmware compiles and runs fine but never advertises for an
   open scan at all — `scripts/pxt.json`'s `yotta.config` block fixes this.
3. **MakeCode's UART characteristic UUIDs are reversed from the "standard" description.**
   Confirmed via a real GATT dump: write to `6e400003`, subscribe (via `indicate`, not `notify`)
   on `6e400002`. `bench_ping.py` and `src/ble/useBleConnection.ts` are both written against this
   confirmed layout now.

If you're re-running this skill and it fails, these three are the first things to check — not
generic BLE troubleshooting.

## Run the bench test first

Always. It removes the app, the CI pipeline, and iOS permissions from the equation — if the
laptop can't reach the micro:bit, the phone certainly can't, and you've saved a build round.

### 1. Build and flash the micro:bit

From `scripts/` (first run installs the MakeCode CLI toolchain, ~1 minute; later runs are fast,
no browser needed):

```
npx pxt target microbit
npx pxt install
npx pxt build
```

Copy `built/binary.hex` onto the micro:bit's `MICROBIT` USB drive — it auto-flashes and resets.
It advertises openly (no pairing) over the Nordic UART service and echoes back whatever raw
bytes it receives.

Confirm the display shows a `B` — that means BLE is advertising.

### 2. Ping it from the Windows laptop

```bash
pip install bleak
python .claude/skills/ble-ping/scripts/bench_ping.py
```

It scans (by service UUID, falling back to matching the advertised name), connects, sends 20
pings, and prints round-trip latency + a summary.

### 3. Interpret the result

| What you see | What it means |
|---|---|
| 20/20 echoed, `RESULT: PASS` | Working. The real bench run saw ~513ms median latency, ~35ms best-case — high, likely because MakeCode's TX characteristic uses `indicate` (which requires a per-message confirmation handshake) rather than `notify`. Not necessarily a blocker for a 10-20Hz control loop, but worth knowing before assuming a number this project hasn't measured yet. |
| Device never found in scan | Check the `B` on the display first. If it's not there, the firmware may have crashed on `bluetooth.startUartService()` — reflash and recheck. If `B` IS showing but still not found, re-verify `pxt.json`'s no-pairing config actually made it into the build (bug #2 above). |
| Connects then immediately drops | Usually power. See `research/hardware/power-brownout-risk.md` |
| Connects, no echo | Link is up but the micro:bit program is wrong — the useful half-result |
| Latency wildly variable beyond the ~500ms baseline | Interference, or the micro:bit is busy. Note it — it constrains the tracking loop |

## Then the phone test

Only after the bench test passes. Requires `react-native-ble-plx` (v3.5.1+, which ships its
**own** Expo config plugin — do **not** install `@config-plugins/react-native-ble-plx`, it peers
on Expo 49 and fails here) and a fresh build on the phone, since a config plugin change means a
full CI round. See `research/hardware/microbit-ble-link.md`.

Same success criterion as the bench test. Compare the latency to the bench number — if the phone
is dramatically slower, that's an iOS BLE behaviour worth recording, not a bug to chase blindly.

## Report back

Append to `testing/REAL_HARDWARE_TEST_LOG.md` — the bench half is already logged
(2026-08-15 entry); still needed:

- Phone: found / connected / echoed? Latency min, median, max, and how long the initial connect
  took.
- Did the link survive 60 seconds idle without dropping?
- micro:bit revision (v1 or v2) — this project's bench unit is confirmed v2 (Unique ID prefix
  `9905`); confirm the same board is used for the phone test.

## Notes

- The micro:bit must **not** be simultaneously connected to MakeCode/Mu over USB serial when
  testing BLE — that can interfere. Flash, unplug, then test. (In practice the bench test above
  was run with the board still USB-powered from the laptop — fine for power, just don't have an
  editor's serial connection open to it at the same time.)
- Pairing is explicitly disabled by `pxt.json`'s config (see bug #2 above) — keep this for bench
  testing; revisit only if this project ever has a real security requirement, which it doesn't.
