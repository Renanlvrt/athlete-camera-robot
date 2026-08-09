# Night Report — night-shift agent, 2026-08-09

Written as the last act, per `docs/NIGHT_LOOP_BRIEF.md` §8. Short and honest over long and
optimistic — this repo has already been burned by confident documentation that turned out
false, and I'd rather you catch me understating something than the reverse.

## Success measures: met / partial / not met

| # | Measure | Status |
|---|---|---|
| SM-1 | Green CI build producing a real `.ipa` | ✅ **Met.** Went green on the **first attempt**, twice — once automatically (day agent's push), once on a deliberate `workflow_dispatch` against `HEAD` with all 5 CV/BLE native packages linked in. A third run proved the skill scripts. All three artifacts downloaded and inspected directly (not just trusted the checkmark). |
| SM-2 | CV+BLE deps installed, typecheck green | ✅ Already done by the day agent before I started — not touched. |
| SM-3 | Tracking math written + unit tested | ✅ Already done by the day agent before I started — not touched. |
| SM-4 | Research/docs airtight | ✅ **Met.** Swept every `index.md` in my lane against tonight's real results; found and fixed one real staleness (`.claude/skills/index.md` / `SKILLS_REGISTRY.md` still said "stub" after the scripts were implemented). Everything else checked out already accurate. |
| SM-5 | Morning hardware-test plan | ✅ **Met.** `testing/MORNING_TEST_PLAN.md` written — see below. |

**All five success measures are met.** This was a shorter path than the brief anticipated: the
brief predicted ~15-20 min per CI round with likely iteration on scheme-detection or
config-plugin failures. None of that happened — both real builds succeeded first try. I did not
manufacture extra scope to fill time; instead I deepened SM-1's own skill implementation
(the two previously-stub scripts) and SM-4's accuracy pass. See `docs/NIGHT_LOOP_PLAN.md` for
the checklist this was worked from, all boxes now checked.

## What works now that didn't last night

- **The iOS build pipeline is proven.** `.github/workflows/build-ios-unsigned.yml` — written
  by the day agent, never run before tonight — now has three green runs. A real, structurally
  valid unsigned `.ipa` (11.1 MB, `Payload/athletecamerarobot.app/` with a 12.2 MB executable
  and a parseable `Info.plist`, `CFBundleIdentifier=com.athleterobot.app`) exists and downloads.
  Evidence: `docs/VERIFICATION_REPORT.md`, "2026-08-09 (night) — CI workflow ran green, first
  attempt, twice."
- **`.claude/skills/build-unsigned-ipa/` is no longer a scaffold.** Both `trigger_build.py` and
  `verify_artifact.py` are implemented and were each run for real against live GitHub Actions
  runs, not just syntax-checked. `references/common-failures.md` is new, documenting the
  predicted (not yet observed) failure modes for the next time something breaks.
- **`testing/MORNING_TEST_PLAN.md` exists** — a sequenced, time-boxed checklist for today's
  hardware session, explicit about what's actually runnable now vs. genuinely blocked.

## Decisions needing your review

All in `docs/NIGHT_DECISIONS.md` — four of them, none blocking, all low-stakes. The one most
worth a glance: I edited `.claude/skills/index.md` and `SKILLS_REGISTRY.md`, which weren't
explicitly assigned to either agent in the brief's ownership table, to fix a real staleness.
Narrow edits, easy to revert if you'd rather that hadn't happened outside the assigned lanes.

## Blockers I couldn't clear

1. **The PCA9685 still isn't purchased** (`docs/PRD.md` §8). This is a hardware order, not
   something any agent can do. It blocks all of `testing/MORNING_TEST_PLAN.md` §8 (servo
   testing) — flagged loudly there and here. Link's in both places:
   https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2 (~$7).
2. **BLE app code doesn't exist yet** (`src/ble/` — checked directly, isn't there). This means
   `testing/MORNING_TEST_PLAN.md` §6 (the phone-side half of the BLE test) can't run yet either.
   This is app-feature work in the day agent's lane, not something I could or should build
   myself overnight — noted as out-of-scope, not a failure.
3. **The CV framerate test needs one small temporary edit first** (wiring
   `FrameTimingScreen.tsx` into `src/App.tsx` — see `testing/MORNING_TEST_PLAN.md` §7). I
   couldn't do this myself; `src/**` was off-limits to me all night per the brief's file-
   ownership rules. It's a 5-minute ask for whichever agent you have running when you're ready
   to run that test.

None of these need anything from you except the PCA9685 purchase (already flagged loudly enough
in the test plan that it shouldn't be missed) and, eventually, a coding session to build the
BLE app code — not tonight's job.

## Start here

**`testing/MORNING_TEST_PLAN.md`.** It's ordered by what's actually runnable right now: install
the app (unblocked — CI is green), run the BLE bench test in parallel, check the on-device
screen states, then the CV framerate test once one small wiring step is done. Servo testing and
phone-side BLE are explicitly marked blocked, with why.

## What is still unverified — stated plainly

Nothing about physical hardware has changed. As of this report:
- **No app has ever been installed on the iPhone.** CI compiling and linking cleanly is real
  evidence the code is structurally sound, but it is not evidence it runs correctly on-device —
  first-run crashes from something CI can't see (missing usage-description strings, native
  module init order) remain entirely possible. `testing/MORNING_TEST_PLAN.md` §3 flags this
  explicitly with a predicted-failure table.
- **No BLE, no servos, no camera frame processing has ever touched real hardware.**
  `testing/REAL_HARDWARE_TEST_LOG.md` still correctly has zero entries — I did not write to it,
  and didn't invent a result for anything I couldn't observe.
- **The tracking math's tuning constants** (`gain: 30`, `deadband: 0.05`, `maxStep: 5` — day
  agent's work) are still untested guesses; nothing tonight changed that.
- Every `⚠️ needs verification` tag left in place tonight is left there because it's genuinely
  unverified, not out of caution for its own sake.
