# src/hooks/ — index

React hooks that own state and side effects. **No JSX/rendering lives
here** — that's `src/screens/`. Every hook exports exactly one thing and
does exactly one job (see `CLAUDE.md` §3).

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `useCameraSetup.ts` | file | Requests camera permission and resolves the back camera device; exposes one discriminated-union status (`requesting-permission` \| `no-device-found` \| `ready`). Does not render anything. | ✅ verified — `tsc --noEmit` passes; behavior matches `docs/PRD.md` §3.1 Milestone 1 scope |
| `useAthleteDetection.ts` | file | Loads the bundled TFLite model, resizes each camera frame, runs inference, and exposes the current frame's `PersonBox[]` plus the `CameraFrameOutput` to pass to `<Camera>`. Does not render anything. | ⚠️ needs verification — `tsc --noEmit` passes and the logic it calls into (`src/tracking/decodeDetections.ts`) is unit-tested, but the hook itself has never run on a device (needs the real frame-processor pipeline; see `docs/PRD.md` §4) |

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
