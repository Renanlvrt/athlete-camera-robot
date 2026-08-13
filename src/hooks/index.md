# src/hooks/ — index

React hooks that own state and side effects. **No JSX/rendering lives
here** — that's `src/screens/`. Every hook exports exactly one thing and
does exactly one job (see `CLAUDE.md` §3).

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `useCameraSetup.ts` | file | Requests camera permission and resolves the device for the currently-selected `facing` (`'front'`\|`'back'`, toggleable); exposes one discriminated-union status (`requesting-permission` \| `no-device-found` \| `ready`) plus `facing`/`toggleFacing`, always available regardless of status. Does not render anything. | ⚠️ needs verification — front/back toggle added 2026-08-13, `tsc --noEmit` passes, but switching cameras has never run on a device |
| `useAthleteDetection.ts` | file | Loads the bundled TFLite model, resizes each camera frame, runs inference, and exposes the current frame's `PersonBox[]`, the `CameraFrameOutput` to pass to `<Camera>`, and an orientation-corrected `frameAspectRatio`. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes and the model/decode logic is validated against real webcam frames (`.claude/skills/webcam-detection-preview/`, including a `--mirror` flag simulating the front camera), but the hook itself (frame output, GPU resizer, CoreML delegate) has never run on a device. Two fixes from the first on-device report: the aspect ratio fed to `frameLayout.ts` now accounts for `Frame.orientation` (not just raw buffer width/height), and `Frame.isMirrored` is passed to `decodeDetections`' `isMirrored` option so front-camera boxes come out correctly un-mirrored. See the file's own doc comment for what's still NOT covered (box coordinate rotation for a 90°-rotated frame). |
| `useVideoRecording.ts` | file | Owns `useVideoOutput` + `Recorder` (no audio, saves to a temp file, not the Photos library yet) — exposes `videoOutput` to pass to `<Camera>`, recording `status`, and start/stop callbacks. Does not render anything. | ⚠️ needs verification — written against the real v5 API (checked in `node_modules`), `tsc --noEmit` passes, but recording is exactly the kind of feature the webcam harness cannot exercise at all — untested until it runs on the real device. |

## Depends on
`react`, `react-native-vision-camera` (`useCameraDevice`, `useCameraPermission`,
`useFrameOutput`, `useVideoOutput`, `CommonResolutions`, `CameraDevice`/`CameraFrameOutput`/
`CameraVideoOutput`/`Recorder` types), `react-native-worklets` (`runOnJS`),
`react-native-vision-camera-resizer` (`useResizer`), `react-native-fast-tflite`
(`useTensorflowModel`), `../tracking/decodeDetections.ts`, `assets/models/person-detection.tflite`.

## Depended on by
`src/App.tsx` calls all three hooks unconditionally and passes their combined output as props
into `src/screens/CameraPreviewScreen.tsx`.

## Rule for growing this folder
One hook per concern. When BLE pairing/control is implemented, it gets its
own `useBleConnection.ts` (or its own `src/ble/hooks/` if it grows past a
couple of files) — do not add unrelated state to `useCameraSetup.ts`,
`useAthleteDetection.ts`, or `useVideoRecording.ts`.
