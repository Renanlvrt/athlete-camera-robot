# .claude/skills/gimbal-control-firmware/ — index

The production micro:bit program that closes the tracking loop: receives gimbal-correction
packets from the phone over BLE and drives the roll/pitch servos. Distinct from `../ble-ping/`
(proves the link only, no servos) and `../servo-bounds-test/` (moves servos only, no BLE
commands from the phone) — this is what actually runs on the robot during filming, once both
of those have passed.

Not responsible for: proving the BLE link is alive (`../ble-ping/`), finding the safe servo
range (`../servo-bounds-test/`), or anything on the phone side (`src/ble/`, `src/hooks/useGimbalControl.ts`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Prerequisites, what the firmware does, flashing steps, first-real-test procedure, report fields | ⚠️ needs verification (never run) |
| `scripts/microbit_gimbal_control.py` | file | MicroPython: BLE-UART receive → decode signed packet → clamp → drive PCA9685, holds position on disconnect | ⚠️ needs verification — never flashed; ships with a PLACEHOLDER safe range that must be replaced with `servo-bounds-test`'s real measurement before trusting it unattended |

## Depends on
`../ble-ping/` and `../servo-bounds-test/` must both pass first (see `SKILL.md`'s hard
prerequisites). Wire format must match `src/ble/encodeGimbalPacket.ts` exactly — if that file's
packet layout ever changes, this script's `_decode_int16_be`/buffering logic must change with it.
`research/hardware/microbit-ble-link.md` (wire format), `research/hardware/pca9685-servo-control.md`
(units/frequency trap), `research/hardware/power-brownout-risk.md` (why clamping matters).

## Depended on by
`docs/ROBOT_INTEGRATION_PLAN.md` sequences this as the last skill-driven step before the first
full field test with live tracking.
