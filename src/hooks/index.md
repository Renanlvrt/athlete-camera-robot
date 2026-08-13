# src/hooks/ — index

React hooks that own state and side effects. **No JSX/rendering lives
here** — that's `src/screens/`. Every hook exports exactly one thing and
does exactly one job (see `CLAUDE.md` §3).

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `useCameraSetup.ts` | file | Requests camera permission and resolves the back camera device; exposes one discriminated-union status (`requesting-permission` \| `no-device-found` \| `ready`). Does not render anything. | ✅ verified — `tsc --noEmit` passes; behavior matches `docs/PRD.md` §3.1 Milestone 1 scope |
| `useAthleteDetection.ts` | file | Loads the bundled TFLite model, resizes each camera frame, runs inference, and exposes the current frame's `PersonBox[]`, the `CameraFrameOutput` to pass to `<Camera>`, and an orientation-corrected `frameAspectRatio`. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes and the model/decode logic is validated against real webcam frames (`.claude/skills/webcam-detection-preview/`), but the hook itself (frame output, GPU resizer, CoreML delegate) has never run on a device. First on-device report (oversized/mispositioned box) led to a fix here: the aspect ratio fed to `frameLayout.ts` now accounts for `Frame.orientation`, not just raw buffer width/height — see the file's own doc comment for what's still NOT covered (box coordinate rotation). |

## Depends on
`react`, `react-native-vision-camera` (`useCameraDevice`, `useCameraPermission`,
`useFrameOutput`, `CameraDevice`/`CameraFrameOutput` types), `react-native-worklets` (`runOnJS`),
`react-native-vision-camera-resizer` (`useResizer`), `react-native-fast-tflite`
(`useTensorflowModel`), `../tracking/decodeDetections.ts`, `assets/models/person-detection.tflite`.

## Depended on by
`src/App.tsx` calls both hooks unconditionally and passes their combined output as props into
`src/screens/CameraPreviewScreen.tsx`.

## Rule for growing this folder
One hook per concern. When BLE pairing/control is implemented, it gets its
own `useBleConnection.ts` (or its own `src/ble/hooks/` if it grows past a
couple of files) — do not add unrelated state to `useCameraSetup.ts` or
`useAthleteDetection.ts`.
