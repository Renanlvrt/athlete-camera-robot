# testing/ — index

The record of what has actually been tried **on real hardware**. This folder is the
human-in-the-loop layer: Claude cannot plug in a micro:bit, point a camera at a moving athlete,
or feel a servo binding. You can. This folder is where what you observed becomes something the
next agent can rely on.

Not responsible for: automated checks that run on the dev machine (`npm run typecheck` results
belong in `docs/VERIFICATION_REPORT.md`), or research findings (`research/`).

## Why this folder exists

The single worst failure mode in this project is an agent **inventing a result it could not have
observed** — writing "servo sweep verified" because the code looks right. `CLAUDE.md` §4 forbids
marking anything ✅ without evidence; this folder is where the evidence for *physical* claims
lives. If a hardware claim isn't recorded here, it didn't happen.

## The loop

```
1. Agent writes a test procedure     → a skill in .claude/skills/, or a file in bench-tests/
2. Agent hands it to you             → explicit steps + the exact fields to report back
3. You run it on the real hardware   → the part no agent can do
4. You report what happened          → including "it didn't work", especially that
5. Agent appends the result          → REAL_HARDWARE_TEST_LOG.md, and updates any index.md status
```

Step 4 matters most when the answer is ugly. A test that failed, recorded honestly, is worth
more than three that "passed" without detail — it's the failures that redirect the design.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `REAL_HARDWARE_TEST_LOG.md` | file | Append-only log of every physical test, newest first | ✅ verified |
| `bench-tests/` | folder | Desk-level tests: laptop↔micro:bit, servos unloaded, robot not assembled — see `bench-tests/index.md` | ✅ verified |
| `field-tests/` | folder | Full-system tests: robot assembled, phone mounted, real athlete moving — see `field-tests/index.md` | ✅ verified |

## Bench vs. field

**Bench** isolates one subsystem with everything else removed — servos off the robot, or BLE with
no CV running. When a bench test fails you know exactly what broke.

**Field** is the whole system doing the real job outdoors. Field tests are the only ones that
surface thermal throttling, sunlight glare, detection range on a distant athlete, battery life,
and vibration — and none of those show up on a desk.

**Always bench first.** Debugging a field failure with five subsystems live is miserable.

## Depends on
`.claude/skills/` — most procedures are defined by a skill; this folder stores their results.

## Depended on by
`docs/VERIFICATION_REPORT.md` (cites entries here to justify ✅ tags), and every `index.md`
whose status depends on hardware behaviour.
