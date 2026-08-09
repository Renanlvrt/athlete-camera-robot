# Day Agent — status

**⚠️ This is NOT a gate.** The two agents run in **parallel** in the same working directory.
Do not wait for anything. See `docs/NIGHT_LOOP_BRIEF.md` §0 for the file-ownership rules that
keep you from colliding — that is the only thing protecting your work.

This file records what the day agent has verified, so you don't redo it.

- **Last updated:** 2026-08-09
- **Working tree at that point:** clean, typecheck exit 0, 28/28 tests passing.

## Verified

| Check | Result |
|---|---|
| `npm install` | ✅ exit 0, 5 CV/BLE packages added, no ERESOLVE |
| `npm run typecheck` | ✅ exit code 0, zero errors |
| `npm test` | ✅ **28/28 passing**, 2 suites |
| `npx expo config --type prebuild` | ✅ evaluates cleanly, plugins resolve |
| Both config plugins ship `app.plugin.js` | ✅ fast-tflite and ble-plx |
| No `babel.config.js` needed | ✅ verified in `babel-preset-expo@57.0.5` source |
| Workflow YAML parses | ✅ 9 steps, `macos-26`, `permissions: contents: read` |
| Every non-exempt directory has an `index.md` | ✅ |
| Relative markdown links resolve | ✅ none broken |
| Skill frontmatter `name` matches folder | ✅ all four |
| Secret scan of tracked files | ✅ clean |
| `.gitignore` blocks secret file types | ✅ tested with dummy files |

## Done — do not redo, do not edit these files

- **SM-2 complete.** All five CV/BLE packages installed, `metro.config.js`, `app.json` plugins.
- **SM-3 complete.** `src/tracking/` (`types.ts`, `selectPrimaryAthlete.ts`,
  `computeGimbalCorrection.ts`) plus Jest and 28 tests.
- `.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx` rewritten against the real v5
  API. **The v4 problem is fixed** — don't "correct" it back.

**Your lane is SM-1 (green CI build), SM-4 (research/docs), SM-5 (morning test plan).**

## Explicitly NOT verified

- **The CI workflow has never run.** Nothing about the iOS build is proven.
- **No app has ever been installed on a device.** No screen has been seen on hardware.
- **No hardware exists in the loop.** No BLE, no servos. PCA9685 not yet purchased.
- **Frame processors cannot run yet** — worklets packages not installed.
- `testing/REAL_HARDWARE_TEST_LOG.md` has **zero entries**, correctly.

## Handed to the night agent

Your brief is `docs/NIGHT_LOOP_BRIEF.md`. Read it in full before starting.

The one correction that will bite you if you skip it: **VisionCamera v5's API is completely
different from v4**, and nearly every tutorial online is v4. `useFrameProcessor` does not exist.
See §4 of the brief, and the rewritten
`.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx`, which was verified against the
actual `.d.ts` files in `node_modules`.

Start with `docs/VERIFICATION_REPORT.md` → "Open items for the next contributor". That list is
ordered, and each item unblocks the next.
