# .claude/skills/ble-ping/ — index

Proves the phone↔micro:bit BLE link is alive, independently of any CV or servo code. The first
diagnostic to run whenever the robot "isn't responding."

Not responsible for: servo movement (see `../servo-bounds-test/`) or the app-side BLE
integration code (that will live in `src/ble/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | The procedure: bench test first, then phone | ⚠️ needs verification (never run) |
| `scripts/microbit_ble_echo.py` | file | MicroPython for the micro:bit — advertises UART, echoes `ACK:<msg>` | ⚠️ needs verification (never flashed) |
| `scripts/bench_ping.py` | file | Windows-side `bleak` script: scan, connect, 20 pings, latency stats | ⚠️ needs verification (never run) |

## Depends on
`research/hardware/microbit-ble-link.md` for the packet format and library rationale.
`bench_ping.py` needs `pip install bleak`.

## Depended on by
`.claude/skills/servo-bounds-test/` (a working link is its precondition), and future `src/ble/`.
