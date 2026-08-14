---
name: gimbal-control-firmware
description: >
  Flashes the production micro:bit program that receives gimbal-correction packets over BLE
  (Nordic UART) from the phone app and drives the roll/pitch servos on the PCA9685 accordingly.
  Use this once ble-ping has proven the BLE link and servo-bounds-test has measured the real
  safe servo range — this is the firmware that actually closes the tracking loop on the robot,
  as opposed to either of those two isolated test procedures.
---

# Gimbal Control Firmware

Unlike `ble-ping` and `servo-bounds-test`, this isn't a bench test — it's what the micro:bit
actually runs while filming. It's still a skill (not inline throwaway code) because re-flashing
it is a real, repeatable action every time the firmware changes.

## Before running this — hard prerequisites

1. **`.claude/skills/ble-ping/` has passed.** If the link isn't proven reliable at a basic
   ping/echo level, don't add servo movement and a real command protocol on top of it.
2. **`.claude/skills/servo-bounds-test/` has passed**, and you have its reported safe roll/pitch
   ranges in hand. `scripts/microbit_gimbal_control.py` ships with a **placeholder** ±30°
   range around centre (`ROLL_SAFE_MIN/MAX`, `PITCH_SAFE_MIN/MAX`) — replace those four constants
   with the real measured numbers from `testing/REAL_HARDWARE_TEST_LOG.md` before trusting this
   on the mounted gimbal unattended.

## What it does

Advertises as `athlete-robot` over the Nordic UART service (same identity `ble-ping`'s echo
script already used, so a phone that connected during `ble-ping` is connecting to the same
thing here). Reads the phone's 4-byte gimbal packets, decodes two signed big-endian int16 deltas
(tenths of a degree — see `src/ble/encodeGimbalPacket.ts` and
`research/hardware/microbit-ble-link.md`'s correction note for why signed, not absolute), adds
each to a running absolute position, clamps to the safe range, and writes the PCA9685 directly
(same register-level approach as `servo-bounds-test`, for the same reason: sidesteps the
centiseconds-vs-milliseconds trap in MicroPython/MakeCode PCA9685 extensions).

On BLE disconnect, servos **hold their last position** — no auto-recentre. Deliberate MVP scope,
not an oversight; see the script's own doc comment.

## Flash it

Copy `scripts/microbit_gimbal_control.py` onto the micro:bit (Python Editor or Mu), same as the
other two scripts. Display key: `B` = advertising/waiting, `C` = connected, `.` = a packet was
applied, `!` = no BLE support on this build.

## First real test — do this before a full field test

With the robot ON A STAND, phone removed from the gimbal (same safety posture as
`servo-bounds-test`):

1. Flash this firmware.
2. Run the app on the phone with a real camera position wired up (or even just pointed at
   yourself) so `useGimbalControl.ts` actually has a locked athlete to compute corrections from.
3. Watch `BleStatusBadge` in the app go `CONNECTED`.
4. Move slowly side to side / up-down in frame. The gimbal should follow, smoothly, staying
   within the clamped range — never slamming to a hard stop.
5. Walk fully out of frame. The gimbal should stop moving (no athlete → no correction sent) and
   simply hold position, not drift or hunt.

## Report back

Append to `testing/REAL_HARDWARE_TEST_LOG.md`:
- Did the gimbal track a slow, deliberate movement correctly (right direction, both axes)?
- Any oscillation/hunting when the athlete is near the deadband edge?
- Did it ever approach or hit the clamped safe range during normal movement (range too tight)?
- Any BLE drop or micro:bit reset during sustained tracking (brownout under *dynamic* load, as
  opposed to `servo-bounds-test`'s synthetic full-range sweep)?
- Whatever the real `ROLL_SAFE_MIN/MAX`/`PITCH_SAFE_MIN/MAX` you used were, if different from
  the placeholder — update the script's constants directly, don't just log them.
