# docs/ — index

Everything that is *about* the project rather than *part of* the running
app: the spec, and the record of what has actually been verified to work.
This folder contains no code.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `PRD.md` | file | Full project spec — hardware, software, CV, control-logic decisions and roadmap. Source of truth for scope. | ✅ verified (kept in sync with the original planning conversation) |
| `VERIFICATION_REPORT.md` | file | Running, append-only log of what was actually tested (commands run, results), so "✅ verified" tags elsewhere are trustworthy | ✅ verified |

## Depends on
Nothing.

## Depended on by
`CLAUDE.md` and every other `index.md` reference `docs/PRD.md` as the
scope authority and `docs/VERIFICATION_REPORT.md` as the evidence log.
