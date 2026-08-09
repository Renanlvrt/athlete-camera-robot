# Common failure patterns — `build-ios-unsigned.yml`

Referenced by `SKILL.md` step 4. **Honesty note (2026-08-09):** the workflow has now run
twice (`gh run` IDs `31288776388`, `31289641191`, `31290028103`) and **succeeded on every
attempt** — see `docs/VERIFICATION_REPORT.md`, "CI workflow ran green, first attempt, twice".
Nothing below has actually been hit yet. These are the *predicted* failure modes, sourced from
the workflow file's own inline comments and `.github/workflows/index.md`, kept here so the
first real failure is diagnosed in one read instead of a guess-and-retry loop. Update this file
with the *real* pattern the moment a build actually fails — do not let a predicted-but-unseen
entry masquerade as a confirmed one.

## 1. Xcode scheme detection fails or picks the wrong scheme
**Symptom:** the "List available Xcode schemes" step succeeds but prints nothing, or the
"Archive" step's Python one-liner (`json.load(sys.stdin)['workspace']['schemes'][0]`) throws a
`KeyError`/`IndexError`.
**Why it's the #1 predicted risk:** the scheme name cannot be determined locally — Windows
refuses `expo prebuild --platform ios` even with `--no-install` (verified,
`research/phone-integration/expo-cng-constraints.md`) — so this was always a guess until CI
ran it for real. It didn't fail in either real run; `expo prebuild` emitted a single workspace
with one scheme (`athletecamerarobot`) both times.
**Fix if it ever does fail:** read the "List available Xcode schemes" step's raw output in the
Actions log — it prints all schemes unconditionally before the JSON-parsing step runs. Update
the index `[0]` in the archive step if a multi-scheme project ever appears (unlikely for a
single-target Expo app, but proj structure could change if new native targets are added).

## 2. `npm ci` fails
**Symptom:** fails in the "Install dependencies" step, before Xcode is ever invoked. Easy to
misread as an Xcode/build problem because it's early in a long log.
**Actual cause, always:** `package-lock.json` wasn't committed alongside a `package.json`
change — `npm ci` refuses to reconcile a mismatched lockfile (by design, unlike `npm install`).
**Fix:** `npm install` locally (or wherever the dependency was added), commit the regenerated
`package-lock.json` in the same commit as the `package.json` change, push, retrigger. This is
the day agent's file territory (`package.json`/`package-lock.json`) — the night agent cannot
fix this directly; log it in `docs/NIGHT_DECISIONS.md` and wait rather than editing those files.

## 3. `expo prebuild` fails on a config plugin
**Symptom:** `PluginError` or `Cannot find module '.../app.plugin.js'` during the "Expo
prebuild" step.
**Already happened once, locally, before this skill existed:** VisionCamera v5 ships no config
plugin at all; an earlier `app.json` had a stale `plugins` entry for it (see
`docs/VERIFICATION_REPORT.md`, 2026-08-09 "Phase 0" entry, and `CLAUDE.md` §4.1). Fixed by
removing the entry. Both `react-native-fast-tflite` and `react-native-ble-plx` were confirmed
(§4.1-style, by checking `node_modules/` directly) to ship a real `app.plugin.js` before being
added to `app.json`, which is exactly why this class of error didn't recur in the real CI runs.
**Fix if a *new* native dependency causes this:** check whether the package actually ships an
`app.plugin.js` in its own `node_modules/` folder before assuming a `plugins` entry is needed —
don't trust a tutorial's word for which major version it was written against (`CLAUDE.md` §4.1).

## 4. Signing identity leaks into the archive/export step
**Symptom:** `xcodebuild archive` or a later export step demands a provisioning
profile/signing identity and fails without one.
**Why this must never be "fixed" by adding a signing identity:** the entire point of this
pipeline (`docs/PRD.md` §3.2) is that CI compiles unsigned and AltStore signs locally with a
free Apple ID. Introducing a certificate/profile into CI would reintroduce the paid-account
requirement this whole design exists to avoid.
**Fix:** confirm the five `CODE_SIGN*`/`CODE_SIGNING*` flags are still present on the
`xcodebuild archive` invocation exactly as written, and that the "Package unsigned .ipa" step
still assembles the `.ipa` by hand (`zip`) rather than via `xcodebuild -exportArchive` (which
always wants a signing identity, unsigned or not).

## What actually mattered in the real runs
Not a "failure," but worth recording since it contradicted the pre-run risk assessment: the
five newly-installed CV/BLE native packages (`react-native-worklets`,
`react-native-vision-camera-worklets`, `react-native-vision-camera-resizer`,
`react-native-fast-tflite`, `react-native-ble-plx`) added ~2m20s to the build (5m19s pre-deps
vs. 7m39s with them linked) and zero new failure modes. The `node_modules/`-first verification
habit from `CLAUDE.md` §4.1, applied before these packages were ever added to `app.json`, is
almost certainly why — the failure class in #3 above was pre-empted rather than hit.
