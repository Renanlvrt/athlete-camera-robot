# Night Loop Plan — night-shift agent

Written per `docs/NIGHT_LOOP_BRIEF.md`'s "first 30 minutes" instruction. This is the execution
order for tonight, owned by me alone (`docs/NIGHT_LOOP_PLAN.md` is in my lane per the brief's
§0 file-ownership table). Update this file's checkboxes as work completes; don't restructure it.

## Gate status
- `docs/DAY_AGENT_DONE.md` existed at start. ✅
- `git status` was dirty at the very start of this session (day agent mid-commit on
  `TREE.txt`, `docs/DAY_AGENT_DONE.md`, `docs/YOUR_STEPS.md`, `index.md`) — waited, it resolved
  within the first few minutes once commit `5e78eec` ("Switch handoff docs to parallel mode;
  refresh status tags") landed. Gate cleared. ✅

## My lane (never touch anything else)
```
.github/**
docs/NIGHT_LOOP_PLAN.md, docs/NIGHT_DECISIONS.md, docs/NIGHT_REPORT.md
testing/MORNING_TEST_PLAN.md, testing/bench-tests/**, testing/field-tests/**
research/**
.claude/skills/build-unsigned-ipa/**
```
Append-only: `docs/VERIFICATION_REPORT.md`, `testing/REAL_HARDWARE_TEST_LOG.md` (never write a
hardware result into the latter — no physical hardware in this loop). Off-limits absolutely:
`src/**`, `package.json`, `package-lock.json`, `app.json`, `metro.config.js`, jest config,
`docs/DAY_AGENT_*.md`, root `index.md`.

## Execution order

- [x] 0. Gate cleared.
- [x] 1. Pushed local commits to `origin/main`.
- [x] 2. **SM-1** — CI went green on the first attempt, twice (no iteration needed). Recorded in
      `docs/VERIFICATION_REPORT.md`, `.github/workflows/index.md` updated.
- [x] 3. Implemented and ran `trigger_build.py` + `verify_artifact.py` for real; wrote
      `references/common-failures.md`; updated `SKILL.md` + `index.md`.
- [x] 4. **SM-5** — `testing/MORNING_TEST_PLAN.md` written.
- [x] 5. **SM-4** — index sweep done; PRD §7 confirmed not closable by research; no spare-capacity
      research deepening needed (nothing was stale beyond the build-unsigned-ipa status).
- [x] 6. Last act: `docs/NIGHT_REPORT.md` written.

**All success measures met.** See `docs/NIGHT_REPORT.md` for the full account.

## Continuous rules
- `git status` before every commit; leave anything outside my lane alone.
- Never `git add -A` — stage explicit paths.
- Small, single-purpose commits.
- Ambiguous calls: decide, log in `docs/NIGHT_DECISIONS.md` with alternatives + confidence, keep
  moving.
- Never mark a hardware-dependent thing `✅`; never write to `testing/REAL_HARDWARE_TEST_LOG.md`.
- On a usage-limit pause: resume exactly from the last unchecked box above on reset, no re-plan.
