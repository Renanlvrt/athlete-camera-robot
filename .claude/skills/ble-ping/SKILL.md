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

Background and the proposed packet format: `research/hardware/microbit-ble-link.md`.

## Run the bench test first

Always. It removes the app, the CI pipeline, and iOS permissions from the equation — if the
laptop can't reach the micro:bit, the phone certainly can't, and you've saved a build round.

### 1. Flash the micro:bit

Copy `scripts/microbit_ble_echo.py` onto the micro:bit (MicroPython, via the Python Editor or
Mu). It advertises as `athlete-robot` over the Nordic UART service and echoes back whatever it
receives, prefixed with `ACK:`.

Confirm the display shows a `B` — that means BLE is advertising.

### 2. Ping it from the Windows laptop

```bash
pip install bleak
python .claude/skills/ble-ping/scripts/bench_ping.py
```

It scans, connects, sends `PING`, and waits for `ACK:PING`. It prints round-trip latency for
each of 20 pings and a summary.

### 3. Interpret the result

| What you see | What it means |
|---|---|
| `ACK:PING`, latency ~20–80 ms | Working. Proceed. |
| Device never found in scan | micro:bit not advertising — reflash; check the `B` on the display |
| Connects then immediately drops | Usually power. See `research/hardware/power-brownout-risk.md` |
| Connects, no echo | Link is up but the micro:bit program is wrong — the useful half-result |
| Latency > 200 ms or wildly variable | Interference, or the micro:bit is busy. Note it — it constrains the tracking loop |

## Then the phone test

Only after the bench test passes. Requires `react-native-ble-plx` +
`@config-plugins/react-native-ble-plx` installed and a fresh build on the phone (a config plugin
change means a full CI round — see `research/hardware/microbit-ble-link.md`).

Same success criterion: send `PING`, receive `ACK:PING`. Compare the latency to the bench number
— if the phone is dramatically slower, that's an iOS BLE behaviour worth recording, not a bug to
chase blindly.

## Report back

Append to `testing/REAL_HARDWARE_TEST_LOG.md`:

- Bench: found / connected / echoed? Latency min, median, max over 20 pings.
- Phone: same three, plus how long the initial connect took.
- Did the link survive 60 seconds idle without dropping?
- micro:bit revision (v1 or v2) — matters, v1 has much less flash for the BLE stack.

## Notes

- The micro:bit must **not** be simultaneously connected to MakeCode/Mu over USB serial when
  testing BLE — that can interfere. Flash, unplug, then test.
- If pairing is required, micro:bit BLE pairing mode is entered with A+B held while pressing
  reset. `scripts/microbit_ble_echo.py` disables pairing (`pairing=False`) to keep the test
  simple — do not use that setting for anything beyond bench testing.
