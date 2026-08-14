# docs/ — index

Everything that is *about* the project rather than *part of* the running
app: the spec, and the record of what has actually been verified to work.
This folder contains no code.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `PRD.md` | file | Full project spec — hardware, software, CV, control-logic decisions and roadmap. Source of truth for scope. | ✅ verified (kept in sync with the original planning conversation) |
| `VERIFICATION_REPORT.md` | file | Running, append-only log of what was actually tested (commands run, results), so "✅ verified" tags elsewhere are trustworthy | ✅ verified |
| `YOUR_STEPS.md` | file | **Start here if you're the human.** Copy-paste commands for GitHub setup, AltStore install, and the morning hardware session | ⚠️ needs verification (steps never executed) |
| `NIGHT_LOOP_BRIEF.md` | file | Complete brief handed to a second Claude instance for an unattended overnight run (2026-08-09) | ✅ verified |
| `DAY_AGENT_DONE.md` | file | Sentinel — its existence tells the night agent the repo is safe to edit | ✅ verified |
| `ROBOT_INTEGRATION_PLAN.md` | file | Step-by-step plan for closing the loop onto the real robot: `ble-ping` → `servo-bounds-test` → `gimbal-control-firmware` → full field test, with a prerequisites checklist and explicit non-goals | ⚠️ needs verification — the plan itself hasn't been executed yet |

Files the night agent is expected to create: `NIGHT_LOOP_PLAN.md`, `NIGHT_DECISIONS.md`,
`NIGHT_REPORT.md`, and `testing/MORNING_TEST_PLAN.md`.

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
