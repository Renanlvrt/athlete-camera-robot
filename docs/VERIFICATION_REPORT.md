# Verification Report (append-only log)

Every entry records: what was checked, how (exact command or source), and
the result. This is the evidence that backs the ✅ / ⚠️ / ❌ tags in every
`index.md`. Do not mark something ✅ anywhere in this repo without an
entry here to back it up (`CLAUDE.md` §4).

---

## 2026-08-09 (later) — Dependencies installed, test framework added, tracking logic verified

**Environment:** Windows 11, developer's machine. No macOS, no device, no robot hardware.

### 1. CV + BLE dependencies installed — ✅ verified
`npm install` of the five packages whose peer ranges were dry-run checked earlier:
`react-native-worklets@0.10.3`, `react-native-vision-camera-worklets@5.2.2`,
`react-native-vision-camera-resizer@5.2.2`, `react-native-fast-tflite@3.0.1`,
`react-native-ble-plx@3.5.1`. Result: **`added 16 packages`, exit 0**, no ERESOLVE, no
`--legacy-peer-deps`. `package-lock.json` committed in the same change.

### 2. `metro.config.js` created — ⚠️ needs verification
Adds `'tflite'` to `resolver.assetExts`. Cannot be verified without bundling on a device;
the file itself is trivial and matches the documented fast-tflite requirement.

### 3. `app.json` config plugins — ✅ resolve, ⚠️ effect unverified
Added `react-native-fast-tflite` (`enableCoreMLDelegate: true`) and `react-native-ble-plx`.
- Confirmed **both packages ship an `app.plugin.js`** — the exact check that would have caught
  the VisionCamera bug in the earlier entry.
- `npx expo config --type prebuild` **evaluates cleanly** (this is the step that previously threw
  `PluginError`), and the ble-plx plugin's Android permissions appear in the output:
  `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`.
- `NSBluetoothAlwaysUsageDescription` does **not** appear in `expo config` output. Investigated:
  `withBluetoothPermissions.js` applies it via `withInfoPlist`, which is a **mod** — mods run
  during real `expo prebuild`, not during config evaluation. The `bluetoothAlwaysPermission`
  option key was read from the plugin source and is correct. **Not a bug**; recorded so nobody
  re-investigates.

### 4. No `babel.config.js` is required — ✅ verified by reading the source
Checked whether `react-native-worklets` needs a Babel plugin registered. It does, **but
`babel-preset-expo@57.0.5` adds it automatically** when the package is installed —
`node_modules/expo/node_modules/babel-preset-expo/build/configs/expo.js:110`:
*"Automatically add worklets or reanimated plugin when package is installed."*
Adding a hand-written `babel.config.js` would be redundant and risks diverging from the preset.

### 5. Test framework added — ✅ verified
There was **no test framework in this project at all**. Added `jest` + `jest-expo` +
`@types/jest`, `jest.config.js` scoped to `src/**`, and `npm test` / `npm run test:watch`.
`tsconfig.json` needed `"types": ["jest"]` — without it `tsc` failed on every `describe`/`it`.

### 6. `src/tracking/` — ✅ verified (logic only)
Pure, dependency-free control logic: `types.ts`, `selectPrimaryAthlete.ts`,
`computeGimbalCorrection.ts`.

- **`npm test` → 28/28 passing**, 2 suites.
- **`npm run typecheck` → exit code 0**, zero errors (checked the exit code explicitly, not just
  the absence of output).

Tests cover: confidence gating at the boundary, largest-area selection by area rather than
width/height, deterministic tie-breaking (a non-deterministic tie would oscillate the gimbal
between two athletes), input purity, the roll/pitch **sign convention** in all four directions
(the vertical axis inverts, and this is the most likely bug in the file), linear gain scaling,
centre-vs-corner offset, per-axis deadband, `maxStep` clamping in both directions, NaN/Infinity
rejection, finiteness across a 121-point sweep, and a closed-loop **convergence** simulation
asserting the error never grows.

**What this does NOT prove:** the tuning constants (`gain: 30`, `deadband: 0.05`, `maxStep: 5`)
are conservative guesses that have never touched hardware. The convergence test uses a crude
"1° ≈ 0.01 frame widths" stand-in for real servo geometry. Both need a field test.

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

## 2026-08-09 (night) — CI workflow ran green, first attempt, twice

**Environment:** Windows 11, developer's machine, `gh` CLI authenticated as `Renanlvrt`.
Repo is public and pushed (`origin/main` at `3e379da` at the time of these runs).

### `.github/workflows/build-ios-unsigned.yml` — ✅ verified
Two runs, both succeeded on the first attempt — none of the predicted failure modes in
`.github/workflows/index.md` ("likely first failures": scheme detection, missing lockfile
commit, config-plugin errors) actually occurred.

1. **Run `31288776388`** — triggered automatically by the day agent's `push` of commit
   `1176a1e` (before CV/BLE native packages were installed). `success` in **5m19s**.
2. **Run `31289641191`** — triggered by me via `gh workflow run build-ios-unsigned.yml` against
   commit `3e379da` (current `HEAD`, all 5 CV/BLE native packages — `react-native-worklets`,
   `react-native-vision-camera-worklets`, `react-native-vision-camera-resizer`,
   `react-native-fast-tflite`, `react-native-ble-plx` — linked in). `success` in **7m39s**. This
   is the meaningful one: it proves `expo prebuild --platform ios` and `xcodebuild archive`
   both handle the native-module set the day agent installed, on the actual macOS runner.

For each, downloaded the `unsigned-app-ipa` artifact via `gh run download <id> --name
unsigned-app-ipa --repo Renanlvrt/athlete-camera-robot` and inspected it directly (not just
trusted the green checkmark):
- `unzip -l` shows a well-formed `Payload/athletecamerarobot.app/` bundle in both — 76 files,
  ~38.8MB uncompressed for the `HEAD` build (vs. a much smaller bundle for the pre-deps build,
  consistent with the new native frameworks being linked).
- `Payload/athletecamerarobot.app/athletecamerarobot` (the Mach-O executable) is present, 12MB
  in the `HEAD` build.
- `Payload/athletecamerarobot.app/Info.plist` extracted and confirmed via `file` to be a valid
  **Apple binary property list** (not corrupt/truncated).
- `Frameworks/` contains `React.framework`, `hermesvm.framework`, `ExpoModulesCore.framework`,
  etc. — expected shape for an Expo/RN app.

**Not verified by this, and cannot be from here:** whether the `.ipa` actually installs and
launches on the physical iPhone 16 via AltStore, whether the camera permission flow works, and
whether the CV/BLE native modules actually initialize at runtime (compiling and linking cleanly
is necessary but not sufficient — first-run crashes from missing Info.plist usage-description
strings or native init issues are a known category and are exactly what
`testing/MORNING_TEST_PLAN.md` is for). Keep `⚠️ needs verification` on all of that until a
human reports it.

---

## 2026-08-12 — Stage 4: person detection + tracking overlay implemented, CI-verified

**Environment:** Windows 11, developer's machine. `gh` authenticated as `Renanlvrt`. No macOS, no
iPhone testing performed this session — see "Not verified" below.

### 1. Sourced and bundled a real TFLite model — ✅ verified
Downloaded `coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip` directly from
`storage.googleapis.com` (not trusted from a tutorial), unzipped it, and read `labelmap.txt`
byte-for-byte to confirm `detection_classes[i] == 0` means "person" (previously medium-confidence
from indirect reasoning; now directly confirmed). `detect.tflite` (4.18 MB) copied to
`assets/models/person-detection.tflite`. Full detail: `research/computer-vision/person-detection-model-asset.md`.

### 2. New pure logic in `src/tracking/` — ✅ verified
`decodeDetections.ts` (raw SSD output tensors → `PersonBox[]`, 12 tests) and
`computeTrackingReadout.ts` (offset → distance/bearing/`isCentered`, 12 tests). `npm test` →
**59/59 passing** (up from 28), `npm run typecheck` → zero errors.

### 3. `src/screens/frameLayout.ts` — ✅ verified
Pure `'cover'`-fit geometry mapping a frame-normalised box to view pixels (7 tests). Documented,
NOT yet proven on hardware: assumes `Frame.orientation === 'up'`, the common case for this
portrait-locked app — see the file's own doc comment for what to check first if the on-device
overlay looks rotated.

### 4. `src/hooks/useAthleteDetection.ts` + `src/screens/TrackingOverlay.tsx` — ⚠️ needs verification
Wired against the real v5 API (checked against `node_modules/**/*.d.ts`, not memory): `useResizer`
(scaleMode `'stretch'`, 300×300 uint8 RGB), `useTensorflowModel` with the `core-ml` delegate,
`model.runSync()` inside the `useFrameOutput` worklet, counting/state updates done on the JS
thread via `runOnJS` (never inside the worklet itself) — same pattern already proven in
`.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx`. `tsc --noEmit` passes. **Cannot
be verified further without the real device** — no simulator can exercise a real camera feed or
CoreML delegate.

### 5. Added `expo-dev-client` — ✅ installs clean
`npx expo install expo-dev-client` → `expo-dev-client@~57.0.11`, no ERESOLVE. Purpose: after the
one CI build below, further UI-only iteration can happen via `expo start --dev-client` and a
Wi-Fi reload instead of a ~20-minute CI round-trip per change.

### 6. CI build + artifact — ✅ verified
Run `31641145475` (commit `b039ba3`) succeeded on the first attempt. Downloaded and inspected via
`.claude/skills/build-unsigned-ipa/scripts/verify_artifact.py`: 14.1 MB `.ipa`, valid
`Payload/athletecamerarobot.app/`, 12.2 MB executable, parseable `Info.plist`. Grew from the prior
11.1 MB build, consistent with `expo-dev-client`'s native code plus the 4.18 MB bundled model.

### What this does NOT prove — stated plainly
- **No on-device inference has run.** Model loading, the CoreML delegate, and `model.runSync()`
  timing are all unverified — this needs `.claude/skills/cv-framerate-test/` on the real iPhone.
- **The overlay's coordinate mapping is unverified.** If the box appears offset or rotated from
  the actual person, check `src/hooks/useAthleteDetection.ts`'s orientation assumption first.
- **`PERSON_CLASS_ID = 0` and the tensor-order assumptions in `decodeDetections.ts`** are
  confirmed against the shipped `labelmap.txt` and TF's own docs, but never exercised against the
  model's *actual runtime output* — a real detection is the only thing that fully proves this.
- **The `CENTER_BUFFER` (0.08) constant** in `computeTrackingReadout.ts` is an unvalidated
  starting guess, same status as `defaultGimbalTuning`.

## 2026-08-13 — First on-device report + two real bugs found and fixed via webcam testing

**Environment:** Windows 11, developer's machine. The developer installed the 2026-08-12 build on
their iPhone via AltStore (using Apple Devices' Files feature to get the `.ipa` into AltStore's
storage, then AltStore's `+`) and reported it launched, but the tracking box was **"way too
big"** and **no distance/bearing numbers were visible**.

### 1. Diagnosis — could not be done on the device, reasoned from the API instead
No device logs were available. Re-read `node_modules/react-native-vision-camera`'s `Frame.nitro.d.ts`
and found the likely cause: `Frame.width`/`Frame.height` are **raw sensor buffer dimensions**,
not automatically rotated to the display's orientation. `src/hooks/useAthleteDetection.ts` had
been computing `frameAspectRatio` directly from these raw dimensions — if the real device reports
`Frame.orientation` as `'left'`/`'right'` (a 90° rotation), the aspect ratio fed into
`frameLayout.ts`'s `'cover'`-fit math would be wrong, and that math **amplifies** an aspect-ratio
error into a large scale/position error — a plausible full explanation for "way too big."
**Fix:** `publishFrameSize` now swaps width/height when `frame.orientation` is `'left'`/`'right'`
before computing the ratio. **Not verified on the device** — this is a reasoned fix, not a proven
one; see the residual-risk comment left in the file (box *coordinates*, not just the aspect
ratio, may also need rotating — unverifiable without the device).

### 2. Built `.claude/skills/webcam-detection-preview/` — ✅ verified, new capability
A Python script running the exact bundled `assets/models/person-detection.tflite` (via
`ai-edge-litert`, installed clean with `pip install ai-edge-litert`) against the laptop's own
webcam, with a faithful port of `decodeDetections.ts` / `selectPrimaryAthlete.ts` /
`computeTrackingReadout.ts` / `TrackingOverlay.tsx`'s drawing logic. Confirmed the model's real
input/output tensor shapes directly (`interpreter.get_input_details()` /
`get_output_details()`) — matches `research/computer-vision/person-detection-model-asset.md`
exactly: input `[1,300,300,3]` uint8, four `[1,10,…]` float32 outputs.

### 3. Real-person testing — ✅ ~20 frames captured and visually inspected
Captured bursts of webcam frames with a live person (two different people, at different points)
across: face-on, side profile (head turned), close-up, low light, near/at frame edges, and in
motion (including motion blur). In every case a person was in frame, the model found them. Found
two real bugs this way, both fixed:

- **Confidence badge invisible under the status panel.** `TrackingOverlay.tsx` drew the box
  (+ badge) BEFORE the panel — later-drawn siblings paint on top in RN, so the panel could hide
  the badge whenever they overlapped (visually confirmed in the Python harness: `6?%` rendering
  faintly through the panel's semi-transparent background). **Fix:** swapped the draw order
  (panel first, box+badge last) in both `TrackingOverlay.tsx` and the Python harness.
- **Badge position not clamped to the screen.** The badge was positioned relative to the box's
  raw top-left corner, which can be off-screen (negative) when the subject is close to the
  camera or near a frame edge. **Fix:** extracted `clampBadgePosition()` into
  `src/screens/frameLayout.ts` (6 new unit tests), used by `TrackingOverlay.tsx`; ported the same
  clamp into the Python harness. Re-captured the exact scenario that exposed it (person very
  close, box extending past two edges at once) — badge stayed on-screen after the fix.
- Also removed the numeric readout panel's dependency on the hook's `status` field — it now shows
  whenever a `readout` exists, regardless of `status`, removing a plausible (if unconfirmed)
  explanation for "no numbers visible" (a `status`/`boxes` state desync, e.g. across a dev-client
  Fast Refresh).

### 4. Tests + typecheck — ✅ verified
`npm test` → **65/65 passing** (up from 59 — 6 new `clampBadgePosition` tests).
`npm run typecheck` → zero errors.

### What this does NOT prove
- **The orientation fix (§1) is unverified on the device.** It's a reasoned fix from reading the
  API, not something the webcam harness can exercise (a laptop webcam has no comparable
  orientation-metadata rotation). The next phone install is the actual test.
- **Nothing about `react-native-vision-camera-resizer`'s GPU resize, the CoreML delegate, or the
  worklet/JS-thread boundary was touched by this testing** — see
  `.claude/skills/webcam-detection-preview/SKILL.md`'s "What this does NOT prove".
- **Detection range/quality at robot-relevant distances** (several meters, outdoors) is still
  untested — the webcam captures were all indoors, within a few feet.

## 2026-08-13 (later) — Structured live testing: distance, motion, multi-person; thresholds validated

**Environment:** Windows 11, developer's machine, laptop webcam. Two people present for the
multi-person round. Extends `.claude/skills/webcam-detection-preview/` with a `--session` mode
(timed run, per-frame CSV log, periodic snapshots, optional live on-screen window with a big red
phase-name banner) so a structured multi-scenario test could run with the developer watching in
real time, without needing another CI+sideload round.

### 1. Distance — ✅ characterized (laptop webcam only, see caveat)
Four stages, ~1.5–2m through an extreme-far hallway shot:

| Stage | Detection rate | Mean confidence |
|---|---|---|
| Baseline (~1.5-2m) | 100% (293/293 frames) | 0.78 |
| Mid (~3-4m) | 100% (442/442) | 0.74 |
| Far (~5-8m) | 95% (420/442) | 0.63 |
| Extreme far (~15-20m+) | 57% (252/442) | 0.61 (among successful detections) |

Detection is reliable through ~8m and degrades to intermittent beyond that — a real, useful data
point for `docs/PRD.md` §7's open "is detection range adequate" question. **Caveat, stated
explicitly so it isn't overclaimed:** this is a laptop webcam's optics/resolution, not the iPhone
16's — it bounds the model's general distance sensitivity but does not substitute for an actual
phone field test. **Developer feedback:** confidence at 5-8m (~51-63% observed) is lower than
expected (~85-90%) — logged as a future model-quality improvement (larger model / higher input
resolution), not a threshold-tuning issue; not acted on now.

### 2. Motion + angle — ✅ verified
25 seconds of continuous walking, turning (side/back profile), and toward/away movement: **100%
detection rate (743/743 frames)**, confidence 0.54-0.82 depending on angle/motion blur, box
placement and offset/bearing math stayed correct throughout (spot-checked against several
snapshots). No dropped tracking during motion.

### 3. Multi-person primary-athlete selection — ✅ verified, with an honest caveat
Two static arrangements (20s each): person A closer, then person B closer. In both, the
largest-box-wins heuristic correctly locked onto the closer/larger person — confirmed visually in
both. **Caveat, corrected after an initial overclaim:** these were two *separate static*
arrangements, not one continuous session where both people actively moved and swapped who was
closer — the offset/bearing log looking smooth (no erratic jumps) is real but is not a rapid-
switching stress test. `selectPrimaryAthlete.ts`'s own documented known weakness (rapid flicker
between similarly-sized athletes) remains untested under actual dynamic switching.

### 4. Threshold calibration — ✅ evidence-based conclusion: no change warranted
Aggregated across all 5 real (non-empty) sessions: **3,652 total frames, 3,333 with a locked
athlete, confidence range 0.50-0.83, mean 0.72. Zero false positives** (the two smoke-test
sessions with nobody in frame correctly logged 0 detections throughout). Every real detection
landed comfortably above `decodeDetections.ts`'s 0.5 score floor and `selectPrimaryAthlete.ts`'s
0.4 confidence gate — no evidence either threshold is cutting off good detections or letting
noise through. **Decision: left `MIN_CONFIDENCE` (0.4), the 0.5 score threshold, and
`CENTER_BUFFER` (0.08) unchanged.** `CENTER_BUFFER` specifically cannot be meaningfully calibrated
from a static human test — it needs an actual corrective gimbal loop to mean anything — so it
stays flagged as an unvalidated starting guess, same as before this session.

### 5. Tests + typecheck — ✅ verified
No production code changed this round (session-mode additions are test-tooling only, in
`.claude/skills/webcam-detection-preview/`). `npm test` → 65/65, `npm run typecheck` → zero errors,
unchanged from the prior entry.

### What this does NOT prove
- Nothing new on the iOS-specific gap already flagged (frame orientation, GPU resizer, CoreML
  delegate, worklet boundary) — still needs the phone.
- Rapid primary-athlete switching under live dynamic movement (see §3's caveat).
- Outdoor/direct-sunlight detection quality — all testing was indoors.

## 2026-08-13 (evening) — Front/back camera, dashed line, recording added; root cause still open

**Environment:** Windows 11, developer's machine. Developer installed the Phone Test #1 build and
reported the "box too big / no numbers" issue, then reported their own hypothesis: the app was
using the **front** camera, whose frame is mirrored.

**⚠️ Correction, caught while writing up this entry:** that hypothesis does not fully square with
the code that was actually running. The Phone Test #1 build's `useCameraSetup.ts` called
`useCameraDevice('back')` unconditionally — there was no front/back selection in the app at all
before this round's changes, so the installed build could not have been *using* the front camera
in the sense of an app-level choice. What's genuinely still true and useful regardless: mirroring
handling was entirely missing, and building it properly (§2 below) is correct and needed once a
front/back toggle exists either way. But it should **not** be treated as a confirmed explanation
for the original oversized-box report — the still-unverified frame-orientation/coordinate-rotation
gap (flagged repeatedly in `src/hooks/useAthleteDetection.ts` and `src/screens/frameLayout.ts`)
remains at least as likely a cause, possibly the only one. **The next phone test needs to check
the box on the BACK camera specifically**, since that's what was actually being used when the
original bug was reported. No further phone install happened this round regardless, per the
developer's explicit request to batch changes and test almost everything on the laptop.

### 1. Front/back camera toggle — ⚠️ needs verification (code + typecheck only)
`useCameraSetup.ts` now holds a `facing` state (`'front'`|`'back'`, default `'back'`) and a
`toggleFacing()` callback, exposed on **every** status branch (not just `'ready'`) so a device
lacking a front camera can never strand the user with no way back. New `CameraControls.tsx`
button in the top-right. Cannot be exercised by the webcam harness (a laptop has no back camera
to switch to) — untested until the device.

### 2. Front-camera mirroring — ✅ verified as far as possible without the device
`react-native-vision-camera`'s `Frame.isMirrored` is threaded through
`useAthleteDetection.ts` into `decodeDetections.ts`'s new `isMirrored` option, which flips each
box's `x` (`1 - x - width`) before it's ever stored — every downstream consumer sees already-
correct coordinates regardless of which camera produced them. 4 new unit tests. Verified via a
new `--mirror` flag on `.claude/skills/webcam-detection-preview/`: flips the frame before
inference (simulating a front camera's raw buffer), decodes with `isMirrored=True`, and draws the
result on the *original* frame. A/B capture of the same scene with and without `--mirror` landed
the box at the same true position (offset 24-26%, bearing 180-184°, difference within normal
frame-to-frame variance) — the mirror simulation and the un-mirror fix cancel out correctly.

### 3. Dashed center-line + vector readout — ✅ verified
New `computeLineStyle()` in `frameLayout.ts` (4 tests, including a rotation-reproduces-both-
endpoints geometric proof) computes the position/length/rotation for a `View` with
`borderStyle: 'dashed'` spanning from the box's center to the screen's center — RN's default
center-origin rotation, not `transformOrigin`, which isn't reliably supported everywhere. Ported
to the Python harness with a manual dash-segment loop (`cv2` has no native dashed line) and
confirmed visually: the dashed line renders correctly and points the right direction relative to
the reported up/down/left/right values. The readout panel also gained a compact decomposed
vector line (`"down 4%   right 7%"`) alongside the existing combined `offset`/`bearing` stats —
percentage of frame, not real-world units (no depth sensor to calibrate against), confirmed as
the right call with the developer directly.

### 4. Video recording — ⚠️ needs verification (code + typecheck only, cannot be laptop-tested at all)
New `useVideoRecording.ts`, written against the real v5 API (`useVideoOutput` + `Recorder`,
checked directly in `node_modules`, not memory). No audio (avoids a microphone permission this
round); saves to a temp file, not the Photos library (avoids a new native dependency +
permission this round) — both deliberately deferred so this stays a single, self-contained
change. `<Camera outputs={[frameOutput, videoOutput]}>` — the recorded file is the camera's raw
feed, a separate native pipeline from the RN view tree, so `TrackingOverlay`'s box/readout is
never in the saved video even though it stays visible live. New record/stop button in
`CameraControls.tsx`. **This is the one piece of this round that fundamentally cannot be tested
off-device** — no laptop equivalent of a native video encoder + Recorder session exists.

### 5. Tests + typecheck — ✅ verified
`npm test` → **73/73 passing** (up from 65 — 4 new `isMirrored` tests, 4 new `computeLineStyle`
tests). `npm run typecheck` → zero errors.

### What this does NOT prove
- **The original "box too big" report's actual root cause is still open** — see the correction
  above. Mirroring is now handled correctly regardless, but that's not confirmed to be what
  caused the first report.
- Front/back switching and recording — see §1 and §4, both need the real device.
- The frame-coordinate-rotation gap for a 90°-rotated frame, flagged since 2026-08-13 (later),
  remains unverified — mirroring and orientation are separate concerns and this round only fixed
  the mirroring one with laptop-verifiable confidence.
- A CI build (run `31747664570`, triggered by this round's push) was in progress as this entry
  was written — see `.github/workflows/index.md` for the outcome once known. Still no phone
  install of any of this round's changes.

---

## 2026-08-13 (night) — Mirroring driven by CameraDevice.position, not Frame.isMirrored

**Environment:** Windows 11, developer's machine. New, more precise developer report: the
Phone Test #1 build was confirmed to be using the **back** camera (settling the open question
from the previous entry), and the box appeared at the horizontally-mirrored position relative to
the actual person — not merely oversized. `Frame.isMirrored` should never report `true` for a
back camera per VisionCamera's own docs, so continuing to key mirror-correction off that flag
was the wrong foundation regardless of whether it happened to test "correct" in isolation.

### Fix — ⚠️ needs verification (deterministic by construction, but the real payoff is on-device)
`useAthleteDetection.ts` now takes `cameraPosition: CameraPosition` as a parameter instead of
reading `frame.isMirrored` inside the worklet. `src/App.tsx` computes it as
`setup.status === 'ready' ? setup.device.position : setup.facing` — the actual resolved
`CameraDevice.position` (ground truth) once known, falling back to the requested `facing` before
that (doesn't matter either way; no frames flow until ready). `isMirrored = cameraPosition ===
'front'` is now a single deterministic line, fully within the app's own control, with no
dependency on a native per-frame flag whose real device behavior was never actually observed.
`decodeDetections.ts`'s `isMirrored` option and its 4 existing tests are unchanged — only the
*source* of the boolean changed, not the decode math itself.

**Why this counts as "cleaner and more accurate" (the developer's own framing) rather than just
another guess:** `CameraDevice.position` is not a heuristic — it's the literal identity of the
camera object the app itself resolved via `useCameraDevice(facing)`. There's no scenario where
the app doesn't know which camera it asked for and got. This removes an entire class of
uncertainty (whatever `Frame.isMirrored`'s real value was doing) rather than trading one guess
for another.

### Tests + typecheck — ✅ verified
`npm test` → 73/73 unchanged (no pure-logic changes, only the caller). `npm run typecheck` →
zero errors. CI run triggered by this commit's push — see `.github/workflows/index.md`.

### What this does NOT prove
- Whether this actually fixes the reported mirrored-box symptom on the real back camera — that's
  exactly what the next phone install needs to check first, before anything else in this batch.
- Nothing about the still-open frame-coordinate-rotation gap for a 90°-rotated frame — a
  *different* concern from mirroring, and still unaddressed.

## Open items for the next contributor

*(Updated 2026-08-13 evening. Ordered — each unblocks the next. Per the developer's explicit
request, phone testing is being batched — at most one more install before the truly final one —
so this list front-loads everything laptop-testable first.)*

1. **Keep using `.claude/skills/webcam-detection-preview/` for any further decode/overlay
   iteration** (now including `--mirror` for front-camera testing) — it catches most bugs in
   under a second per frame, no build required.
2. **When ready for the next phone install** (Phone Test #2 of the developer's 2-total budget,
   not necessarily the final one): rebuild via CI (`.claude/skills/build-unsigned-ipa/`), then
   AltStore install (`docs/YOUR_STEPS.md` — Apple Devices → Files → AltStore → Add File, then
   AltStore → My Apps → `+`). Check, in order: (a) box no longer oversized, numbers visible
   (should already be fixed); (b) front/back toggle actually switches cameras; (c) front-camera
   tracking is correctly un-mirrored; (d) the dashed line + vector readout render as designed;
   (e) recording actually produces a playable file.
3. **If the box is still wrong on back camera specifically**, it's the *coordinate rotation* gap
   flagged in `src/hooks/useAthleteDetection.ts` and `src/screens/frameLayout.ts` (aspect ratio is
   fixed, box (x,y) rotation for a 90°-rotated frame is not) — log `frame.orientation` to confirm.
4. **Run `.claude/skills/cv-framerate-test/`** once the box/readout look right, to confirm timing
   and that the CoreML delegate actually engages.
5. Once installed once, **use `expo start --dev-client`** for UI-only iteration instead of a new
   CI build per change.
6. **Log whatever happens in `testing/REAL_HARDWARE_TEST_LOG.md`** — that file currently has
   **zero** entries. Only a human can write to it (`CLAUDE.md` §5.2).
7. **Buy the PCA9685** (PRD §8) before `servo-bounds-test` or any gimbal work can run.
8. Everything in `docs/PRD.md` marked FUTURE/STRETCH is still not started — do not
   begin it without the user explicitly asking, per `CLAUDE.md` §4 and §7.

**Standing reminder (superseded by the 2026-08-14 entry below):** as of 2026-08-13 evening, one
on-device report exists (box too big, no numbers — root-caused by the developer as front-camera
mirroring). That's fixed and laptop-verified as far as possible; front/back switching, correct
on-device un-mirroring, and recording are all implemented but **not yet confirmed on the
device.** Treat every `⚠️` tag accordingly.

## 2026-08-14 (night) — Phone Test #2 fixes, BLE transport, gimbal control loop, micro:bit firmware

### Phone Test #2 result (reported by the developer)
Two findings from the build recorded in `.github/workflows/index.md`'s `31750739831` entry:
1. **Front camera:** tracking worked correctly.
2. **Back camera:** the box was wrong "as if it was wrong side + wrong top/down" — both axes at
   once, not just mirrored. This is the exact signature of a missing 180° (or ±90°) rotation
   correction, not a mirroring problem — mirroring only ever flips one axis (x).
3. **Recording:** the recording itself worked, but nothing appeared in the Photos app — expected,
   since that build only ever wrote to a temp file (documented as deliberately deferred in
   `useVideoRecording.ts`'s prior doc comment).

### Fix 1 — back-camera box rotation — ✅ verified (logic), ⚠️ unverified (on-device)
`src/tracking/decodeDetections.ts` gained an `orientation` option and an `orientBox` function that
rotates a raw-buffer-space box into upright space for all four `CameraOrientation` values
(`'up'/'right'/'down'/'left'`), derived directly from
`node_modules/react-native-vision-camera/lib/specs/instances/Frame.nitro.d.ts`'s and
`.../common-types/CameraOrientation.d.ts`'s documented semantics (`CLAUDE.md` §4.1) — not
guessed. Applied BEFORE the existing `isMirrored` step (rotation is a buffer-geometry fact,
mirroring is a separate camera-facing fact). `src/hooks/useAthleteDetection.ts` now passes
`frame.orientation` through `runOnJS(publishDetections)` every frame.

**Tests:** 7 new cases in `decodeDetections.test.ts` — identity, 180°, ±90° (with the expected
width/height swap), that 'right'/'left' land an asymmetric corner-hugging test box on visibly
different corners, that rotation composes correctly with mirroring (order matters, tested
explicitly), and a post-rotation-degenerate-box guard. `npm test` → all passing (103/103
repo-wide after this whole night's additions). `npm run typecheck` → zero errors.

**What this does NOT prove:** whether it actually fixes the reported back-camera symptom — that
requires the next phone install, same as always for anything Frame/VisionCamera-specific.

### Fix 2 — recordings now save to Photos — ⚠️ unverified (on-device, cannot be otherwise)
Added `expo-media-library` (`~57.0.3`) and an `expo.plugins` entry in `app.json` with custom
permission strings. `useVideoRecording.ts` now calls `requestPermissionsAsync(true)` (write-only)
then `Asset.create(filePath)` after a recording finishes, exposed as a new `saveStatus`/
`saveError` separate from the recording's own `status` — a failed Photos copy never looks like a
lost recording, since `lastRecordingPath` still points at the valid temp file either way.

**Scar avoided, not hit (`CLAUDE.md` §4.1):** every tutorial for this package describes
`MediaLibrary.saveToLibraryAsync(uri)`. Checked `node_modules/expo-media-library/build/*.d.ts`
directly before writing any code: in the installed version (the package's "Next" API rewrite),
that function is only re-exported for backwards compatibility from `legacyWarnings.d.ts`, and
every export there is explicitly documented `@deprecated ... This method will throw in runtime.`
The real, current call is the static `Asset.create(filePath)`. Using the tutorial-documented call
would have typechecked cleanly and then thrown at runtime on the very first recording — exactly
the failure mode this section of `CLAUDE.md` exists to prevent, caught here before it ever ran.

**UI:** `CameraControls.tsx`'s status line now shows `SAVING TO PHOTOS…` / `SAVED TO PHOTOS` /
`SAVE TO PHOTOS FAILED` once recording itself returns to idle, so the next phone test has direct
visual confirmation instead of having to check the Photos app blind.

### BLE transport + control loop + micro:bit firmware — all new, zero hardware contact
`src/ble/` (transport), `src/hooks/useGimbalControl.ts` (control loop: `selectPrimaryAthlete` →
`computeGimbalCorrection` → rate-limited ~15Hz BLE send), `src/screens/BleStatusBadge.tsx` (UI),
and `.claude/skills/gimbal-control-firmware/` (the micro:bit-side production program) were all
written this session. Full design rationale is in each file's own doc comment and
`docs/ROBOT_INTEGRATION_PLAN.md` — not duplicated here to avoid the two documents drifting out of
sync. Headline facts for this log specifically:

- `src/ble/encodeGimbalPacket.ts` and `src/ble/base64.ts` are pure and fully unit-tested (8 + 15
  tests) — base64 output is cross-checked against Node's own `Buffer` as ground truth.
- `src/ble/useBleConnection.ts` is written directly against
  `node_modules/react-native-ble-plx/src/index.d.ts` (every method/type/enum confirmed there, not
  from the pre-existing research doc alone) but **has no unit test** — it's almost entirely native
  BLE side effects, and per `CLAUDE.md` §5.2 no agent may claim a hardware behavior works without
  a human running it. `typecheck` passing is the only automated evidence that exists for this file.
- **Real correction made while writing the encoder, not new research:** the BLE packet format was
  previously specified (`research/hardware/microbit-ble-link.md`) as unsigned absolute angles
  (0–1800 = 0.0–180.0°). That's inconsistent with `computeGimbalCorrection.ts` (already ✅
  verified, written after that research note), which deliberately outputs signed **deltas**. Fixed
  to two big-endian signed int16 deltas (tenths of a degree) in the research file, `docs/PRD.md`
  §7, and `src/ble/index.md` — all three updated together, not just the code.
- `.claude/skills/gimbal-control-firmware/scripts/microbit_gimbal_control.py` reuses the exact
  PCA9685 register-writing approach already used (and documented as correct) in
  `servo-bounds-test/scripts/microbit_servo_sweep.py`, to avoid the centiseconds-vs-milliseconds
  unit trap `research/hardware/pca9685-servo-control.md` documents for extension-based PCA9685
  libraries. Ships with a placeholder ±30° safe range — loudly marked in both the script and its
  `SKILL.md` as needing `servo-bounds-test`'s real measurement before trusting it unattended.

### CI build — ✅ verified
Run `31762839976` (commit range `7688563`..`0bbb2d4` — camera fixes, BLE/control-loop, plan doc):
success in 9m51s, auto-triggered by the push. Downloaded and inspected locally: valid zip,
`Payload/athletecamerarobot.app/athletecamerarobot` (12.2MB executable) and a parseable
`Info.plist` present. Artifact grew to 14.3MB (from 14.1MB) — consistent with `expo-media-library`
now actually being used and `react-native-ble-plx` now actually being imported (both were config
plugins already present in `app.json`, but this is the first commit that imports either package
from `src/`). **This is the build for the next phone test.**

### PRD/BOM status — ✅ verified (as a documentation change; the underlying fact is user-reported, not agent-observed)
`docs/PRD.md` §2.2/§8 updated: the user directly confirmed the PCA9685 is now acquired and wired,
moved off the "Needed" list. The dedicated battery/power bank remains explicitly flagged as
**unconfirmed** — not assumed resolved just because other hardware is ready. See
`docs/ROBOT_INTEGRATION_PLAN.md`'s prerequisites checklist, which exists specifically so this
doesn't get missed before the first powered servo test.

### What this whole entry does NOT prove
- Whether either camera fix actually resolves the reported symptoms on the real device.
- Whether Photos saving actually works on-device (permission prompt, real disk I/O, real
  `expo-media-library` native module — none of this can be exercised off-device).
- **Anything at all about BLE/servo/firmware working in reality.** Every claim in the BLE section
  above is "matches the real library's types and this project's own prior research," never
  "observed working." `testing/REAL_HARDWARE_TEST_LOG.md` still has zero fully-human-run entries.

## Open items for the next contributor

*(Replaces the 2026-08-13 evening list above — that list's items 1-2, 4-6 are superseded by this
one; item 7 (buy the PCA9685) is done.)*

1. **Next phone test** (install run `31762839976`'s artifact, per `docs/YOUR_STEPS.md`): check,
   in order — (a) back camera box now correctly positioned; (b) front camera still correct; (c) a
   recording actually appears in the Photos app; (d) `BleStatusBadge` shows `BLE: OFF` or
   `BLE: SCANNING…` sensibly even with no micro:bit powered on nearby (i.e. it doesn't crash).
2. **Then follow `docs/ROBOT_INTEGRATION_PLAN.md` in order**: `ble-ping` → `servo-bounds-test`
   (replace the firmware's placeholder safe-range constants with the real measurement) →
   `gimbal-control-firmware` manual sanity check → full field test with the phone mounted.
3. **Confirm the battery/power bank for the robot electronics** before any powered servo test —
   flagged unconfirmed in `docs/PRD.md` §8, not resolved by tonight's PCA9685 confirmation.
4. Keep using `.claude/skills/webcam-detection-preview/` for any further camera/overlay
   iteration — still the fastest loop for anything not BLE/VisionCamera-specific.
5. **Log whatever happens in `testing/REAL_HARDWARE_TEST_LOG.md` and `testing/field-tests/`** —
   only a human can write real hardware results there (`CLAUDE.md` §5.2).
6. Everything in `docs/PRD.md` marked FUTURE/STRETCH is still not started — do not begin it
   without the user explicitly asking, per `CLAUDE.md` §4 and §7.

**Standing reminder:** as of 2026-08-14 night, two on-device reports exist. Both this round's
fixes (back-camera rotation, Photos saving) are implemented and laptop/typecheck-verified as far
as possible but **not yet confirmed on the device.** The entire BLE/robot side (transport,
control loop, firmware) is new tonight and has had **zero contact with real hardware** — treat
every claim about it as a design/implementation claim, not a working-system claim, until
`docs/ROBOT_INTEGRATION_PLAN.md` has actually been run.

## 2026-08-14 (later) — BLE auto-reconnect, PCA9685/power wiring research, CI run 31847260683

Added auto-reconnect to `src/ble/useBleConnection.ts`: an unexpected connection drop now
schedules a rescan every 3s instead of staying dead until the app is relaunched — real BLE links
are expected to drop transiently during filming, so `'connection-lost'` needed to be recoverable,
not terminal. `npm run typecheck` → zero errors, `npm test` → 103/103 unchanged (this hook has no
unit tests, same as before — see `src/ble/index.md` for why).

Documented the user's real hardware in `research/hardware/pca9685-servo-control.md`: PCA9685
channel assignment cross-checked against the firmware's `CHANNEL_ROLL`/`CHANNEL_PITCH` constants,
and exact wiring guidance for powering it from a standard USB power bank (Bextoo 27,000mAh) —
needs a USB breakout/cut-cable to reach the screw terminals, 5V is in-spec for hobby servos,
current adequacy for Phase 1 is plausible but explicitly deferred to `servo-bounds-test` (not
resolvable by research, per `power-brownout-risk.md`'s own standing rule). `docs/PRD.md` §8
updated to reflect the power source is identified.

CI run `31847260683`: success in 8m51s, artifact downloaded and inspected (valid zip,
`Payload/*.app`, parseable `Info.plist`). No native surface changed (pure JS control-flow change),
so this is a low-risk confirmation, not a new area of build risk.

**Still zero real BLE hardware contact** — none of this has been observed working on the actual
micro:bit. The user separately reported connecting the micro:bit to their laptop via USB (for
flashing) with no motors connected (safety-correct posture) — that's the human's own action,
logged here for context, not something this agent ran or verified (`CLAUDE.md` §5.2).

## 2026-08-15 (later) — Real-hardware BLE breakthrough, then a real app-side failure, then a fix for diagnosability

Major update to the entries above: the agent ran real hardware tests this session (at the user's
explicit, repeated, in-session request — see the transparent provenance note in
`testing/REAL_HARDWARE_TEST_LOG.md`'s 2026-08-15 entry, and `.claude/skills/index.md`'s note on
why this is a narrow exception, not a rule change). Headline result: **BLE actually works now** —
a real 20/20-ping bench round trip, after finding and fixing three real bugs (standard
MicroPython has no working Bluetooth UART at all; MakeCode needs an explicit no-pairing config;
MakeCode's RX/TX characteristic UUIDs are reversed from the "standard" description). Full detail
in `research/hardware/microbit-ble-link.md` and `src/ble/index.md` — not repeated here.

**Then a real, human-reported failure**: the user installed the build with these fixes
(`31898819543`) and reported "BLE error" on launch. Root cause is **still unknown** — the app's
own error UI at the time only showed a static "BLE: ERROR" label with no detail, which was
itself the immediate blocker to diagnosing anything further.

**Fix shipped, not yet verified**: `src/ble/useBleConnection.ts` gained a manual `retry()`
(tears down and restarts the whole scan/connect cycle, callable from any state) and
`BleStatusBadge.tsx` is now tappable (calls `retry`) and displays `state.error.message` — real
diagnostic text from `react-native-ble-plx`/Core Bluetooth, not a description this app invents.
`npm run typecheck` → zero errors, `npm test` → 103/103 unchanged (no pure-logic changes). CI run
`31901198781`: success in 11m40s, artifact downloaded and inspected (valid zip, `Payload/*.app`,
parseable `Info.plist`).

**What this does NOT prove**: whether the underlying BLE connection failure is actually fixed —
it isn't, by design; this round only makes the *next* failure (if any) diagnosable instead of a
dead end. The real root cause is still open until the next phone report comes back either
`'connected'` or with a real error message to act on.

## 2026-08-15/16 — Full BLE sandbox, a real reconnect bug found via it, and a fix for the actual retry race

Using the retry-fix build (`31901198781`), the user reported the badge showed `'connected'`
after a disconnect/reconnect cycle while nothing was actually working — a real, human-reported
failure of the retry mechanism itself. Root-caused by re-reading `retry()`'s own logic: it bumped
the effect's retry-generation counter to force a full teardown/restart, but a React cleanup
function can't be awaited — the old device's `cancelDeviceConnection` was fired-and-forgotten,
so a new `connectToDevice` for the same peripheral could start before the old connection had
actually finished tearing down at the native level.

**Fixed**: `retry()` now explicitly awaits `cancelDeviceConnection` on the previously-connected
device before bumping the generation counter, guaranteeing the next connection attempt starts
from a clean slate. The same underlying failure mode (claiming "connected" when it wasn't) was
independently found and fixed in the Python sandbox's `BleSender` — it only inferred disconnects
from write exceptions, so a silent drop between writes went unnoticed; now polls
`client.is_connected` every loop iteration and auto-reconnects on a real drop.

Also built, in the same session: `.claude/skills/webcam-detection-preview/scripts/detect_preview.py --live --send-ble`
— ports `computeGimbalCorrection.ts`/`encodeGimbalPacket.ts` to Python (hand-verified against
known inputs: centred → (0,0), an off-centre athlete → a correctly-clamped delta, encode/decode
round-trip, NaN/Infinity → 0) and runs a real `bleak` BLE connection on a background thread,
matching `useBleConnection.ts`'s exact scan/connect logic. Used this to isolate the earlier "BLE
error" report: a standalone scan→connect→discover→write sequence mirroring the app succeeded
cleanly from Windows (found in 0.25s, connected in 1.88s, wrote successfully), which is strong
(not conclusive) evidence the robot/firmware/protocol are sound and the app's failures are
specific to `react-native-ble-plx`'s iOS behaviour.

Also independently verified, at the user's request: the BLE communication genuinely travels over
the Bluetooth radio, not the USB cable used for power — confirmed by receiving 72 separate native
Bluetooth LE radio advertisements from the micro:bit's own address over 10 seconds via
`Windows.Devices.Bluetooth.Advertisement` (an API with no USB/serial code path at all), while the
USB drive remained separately mounted the whole time.

`npm run typecheck` → zero errors, `npm test` → 103/103 unchanged. CI run `31913485020`: success
in 9m11s, artifact downloaded and inspected (valid zip, `Payload/*.app`, parseable `Info.plist`).

**What this does NOT prove**: whether the retry-race fix actually resolves the reconnect problem
on the real phone — untested there as of this entry. The sandbox's own reliability (proven on
Windows/bleak) also says nothing about `react-native-ble-plx`'s iOS-specific behaviour, which
remains the leading suspect for whatever the phone is still doing wrong.

## 2026-08-16 — Real report: USB power bank auto-shuts-off powering the micro:bit alone

Human-reported: the power bank stops delivering current to the micro:bit after a few seconds.
Root-caused via research, not guessed: confirmed against the *official* micro:bit hardware docs
(`tech.microbit.org/hardware/powersupply/`), which explicitly name this exact failure mode (power
banks auto-shutoff below ~50-100mA draw; a bare micro:bit idles at ~30mA) and confirm the
micro:bit's native JST-PH battery connector has no such shutoff logic. Full writeup in
`research/hardware/power-bank-auto-shutoff.md`, including options for the servo/PCA9685 rail if
the same issue recurs there (untested).

A firmware-side fix (deliberately drawing more current via the LED matrix) was considered and
retracted after checking real numbers: the micro:bit's own docs cap all on-board peripherals at
~30mA even fully lit, which is below the shutoff threshold — and the LED simulator's own display
activity already partially tests this without success, consistent with that number.

No fix has been applied yet — the user wants to try a zero-cost, zero-cable-cutting option (using
the owned ELEGOO Arduino Uno as a power relay) on 2026-08-17, once they can check for jumper
wires and edge-connector access. A one-time scheduled reminder was created for that check
(`trig_01QxHH6TVcvbZoXSEg7JRKdq`). Not a blocker for current CV/BLE work — the user is not
connecting servos/motors yet, and a plain USB wall charger has no auto-shutoff issue at all for
continued bench testing in the meantime.

## 2026-08-16 — Real report: the shipped back-camera box-rotation fix did NOT work; root cause found and fixed

Human-reported, explicit and unambiguous: "This did not work for sure" — the fix recorded in the
2026-08-14 entry above (added an `orientation` option and `orientBox()` rotation math to
`src/tracking/decodeDetections.ts`) was installed and re-tested on the real phone, and the back
camera's box was still wrong.

Root-caused this time from an unambiguous source rather than re-deriving the rotation math from
scratch again (the same approach that produced the first, broken fix). `CameraOrientation`'s own
doc comment describes `'right'`/`'left'` as "+90°"/"-90°" relative to upright, but doesn't say
which physical direction "+" means, and that ambiguity is exactly the trap: read instead from
`node_modules/react-native-vision-camera/ios/Extensions/Converters/CG+CameraOrientation.swift`'s
`toCGOrientation()`, which maps `CameraOrientation.right` -> `CGImagePropertyOrientation.right`
and `.left` -> `.left`; cross-checked against
`.../ios/Extensions/UIImageOrientation+exif.swift`, which maps those directly to the formal EXIF
orientation tag values 6 and 8. EXIF tag semantics are a fixed international spec (which row/
column of the raw buffer becomes which edge of the correctly-oriented image) — not open to
CW/CCW interpretation. Working through that spec for tags 6 and 8 by hand shows the box-rotation
formulas previously shipped under `case 'right'` and `case 'left'` in `orientBox()` were swapped
with each other: the body that should run for `'right'` was running for `'left'`, and vice versa.
A left/right swap produces a box wrong on both axes at once — exactly the reported symptom, both
times — and explains why the front camera was unaffected: it apparently reports `'up'`/`'down'`
(identity and 180°, both direction-symmetric), so the swap never had a chance to show up there.

**Fixed**: `orientBox()`'s `'right'` and `'left'` case bodies swapped to match the EXIF-tag-
derived math (documented inline in the function's own doc comment, with the full derivation, so
the next person doesn't have to re-derive it under pressure either). `decodeDetections.test.ts`'s
`'right'`/`'left'` expected values swapped to match. `npm run typecheck` → zero errors, `npm test`
→ 103/103 passing (same 7 suites, same counts — this only changed which numbers two existing
tests expect, not what's tested).

**What this does NOT prove**: whether this is actually correct on the real phone — untested there
as of this entry. The previous fix also passed its own tests and still failed on hardware, so
test-suite passing is evidence the *internal logic* is self-consistent with the EXIF-derived
model, not proof the model itself matches real iOS back-camera behaviour. This needs a real
on-device back-camera test before it can be marked more than `⚠️ needs verification`.

## 2026-08-16 — Real report: BLE stuck at 'connecting' forever on phone; multi-athlete lock "seems all random"; occlusion detection weak

Human-reported, three items in one message:

1. Back-camera rotation "seems better" (informal, not a full confirmation) after the swap fix
   above.
2. **BLE**: works from the Windows sandbox, but from the real phone the app is always stuck at
   `'connecting'` — never reaches `'connected'` or surfaces an error. Explicitly asked for a
   multi-subagent diagnosis + research push before attempting a fix. Diagnosis dispatched — see
   the follow-up entry once findings land; not yet root-caused as of this entry.
3. Detection accuracy drops under partial occlusion (legs cut off, only part of the body
   visible). Requested research into improving this. Not yet actioned as of this entry —
   dispatched alongside the BLE diagnosis.
4. Multi-athlete selection "seems all random" — explicitly asked for a strategy that holds onto
   one athlete rather than flipping, with "follow whoever's always been followed" as the
   suggested approach (also floated, as a separate idea: "follow the person with the ball").

**Fixed (item 4), same session**: `src/tracking/selectPrimaryAthlete.ts`'s `selectPrimaryAthlete`
now takes an optional `previousLock`. If given, it looks for a continuation of that lock among
the current frame's boxes (IoU primary signal, center-distance as a fallback for boxes shrunk by
occlusion — see the function's own doc comment for the exact thresholds and reasoning) and keeps
following it even when another box is now larger; the largest-area heuristic is now only used to
acquire or re-acquire a lock, not to re-decide it from scratch every single frame. A NEW hook,
`src/hooks/useLockedAthlete.ts`, owns the actual state (the previous lock, and a `LOCK_MEMORY_MS`
= 1000ms grace window that keeps offering a stale lock position for re-matching through a brief
total-occlusion gap) and is now the single call site for `selectPrimaryAthlete` —
`TrackingOverlay.tsx` and `useGimbalControl.ts` previously each called `selectPrimaryAthlete`
independently on the same frame's `boxes`, which is a second, structural reason selection could
look random: the overlay and the actual BLE command could disagree about who was locked. Both
now consume `useLockedAthlete`'s single output via `App.tsx`. 7 new tests in
`selectPrimaryAthlete.test.ts` (continuity beats a larger box, IoU match on movement,
center-distance match on an occlusion-shrunk box, fallback to fresh acquisition, fallback to
`no-athletes`, low-confidence candidates still rejected, `previousLock`-omitted callers
unchanged). `npm run typecheck` → zero errors, `npm test` → 110/110.

**"Follow the person with the ball"**: NOT built. Confirmed the bundled model is full COCO (only
filtered to `PERSON_CLASS_ID` in `decodeDetections.ts` today) so a "sports ball" class is
technically available without swapping models, but reliable ball detection at filming distance
with this small quantized model, and the box-to-person association logic, are both unresearched
— scoped as a separate follow-up in `docs/PRD.md` §7 rather than half-built here.

**What this does NOT prove**: whether continuity-locking actually reads as "stable" to a human
watching real multi-athlete footage — untested on a phone as of this entry. Also does not address
occlusion's ROOT cause (the model producing a smaller/lower-confidence/missing box in the first
place) — only makes the selection layer more resilient to whatever imperfect boxes the model
does produce. The detection-accuracy research (item 3) is the other half of this.

## 2026-08-16 (later) — BLE connect-timeout fix, ByteTrack-style occlusion tolerance, both from a 4-agent parallel research push

Following the items 2 and 3 above, dispatched 4 parallel `researcher` subagents (explicitly
requested: "deploy all the subagents possible to diagnosis, then research with all the agents"):
two independently investigating the BLE stuck-at-`'connecting'` bug from different angles
(CoreBluetooth pairing/bonding theory; and a direct audit of `react-native-ble-plx`'s real iOS
connect API in `node_modules`, since the actual native connection logic turned out to live in an
external CocoaPod, `MultiPlatformBleAdapter`, not in the npm package itself), and one on
occlusion-robust detection. Before dispatching, personally ruled out one hypothesis directly:
downloaded CI run `31962301870`'s real built `.ipa`, extracted and parsed the actual `Info.plist`
with `plistlib`, and confirmed `NSBluetoothAlwaysUsageDescription` and `UIBackgroundModes:
['bluetooth-central']` are both correctly present — so this was never a missing-permission-string
bug, and the agents were briefed not to re-check it.

**BLE fix, applied**: all three BLE-focused findings converged. `src/ble/useBleConnection.ts`
called `manager.connectToDevice(device.id)` with no second argument; per
`research/hardware/react-native-ble-plx-ios-connect-api.md` (which fetched
`MultiPlatformBleAdapter`'s real Swift source directly, since it's not present in this repo's
`node_modules`), iOS's CoreBluetooth has no OS-level connect timeout of its own (unlike Android),
and the library only arms one when a JS `timeout` option is supplied — with none, a stalled
native attempt has nothing that will ever force the JS promise to resolve or reject, matching the
reported symptom exactly. Fixed: `connectToDevice(device.id, { timeout: CONNECT_TIMEOUT_MS })`,
`CONNECT_TIMEOUT_MS = 15000`. This makes a stall surface as the existing, already-built `'error'`
state (with its existing manual retry button) instead of hanging silently forever — but it does
NOT explain the underlying trigger. The leading hypothesis for that (medium confidence, from
`research/hardware/ios-ble-pairing-mismatch.md` and `research/hardware/ios-ble-connect-hang.md`):
a stale iOS Bluetooth bond left over from this exact micro:bit's earlier MicroPython-firmware
life — the board's hardware Bluetooth address doesn't change across reflashes, and the firmware's
`pairing_mode: 0` can only prevent a NEW bond, not erase an old cached one; iOS gives apps no API
to clear this. **If the timeout fix alone doesn't reach `'connected'` on the next phone test, try
iOS Settings > Bluetooth > find the micro:bit entry > "Forget This Device" > relaunch the app >
retry, before assuming the timeout fix failed.** `npm run typecheck` → zero errors.

**Occlusion fix, applied (partial)**: per `research/computer-vision/occlusion-robustness.md`,
implemented the ByteTrack (Zhang et al., ECCV 2022) two-stage confidence pattern —
`selectPrimaryAthlete.ts`'s continuity match (`findContinuedLock`) now accepts a lower confidence
floor, `CONTINUITY_MIN_CONFIDENCE = 0.25`, than fresh acquisition's `MIN_CONFIDENCE = 0.4`. A
real athlete's box dipping in confidence under partial occlusion no longer loses the lock, as
long as it's still spatially where the lock already is — gated by the existing IoU/center-distance
check, not by confidence alone, which keeps this narrow rather than a blanket "trust more noise"
change. 2 new tests (a 0.3-confidence box accepted as a continuity match; the same box rejected
for fresh acquisition, confirming the lower floor doesn't leak into that path). `npm run
typecheck` → zero errors, `npm test` → 112/112.

**Occlusion fix, NOT applied — flagged as the higher-leverage next step**: switching
`useAthleteDetection.ts`'s resizer `scaleMode` from `'stretch'` to `'contain'`. The research
(reading the resizer's own `.d.ts` directly) confirmed `'stretch'` squashes/stretches each axis
independently to fill the model's square 300×300 input — which further distorts the
already-atypical aspect ratio of a partially-visible/truncated body, on top of SSD-MobileNet-V1's
architecturally-known weakness on small/partial objects. `'contain'` (letterboxing) would remove
that compounding distortion. Deliberately NOT implemented in this pass: it requires new
letterbox-offset math in the exact box-coordinate pipeline that has already shipped two broken
coordinate bugs this project (front-camera mirroring, then back-camera rotation) — this needs its
own careful derivation and dedicated test pass, not to be bundled in under the same time pressure
as everything else in this entry. A model swap to EfficientDet-Lite0 (25.69% vs ~21% COCO mAP per
TF's own Pixel-4 benchmark table, similar latency class) is a further, bigger, unimplemented
option if the above two aren't enough — explicitly do NOT swap to plain SSD-MobileNetV2, TF's own
numbers show it scoring *lower* mAP than V1 at this input size.

**What none of this proves**: whether the BLE timeout fix actually gets the phone to `'connected'`
— untested on real hardware as of this entry, and the "stale bond" hypothesis, if correct, means
the timeout fix alone might not be sufficient without the user also doing the iOS
"Forget This Device" step. Whether the occlusion confidence-floor change measurably helps on real
occluded footage is also untested — it's a precedented, low-risk mechanism, not a proven result.

## 2026-08-16 (later still) — BLE confirmed working; new box regression on BOTH cameras; webcam test isolates it to iOS-only code; diagnostic overlay shipped instead of a third guess

**BLE**: real human confirmation — "the forget thing worked!!!!". The developer used iOS
Settings > Bluetooth > "Forget This Device" on the micro:bit, relaunched the app, and it reached
`'connected'`. Confirms both the `CONNECT_TIMEOUT_MS` code fix and the stale-bond root-cause
hypothesis; logged in `testing/REAL_HARDWARE_TEST_LOG.md`, confidence upgraded to high in
`research/hardware/ios-ble-pairing-mismatch.md`. Separately clarified for the user (and worth
recording): attempting to connect to a custom, unencrypted BLE peripheral directly via iOS
Settings is not expected to work at all regardless of app-side correctness — Settings' pairing
UI is built around bondable/encrypted accessories, and confirmed via web research
(`punchthrough.com`'s CoreBluetooth guide, an Ezurio support FAQ) that "BLE-only devices are
hidden unless a dedicated app is used for pairing" and iOS won't pair at all unless a
characteristic specifically requests encryption — which this firmware deliberately doesn't. A
Settings-initiated connect failing there is not evidence of anything being broken.

**New regression, real report**: with the back-camera rotation re-fix and continuity-lock both
shipped, the developer reported the box now wrong on the FRONT camera too (previously correct),
and the BACK camera detecting nothing at all (a new, different symptom from "wrong box" —
genuinely zero detections). Rather than re-derive the rotation math a third time (the first two
rounds each looked correct on paper and were still wrong on-device), asked the user directly and
they agreed: ship on-screen diagnostics first.

**Isolated via `.claude/skills/webcam-detection-preview/`**: ran a live session and two captures
(normal + `--mirror`) with the developer physically in frame. Both showed the box tightly and
correctly wrapping the person — confirms the shared decode/mirror/continuity-selection logic is
NOT the cause of either symptom. This structurally narrows the search: the webcam has no
rotation concept at all (`Frame.orientation`/`orientBox()` never runs in the Python port), so
this result specifically rules out everything EXCEPT the iOS/VisionCamera-only code path — which
is exactly the code that's been wrong twice. Also updated `detect_preview.py`'s
`select_primary_athlete` port to match today's continuity-lock addition (it was stale, missing
`previous_lock` entirely), threading `previous_lock` through the `--session`/`--live` loops — the
"keep in sync" rule this skill documents for itself.

**A second, real, code-review-found bug fixed** (not the rotation math — a different, concrete
defect): `useAthleteDetection.ts`'s `hasSetAspectRatio` latched `true` permanently on the very
first processed frame and never reset. Since this hook is never remounted by the front/back
toggle (`src/App.tsx` calls it once, unconditionally), switching cameras mid-session kept using
the FIRST camera's aspect ratio for both — silently wrong for whichever camera was switched to.
Fixed: both `frameAspectRatio` and the new diagnostic `rawOrientation` now reset via a
`useEffect` keyed on `cameraPosition`. This is a plausible PARTIAL explanation for the front
regression if the developer toggled cameras mid-session, but not a full explanation on its own
(doesn't explain back camera's zero-detections symptom) — not claimed as "the fix," just a real
defect found and closed.

**Diagnostic overlay shipped instead of a third blind fix**: new `src/screens/DebugReadout.tsx`
(explicitly marked TEMPORARY, delete-after-use), wired through `useAthleteDetection.ts`'s new
`rawOrientation` field, `CameraPreviewScreen.tsx`, and `App.tsx`. Shows camera position, raw
`Frame.orientation`, mirror flag, live detection count, and `frameAspectRatio` on-screen. The
next phone report will contain the actual numbers `orientBox`'s math depends on, instead of
another inference.

`npm run typecheck` → zero errors, `npm test` → 112/112 (unchanged — this round touched no
tracking logic, only wiring + a new presentational component).

**What this does NOT prove**: the actual root cause of either camera's regression — that's
exactly what's still unknown and why the diagnostic build exists. The webcam result is real
evidence about WHERE the bug isn't, not a fix.

## 2026-08-17 — Real diagnostic data received; a genuine aspect-ratio bug found and fixed from it; started a live phone-screen inspection tool

**Real data, human-reported from the `DebugReadout` build**: back camera → `orient=left
mirrored=N boxes=0 ar=0.56`; front camera → `orient=right mirrored=Y boxes=1 ar=1.78`. First real
numbers this project has had for `Frame.orientation` on either camera.

**Aspect ratio bug found and fixed, directly from this data (not another guess)**: `ar=0.56`
(back) is correct — that's a portrait 9:16 ratio, matching a portrait-locked screen. `ar=1.78`
(front) is wrong — that's LANDSCAPE 16:9, fed into a portrait viewport's `'cover'`-fit math in
`frameLayout.ts`, which would produce exactly the reported symptom (huge, badly-scaled,
mispositioned boxes). Both numbers came from the same code path
(`useAthleteDetection.ts`'s `publishFrameSize`, `isRotated ? height/width : width/height`,
`isRotated` = `orientation === 'left' | 'right'`) — and 0.56 and 1.78 are reciprocals of each
other, meaning the front and back camera sensors' raw buffers relate to "portrait" OPPOSITELY,
so one fixed swap rule (based on left/right) can't be correct for both. Fixed by removing the
inference entirely: since `app.json` locks `"orientation": "portrait"`, the displayed shape is
ALWAYS portrait by construction — `frameAspectRatio` is now always
`min(width, height) / max(width, height)`, which is correct regardless of how a given camera's
raw buffer relates to `Frame.orientation`. `npm run typecheck` → zero errors, `npm test` →
112/112 (this fix touches no tracking-folder logic).

**What this does NOT fix**: the box's own (x, y) rotation math (`orientBox`, in
`decodeDetections.ts`) is completely unchanged by this — it's a separate code path from the
aspect-ratio computation. Back camera's `boxes=0` (zero detections, not just misplaced ones) is
still unexplained; a live hypothesis is that `orientBox`'s `'left'` case is still producing
degenerate (inverted min/max) coordinates for real detections on this specific device, which
`decodeDetections`' `width > 0 && height > 0` guard would silently drop, presenting as "no
detections" even if the model found someone. Not confirmed.

**New tool, still being set up**: installed `pymobiledevice3` (pure-Python, cross-platform
libimobiledevice reimplementation — works on Windows without a Mac) to enable direct screenshot
capture from the developer's iPhone over the existing USB cable, at the developer's own
suggestion ("I give you access to my phone camera and maybe you can see it live?"). Confirmed
`usbmux list` sees the device over USB; `developer dvt screenshot` requires the phone unlocked
(returned "Device is password protected" while locked) — not yet captured a working screenshot
as of this entry, in progress.
