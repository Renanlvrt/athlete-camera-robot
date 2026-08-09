# docs/ — index

Everything that is *about* the project rather than *part of* the running
app: the spec, and the record of what has actually been verified to work.
This folder contains no code.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `PRD.md` | file | Full project spec — hardware, software, CV, control-logic decisions and roadmap. Source of truth for scope. | ✅ verified (kept in sync with the original planning conversation) |
| `VERIFICATION_REPORT.md` | file | Running, append-only log of what was actually tested (commands run, results), so "✅ verified" tags elsewhere are trustworthy | ✅ verified |

## Not to be confused with

Three other folders hold knowledge, and mixing them up destabilizes the spec
(`CLAUDE.md` §5.3):

| Kind of knowledge | Belongs in |
|---|---|
| A **decision** about what to build | `docs/PRD.md` — here |
| An **external fact** (library API, pricing, hardware quirk) | `research/<domain>/` |
| A **physical observation** from real hardware | `testing/REAL_HARDWARE_TEST_LOG.md` |
| **Evidence** backing a ✅ tag | `docs/VERIFICATION_REPORT.md` — here |

A research finding pasted into the PRD makes the spec churn every time a
library updates. A decision hidden in `research/` is invisible to anyone
reading the spec.

## Depends on
`research/` — several PRD §7 items were closed by findings there, and cite them.

## Depended on by
`CLAUDE.md` and every other `index.md` reference `docs/PRD.md` as the
scope authority and `docs/VERIFICATION_REPORT.md` as the evidence log.
