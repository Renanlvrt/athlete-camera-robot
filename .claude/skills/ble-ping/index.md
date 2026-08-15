# .claude/skills/ble-ping/ — index

Proves the phone↔micro:bit BLE link is alive, independently of any CV or servo code. The first
diagnostic to run whenever the robot "isn't responding."

Not responsible for: servo movement (see `../servo-bounds-test/`) or the app-side BLE
integration code (that lives in `src/ble/`).

## ✅ Bench test passed for real, 2026-08-15 — see `SKILL.md`'s own writeup

20/20 pings echoed against actual hardware. Getting there required rewriting the firmware from
MicroPython (confirmed broken — no working BLE UART in real MicroPython) to MakeCode, and fixing
two more real bugs (a required no-pairing config, reversed RX/TX characteristic UUIDs) — full
detail in `SKILL.md` and `research/hardware/microbit-ble-link.md`. The phone half is still
unrun.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | The procedure, the three real bugs found getting it working, bench then phone | ✅ verified (bench half) — real 20/20-ping pass, 2026-08-15 |
| `scripts/pxt.json` | file | MakeCode project config for the echo firmware, including the confirmed-required no-pairing config | ✅ verified — this exact config is what made the bench test pass |
| `scripts/main.ts` | file | MakeCode/TypeScript for the micro:bit — advertises UART, echoes raw bytes back via buffer polling | ✅ verified — ran for real, 20/20 echoes |
| `scripts/bench_ping.py` | file | Windows-side `bleak` script: scan (UUID + name fallback), connect, 20 pings, latency stats | ✅ verified — this is the script that produced the 20/20 pass |

## Depends on
`research/hardware/microbit-ble-link.md` for the packet format and library rationale.
`bench_ping.py` needs `pip install bleak`. `scripts/pxt.json`/`main.ts` need the `pxt` CLI
(`npx pxt target microbit`, no separate install — see `SKILL.md`).

## Depended on by
`.claude/skills/servo-bounds-test/` (a working link is its precondition), `.claude/skills/gimbal-control-firmware/`
(reuses the same MakeCode toolchain and no-pairing config pattern), and `src/ble/`.
