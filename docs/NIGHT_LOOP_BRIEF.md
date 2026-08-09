# Night Loop Brief — for the second Claude instance

**You are the night-shift agent on this project.** This document is your complete brief.
Read it fully before doing anything. It was written by another Claude instance ("the day
agent") that has been working in this repo and is finishing up now.

**Date written:** 2026-08-09
**Expected run window:** ~12–14 hours, overnight, unattended.
**The user will not be available.** Do not plan around asking them anything.

---

## 0. THE FIRST RULE: you are running in PARALLEL — stay in your lane

**Start immediately. Do not wait for anyone.** The day agent is working at the same time as you,
in the **same working directory**. You are not taking over from it; you are working beside it.

Because you share one filesystem, git branches cannot protect you. **The only thing keeping you
two from corrupting each other's work is strict file ownership.** This is non-negotiable.

### 🚫 Files you must NEVER create, edit, or delete — the day agent owns these

```
src/**                     ← ALL application source, especially src/tracking/
package.json               ← settled before you start; do not add or bump anything
package-lock.json
app.json
metro.config.js
jest.config.js  /  jest.setup.js  /  any test config
docs/DAY_AGENT_*.md
```

**If you believe you need a new npm package, you may not install it.** Write the request into
`docs/NIGHT_DECISIONS.md` and work around it. An unexpected `package.json` edit will collide
with the other agent mid-write and break both of you.

### ✅ Files you own outright — the day agent will not touch these

```
.github/**                        ← the CI workflow, and iterating on it
docs/NIGHT_LOOP_PLAN.md
docs/NIGHT_DECISIONS.md
docs/NIGHT_REPORT.md
testing/MORNING_TEST_PLAN.md
testing/bench-tests/**
testing/field-tests/**
research/**                       ← new findings and RESEARCH_LOG.md rows
.claude/skills/build-unsigned-ipa/**   ← including implementing the two stub scripts
```

### Shared files — append-only, never rewrite

`docs/VERIFICATION_REPORT.md` and `testing/REAL_HARDWARE_TEST_LOG.md`: **add a new dated section
at the top or bottom. Never restructure or reflow existing content.** If you need to correct
something already there, add a new entry saying so rather than editing in place.

`index.md` files: only edit the ones inside folders you own.

### Working rhythm

- **Commit often and small**, scoped to your own files. `git add` specific paths — never
  `git add -A`, which would sweep up the other agent's in-progress work.
- Before each commit: `git status`. If you see modified files outside your lane, **leave them
  alone** — they are the other agent mid-task.
- If git reports a conflict or a file changed under you: **stop, do not force anything**, log it
  in `docs/NIGHT_DECISIONS.md`, and move to another task in your lane.
- `docs/DAY_AGENT_DONE.md` exists and is **not** a gate anymore. It records what the day agent
  had verified as of handoff. Read it once for context, then ignore it.

**First 30 minutes:** read §3, then write `docs/NIGHT_LOOP_PLAN.md`. After that, go straight to
SM-1 — it's the longest pole and it's entirely inside your lane.

---

## 1. How to run

- Launch with **`nohup`** so the session survives terminal disconnects.
- Use Claude Code's **`acceptEdits`** permission mode ("don't ask me about edits").
  **Do NOT use `--dangerously-skip-permissions` / bypass-permissions.** The user was explicit:
  auto-accept edits, yes; disable the permission system entirely, no.
- **Token / rate limits:** when you hit the usage limit, **wait for the ~5-hour reset, then
  resume automatically.** Do not stop, do not consider the job finished, do not summarize and
  exit. Pick up exactly where you left off. Repeat as many times as needed across the night
  until the success measures in §2 are met.
- **Commit frequently** — after every meaningful unit of work. A crash mid-night must not lose
  hours. Small, well-described commits.

---

## 2. Success measures — what "done" looks like at ~7am

The user chose all four. Ordered by value.

### ✅ SM-1 — A green CI build producing a real `.ipa`
The user is pushing the repo to **public** GitHub before they leave, so this is unblocked.
- Trigger `.github/workflows/build-ios-unsigned.yml` (via `gh` CLI or the API).
- **Iterate on failures until it passes.** Each round is ~15–20 min; that's fine, you have all
  night. This is exactly the work that's miserable for a human and ideal for you.
- Read the "List available Xcode schemes" diagnostic output — the scheme name could not be
  determined on Windows (Expo refuses iOS prebuild off macOS/Linux; verified).
- Success = the `unsigned-app-ipa` artifact downloads and contains `Payload/*.app`.
- Then implement the two stub scripts in `.claude/skills/build-unsigned-ipa/scripts/`
  (`trigger_build.py`, `verify_artifact.py`) against the workflow you now know works.

### ✅ SM-2 — CV + BLE packages installed, typecheck green
Peer compatibility is **already verified** by dry-run (see
`research/computer-vision/frame-processor-stack-v5.md`). These resolve clean:
`react-native-worklets@0.10.3`, `react-native-vision-camera-worklets@5.2.2`,
`react-native-vision-camera-resizer@5.2.2`, `react-native-fast-tflite@3.0.1`.

Plus `react-native-ble-plx@3.5.1` — use its **own built-in** Expo config plugin.
**Do NOT install `@config-plugins/react-native-ble-plx`**; it peers on `expo@^49` and ERESOLVEs.

Also: create `metro.config.js` with `'tflite'` in `resolver.assetExts`, add the fast-tflite
plugin (`enableCoreMLDelegate: true`) to `app.json`, and **commit `package-lock.json` with every
dependency change** (CI runs `npm ci`, which fails hard on a mismatched lockfile).

> ⚠️ **`.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx` is WRONG and needs a
> rewrite.** The day agent wrote it against the VisionCamera **v4** API, then discovered v5's API
> is completely different. See §4 — this is the single most important correction to make.

### ✅ SM-3 — Tracking math written and unit tested
**There is no test framework in this project at all.** Add one (Jest via `jest-expo`, or Vitest
— your call, document it). Then build `src/tracking/` as pure, testable functions:

- `selectPrimaryAthlete.ts` — `PersonBox[]` → the locked box. MVP heuristic: largest area
  (PRD §4.2 says keep this loose).
- `computeGimbalCorrection.ts` — box offset from centre → roll/pitch deltas. **Proportional
  only** (PRD §5.1 — PID is FUTURE, do not build it). **Must include angle clamping and slew
  limiting from the start** — per `research/hardware/power-brownout-risk.md` these are the two
  primary brownout mitigations and they live in software.
- `useAthleteDetection.ts` — frames → `PersonBox[]`, discriminated-union return (no silent
  failure, `CLAUDE.md` §3.5).

**This is the highest-value work you can do**, because pure functions are the only part of the
whole control loop that is fully verifiable on Windows with no hardware. Test edge cases hard:
zero boxes, one box, ties, boxes at frame edges, clamp boundaries, NaN inputs.

### ✅ SM-4 — Research and docs airtight
Close what's closable in `docs/PRD.md` §7. Keep `research/` and `RESEARCH_LOG.md` current.
Ensure every `index.md` status tag is accurate and honest.

### ✅ SM-5 — **The morning hardware-test plan** (the user emphasized this)
> *"If we can't do a few things because it requires testing of real hardware, make sure to plan
> extremely excessively so that when I come back, we know exactly how to do the testings very
> efficiently (can multi task) and not have many issues or at least predictable issues."*

Write **`testing/MORNING_TEST_PLAN.md`**. This is a deliverable, not an afterthought. It must:

- **Sequence tests to maximize parallelism.** Example: the iPhone build installs while the
  micro:bit is being flashed; the 5-minute thermal soak test runs while servo wiring happens.
  Explicitly mark what can run concurrently.
- **Front-load the blocking/highest-risk items**, so a failure is discovered at 9am, not 4pm.
- **List every physical prerequisite up front** as a checklist — cables, the PCA9685 (⚠️ **not
  yet purchased**, PRD §8 — flag this loudly, it blocks all servo work), battery charged, phone
  charged, stand for the robot.
- **For each test:** exact steps, expected result, **predicted failure modes with their fixes
  already worked out**, and the exact fields to report back.
- **Time-box each test** with a realistic estimate.
- **Define abort conditions** — when to stop and move to the next test rather than sink an hour.

Aim for the user to work down a checklist without thinking, and for every failure they hit to
be one you already predicted and pre-solved.

---

## 3. Read these first, in this order

1. **`CLAUDE.md`** — the repo constitution. Hard constraints, not suggestions. Note §4.1 and §5
   especially; both were added today and both matter to you.
2. **`index.md`** (root) — current state of everything.
3. **`docs/PRD.md`** — DECIDED vs. FUTURE. **Never build a FUTURE item.**
4. **`docs/VERIFICATION_REPORT.md`** — the 2026-08-09 entry, and "Open items for the next
   contributor" which is your ordered backlog.
5. **`research/RESEARCH_LOG.md`** — check before searching anything; append after.
6. **`testing/REAL_HARDWARE_TEST_LOG.md`** — currently zero entries. Nothing has ever run on
   hardware.

---

## 4. Critical technical context you must not rediscover the hard way

**VisionCamera v5 is a Nitro rewrite with a completely different API from v4.** Almost every
tutorial online is v4 and will mislead you. Verified today by reading the actual `.d.ts` files
in `node_modules/`:

| v4 (what tutorials say) | v5.2.1 (what's actually installed) |
|---|---|
| `useFrameProcessor(...)` | **Does not exist.** Use `useFrameOutput({ onFrame })` |
| `<Camera frameProcessor={fp} />` | `<Camera outputs={[frameOutput]} />` |
| `react-native-worklets-core` | `react-native-worklets` (Software Mansion) |
| `NitroModules.box(model)` | Not needed — worklets access HybridObjects directly |

Confirmed exports:
- `useFrameOutput`, `useCamera`, `useAsyncRunner`, `usePermission`, `useCameraDevice` — all from
  **`react-native-vision-camera`** itself.
- `runOnJS` — from **`react-native-worklets`** ✅ (verified present).
- `react-native-vision-camera-worklets` exports runtime *plumbing* only (`provider`,
  `createAsyncRunner`, …) — **no hooks**. Install it (v5 requires it), but don't import hooks
  from it.

**Two v5 rules you must obey in any frame processor:**
1. **`frame.dispose()` is MANDATORY** as soon as you're done with the frame, or the pipeline
   stalls and starts dropping frames.
2. **Use `onFrameDropped`** — it reports `'frame-was-late' | 'out-of-buffers' | 'discontinuity' |
   'unknown'`. `'out-of-buffers'` specifically means your `onFrame` ran longer than one frame
   interval. **This is a better over-budget signal than timing arithmetic**, and it's free.

**Unverified, be careful:** `performance.now()` inside a `'worklet'` body may not exist — the
worklet runtime is a separate JS context. Prefer measuring on the JS side via `runOnJS`, or use
`frame.timestamp` (a real property on `Frame`). Don't assume; check.

**One more efficiency note from the v5 docs:** LiteRT/TFLite converts YUV→RGB internally, so
requesting `pixelFormat: 'rgb'` from the camera is *more* efficient than converting yourself —
the camera pipeline does it for free. Worth using.

---

## 5. Rules of engagement

### Decide, document, flag — the user's chosen policy
When you hit something ambiguous: **make the reasonable call and keep moving.** Do not stall.
Log it in **`docs/NIGHT_DECISIONS.md`** with: what you decided, why, what the alternatives were,
and how confident you are. The user reviews that one file in the morning.

### Never claim what you cannot observe
This is `CLAUDE.md` §5.2 and it is the most important rule in this repo. **You have no
hardware.** You cannot verify BLE, servos, on-device framerate, or detection quality.
- Never write into `testing/REAL_HARDWARE_TEST_LOG.md` — that file is for human-reported results
  only.
- Never mark a hardware-dependent thing `✅ verified`.
- `⚠️ needs verification` is an honest tag. Use it freely.

A CI build result **is** legitimately verifiable by you — that's a real command with real output.
Record those in `docs/VERIFICATION_REPORT.md`.

### Check `node_modules/` before believing any tutorial
`CLAUDE.md` §4.1. Two separate bugs today came from sources that were a major version behind and
all agreed with each other. `npm view` and `npm install --dry-run` are cheap and definitive.

### Stay in scope
PRD §6 lists explicit non-goals: base/wheel movement, PID, ball tracking, pose tracking,
re-identification, tap-to-select, telemetry readouts, scoring animations, TestFlight. **Do not
build these**, even if you run out of other work. If you genuinely run dry, deepen testing,
research, and the morning plan instead.

### Keep the indexes true
Every change updates the relevant `index.md` in the same commit (`CLAUDE.md` §1.3). A stale index
is worse than none.

---

## 6. The user's environment — everything must work for them

- **Windows 11 PC.** No Mac, and no reliable access to one. Never propose a step requiring macOS.
- **iPhone 16** (non-Pro, no LiDAR — RGB camera only).
- **`expo prebuild --platform ios` does NOT run on Windows**, even with `--no-install`. Verified.
  CI is the only way to exercise the iOS native build. `npm run typecheck` is the only fast local
  gate — use it constantly.
- **Everything must stay free.** Public repo (free unmetered macOS runners), AltStore Classic +
  AltServer (free), free Apple ID. No paid Apple Developer account. If you find yourself
  recommending something that costs money, stop and log it in `NIGHT_DECISIONS.md` instead.
- Shell is **PowerShell**, with Git Bash also available. Watch for Windows path and encoding
  quirks (the day agent hit a `cp1252` console encoding error printing box-drawing characters —
  write to a file instead of printing).

---

## 7. What the day agent already did (don't redo it)

Commits `976c55c` → `5b36707`, all committed, typecheck green:

- **Discovered the repo didn't match its own docs.** `.github/`, `assets/`, `node_modules/`, and
  git itself were all missing despite being documented as present.
- **Fixed a build-blocking bug:** `app.json` had a `plugins` entry for `react-native-vision-camera`.
  v5 ships no config plugin; this made `expo prebuild` fail outright. Removed.
- Removed 5 dead asset references from `app.json`; deleted a stale duplicate PRD.
- **Wrote `.github/workflows/build-ios-unsigned.yml`** (pinned `macos-26`, `set -o pipefail`,
  scheme derived from the workspace at runtime, no `xcpretty` dependency). **Never run.**
- `git init`, `.gitignore`, three commits.
- Built **`research/`** (11 sourced findings), **`testing/`**, **`.claude/agents/`** (researcher,
  hardware-tester, ux-reviewer), and three skills (`ble-ping`, `servo-bounds-test`,
  `cv-framerate-test`).
- Added `CLAUDE.md` §4.1 (version-drift rule) and §5 (Research & Testing Protocol).
- Rewrote `README.md`, root `index.md`, `TREE.txt`, `docs/VERIFICATION_REPORT.md` honestly.
- Verified peer compatibility of all 5 planned packages by dry-run (nothing installed).

**Known-broken and left for you:** `FrameTimingScreen.tsx` uses the v4 API (see §4).

---

## 8. Morning handoff — what the user sees when they wake up

Write **`docs/NIGHT_REPORT.md`** as your last act. Keep it scannable:

1. **Success measures: met / partially met / not met**, one line each, honest.
2. **What works now that didn't last night** — with evidence (commands run, output).
3. **`docs/NIGHT_DECISIONS.md`** — the decisions needing their review.
4. **Blockers you couldn't clear**, and exactly what you need from them.
5. **Pointer to `testing/MORNING_TEST_PLAN.md`** — their checklist for the day.
6. **What is still unverified**, stated plainly. Do not oversell. A short honest report beats a
   long optimistic one, and this repo has already been burned by confident documentation that
   turned out to be false.

Good luck. The structure is in place; the hard part now is making it real.
