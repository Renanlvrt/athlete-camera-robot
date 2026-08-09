# Verification Report (append-only log)

Every entry records: what was checked, how (exact command or source), and
the result. This is the evidence that backs the ✅ / ⚠️ / ❌ tags in every
`index.md`. Do not mark something ✅ anywhere in this repo without an
entry here to back it up (`CLAUDE.md` §4).

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
1. Run the CI workflow for real; fix the Xcode scheme name if needed; update
   `.github/workflows/index.md` and this file.
2. Once an actual device build is installed on the iPhone 16, confirm the
   three `useCameraSetup` states are reachable and correct on-device; update
   `src/hooks/index.md` and `src/screens/index.md` accordingly.
3. Everything else in `docs/PRD.md` marked FUTURE/STRETCH is still not
   started — do not begin it without the user explicitly asking, per
   `CLAUDE.md` §4 and §6.
