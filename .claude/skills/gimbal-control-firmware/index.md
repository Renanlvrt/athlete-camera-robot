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
| `SKILL.md` | file | Prerequisites, what the firmware does, build/flash steps, first-real-test procedure, report fields | ⚠️ needs verification — BLE protocol layer confirmed on real hardware (see below), servo driving never run |
| `scripts/pxt.json` | file | MakeCode project config — declares the `bluetooth` dependency and the confirmed-required no-pairing config | ✅ verified — this exact config (adapted with a different firmware body) is what made the 20/20-ping bench test pass |
| `scripts/main.ts` | file | MakeCode/TypeScript: polls the raw BLE UART buffer → decodes signed packet → clamps → drives PCA9685, holds position on disconnect | ⚠️ needs verification — compiles cleanly via `pxt build` (confirmed 2026-08-15), BLE receive logic uses the same polling approach proven against real hardware (raw binary round-trip, including a payload of all-0x0A bytes), but the PCA9685/servo-driving half has never run — no PCA9685 was connected to the bench setup used for the BLE test. Ships with a PLACEHOLDER safe range that must be replaced with `servo-bounds-test`'s real measurement before trusting it unattended. **Supersedes a MicroPython version deleted 2026-08-15** — that version's `import bluetooth` was confirmed to have no working UART class in real MicroPython at all. |

## Depends on
`../ble-ping/` and `../servo-bounds-test/` must both pass first (see `SKILL.md`'s hard
prerequisites). Wire format must match `src/ble/encodeGimbalPacket.ts` exactly — if that file's
packet layout ever changes, this script's buffering/decode logic must change with it.
`research/hardware/microbit-ble-link.md` (wire format, and the 2026-08-15 pairing/UUID/framing
findings), `research/hardware/pca9685-servo-control.md` (units/frequency trap),
`research/hardware/power-brownout-risk.md` (why clamping matters).

## Depended on by
`docs/ROBOT_INTEGRATION_PLAN.md` sequences this as the last skill-driven step before the first
full field test with live tracking.
