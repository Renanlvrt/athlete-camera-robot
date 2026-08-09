# .claude/skills/build-unsigned-ipa — index

Skill folder for triggering and verifying the no-Mac GitHub Actions unsigned-ipa build. See
`SKILL.md` for the instructions Claude Code auto-loads; this file is for human/agent
navigation only, per `CLAUDE.md` Section 1.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Instructions Claude Code loads when this skill triggers | ✅ verified — matches the implemented scripts |
| `scripts/trigger_build.py` | file | Dispatch the GitHub Actions workflow, poll for completion | ✅ verified — ran for real, dispatched+watched run `31290028103` to success |
| `scripts/verify_artifact.py` | file | Download and sanity-check the built `.ipa` artifact | ✅ verified — ran for real against run `31289641191`, all checks passed |
| `references/common-failures.md` | file | Predicted failure patterns + fixes for the CI workflow | ⚠️ needs verification — patterns are predicted/documented, not yet actually observed (workflow has succeeded 3/3 attempts) |

Both scripts were fleshed out on 2026-08-09 once `.github/workflows/build-ios-unsigned.yml` had
run green (see `docs/VERIFICATION_REPORT.md`), then run for real (not just syntax-checked) to
confirm the interface actually works end-to-end.

## Depends on
`gh` CLI (GitHub CLI), authenticated. `.github/workflows/build-ios-unsigned.yml` — now run green
three times. See `.github/workflows/index.md`.

## Depended on by
Any feature work that adds/changes a native dependency — run this skill before sideloading to
confirm the pipeline still produces a valid artifact.
