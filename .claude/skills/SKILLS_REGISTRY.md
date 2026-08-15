# Skills Registry

One row per skill folder in `.claude/skills/`. Update this in the same change that adds,
renames, or removes a skill — see `CLAUDE.md` Section 0.2, step 5. This table is for humans
and for quick agent orientation; Claude Code's actual auto-discovery reads each skill's own
`SKILL.md` frontmatter, not this file.

| Skill | Path | Purpose | Status |
|---|---|---|---|
| build-unsigned-ipa | `.claude/skills/build-unsigned-ipa/` | Trigger the GitHub Actions macOS build for the unsigned `.ipa` and confirm the artifact downloads. | ✅ verified — scripts run for real against a workflow that's gone green 4/4 attempts; see `docs/VERIFICATION_REPORT.md` |
| webcam-detection-preview | `.claude/skills/webcam-detection-preview/` | Run the bundled TFLite model against the laptop webcam (or a static image) for fast, no-phone iteration on detection/overlay code. | ✅ verified — run against the real model and real webcam frames, 2026-08-13 |
| ble-ping | `.claude/skills/ble-ping/` | Connect to the micro:bit over BLE and echo a test payload — bench (laptop) first, then phone. | ✅ verified (bench half) — real 20/20-ping pass, 2026-08-15; phone half still unrun |
| servo-bounds-test | `.claude/skills/servo-bounds-test/` | Sweep the gimbal servos to find real mechanical limits; stress-test for BLE brownout. | ⚠️ needs verification — script written, never flashed. PCA9685 is now owned/wired (confirmed 2026-08-14, `docs/PRD.md` §8) — no longer blocked on hardware, just on running it |
| cv-framerate-test | `.claude/skills/cv-framerate-test/` | Measure per-frame processing time on the iPhone 16 — empty processor first, then with the model. | ⚠️ needs verification — screen written, but blocked: requires worklets packages that are not installed |
| gimbal-control-firmware | `.claude/skills/gimbal-control-firmware/` | Flash the production micro:bit program that receives BLE gimbal packets and drives the PCA9685 servos — the last step before a real field test. | ⚠️ needs verification — rewritten in MakeCode 2026-08-15 (MicroPython BLE confirmed broken), compiles cleanly; servo-driving half never run, ships with a placeholder safe range pending servo-bounds-test's real measurement |
| gimbal-led-simulator | `.claude/skills/gimbal-led-simulator/` | Flash a servo-free firmware that shows gimbal corrections as an arrow/square/X on the LED matrix — MVP pipeline validation before any servo is trusted. | ⚠️ needs verification — flashed and mechanically smoke-tested (connects, accepts packets, no crash) 2026-08-15; visual output not yet human-confirmed |

Status tags match `CLAUDE.md` Section 1.2 (`✅ verified`, `⚠️ needs verification`,
`❌ deprecated`, `🔜 planned`).

## Dependency order

These are not independent — each is a gate for the next:

```
build-unsigned-ipa ──► (app on phone) ──► cv-framerate-test ──► tracking work
                                    └──► ble-ping ──► gimbal-led-simulator ──► servo-bounds-test ──► gimbal-control-firmware ──► field test
```

`gimbal-led-simulator` is a deliberate detour, not skippable-but-optional: the user wants the
full CV→BLE→firmware pipeline proven safe (no servo/motor connected at all) before
`servo-bounds-test` or `gimbal-control-firmware` are ever run for real.

`build-unsigned-ipa` is now proven end-to-end at the CI level (2026-08-09) — the remaining gap
is installing that artifact on the physical phone, tracked in `testing/MORNING_TEST_PLAN.md`.
It's still the first domino: none of the other three can produce a hardware result until that
install happens.
