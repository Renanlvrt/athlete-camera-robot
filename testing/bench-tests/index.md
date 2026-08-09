# testing/bench-tests/ — index

Desk-level tests that isolate **one** subsystem, with the robot not necessarily assembled and
nothing else running. The point of a bench test is that when it fails, you know exactly what
broke.

Not responsible for: whole-system behaviour outdoors (see `../field-tests/`).

## What belongs here

- Laptop → micro:bit BLE, with no phone and no app involved.
- Servo sweeps with the servo **off the robot** or the robot **on a stand, wheels off the ground**.
- Frame-processor timing with the phone on a desk, not mounted.
- Anything where you're answering "does this one piece work at all?"

## What does not belong here

Anything where two or more subsystems are live at once, or where the answer depends on the
outdoors (sun, distance, heat, movement). Those are field tests.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| — | — | No bench tests recorded yet | 🔜 planned |

Results are recorded in `../REAL_HARDWARE_TEST_LOG.md`. Add a file here only when a single test
needs more room than a log entry — raw timing dumps, photos of a wiring layout, a long serial
capture. Name it `YYYY-MM-DD-<subject>.md` and link it from the log entry.

## Depends on
`.claude/skills/ble-ping/`, `.claude/skills/servo-bounds-test/`, `.claude/skills/cv-framerate-test/`
— these define the procedures.

## Depended on by
`../REAL_HARDWARE_TEST_LOG.md`.
