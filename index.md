# athlete-camera-robot — index

Companion phone app for a wheeled robot that films an athlete by tracking
them with on-device computer vision and steering a camera gimbal to follow
them. **Read `CLAUDE.md` first** for the rules this index system follows.
Read `docs/PRD.md` for what is decided vs. future.

Current milestone: **Milestone 1 / Stage 4 — live camera preview + on-device person detection +
tracking overlay (box, distance, bearing, centred indicator).** Code and unit tests are done and
verified on Windows; on-device behavior is not (see below). Multi-athlete UX, base movement, and
everything else in `docs/PRD.md` §5–§6 remain untouched.

## ⚠️ One on-device report so far — box too big, fixed but not re-confirmed

As of **2026-08-13**: `npm install`, `npm run typecheck`, and `npm test` (65/65) all succeed, the
Expo config evaluates, and **the CI build pipeline has run green 4 times** (`.github/workflows/index.md`,
`docs/VERIFICATION_REPORT.md`) producing a real, inspected unsigned `.ipa`. The app **has** now
been installed on the iPhone and launched — the first real on-device report found the tracking
box was oversized/mispositioned and the readout numbers weren't visible. Both were diagnosed and
fixed (see `docs/VERIFICATION_REPORT.md`'s 2026-08-13 entry) using
`.claude/skills/webcam-detection-preview/` for everything testable off-device, but **the fixes
have not yet been re-confirmed on the phone.** No BLE link has been made and no servo has moved.
`testing/REAL_HARDWARE_TEST_LOG.md` still has zero entries — only a human running
`testing/MORNING_TEST_PLAN.md` can change that (`CLAUDE.md` §5.2).

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
| `src/` | folder | All application source loaded by `index.ts` — see `src/index.md` | ⚠️ mixed — `src/tracking/` + `src/screens/frameLayout.ts` are ✅ unit-tested (65 tests total); on-device rendering is still unconfirmed after the 2026-08-13 fixes |
| `.claude/` | folder | Skills (`skills/`) and subagents (`agents/`) — see each folder's `index.md` | ⚠️ needs verification — `build-unsigned-ipa` and `webcam-detection-preview` are ✅ verified (both runnable/run from this machine), the other 3 hardware skills are unrun |
| `.github/` | folder | CI workflow for the unsigned iOS build — see `.github/index.md` | ✅ verified — ran green 4 times, most recently 2026-08-12 |
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
