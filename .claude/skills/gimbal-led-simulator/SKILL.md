---
name: gimbal-led-simulator
description: >
  Flashes a micro:bit firmware that visualizes real gimbal-correction BLE packets on the 5x5 LED
  matrix instead of driving servos — an arrow toward frame centre, a filled square when
  centred, an X when no athlete is detected. Use this to validate the full CV -> BLE -> firmware
  pipeline with zero servo/motor risk, before gimbal-control-firmware is ever trusted to move
  real hardware. This is the MVP validation step the user explicitly wants before connecting
  anything to motors or servos.
---

# Gimbal LED Simulator

Same BLE wire protocol as `.claude/skills/gimbal-control-firmware/` — the phone app doesn't know
or care which firmware is running. This one only ever touches the LED matrix, never I2C/PCA9685,
so it's safe to run with nothing but the micro:bit connected. Built and flashed 2026-08-15,
mechanically smoke-tested (connects, accepts packets, no crash) — **the actual visual mapping
has NOT been human-confirmed yet.**

## Prerequisites

Just `.claude/skills/ble-ping/` having passed — this firmware IS effectively a more elaborate
`ble-ping` responder, using the same no-pairing config and binary-safe polling-receive approach,
both already hardware-confirmed working (`research/hardware/microbit-ble-link.md`).

## What it shows

| Display | When | Why |
|---|---|---|
| Filled square (□) | A packet arrives with BOTH deltas exactly 0 | `computeGimbalCorrection.ts`'s deadband makes a correction exactly (0,0) precisely when the athlete is centred — a real, reliable signal, not a guess |
| Arrow (8 directions) | A packet arrives with a nonzero delta | Points from the athlete's position TOWARD frame centre — e.g. athlete in the bottom-left of frame → arrow points top-right. This is the OPPOSITE of the actual servo chase-direction (`computeGimbalCorrection.ts`'s own convention moves the gimbal TOWARD the athlete to follow them) — deliberately shown this way because it's what was asked for |
| X | No packet received for 1.5 seconds | There's no "nobody detected" packet on the wire — `useGimbalControl.ts` simply sends nothing when no athlete is locked, so this is a watchdog timeout, not a decoded value |

## Build and flash it

Same as every other MakeCode skill in this project — from `scripts/`:

```
npx pxt target microbit
npx pxt install
npx pxt build
```

Copy `built/binary.hex` onto the micro:bit's `MICROBIT` USB drive.

## How to actually test it (this is the part that needs you)

1. Flash this firmware. Confirm the display starts on the X icon (no BLE connection yet).
2. Launch the app on your phone, pointed at yourself or another person. Watch `BleStatusBadge`
   reach `BLE: CONNECTED`.
3. **The X should change** once the app locks onto you and starts sending corrections — to
   either the square (if you're centred) or an arrow (if not).
4. **Move slowly, deliberately, in one direction at a time** — step or lean left, right, up
   (crouch), down. Confirm the arrow updates and points where you'd expect. This is the direct
   test of the "rotate the phone / move the target and watch it react" requirement.
5. **Get yourself centred in frame** (use the app's own on-screen readout as ground truth — it
   already shows "CENTERED" in green when you are). Confirm the LED switches to the square at
   the same moment.
6. **Step fully out of frame.** Confirm the LED switches to X within about 1.5 seconds, not
   instantly (there's a deliberate timeout, not a hard cutoff) and not never.
7. **Walk back into frame off-centre.** Confirm it switches back to an arrow, correctly again.

## Report back

This is exactly the kind of thing `CLAUDE.md` §5.2 reserves for a human — an agent can confirm
the firmware runs and accepts packets (already done, see above) but cannot see an LED matrix.
Append to `testing/REAL_HARDWARE_TEST_LOG.md`:
- Did each of the 3 states appear at the right moment?
- Were the arrow directions correct for slow, deliberate movement in each of the 4 cardinal
  directions at minimum (diagonals if you want to be thorough)?
- Did the timeout-to-X feel right, or too slow/fast? (Change `NO_DETECTION_TIMEOUT_MS` in
  `scripts/main.ts` if so — it's a plain constant, no protocol implications.)
- Anything about the ~500ms BLE latency (measured in `ble-ping`'s bench test) that made the
  display feel laggy relative to your actual movement?

Once this is fully confirmed working, it's the sign-off to move to `servo-bounds-test` and
eventually swap this firmware for `gimbal-control-firmware`'s real servo-driving version —
not before, per the user's own explicit sequencing.
