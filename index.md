# athlete-camera-robot — index

Companion phone app for a wheeled robot that films an athlete by tracking
them with on-device computer vision and steering a camera gimbal to follow
them. **Read `CLAUDE.md` first** for the rules this index system follows.
Read `docs/PRD.md` for what is decided vs. future.

Current milestone: **Milestone 1 / Stage 3 — live camera preview only.**
Person detection (Stage 4) is not implemented — see `docs/PRD.md` §4.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `CLAUDE.md` | file | Rules every contributor (AI or human) must follow | ✅ verified |
| `README.md` | file | Human quickstart: get code onto a machine, build, sign, install | ✅ verified |
| `docs/` | folder | Project spec, decisions, and the verification log — see `docs/index.md` | ✅ verified |
| `src/` | folder | All application source loaded by `index.ts` — see `src/index.md` | ✅ verified |
| `index.ts` | file | Expo entry point; registers `src/App.tsx` as the root component | ✅ verified |
| `app.json` | file | Expo config: bundle IDs, permissions, native config plugins | ✅ verified |
| `package.json` | file | Dependencies + scripts (`npm run typecheck`, `start`, `ios`, `android`) | ✅ verified |
| `tsconfig.json` | file | TypeScript config (extends `expo/tsconfig.base`, `strict: true`) | ✅ verified |
| `.github/` | folder | CI workflows — see `.github/index.md` | ⚠️ needs verification (see note below) |
| `LICENSE` | file | MIT (inherited from the Expo template this project started from) | ✅ verified |

## Depends on
Nothing outside this repo except npm packages declared in `package.json`.

## Depended on by
Nothing — this is the top level.

## Known open item
`.github/workflows/build-ios-unsigned.yml` exists and matches the pipeline
documented in `docs/PRD.md` §3.2 and `README.md`, but it has never actually
been run (no macOS runner is available in the environment that authored it).
See `docs/VERIFICATION_REPORT.md` for exactly what is and isn't confirmed.
**The next person who triggers this workflow must update that file with the
real outcome.**
