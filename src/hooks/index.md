# src/hooks/ — index

React hooks that own state and side effects. **No JSX/rendering lives
here** — that's `src/screens/`. Every hook exports exactly one thing and
does exactly one job (see `CLAUDE.md` §3).

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `useCameraSetup.ts` | file | Requests camera permission and resolves the device for the currently-selected `facing` (`'front'`\|`'back'`, toggleable); exposes one discriminated-union status (`requesting-permission` \| `no-device-found` \| `ready`) plus `facing`/`toggleFacing`, always available regardless of status. Does not render anything. | ⚠️ needs verification — front/back toggle added 2026-08-13, `tsc --noEmit` passes, but switching cameras has never run on a device |
| `useAthleteDetection.ts` | file | Loads the bundled TFLite model, resizes each camera frame, runs inference, and exposes the current frame's `PersonBox[]`, the `CameraFrameOutput` to pass to `<Camera>`, and an orientation-corrected `frameAspectRatio`. Takes `cameraPosition` (the resolved `CameraDevice.position`) as a parameter to drive mirror-correction, and passes `frame.orientation` through every frame to drive box rotation. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes and the model/decode logic is validated against real webcam frames (`.claude/skills/webcam-detection-preview/`, including a `--mirror` flag simulating the front camera), but the hook itself (frame output, GPU resizer, CoreML delegate) has never run on a device. Fixed from three on-device reports: mirror-correction is driven by the resolved `CameraDevice.position` (deterministic, app-controlled), **not** `Frame.isMirrored`; the aspect ratio fed to `frameLayout.ts` accounts for `Frame.orientation`; and (2026-08-14) the box's own (x, y) is now fully rotated for `Frame.orientation`, not just its aspect ratio — see `src/tracking/decodeDetections.ts`'s `orientBox`, added after a real back-camera report showed the box wrong on both axes at once. |
| `useVideoRecording.ts` | file | Owns `useVideoOutput` + `Recorder` (no audio) — exposes `videoOutput` to pass to `<Camera>`, recording `status`, start/stop callbacks, and (2026-08-14) copies the finished recording into the Photos library via `expo-media-library`, exposing that as a separate `saveStatus`/`saveError` so a failed Photos copy never looks like a lost recording (`lastRecordingPath` still points at the temp file either way). | ⚠️ needs verification — written against the real v5/`expo-media-library` 57.0.3 API (checked in `node_modules`, not a tutorial — the tutorial-documented `saveToLibraryAsync` throws at runtime in this version, see the file's own doc comment), `tsc --noEmit` passes, but recording+saving is exactly the kind of feature the webcam harness cannot exercise at all — untested until it runs on the real device. A real report (2026-08-14) confirmed recording worked but nothing reached Photos, which is what this change fixes. |
| `useLockedAthlete.ts` | file | Owns the "which athlete is locked" state (2026-08-16, new) — calls `selectPrimaryAthlete(boxes, previousLock)` with the last frame's lock so continuity-matching in `src/tracking/selectPrimaryAthlete.ts` can keep following the same athlete instead of re-picking "largest box" from scratch every frame, plus a short (`LOCK_MEMORY_MS` = 1000ms) grace period that keeps offering the last-known position for re-matching through a brief occlusion/detection gap. The ONE call site for `selectPrimaryAthlete` — `TrackingOverlay.tsx` and `useGimbalControl.ts` both now consume its output instead of each calling `selectPrimaryAthlete` independently (which could disagree). Does not render anything. | ⚠️ needs verification — `tsc --noEmit`/`npm test` pass (the matching logic it calls is unit-tested in `src/tracking/selectPrimaryAthlete.test.ts`), but this hook's own `Date.now()`-driven memory/grace-period glue has no dedicated test and has never run on a device, same category of gap as `useGimbalControl.ts` below. |
| `useGimbalControl.ts` | file | The control loop: takes the already-locked `primary` (from `useLockedAthlete.ts`, not raw `boxes` — changed 2026-08-16) → `computeGimbalCorrection` → rate-limited (~15Hz) `useBleConnection().send()`. Exposes `bleState` and `retryBle` (added 2026-08-15) for `src/screens/BleStatusBadge.tsx`. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes; the pure decision it applies is already unit-tested in `src/tracking/`, but the rate-limiting/composition itself has no dedicated test. **Real device run 2026-08-15 reached BLE `'error'`; a later report (2026-08-16) shows it stuck at `'connecting'` forever** — under active diagnosis, see `src/ble/index.md`. |

## Depends on
`react`, `react-native-vision-camera` (`useCameraDevice`, `useCameraPermission`,
`useFrameOutput`, `useVideoOutput`, `CommonResolutions`, `CameraDevice`/`CameraFrameOutput`/
`CameraVideoOutput`/`Recorder` types), `react-native-worklets` (`runOnJS`),
`react-native-vision-camera-resizer` (`useResizer`), `react-native-fast-tflite`
(`useTensorflowModel`), `expo-media-library` (`Asset`, `requestPermissionsAsync`),
`../tracking/` (`decodeDetections.ts`, `selectPrimaryAthlete.ts`, `computeGimbalCorrection.ts`,
`types.ts`), `../ble/useBleConnection.ts`, `assets/models/person-detection.tflite`.

## Depended on by
`src/App.tsx` calls all five hooks unconditionally and passes their combined output as props
into `src/screens/CameraPreviewScreen.tsx`. `useLockedAthlete.ts`'s output feeds BOTH
`useGimbalControl.ts` (as `primary`) and, via `App.tsx`, `TrackingOverlay.tsx` — the one shared
decision, per its own doc comment.

## Rule for growing this folder
One hook per concern. BLE's own connection lifecycle lives in `src/ble/useBleConnection.ts`, not
here — `useGimbalControl.ts` only composes it with `src/tracking/`'s pure decisions.
`selectPrimaryAthlete` is called from exactly one place, `useLockedAthlete.ts` — do not add a
second call site elsewhere; consume its output instead, the way `useGimbalControl.ts` and
`TrackingOverlay.tsx` do. Do not add unrelated state to `useCameraSetup.ts`,
`useAthleteDetection.ts`, `useVideoRecording.ts`, `useLockedAthlete.ts`, or `useGimbalControl.ts`.
