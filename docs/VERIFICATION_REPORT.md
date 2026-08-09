# Verification Report (append-only log)

Every entry records: what was checked, how (exact command or source), and
the result. This is the evidence that backs the ✅ / ⚠️ / ❌ tags in every
`index.md`. Do not mark something ✅ anywhere in this repo without an
entry here to back it up (`CLAUDE.md` §4).

---

## 2026-08-09 — Phase 0: the repo did not match its own documentation

**Environment:** Windows 11, the developer's actual machine. Node.js + npm available.
No macOS, no Xcode, no physical device testing performed.

### 1. What was actually on disk vs. what the docs claimed

Audited the real folder before making changes. Several documented components did not exist:

| Documented as existing | Reality |
|---|---|
| `.github/workflows/build-ios-unsigned.yml` — asserted by `README.md`, root `index.md`, **and this file's own 2026-08-03 §4 entry** | **No `.github/` folder at all** |
| `assets/icon.png` + 4 other assets, referenced by `app.json` | **No `assets/` folder** |
| `node_modules/` — required by the §4 typecheck gate | Absent; the gate had never been runnable here |
| A git repository (the pipeline is "push → Actions → artifact") | **Not a git repo** |
| 4 skills in `SKILLS_REGISTRY.md` | Only `build-unsigned-ipa/`, whose scripts are stubs |
| `docs/PRD.md` as sole spec | A stale 213-line duplicate also sat at root as `robot-camera-tracker-PRD.md` |

The 2026-08-03 entry below describes writing the CI workflow. **That work was done in a
different environment and never reached this machine.** The entry documenting the fix for a
missing file was itself describing a file that is missing — the same failure mode one level up.
Left in place rather than deleted, as the record of what happened.

### 2. `npm install`
- Command: `npm install --no-audit --no-fund`
- Result: **succeeded**, 470 packages, exit 0. One deprecation warning (`uuid@7.0.3`, transitive).

### 3. TypeScript check — ✅ **verified**
- Command: `npm run typecheck` (`tsc --noEmit`)
- Result: **zero errors.** First honestly-verified claim in this repo.
- Follow-up: `tsconfig.json` had no `include`/`exclude`, so `tsc` swept up everything including
  `.claude/skills/*/scripts/`. Scoped it to `index.ts` + `src/**` and excluded `node_modules`,
  `ios`, `android`, `.claude`. Re-ran: still zero errors. Skill scripts are staging templates,
  not app source, and some deliberately import packages that aren't installed yet.

### 4. `expo prebuild --platform ios` on Windows — ❌ **does not work**
- Command: `npx expo prebuild --platform ios --no-install`
- Result: `⚠️ Skipping generating the iOS native project files. Run npx expo prebuild again from
  macOS or Linux.` then `CommandError: At least one platform must be enabled when syncing`.
- `--no-install` does **not** rescue it — Expo refuses the iOS generation step itself off
  macOS/Linux, not merely the CocoaPods step.
- **Consequence:** the Xcode scheme name cannot be determined locally. The workflow now derives
  it at runtime from `xcodebuild -list -json` and prints all schemes in a diagnostic step,
  rather than hard-coding a guess.
- Recorded in `research/phone-integration/expo-cng-constraints.md`.

### 5. `app.json` had an invalid config plugin — **a regression introduced by the fix below**
- The first prebuild attempt failed with:
  `PluginError: Cannot find module '.../react-native-vision-camera/lib/VisionCamera'` and
  `No "app.plugin.{js,cjs,mjs,ts,cts,mts}" file was found in "react-native-vision-camera"`.
- Verified directly: `node_modules/react-native-vision-camera@5.2.1/` contains **no
  `app.plugin.js`**. VisionCamera v5 ships no Expo config plugin. Confirmed against the current
  official docs, which show permissions set via `ios.infoPlist` and `android.permissions`
  **with no plugin entry**.
- The `plugins` array was added by the 2026-08-03 pass (§3 below), citing several agreeing
  guides. Those guides were all written for VisionCamera v3/v4, where the plugin *was* required.
  **The original `app.json`, before that "fix," was already correct for v5.**
- **Fix applied:** removed the `plugins` array. `ios.infoPlist.NSCameraUsageDescription` and
  `android.permissions` were already present and are the correct v5 configuration.
- **This is why `CLAUDE.md` §4.1 now exists.** Multiple secondary sources agreeing is not
  corroboration — it usually means they were written the same year. Check `node_modules/`.
- **Not verified end-to-end:** prebuild still cannot run here (item 4), so the *only* thing
  proven is that this specific plugin error is gone. Whether prebuild then succeeds on macOS is
  unknown until CI runs.

### 6. Other Phase 0 fixes (typecheck-verified only)
- Removed `icon` / `web.favicon` / `android.adaptiveIcon` from `app.json` — all five referenced
  files were absent, which would fail prebuild. Expo has defaults; real branding assets are a
  separate task. Chose removal over placeholder PNGs deliberately: Expo's icon pipeline fails on
  a zero-byte or malformed PNG, which is a worse failure than having no icon.
- Wrote `.github/workflows/build-ios-unsigned.yml`. Pinned `runs-on: macos-26` (GA since Feb
  2026; `macos-latest` migrated to it mid-2026 — a floating label lets a GitHub-side rollover
  break the build). YAML validated with a parser: 9 steps, parses clean.
- `git init` + `.gitignore` (`ios/`, `android/` untracked — CNG regenerates them). Baseline
  commit made **before** any deletions so nothing was lost.
- Deleted `robot-camera-tracker-PRD.md`, the stale duplicate. Grepped first: only `TREE.txt`
  referenced it. Recoverable at commit `976c55c`.
- Python syntax-checked both `ble-ping` scripts (`py_compile`): clean.

### 7. What was NOT verified — and cannot be, from here
- **The CI workflow has never run.** Everything about it is `⚠️ needs verification`. The scheme
  derivation, the archive flags, the `.ipa` packaging — all unproven.
- **No app has ever been installed on the iPhone.** No screen has been seen on a device.
- **No hardware exists in the loop yet.** No BLE, no servos. The PCA9685 is still unpurchased
  (PRD §8).
- **Every skill except `build-unsigned-ipa` is unrun**, and that one's scripts are stubs.
- Frame processors **cannot run at all** today: `react-native-worklets` and
  `react-native-vision-camera-worklets` are not installed (see
  `research/computer-vision/frame-processor-stack-v5.md`).

### 8. Structure added
`research/` (sourced findings + `RESEARCH_LOG.md`), `testing/` (human-reported hardware
results), `.claude/agents/` (researcher, hardware-tester, ux-reviewer), and three new skills.
`CLAUDE.md` gained §4.1 (version-drift rule) and §5 (Research & Testing Protocol); Directory Map
and Growing This Project renumbered to §6 and §7, with stale cross-references in `src/index.md`
and this file corrected.

---

## 2026-08-03 — Full repo re-verification + reorganization

**Environment:** Linux sandbox, Node.js + npm available, no macOS/Xcode,
no physical iOS/Android device, no network access to registries other than
npm/pypi/github (per this environment's egress allowlist).

### 1. `npm install` from the original `package.json` + `package-lock.json`
- Command: `npm install --no-audit --no-fund`
- Result: **succeeded**, 471 packages installed.
- Follow-up check: `npm ls react-native-nitro-modules react-native-nitro-image react-native-vision-camera`
  showed both nitro packages present **only as transitive peer dependencies**
  of `react-native-vision-camera` — neither was declared directly in
  `package.json`.
- Cross-checked against the official VisionCamera docs
  (https://visioncamera.margelo.com/docs): *"VisionCamera is built on-top of
  react-native-nitro-modules and uses react-native-nitro-image's Image type
  for photos - install those dependencies."* This confirms they are meant to
  be **direct** dependencies, not incidental transitive ones.
- **Risk this created:** npm's auto-install of unmet peer dependencies is
  version/config-dependent behavior, not a guarantee. A different package
  manager, a future npm major version, or a lockfile regeneration could
  silently drop these and break native module autolinking with no clear
  error message pointing at the cause.
- **Fix applied:** added `react-native-nitro-modules` and
  `react-native-nitro-image` as explicit `dependencies` in `package.json`.
- **Re-verification:** `npm install` again with the fixed `package.json` →
  succeeded, 470 packages (lockfile regenerated). `npm ls` now shows both
  packages as **direct** top-level dependencies, not just deduped peers.

### 2. TypeScript check
- Command: `npx tsc --noEmit -p tsconfig.json`
- Result on the **original** `App.tsx`: **zero errors.** The original
  component was not buggy at the type level.
- Result on the **reorganized** `src/` tree (`App.tsx` + `hooks/` +
  `screens/` + `theme/`): **zero errors.**
- Status: ✅ verified, both before and after reorganization.

### 3. `app.json` vs. `react-native-vision-camera` Expo setup requirements
- Searched current library documentation and multiple independent guides
  (VisionCamera official docs, Ignite Cookbook, LogRocket, Weblianz) for the
  Expo (Continuous Native Generation) setup steps.
- All consistently show a `"plugins": ["react-native-vision-camera", {...}]`
  entry is required in `app.json` for Expo's config-plugin system (CNG) to
  correctly wire the camera permission strings and native linking when
  running `expo prebuild`.
- The original `app.json` had **no `plugins` array at all** — only the raw
  `ios.infoPlist.NSCameraUsageDescription` string, which is not sufficient
  for CNG's automatic native project generation, and this repo's own
  documented CI pipeline (`docs/PRD.md` §3.2) explicitly runs
  `expo prebuild`.
- **Fix applied:** added the `plugins` array to `app.json`, plus
  `android.permissions: ["android.permission.CAMERA"]` for parity on
  Android (was previously iOS-only, matching neither the PRD's Android
  target ambiguity nor the library's documented setup).
- **Not independently re-verified end-to-end** (no macOS runner available
  here to actually run `expo prebuild --platform ios` and inspect the
  generated Xcode project). Flagged ⚠️ in `app.json`'s effect on
  `.github/workflows/build-ios-unsigned.yml` until someone runs the
  workflow for real.

### 4. `.github/workflows/build-ios-unsigned.yml`
- `README.md` (original) and `docs/PRD.md` §3.2 both describe this file as
  **already created and part of the project**.
- Checked the actual project file listing: **the file did not exist
  anywhere in the repository.**
- This is exactly the "confidently-wrong index" failure mode `CLAUDE.md`
  exists to prevent — documentation asserting a component exists and works,
  when it never did.
- **Fix applied:** wrote `.github/workflows/build-ios-unsigned.yml` to
  implement the pipeline exactly as documented in `docs/PRD.md` §3.2:
  `npm ci` → typecheck → `expo prebuild --platform ios` → `xcodebuild
  archive` with code signing disabled → zip into an unsigned `.ipa` →
  upload as a workflow artifact.
- **Explicitly NOT verified end-to-end** — no macOS/Xcode available in this
  environment to execute it. The Xcode scheme name used in the workflow is
  an educated guess based on Expo's naming convention and is flagged inline
  in the workflow file and in `.github/workflows/index.md`. **Action
  required:** the next person with GitHub Actions access must run this
  workflow via `workflow_dispatch` and update this report + that index.md
  with the real result.

### 5. Code structure change (no behavior change intended)
- Split the original single `App.tsx` (permission request + device lookup +
  three conditional render branches, all in one function) into:
  - `src/hooks/useCameraSetup.ts` — state only, discriminated-union return type
  - `src/screens/PermissionRequiredScreen.tsx`
  - `src/screens/NoCameraDeviceScreen.tsx`
  - `src/screens/CameraPreviewScreen.tsx`
  - `src/App.tsx` — composition/routing only
- Rationale: `CLAUDE.md` §3 (single-responsibility). Also removes a
  non-null assertion (`device!`) that existed implicitly in the "flat"
  version's control flow, in favor of a discriminated union TypeScript can
  narrow safely.
- Verified no behavior change: same three render states, same permission
  request timing (`useEffect` on `hasPermission`), same `Camera` props.
- `tsc --noEmit`: zero errors (see item 2 above).
- **Not verified on a physical device** — no iOS/Android hardware available
  in this environment. This was true of the original code too; carrying the
  same caveat forward rather than claiming new proof that doesn't exist.

---

## Open items for the next contributor

*(Updated 2026-08-09. Ordered — each unblocks the next.)*

1. **Push to a public GitHub repo.** Nothing downstream can happen first. Public
   matters: free *unmetered* macOS runner minutes; private bills at 10×.
2. **Run the CI workflow.** Read the scheme name from the diagnostic step's output
   (it cannot be determined on Windows — see 2026-08-09 item 4). Update
   `.github/workflows/index.md` and this file with the real outcome.
3. **Install on the iPhone 16 via AltStore.** Confirm the three `useCameraSetup`
   states are reachable on-device; update `src/hooks/index.md` and
   `src/screens/index.md`. Log it in `testing/REAL_HARDWARE_TEST_LOG.md` — that
   file currently has **zero** entries.
4. **Install the frame-processor packages** (`react-native-worklets`,
   `react-native-vision-camera-worklets`) and run `.claude/skills/cv-framerate-test/`
   Stage 1 before adding any model. Settle peer conflicts locally first and commit
   the regenerated lockfile, or CI's `npm ci` fails in a way that looks like an
   Xcode problem.
5. **Buy the PCA9685** (PRD §8) before `servo-bounds-test` can run.
6. Everything in `docs/PRD.md` marked FUTURE/STRETCH is still not started — do not
   begin it without the user explicitly asking, per `CLAUDE.md` §4 and §7.

**Standing reminder:** as of 2026-08-09 **nothing in this repo has been run on
physical hardware.** The only verified claims are `npm install` and
`npm run typecheck`. Treat every other status tag accordingly.
