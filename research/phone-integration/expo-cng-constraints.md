# Expo CNG + Windows: what is actually forbidden

- **Researched:** 2026-08-09
- **Confidence:** **high — both findings verified by running the commands locally**, not inferred.
- **Expires:** Re-check on any Expo SDK major bump (currently `~57.0.9`) or if VisionCamera
  changes its Expo setup again.
- **Sources:**
  - Verified locally on this machine, 2026-08-09 (see `docs/VERIFICATION_REPORT.md`)
  - https://visioncamera.margelo.com/docs/guides/
  - https://docs.expo.dev/guides/adopting-prebuild/
  - https://docs.expo.dev/modules/additional-platform-support/

## Conclusion

Two hard limits, both confirmed by running them:

1. **Windows cannot generate the iOS native project at all** — not even with `--no-install`.
2. **VisionCamera v5 ships no Expo config plugin.** Listing it in `app.json`'s `plugins` array
   breaks `expo prebuild` outright.

## Detail

### Finding 1 — `expo prebuild --platform ios` does not work on Windows

Tried on this machine:

```
$ npx expo prebuild --platform ios --no-install
⚠️  Skipping generating the iOS native project files.
   Run npx expo prebuild again from macOS or Linux to generate the iOS project.
CommandError: At least one platform must be enabled when syncing
```

`--no-install` skips CocoaPods but does **not** rescue the situation — Expo refuses the iOS
generation step itself off macOS/Linux. Secondary sources that suggest `--no-install` produces a
usable `ios/` tree on Windows are wrong, at least for SDK 57.

**Consequence:** the Xcode scheme name cannot be read locally. It has to come from CI. The
workflow therefore (a) prints all schemes in a diagnostic step and (b) derives the scheme from
`xcodebuild -list -json` rather than hard-coding a guess. That turns the #1 predicted build
failure into a non-issue instead of a guess-and-retry loop at ~20 min per round.

**Consequence 2, more important:** you cannot compile *any* native iOS code locally. This is the
constraint that decides the CV stack — see `../computer-vision/person-detection-model-choice.md`.
Anything requiring hand-written Swift is effectively off the table.

### Finding 2 — VisionCamera v5 has no config plugin

`app.json` contained this, added during an earlier pass:

```json
"plugins": [["react-native-vision-camera", { "cameraPermissionText": "...", "enableMicrophonePermission": false }]]
```

Running prebuild produced:

```
PluginError: Cannot find module '.../react-native-vision-camera/lib/VisionCamera'
No "app.plugin.{js,cjs,mjs,ts,cts,mts}" file was found in "react-native-vision-camera",
so the package's main entry was loaded instead.
```

Confirmed by inspection — `node_modules/react-native-vision-camera@5.2.1/` contains no
`app.plugin.js`. Expo fell back to importing the library's runtime entry point as if it were a
plugin, which of course fails.

The official v5 docs say to configure permissions **directly**, with no plugin:

```json
{
  "ios":     { "infoPlist": { "NSCameraUsageDescription": "..." } },
  "android": { "permissions": ["android.permission.CAMERA"] }
}
```

**Fix applied:** removed the `plugins` array from `app.json`. The `ios.infoPlist` and
`android.permissions` entries were already present and are the correct v5 configuration.

### Why this one is worth remembering

The plugin entry was added deliberately, by an earlier pass, citing several tutorials and guides
that all agreed a `plugins` entry was required. They agreed because they were all written for
VisionCamera v3/v4, where it *was* required. The original `app.json` — before that "fix" — was
already correct for v5.

**The lesson to carry:** for fast-moving native libraries, secondary sources describe whichever
major version was current when they were written, and they rarely say which one. Confirm against
the library's own current docs, or better, against what's actually in `node_modules/`. This is
also exactly why `CLAUDE.md` §4.3 exists — and this instance is a case where following §4.3
against tutorials rather than primary docs still produced the wrong answer.
