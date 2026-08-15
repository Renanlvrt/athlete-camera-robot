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

## ⚠️ Rewritten 2026-08-15 — MicroPython BLE does not work, this is MakeCode now

The original version of this skill was written in MicroPython (`import bluetooth`). That is
**confirmed broken**: standard MicroPython for micro:bit has no working Bluetooth UART class at
all — checked directly against the official micro:bit MicroPython docs, which state only
BLE-based firmware-update features are implemented, nothing usable from user code. This wasn't
discovered until real hardware testing (see `.claude/skills/ble-ping/`'s own history) — no amount
of research alone would have caught it. The firmware is now written in **MakeCode** (Static
TypeScript), built via the `pxt` command-line compiler — no browser required, and proven to
produce a working build (`research/hardware/microbit-ble-link.md`'s 2026-08-15 entry).

## Before running this — hard prerequisites

1. **`.claude/skills/ble-ping/` has passed.** If the link isn't proven reliable at a basic
   ping/echo level, don't add servo movement and a real command protocol on top of it.
2. **`.claude/skills/servo-bounds-test/` has passed**, and you have its reported safe roll/pitch
   ranges in hand. `scripts/main.ts` ships with a **placeholder** ±30° range around centre
   (`ROLL_SAFE_MIN/MAX`, `PITCH_SAFE_MIN/MAX`) — replace those four constants with the real
   measured numbers from `testing/REAL_HARDWARE_TEST_LOG.md` before trusting this on the mounted
   gimbal unattended.

## What it does

Advertises openly (no pairing required — see `scripts/pxt.json`'s `yotta.config` block, and the
"two real bugs" note below) over the Nordic UART service. Reads the phone's 4-byte gimbal
packets by **polling the raw UART buffer directly** (not MakeCode's usual delimiter-triggered
event pattern — the packet is binary, and a delimiter byte value can legitimately appear inside
it; see `scripts/main.ts`'s doc comment for why this matters and how it was verified against real
hardware), decodes two signed big-endian int16 deltas (tenths of a degree — see
`src/ble/encodeGimbalPacket.ts` and `research/hardware/microbit-ble-link.md`'s correction note
for why signed, not absolute), adds each to a running absolute position, clamps to the safe
range, and writes the PCA9685 directly (same register-level approach as `servo-bounds-test`, for
the same reason: sidesteps the centiseconds-vs-milliseconds trap in MicroPython/MakeCode PCA9685
extensions).

**Two real bugs were found and fixed getting BLE working at all** (full detail in
`research/hardware/microbit-ble-link.md`): MakeCode's Bluetooth defaults to requiring pairing
(fixed via `pxt.json`'s config, not code), and its UART characteristic UUIDs are reversed from
what the Nordic UART spec's description alone suggests (confirmed via a real GATT dump;
`src/ble/useBleConnection.ts` already matches the confirmed layout).

On BLE disconnect, servos **hold their last position** — no auto-recentre. Deliberate MVP scope,
not an oversight; see the script's own doc comment.

## Build and flash it

From `scripts/` (first run installs the toolchain, ~1 minute; later runs are fast):

```
npx pxt target microbit
npx pxt install
npx pxt build
```

Copy `built/binary.hex` onto the micro:bit's `MICROBIT` USB drive — it auto-flashes and resets.
Display key: `B` = advertising/waiting, `C` = connected, a diamond icon = a packet was applied.

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
