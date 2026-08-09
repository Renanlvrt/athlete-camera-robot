# .claude/skills/ — index

Every reusable, discrete capability for this project lives here as its own skill folder, per
`CLAUDE.md` Section 0. This is auto-discovered by Claude Code — every subfolder containing a
`SKILL.md` is a skill Claude can load on demand. `SKILLS_REGISTRY.md` in this folder is the
human-readable summary; keep it in sync whenever a skill is added, renamed, or removed.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILLS_REGISTRY.md` | file | Human-readable table of every skill in this folder | ✅ verified |
| `build-unsigned-ipa/` | folder | Trigger + verify the GitHub Actions unsigned-ipa build | 🔜 planned (scaffold only, not yet implemented) |

## Depends on
Nothing outside this folder.

## Depended on by
Any feature work anywhere in the repo that needs a discrete, repeatable capability — see
`CLAUDE.md` Section 0 for when to add a new skill here vs. writing inline code.
