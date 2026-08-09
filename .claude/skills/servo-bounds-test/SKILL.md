---
name: servo-bounds-test
description: >
  Sweeps the gimbal roll/pitch servos across their range from the micro:bit side to find the
  real mechanical limits and to check for BLE brownout under load. Use before wiring any live
  tracking to the servos, after any change to the power setup or wiring, and whenever the robot
  resets or drops its connection while moving — the classic symptom of a servo current spike.
---

# Servo Bounds Test

Two questions, answered together because they share a setup:

1. **What is the real safe angle range** of each gimbal axis, given the 3D-printed mechanics?
2. **Does the system brown out** when servos draw current?

Both must be answered before closed-loop tracking runs. Background:
`research/hardware/pca9685-servo-control.md` and `research/hardware/power-brownout-risk.md`.

## Safety — read before running

- **Robot on a stand, wheels off the ground.** Drive motors unpowered. Phase 1 is gimbal-only
  (PRD §5.1, §6).
- **Remove the phone from the gimbal** for the first run. You are deliberately driving servos
  toward their limits; do not do that with a phone clamped in the mount.
- **Battery disconnect within reach.** A stalled servo draws maximum current continuously and
  gets hot fast.
- **Prerequisite:** `.claude/skills/ble-ping/` passes. Do not debug servos and BLE at once.

## Procedure

### 1. Know the units trap (this script avoids it, but you should know why)

`research/hardware/pca9685-servo-control.md` documents the footgun: many micro:bit PCA9685
**extensions** take pulse widths in **centiseconds**, not milliseconds — so 0°/90°/180° are
**100/150/200**, not 1.0/1.5/2.0. Passing the wrong unit makes every servo slam to one extreme,
which looks exactly like a wiring fault.

`scripts/microbit_servo_sweep.py` **sidesteps this** by writing PCA9685 registers directly and
computing the 12-bit pulse counts itself. The trap matters if you ever swap to an
extension-based implementation — and it matters when reading other people's micro:bit servo
code, which is where you'll meet it.

The script sets **50 Hz** in `pca_init()`. The chip powers on near 200 Hz, which makes analog
servos buzz, jitter, or sit unresponsive — a very common "the servos are broken" false alarm.

### 2. Flash and run the sweep

Copy `scripts/microbit_servo_sweep.py` onto the micro:bit. It sweeps one axis at a time, in
**small steps with a pause between each**, starting from centre and widening outward — so you
can stop it the instant something binds.

Controls:
- **Button A** — step outward (widen the range being tested)
- **Button B** — return to centre immediately
- **A+B** — switch axis (roll ↔ pitch)

The display shows the current angle.

### 3. Find the mechanical limits, by hand and eye

For each axis, step outward until you **see or hear** the mechanism start to bind — resistance,
a change in servo pitch, the frame flexing. **Stop there and press B.** Do not push through it.

Record the last *comfortable* angle in each direction, then subtract a few degrees of margin.
That margin is what goes into the software clamp.

### 4. Brownout test — the part that matters

Now deliberately stress it:

1. Sweep **both axes simultaneously**, full commanded range, at full speed. One servo moving
   slowly will pass and prove nothing.
2. Hold a servo against a soft mechanical limit for ~2 seconds.
3. Watch: does the micro:bit reset? Does the BLE link drop? Does the display glitch?
4. If you have a multimeter, measure supply voltage during the sweep.
5. Repeat with a **half-discharged battery**. A fresh pack behaves differently, and filming
   sessions are long.

## Report back

Append to `testing/REAL_HARDWARE_TEST_LOG.md`:

- **Roll axis:** safe min/max in degrees. What binding felt or sounded like at the limit.
- **Pitch axis:** same.
- **Brownout:** did the micro:bit reset or drop BLE, under which of the four conditions above?
- **Voltage** under load, if measured.
- **Unit used** (centiseconds or milliseconds) and the PWM frequency — so the next person
  doesn't rediscover it.
- Anything that got warm.

## What happens with the result

The measured safe range becomes a hard clamp in `computeGimbalCorrection.ts`. Per
`research/hardware/power-brownout-risk.md`, clamping and slew-limiting are the first two
brownout mitigations and both live in software — design that function with them from the start
rather than retrofitting after the first brownout.
