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
| `useGimbalControl.ts` | file | New 2026-08-14. The control loop: `boxes` → `selectPrimaryAthlete` → `computeGimbalCorrection` → rate-limited (~15Hz) `useBleConnection().send()`. Exposes `bleState` for `src/screens/BleStatusBadge.tsx`. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes; the pure decisions it composes are already unit-tested in `src/tracking/`, but the rate-limiting/composition itself has no dedicated test (timing-driven, not meaningfully unit-testable) and has never run against a real BLE link. |

## Depends on
`react`, `react-native-vision-camera` (`useCameraDevice`, `useCameraPermission`,
`useFrameOutput`, `useVideoOutput`, `CommonResolutions`, `CameraDevice`/`CameraFrameOutput`/
`CameraVideoOutput`/`Recorder` types), `react-native-worklets` (`runOnJS`),
`react-native-vision-camera-resizer` (`useResizer`), `react-native-fast-tflite`
(`useTensorflowModel`), `expo-media-library` (`Asset`, `requestPermissionsAsync`),
`../tracking/` (`decodeDetections.ts`, `selectPrimaryAthlete.ts`, `computeGimbalCorrection.ts`,
`types.ts`), `../ble/useBleConnection.ts`, `assets/models/person-detection.tflite`.

## Depended on by
`src/App.tsx` calls all four hooks unconditionally and passes their combined output as props
into `src/screens/CameraPreviewScreen.tsx`.

## Rule for growing this folder
One hook per concern. BLE's own connection lifecycle lives in `src/ble/useBleConnection.ts`, not
here — `useGimbalControl.ts` only composes it with `src/tracking/`'s pure decisions. Do not add
unrelated state to `useCameraSetup.ts`, `useAthleteDetection.ts`, `useVideoRecording.ts`, or
`useGimbalControl.ts`.
