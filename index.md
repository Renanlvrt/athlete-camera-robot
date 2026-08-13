# athlete-camera-robot — index

Companion phone app for a wheeled robot that films an athlete by tracking
them with on-device computer vision and steering a camera gimbal to follow
them. **Read `CLAUDE.md` first** for the rules this index system follows.
Read `docs/PRD.md` for what is decided vs. future.

Current milestone: **Milestone 1 / Stage 4 — live camera preview + on-device person detection +
tracking overlay (box, distance, bearing, dashed center-line, centred indicator), front/back
camera toggle, and basic video recording.** Code and unit tests are done and verified on Windows;
on-device behavior of everything added since the first phone install is not (see below).
Multi-athlete UX, base movement, and everything else in `docs/PRD.md` §5–§6 remain untouched.

## ⚠️ One on-device report so far — box-too-big fixed, next round untested

As of **2026-08-13**: `npm install`, `npm run typecheck`, and `npm test` (73/73) all succeed, the
Expo config evaluates, and **the CI build pipeline has run green 6 times**
(`.github/workflows/index.md`, `docs/VERIFICATION_REPORT.md`) producing a real, inspected unsigned
`.ipa`. The app **has** been installed on the iPhone and launched once — that report found the
tracking box was oversized/mispositioned and the readout numbers weren't visible. The box-drawing
bug (badge invisible under the panel) is fixed and laptop-confirmed; **the box-size/position root
cause is not actually confirmed** — the developer's own hypothesis (front camera) turned out to
not match the code that was running (only the back camera was ever requested), so front-camera
mirroring is now handled correctly regardless, but the real explanation is still most likely the
open frame-coordinate-rotation gap (`src/hooks/useAthleteDetection.ts`). A further round also
added a front/back toggle, a dashed center-line + vector readout, and basic video recording — all
implemented and laptop-tested as far as possible (`.claude/skills/webcam-detection-preview/`), but
**none of this second round has been installed on the phone yet.** No BLE link has been made and
no servo has moved. `testing/REAL_HARDWARE_TEST_LOG.md` still has zero entries — only a human
running `testing/MORNING_TEST_PLAN.md` can change that (`CLAUDE.md` §5.2).

Treat every `⚠️` tag below as literal. See `docs/VERIFICATION_REPORT.md` for exactly what was and
wasn't checked, and `testing/MORNING_TEST_PLAN.md` for the ordered path to a real hardware test.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `CLAUDE.md` | file | Rules every contributor (AI or human) must follow | ✅ verified |
| `README.md` | file | Human quickstart: get code onto a machine, build, sign, install | ⚠️ needs verification (steps never executed end-to-end) |
| `docs/` | folder | Project spec, decisions, and the verification log — see `docs/index.md` | ✅ verified |
| `research/` | folder | Sourced external findings per domain; check `RESEARCH_LOG.md` before searching — see `research/index.md` | ✅ written & sourced (see that file — ✅ means something different there) |
| `testing/` | folder | Human-reported results from real hardware — see `testing/index.md` | ⚠️ structure only — **zero results recorded** |
| `design/` | folder | UI mockups for direction-setting — see `design/index.md` | ✅ verified |
| `assets/` | folder | Bundled static files (the TFLite model) — see `assets/index.md` | ⚠️ needs verification — model sourced/confirmed, inference untested on device |
| `src/` | folder | All application source loaded by `index.ts` — see `src/index.md` | ⚠️ mixed — `src/tracking/` + `src/screens/frameLayout.ts` are ✅ unit-tested (73 tests total); on-device rendering (including front/back switching and recording) is unconfirmed |
| `.claude/` | folder | Skills (`skills/`) and subagents (`agents/`) — see each folder's `index.md` | ⚠️ needs verification — `build-unsigned-ipa` and `webcam-detection-preview` are ✅ verified (both runnable/run from this machine), the other 3 hardware skills are unrun |
| `.github/` | folder | CI workflow for the unsigned iOS build — see `.github/index.md` | ✅ verified — ran green 6 times, most recently 2026-08-13 |
| `index.ts` | file | Expo entry point; registers `src/App.tsx` as the root component | ✅ verified |
| `app.json` | file | Expo config: bundle IDs, camera permissions, fast-tflite/ble-plx plugins | ⚠️ needs verification — evaluates cleanly and CI's `expo prebuild` succeeds, but effect on-device (permission prompts, plugin behavior) unconfirmed |
| `metro.config.js` | file | Adds `.tflite` to Metro's asset extensions so models bundle | ⚠️ needs verification (never bundled on device) |
| `package.json` | file | Dependencies + scripts (`npm run typecheck`, `start`, `ios`, `android`); includes `expo-dev-client` for fast JS-only iteration after the first sideload | ✅ verified — installs clean, no ERESOLVE |
| `tsconfig.json` | file | TypeScript config; scoped to `index.ts` + `src/**`, excludes `.claude/` | ✅ verified |
| `.gitignore` | file | Keeps `ios/` and `android/` untracked — CNG regenerates them | ✅ verified |
| `LICENSE` | file | MIT (inherited from the Expo template this project started from) | ✅ verified |

## The three domains

This project spans computer vision, phone/build integration, and physical
hardware. Each fails differently, and the structure reflects that:

- **`research/`** — external facts that change (library APIs, platform
  pricing, hardware quirks). Dated and sourced, so staleness is visible.
- **`testing/`** — physical observations. **Only a human can put results
  here** (`CLAUDE.md` §5.2).
- **`docs/VERIFICATION_REPORT.md`** — evidence for every ✅ tag.

## Depends on
Nothing outside this repo except npm packages declared in `package.json`.

## Depended on by
Nothing — this is the top level.
