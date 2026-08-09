# .claude/skills/servo-bounds-test/ — index

Finds the real mechanical angle limits of the 2-axis gimbal and checks for BLE brownout under
servo load. A gate that must pass before any closed-loop tracking is wired up.

Not responsible for: the BLE link itself (see `../ble-ping/`), or drive-motor control (Phase 2,
not in scope — PRD §5.2).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Safety rules, sweep procedure, brownout stress test, report fields | ⚠️ needs verification (never run) |
| `scripts/microbit_servo_sweep.py` | file | MicroPython: button-driven incremental sweep with a centre-return panic button | ⚠️ needs verification (never flashed; PCA9685 not yet purchased) |

## Depends on
`../ble-ping/` must pass first. `research/hardware/pca9685-servo-control.md` (units, frequency)
and `research/hardware/power-brownout-risk.md` (what to measure and why).
Hardware: PCA9685 board, **not yet purchased** — see `docs/PRD.md` §8.

## Depended on by
Future `src/tracking/computeGimbalCorrection.ts` — its angle clamps come from this test's output.
