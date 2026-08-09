# athlete-camera-robot — index

Companion phone app for a wheeled robot that films an athlete by tracking
them with on-device computer vision and steering a camera gimbal to follow
them. **Read `CLAUDE.md` first** for the rules this index system follows.
Read `docs/PRD.md` for what is decided vs. future.

Current milestone: **Milestone 1 / Stage 3 — live camera preview only.**
Person detection (Stage 4) is not implemented — see `docs/PRD.md` §4.

## ⚠️ Nothing here has ever run on real hardware

As of **2026-08-09**, the verified claims in this repo are: `npm install`,
`npm run typecheck`, and `npm test` (28/28) all succeed, and the Expo config
evaluates. That is all. No CI build has run, no app
has been installed on the iPhone, no BLE link has been made, no servo has
moved. `testing/REAL_HARDWARE_TEST_LOG.md` has zero entries.

Treat every `⚠️` tag below as literal. See `docs/VERIFICATION_REPORT.md`
(2026-08-09 entry) for exactly what was and wasn't checked, and its
"Open items" list for the ordered path forward.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `CLAUDE.md` | file | Rules every contributor (AI or human) must follow | ✅ verified |
| `README.md` | file | Human quickstart: get code onto a machine, build, sign, install | ⚠️ needs verification (steps never executed end-to-end) |
| `docs/` | folder | Project spec, decisions, and the verification log — see `docs/index.md` | ✅ verified |
| `research/` | folder | Sourced external findings per domain; check `RESEARCH_LOG.md` before searching — see `research/index.md` | ✅ written & sourced (see that file — ✅ means something different there) |
| `testing/` | folder | Human-reported results from real hardware — see `testing/index.md` | ⚠️ structure only — **zero results recorded** |
| `design/` | folder | UI mockups for direction-setting — see `design/index.md` | ✅ verified |
| `src/` | folder | All application source loaded by `index.ts` — see `src/index.md` | ⚠️ mixed — `src/tracking/` is ✅ unit-tested (28 tests); the screens have never run on a device |
| `.claude/` | folder | Skills (`skills/`) and subagents (`agents/`) — see each folder's `index.md` | ⚠️ needs verification (no skill has been run) |
| `.github/` | folder | CI workflow for the unsigned iOS build — see `.github/index.md` | ⚠️ needs verification (**never run**) |
| `index.ts` | file | Expo entry point; registers `src/App.tsx` as the root component | ✅ verified |
| `app.json` | file | Expo config: bundle IDs, camera permissions | ⚠️ needs verification (plugin bug fixed 2026-08-09; prebuild unrunnable on Windows) |
| `metro.config.js` | file | Adds `.tflite` to Metro's asset extensions so models bundle | ⚠️ needs verification (never bundled on device) |
| `package.json` | file | Dependencies + scripts (`npm run typecheck`, `start`, `ios`, `android`) | ✅ verified |
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
