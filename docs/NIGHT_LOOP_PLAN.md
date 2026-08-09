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
- [ ] 1. `git push` local commits (day agent's + mine) to `origin/main` — required before any
      `workflow_dispatch` CI trigger will see current code.
- [ ] 2. **SM-1** — trigger `.github/workflows/build-ios-unsigned.yml`, iterate on failures
      (workflow-file-only fixes; never touch `package.json`/`app.json` — log a blocked
      dependency need in `docs/NIGHT_DECISIONS.md` instead) until the `unsigned-app-ipa`
      artifact downloads and contains `Payload/*.app`. Record in
      `docs/VERIFICATION_REPORT.md`, update `.github/workflows/index.md`.
- [ ] 3. Implement `.claude/skills/build-unsigned-ipa/scripts/trigger_build.py` and
      `verify_artifact.py` against the now-proven workflow; write
      `references/common-failures.md` from real failures hit tonight; update `SKILL.md` status
      + `index.md`.
- [ ] 4. **SM-5** — write `testing/MORNING_TEST_PLAN.md`: prerequisites checklist (PCA9685 not
      purchased — flag first), parallelized sequencing, front-loaded high-risk items, per-test
      steps/expected-result/predicted-failures/time-box/abort-condition, reference existing
      skills (`ble-ping`, `servo-bounds-test`, `cv-framerate-test`) by path.
- [ ] 5. **SM-4** — sweep `index.md` files in owned folders for accuracy against tonight's real
      results; confirm PRD §7 "still genuinely open" items really can't close by research;
      deepen `research/` only if spare capacity remains.
- [ ] 6. Last act: `docs/NIGHT_REPORT.md` — honest, scannable, met/partial/not-met.

## Continuous rules
- `git status` before every commit; leave anything outside my lane alone.
- Never `git add -A` — stage explicit paths.
- Small, single-purpose commits.
- Ambiguous calls: decide, log in `docs/NIGHT_DECISIONS.md` with alternatives + confidence, keep
  moving.
- Never mark a hardware-dependent thing `✅`; never write to `testing/REAL_HARDWARE_TEST_LOG.md`.
- On a usage-limit pause: resume exactly from the last unchecked box above on reset, no re-plan.
