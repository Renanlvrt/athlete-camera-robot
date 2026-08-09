# .claude/skills/build-unsigned-ipa — index

Skill folder for triggering and verifying the no-Mac GitHub Actions unsigned-ipa build. See
`SKILL.md` for the instructions Claude Code auto-loads; this file is for human/agent
navigation only, per `CLAUDE.md` Section 1.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Instructions Claude Code loads when this skill triggers | ⚠️ needs verification — written, not yet run against a real workflow |
| `scripts/trigger_build.py` | file | Dispatch the GitHub Actions workflow, poll for completion | 🔜 planned — **stub**, raises `NotImplementedError` |
| `scripts/verify_artifact.py` | file | Download and sanity-check the built `.ipa` artifact | 🔜 planned — **does not exist** |

Both scripts are deliberately unwritten: `SKILL.md` says to flesh them out only once the
workflow has succeeded at least once by hand, so they mirror an interface known to work rather
than a guessed one. Until then, run the build from the GitHub Actions UI (`README.md` step 4).

## Depends on
`gh` CLI (GitHub CLI), authenticated. `.github/workflows/build-ios-unsigned.yml` now exists
(written 2026-08-09) but has **never been run**, and the repo has **no remote configured yet** —
both are prerequisites. See `.github/workflows/index.md`.

## Depended on by
Any feature work that adds/changes a native dependency — run this skill before sideloading to
confirm the pipeline still produces a valid artifact.
