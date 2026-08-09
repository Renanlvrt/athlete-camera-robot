# Skills Registry

One row per skill folder in `.claude/skills/`. Update this in the same change that adds,
renames, or removes a skill — see `CLAUDE.md` Section 0.2, step 5. This table is for humans
and for quick agent orientation; Claude Code's actual auto-discovery reads each skill's own
`SKILL.md` frontmatter, not this file.

| Skill | Path | Purpose | Status |
|---|---|---|---|
| build-unsigned-ipa | `.claude/skills/build-unsigned-ipa/` | Trigger the GitHub Actions macOS build for the unsigned `.ipa` and confirm the artifact downloads successfully. | 🔜 planned — folder scaffolded, `SKILL.md` and `scripts/` not yet written |
| ble-ping | `.claude/skills/ble-ping/` | Connect to the micro:bit over BLE and send/receive a dummy payload to confirm the link is alive. | 🔜 planned — not yet created |
| servo-bounds-test | `.claude/skills/servo-bounds-test/` | Sweep the gimbal roll/pitch servos to their limits from the micro:bit side; watch for BLE brownout. | 🔜 planned — not yet created |
| cv-framerate-test | `.claude/skills/cv-framerate-test/` | Run a dummy TFLite model through a VisionCamera Frame Processor and log per-frame timing against the 16-33ms budget. | 🔜 planned — not yet created |

Status tags match `CLAUDE.md` Section 1.2 (`✅ verified`, `⚠️ needs verification`,
`❌ deprecated`, `🔜 planned`).
