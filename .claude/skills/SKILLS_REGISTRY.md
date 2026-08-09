# Skills Registry

One row per skill folder in `.claude/skills/`. Update this in the same change that adds,
renames, or removes a skill — see `CLAUDE.md` Section 0.2, step 5. This table is for humans
and for quick agent orientation; Claude Code's actual auto-discovery reads each skill's own
`SKILL.md` frontmatter, not this file.

| Skill | Path | Purpose | Status |
|---|---|---|---|
| build-unsigned-ipa | `.claude/skills/build-unsigned-ipa/` | Trigger the GitHub Actions macOS build for the unsigned `.ipa` and confirm the artifact downloads. | 🔜 planned — `SKILL.md` written; `scripts/trigger_build.py` is a stub that raises `NotImplementedError`, and `verify_artifact.py` does not exist |
| ble-ping | `.claude/skills/ble-ping/` | Connect to the micro:bit over BLE and echo a test payload — bench (laptop) first, then phone. | ⚠️ needs verification — scripts written, never run against hardware |
| servo-bounds-test | `.claude/skills/servo-bounds-test/` | Sweep the gimbal servos to find real mechanical limits; stress-test for BLE brownout. | ⚠️ needs verification — script written, never flashed; PCA9685 not yet purchased |
| cv-framerate-test | `.claude/skills/cv-framerate-test/` | Measure per-frame processing time on the iPhone 16 — empty processor first, then with the model. | ⚠️ needs verification — screen written, but blocked: requires worklets packages that are not installed |

Status tags match `CLAUDE.md` Section 1.2 (`✅ verified`, `⚠️ needs verification`,
`❌ deprecated`, `🔜 planned`).

## Dependency order

These are not independent — each is a gate for the next:

```
build-unsigned-ipa ──► (app on phone) ──► cv-framerate-test ──► tracking work
                                    └──► ble-ping ──► servo-bounds-test ──► closed loop
```

Nothing has been run yet. `build-unsigned-ipa` is the first domino: until a build lands on the
phone, none of the other three can produce a result.
