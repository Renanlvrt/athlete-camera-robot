# .github/workflows/ — index

The CI workflow that compiles an unsigned iOS `.ipa` on a free GitHub-hosted macOS runner,
bypassing EAS Build's paid-account requirement. Full rationale: `docs/PRD.md` §3.2 and
`research/phone-integration/windows-to-iphone-pipeline.md`.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `build-ios-unsigned.yml` | file | `npm ci` → typecheck → `expo prebuild` → `xcodebuild archive` (unsigned) → zip → artifact | ✅ verified — ran successfully 21 times |

## Status: ✅ verified green, 21/21 runs, most recently 2026-08-17 (raw-vs-corrected box A/B diagnostic)

Triggered four times via `gh workflow run` / an automatic `push` trigger:
- Run `31288776388` (commit `1176a1e`, pre-CV/BLE-deps): success in 5m19s.
- Run `31289641191` (commit `3e379da`, all 5 CV/BLE native packages linked in): success in 7m39s.
- Run `31290028103` (same commit, dispatched to test `trigger_build.py` itself): success.
- Run `31641145475` (commit `b039ba3` — adds `expo-dev-client` + the bundled TFLite model asset):
  success. Artifact grew to 14.1 MB (from 11.1 MB), consistent with the new dev-client native
  code and the 4.18 MB model file now bundled.
- Run `31731682846` (commit `920674e` — Phone Test #1: orientation fix, badge z-order/clamping
  fix, structured webcam testing): success, artifact still 14.1 MB (no app-source changes this
  round, test tooling + docs only).
- Run `31747664570` (commit `28919e3` — front/back camera toggle, front-camera un-mirroring,
  dashed center-line + vector readout, video recording): success, auto-triggered by the push
  (this workflow's `on: push` trigger, not a deliberate `workflow_dispatch`). Artifact still
  14.1 MB. Confirms the new native usage (`useVideoOutput`/`Recorder`) at least compiles and
  archives cleanly — says nothing about whether recording actually works at runtime.
- Run `31750739831` (commit `0994313` — mirror-correction switched from `Frame.isMirrored` to
  the resolved `CameraDevice.position`): success in 8m0s, auto-triggered by the push. Artifact
  still 14.1 MB (no native surface changed, just which signal drives a JS-side boolean). This was
  the build installed for Phone Test #2 — see its result below.
- Run `31762839976` (commits `7688563`..`0bbb2d4` — back-camera box rotation fix, Photos-library
  recording via `expo-media-library`, the full BLE transport + gimbal control loop, and the
  micro:bit production firmware skill): success in 9m51s, auto-triggered by the push. Artifact
  grew to 14.3 MB (from 14.1 MB) — the first commit that actually *imports*
  `expo-media-library`/`react-native-ble-plx` from `src/`, not just lists them as config plugins.
  **This is the build to install for the next phone test** — see
  `docs/ROBOT_INTEGRATION_PLAN.md` for what to check.

**Phone Test #2 result** (reported by the developer, logged in full in
`docs/VERIFICATION_REPORT.md`'s 2026-08-14 entry): front camera tracking was correct; the back
camera's box was wrong on both axes at once (not just mirrored) — traced to a missing box
*rotation* step for `Frame.orientation` (only the aspect ratio was ever corrected, never the
box's own x/y), now fixed and included in run `31762839976` above. Recording itself worked but
nothing reached the Photos app, as expected for that build (temp-file-only) — also fixed in the
same run.

- Run `31847260683` (commit `7ea1252` — BLE auto-reconnect on unexpected drop, PCA9685/power-bank
  wiring research): success in 8m51s, auto-triggered by the push. Same 14.3 MB, no native surface
  change — this is a pure JS-side control-flow change to `useBleConnection.ts`.
- Run `31898819543` (commit `16b34c6` — hardware-confirmed BLE fixes: reversed RX/TX
  characteristic UUIDs, UUID-or-name device matching): success in 8m24s, auto-triggered.
- Run `31900338221` (commit `a7c6945` — `gimbal-led-simulator` skill added; no `src/` changes):
  success. Confirms adding non-`.md` files anywhere in the repo (even `.claude/skills/`) still
  triggers this workflow, not just `src/` changes.
- Run `31901198781` (commit `fda4d54` — BLE manual retry + real error-message display on
  `BleStatusBadge`): success in 11m40s, auto-triggered. Installed on the phone; reached
  `'connected'` after a retry, but a real report showed it stuck claiming `'connected'` after a
  disconnect/reconnect cycle while nothing actually worked.
- Run `31904696836` (commit `157c08b` — the `--live --send-ble` full-pipeline sandbox added to
  `webcam-detection-preview`; no `src/` changes): success in 8m31s, auto-triggered.
- Run `31913485020` ("first commit" — the actual fix for the stuck-`'connected'` report:
  `useBleConnection.ts`'s `retry()` now awaits the old device's `cancelDeviceConnection` before
  starting a new connection attempt, closing the race that caused it; the same class of bug was
  also fixed in the Python sandbox's `BleSender`, which now polls `client.is_connected` instead
  of inferring connection state from write success/failure): success in 9m11s, auto-triggered.
- Run `31976197144` (commit `e6bf477`, on top of `a0c5757` — real report: front camera box wrong
  again, back camera detecting nothing at all, right after the previous two fixes shipped.
  Isolated via the webcam harness (developer-confirmed "extremely accurate" on both normal and
  mirrored captures) to be iOS-only code, not the shared decode/selection logic. Fixed one real,
  separate bug found by code review — `useAthleteDetection.ts`'s aspect-ratio value used to latch
  on the FIRST camera used and never update after a front/back toggle. Shipped a temporary
  on-screen `DebugReadout` (camera position, raw `Frame.orientation`, mirror flag, detection
  count, aspect ratio) instead of re-deriving the rotation math a third time): success, auto-
  triggered. Same 14.3 MB. Downloaded and inspected directly: valid zip, Mach-O executable and
  `Info.plist` both present. Real diagnostic data came back from this build — see the next run.
- Run `31981477498` (commit `f511608` — using the real `DebugReadout` numbers (back:
  `orient=left ar=0.56`, front: `orient=right ar=1.78`), found the front/back aspect ratio was
  genuinely wrong: 0.56 and 1.78 are reciprocals, proving the front/back sensors relate to
  "portrait" oppositely, so one orientation-based width/height swap rule can't be right for both.
  Fixed by removing the inference: `app.json` locks portrait, so `frameAspectRatio` is now always
  `min(width,height)/max(width,height)` — correct by construction, not by trusting camera-specific
  `Frame.orientation` behavior): success, auto-triggered. Same 14.3 MB. Downloaded and inspected
  directly: valid zip, Mach-O executable and `Info.plist` both present. Real report came back:
  the aspect-ratio fix alone didn't fix it — see the next run.
- Run `31983560357` (commit `e5075d5` — real report after the aspect-ratio fix: horizontal
  real-world motion shows up as VERTICAL motion in both the on-screen box AND the gimbal
  correction sent to the micro:bit, proving the underlying `PersonBox` coordinates themselves are
  wrong, not just their rendering. Re-derived `orientBox`'s rotation math a second, independent
  way and got the same formula both times — ruling out an obvious arithmetic mistake and raising
  a new hypothesis (the pipeline may already deliver rotation-corrected coordinates upstream,
  making `orientBox` a double-rotation). Rather than guess a fourth formula, shipped
  `rawUncorrectedBoxes` — every detection decoded with NO rotation/mirror applied — and a dashed
  red comparison box in `TrackingOverlay.tsx` drawn alongside the normal one): success,
  auto-triggered. Same 14.3 MB. Downloaded and inspected directly: valid zip, Mach-O executable
  and `Info.plist` both present. **This is the build to install next** — walk left/right and
  report which box (solid yellow = corrected, dashed red = raw/uncorrected) actually tracks real
  motion correctly. See `docs/VERIFICATION_REPORT.md`'s 2026-08-17 (later) entry.
- Run `31962301870` (commit `13d020a` — back-camera box-rotation RE-fix: the 2026-08-14 fix's
  `orientBox()` had its `'left'`/`'right'` case formulas swapped with each other, confirmed
  broken on a real phone; re-derived from VisionCamera's iOS `CameraOrientation`->EXIF-tag
  mapping and corrected): success, auto-triggered by the push. Artifact still 14.3 MB (pure
  JS-side math change in `src/tracking/`, no native surface touched). User reported "seems
  better" 2026-08-16 (not a full confirmation).
- Run `31967884043` (commit `d7fb92e` — continuity-based multi-athlete lock, fixing a real report
  that multi-athlete selection "seems all random"): success in 9m23s, auto-triggered. Same 14.3
  MB, pure JS-side change (`src/tracking/selectPrimaryAthlete.ts` + new
  `src/hooks/useLockedAthlete.ts`).
- Run `31968575854` (commit `3e3ce0f` — BLE connect-timeout fix for the real "stuck at
  'connecting' forever" report, plus a ByteTrack-style occlusion-confidence fix for
  `selectPrimaryAthlete.ts`'s continuity match): success, auto-triggered by the push. Same 14.3
  MB. Downloaded and inspected directly: valid zip, `athletecamerarobot` Mach-O executable and
  `Info.plist` both present. **This is the build to install next** — it's cumulative, so it also
  carries the back-camera rotation and continuity-lock fixes above. See
  `docs/VERIFICATION_REPORT.md`'s 2026-08-16 (later) entry for the full BLE root-cause writeup —
  if the phone still doesn't reach `'connected'` after this build, try iOS Settings > Bluetooth >
  "Forget This Device" for the micro:bit before assuming the fix failed.

All twenty-one produced a real `unsigned-app-ipa` artifact, downloaded and inspected locally: a
valid zip, `Payload/athletecamerarobot.app/` present, `athletecamerarobot` Mach-O executable
present, `Info.plist` is a parseable Apple binary property list. **First attempt succeeded on
all twenty-one runs** — none of the "likely first failures" predicted below have occurred yet.
Full detail in `docs/VERIFICATION_REPORT.md`.

**Not verified by this**: whether the app actually launches/runs correctly on a physical
iPhone — that's `⚠️ needs verification`, human-only, tracked in
`testing/MORNING_TEST_PLAN.md`.

### Design decisions worth knowing before you debug it

- **`runs-on: macos-26` is pinned deliberately.** `macos-latest` migrated to macos-26 mid-2026;
  relying on the floating label means a GitHub-side image rollover can break the build with no
  change on our side, and the failure will look like a code problem.
- **The Xcode scheme is derived at runtime**, not hard-coded, via `xcodebuild -list -json`. The
  scheme name is the most likely failure point, and it **cannot be determined locally** —
  Windows refuses to run `expo prebuild --platform ios` even with `--no-install` (verified; see
  `research/phone-integration/expo-cng-constraints.md`). A diagnostic step prints all schemes so
  one CI round gives the answer rather than a guess-and-retry loop.
- **The `.ipa` is assembled with `zip`**, not `xcodebuild -exportArchive`. An `.ipa` is just a
  zip with the `.app` inside `Payload/`; the export step insists on a signing identity, which is
  exactly what this pipeline avoids.
- **Signing stays disabled here, always.** If a build fails, do not "fix" it by adding a signing
  identity — signing happens locally via AltStore with a free Apple ID. That separation is the
  whole point of the design.

### Likely first failures

1. Scheme name — the diagnostic step exists for this.
2. `npm ci` failing because `package-lock.json` wasn't committed alongside a dependency change.
   Reads like an Xcode problem; isn't one.
3. `expo prebuild` choking on a config plugin. One such bug (VisionCamera v5 shipping no
   `app.plugin.js`) was already found and fixed locally on 2026-08-09.

## Depends on
`package.json`, `package-lock.json`, `app.json`, `tsconfig.json`.

## Depended on by
`.claude/skills/build-unsigned-ipa/`, `README.md`.
