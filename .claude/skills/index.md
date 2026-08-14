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
| `ble-ping/` | folder | Prove the phone↔micro:bit BLE link is alive | ⚠️ needs verification (never run) |
| `servo-bounds-test/` | folder | Find real gimbal angle limits; stress-test for brownout | ⚠️ needs verification (never run) |
| `cv-framerate-test/` | folder | Measure per-frame CV time on the real device | ⚠️ needs verification (never run) |
| `gimbal-control-firmware/` | folder | Production micro:bit program: BLE gimbal packets → PCA9685 servo commands | ⚠️ needs verification (never run) |

`build-unsigned-ipa` and `webcam-detection-preview` are verifiable from the developer's own
machine and are now verified. The remaining three are hardware-dependent and therefore **cannot
be verified by an agent alone**. Their procedures end with an explicit report block; results go
to `testing/`, never into an `index.md` on an agent's say-so.

## Depends on
`research/` — each hardware skill cites the finding that explains the risk it addresses.

## Depended on by
Any feature work anywhere in the repo that needs a discrete, repeatable capability — see
`CLAUDE.md` Section 0 for when to add a new skill here vs. writing inline code.
`.claude/agents/hardware-tester.md` invokes these rather than inventing parallel procedures.
