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

**Standing reminder:** as of 2026-08-13 evening, one on-device report exists (box too big, no
numbers — root-caused by the developer as front-camera mirroring). That's fixed and
laptop-verified as far as possible; front/back switching, correct on-device un-mirroring, and
recording are all implemented but **not yet confirmed on the device.** Treat every `⚠️` tag
accordingly.
