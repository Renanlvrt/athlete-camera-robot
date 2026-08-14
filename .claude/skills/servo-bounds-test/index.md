# .claude/skills/servo-bounds-test/ — index

Finds the real mechanical angle limits of the 2-axis gimbal and checks for BLE brownout under
servo load. A gate that must pass before any closed-loop tracking is wired up.

Not responsible for: the BLE link itself (see `../ble-ping/`), or drive-motor control (Phase 2,
not in scope — PRD §5.2).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Safety rules, sweep procedure, brownout stress test, report fields | ⚠️ needs verification (never run) |
| `scripts/microbit_servo_sweep.py` | file | MicroPython: button-driven incremental sweep with a centre-return panic button | ⚠️ needs verification (never flashed) |

## Depends on
`../ble-ping/` must pass first. `research/hardware/pca9685-servo-control.md` (units, frequency)
and `research/hardware/power-brownout-risk.md` (what to measure and why).
Hardware: PCA9685 board — **acquired and wired**, per direct user confirmation 2026-08-14
(`docs/PRD.md` §8). No longer hardware-blocked, just not yet run.

## Depended on by
`src/tracking/computeGimbalCorrection.ts`'s angle clamps should come from this test's real
output (currently unvalidated conservative guesses — see that file's own doc comment).
`../gimbal-control-firmware/`'s placeholder `ROLL_SAFE_MIN/MAX`/`PITCH_SAFE_MIN/MAX` constants
must be replaced with this test's measured values before trusting that firmware unattended.
