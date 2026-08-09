# research/hardware/ — index

Findings about the robot side: the BLE link from phone to micro:bit, driving servos through the
moto:bit and PCA9685, and the power/brownout risk that sits under all of it.

Not responsible for: mechanical/3D-printed design (already built, see `docs/PRD.md` §2.1), or
the app-side BLE code (that will be `src/ble/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `microbit-ble-link.md` | file | GATT options, library choice, and the proposed command packet | ⚠️ needs verification (no hardware test yet) |
| `pca9685-servo-control.md` | file | I2C servo driving from micro:bit, and the centiseconds footgun | ⚠️ needs verification (board not yet purchased) |
| `power-brownout-risk.md` | file | **Open question** — not resolvable by research, must be measured | ⚠️ open question |

## Depends on
Nothing outside this folder.

## Depended on by
`docs/PRD.md` §2 and §7, `.claude/skills/ble-ping/`, `.claude/skills/servo-bounds-test/`, and
future `src/ble/`.
