# Night Decisions — for your review

Every ambiguous call made overnight, per `docs/NIGHT_LOOP_BRIEF.md`'s "decide, document, flag"
policy. None of these block anything; they're here so you can override any of them if you'd
have called it differently.

---

## 1. Edited `.claude/skills/index.md` and `.claude/skills/SKILLS_REGISTRY.md`

**What:** updated the `build-unsigned-ipa` row in both files from "🔜 planned / stub" to
"✅ verified", once its scripts were implemented and run for real against a workflow that went
green 3/3 times.

**Why ambiguous:** `docs/NIGHT_LOOP_BRIEF.md` §0's ownership table lists
`.claude/skills/build-unsigned-ipa/**` as mine, but these two files live one level up, at
`.claude/skills/`, which isn't explicitly assigned to either agent.

**Decision:** edited them anyway — narrowly, only the rows/sentences about
`build-unsigned-ipa`, nothing about the other three skills. Reasoning: `CLAUDE.md` §1.3 requires
the relevant `index.md` to be updated in the same change that changes a file's status, and
leaving these two saying "stub" while the skill folder itself said "✅ verified" would be exactly
the stale-index problem `CLAUDE.md` §1 exists to prevent. Low risk of collision — the day agent
was never assigned this file either, and my edits didn't touch any other skill's row.

**Confidence:** high that the edit itself is correct; medium on whether editing a shared file was
the "right" call vs. leaving a note here and not touching it. Revert with `git revert` if you'd
rather the day agent (or you) had made this specific edit.

---

## 2. Did not touch `testing/REAL_HARDWARE_TEST_LOG.md`'s "No entries yet" table

**What:** that file's blocker table (`| iOS build pipeline | Never run | Repo not yet pushed... |`
etc.) is now stale — the repo is pushed and the build has run green three times. I did not
correct it.

**Why:** the file is append-only/never-restructure per `docs/NIGHT_LOOP_BRIEF.md` §0, and its
explicit purpose is human-reported *physical* hardware results only — a CI success isn't a
physical observation, so it doesn't belong in that table's format either way.

**Decision:** left it untouched. The corrected status lives in `testing/MORNING_TEST_PLAN.md` §0
instead, which is exactly the right file for "here's what changed and what's next."

**Confidence:** high.

---

## 3. Triggered a third CI run to test `trigger_build.py` for real

**What:** after two green runs already proved the workflow itself, I dispatched a third
(`31290028103`) specifically to exercise `trigger_build.py` end-to-end rather than just
syntax-checking it.

**Why ambiguous:** costs ~8 minutes of runner time (free, unmetered on this public repo — see
`research/phone-integration/windows-to-iphone-pipeline.md` — so no real cost, but worth noting
since it's a real action with a real side effect: another artifact now exists).

**Decision:** did it. A skill script that's only ever been syntax-checked isn't "implemented" by
this project's own verification standard (`CLAUDE.md` §4) — `SKILL.md`'s Status section makes a
real claim ("ran for real, dispatched+watched run 31290028103") and I wanted that to be true, not
aspirational.

**Confidence:** high this was the right call.

---

## 4. Wrote `references/common-failures.md` from *predicted* failures, not observed ones

**What:** `.claude/skills/build-unsigned-ipa/references/common-failures.md` documents four
failure patterns sourced from the workflow's own inline comments and prior research — none of
which actually occurred (all three CI runs succeeded first try).

**Why ambiguous:** `SKILL.md` step 4 implies this file should hold "known-failure patterns," which
reads like it should come from real failures.

**Decision:** wrote it anyway, with an explicit, prominent honesty note at the top stating these
are predicted-not-observed and naming exactly which real runs contradicted the pre-run risk
assessment. The alternative — an empty file — throws away real research value (the workflow's own
"likely first failures" comments) that's genuinely useful the first time something *does* break.

**Confidence:** high, given the honesty caveat is unmissable at the top of the file.
