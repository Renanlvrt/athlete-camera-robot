# .claude/skills/ — index

Every reusable, discrete capability for this project lives here as its own skill folder, per
`CLAUDE.md` Section 0. This is auto-discovered by Claude Code — every subfolder containing a
`SKILL.md` is a skill Claude can load on demand. `SKILLS_REGISTRY.md` in this folder is the
human-readable summary; keep it in sync whenever a skill is added, renamed, or removed.

For the difference between a **skill** (how to perform a task correctly) and a **subagent** (who
does the work, in a separate context window), see `.claude/agents/index.md`.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILLS_REGISTRY.md` | file | Human-readable table of every skill, plus their dependency order | ✅ verified |
| `build-unsigned-ipa/` | folder | Trigger + verify the GitHub Actions unsigned-ipa build | ✅ verified (scripts run for real, workflow green 4/4) |
| `webcam-detection-preview/` | folder | Run the bundled TFLite model against the laptop webcam for fast, no-phone detection/UI iteration | ✅ verified — run against the real model and real webcam frames, 2026-08-13 |
| `ble-ping/` | folder | Prove the phone↔micro:bit BLE link is alive | ✅ verified (bench half) — real 20/20-ping pass, 2026-08-15 |
| `servo-bounds-test/` | folder | Find real gimbal angle limits; stress-test for brownout | ⚠️ needs verification (never run) |
| `cv-framerate-test/` | folder | Measure per-frame CV time on the real device | ⚠️ needs verification (never run) |
| `gimbal-control-firmware/` | folder | Production micro:bit program: BLE gimbal packets → PCA9685 servo commands | ⚠️ needs verification (compiles; servo-driving half never run) |
| `gimbal-led-simulator/` | folder | Servo-free variant: BLE gimbal packets → LED matrix arrow/square/X, for MVP validation before any servo is trusted | ⚠️ needs verification (flashed, smoke-tested; visual output not human-confirmed) |

`build-unsigned-ipa` and `webcam-detection-preview` are verifiable from the developer's own
machine and are now verified. `servo-bounds-test`, `cv-framerate-test`, and
`gimbal-control-firmware`'s servo-driving half remain hardware-dependent and **cannot be verified
by an agent alone** — their procedures end with an explicit report block; results go to
`testing/`, never into an `index.md` on an agent's say-so.

**`ble-ping`'s bench half is a deliberate, narrow exception, not a rule change.** Its 2026-08-15
result was obtained by the agent itself running real commands against real hardware connected to
the same machine — at the user's own explicit, repeated, in-session request, not the agent's
unilateral decision. This is recorded transparently as agent-run in `testing/REAL_HARDWARE_TEST_LOG.md`
(see that entry's provenance note) rather than written up as if a human watched it happen. Treat
this as the narrow case it is: an agent normally has no path to touch physical hardware at all,
which is the entire reason `CLAUDE.md` §5.2 exists; here, the same machine running the agent
happened to have the necessary radio and cable access, and the user chose to direct it that way.

## Depends on
`research/` — each hardware skill cites the finding that explains the risk it addresses.

## Depended on by
Any feature work anywhere in the repo that needs a discrete, repeatable capability — see
`CLAUDE.md` Section 0 for when to add a new skill here vs. writing inline code.
`.claude/agents/hardware-tester.md` invokes these rather than inventing parallel procedures.
