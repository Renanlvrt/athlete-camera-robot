# .claude/skills/build-unsigned-ipa — index

Skill folder for triggering and verifying the no-Mac GitHub Actions unsigned-ipa build. See
`SKILL.md` for the instructions Claude Code auto-loads; this file is for human/agent
navigation only, per `CLAUDE.md` Section 1.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Instructions Claude Code loads when this skill triggers | ⚠️ needs verification — written, not yet run against a real workflow |
| `scripts/trigger_build.py` | file | Dispatch the GitHub Actions workflow, poll for completion | 🔜 planned — not yet written |
| `scripts/verify_artifact.py` | file | Download and sanity-check the built `.ipa` artifact | 🔜 planned — not yet written |

## Depends on
`gh` CLI (GitHub CLI), authenticated. The `.github/workflows/build-ios-unsigned.yml` workflow
must exist and be pushed to the remote repo.

## Depended on by
Any feature work that adds/changes a native dependency — run this skill before sideloading to
confirm the pipeline still produces a valid artifact.
