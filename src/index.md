# src/ — index

All application source code loaded by `index.ts`. Organized by
responsibility, not by feature-of-the-week: state/logic lives in `hooks/`,
rendering lives in `screens/`, shared style values live in `theme/`, and
`App.tsx` only wires them together.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `App.tsx` | file | Composition root — switches on `useCameraSetup()`'s status and renders exactly one screen, wiring in `useAthleteDetection()` and `useVideoRecording()` unconditionally. No business logic, no styling. | ✅ verified |
| `hooks/` | folder | State and side-effect logic, no JSX — see `hooks/index.md` | ⚠️ mixed — logic verified via `.claude/skills/webcam-detection-preview/` and tests where possible; front/back switching, back-camera box rotation, and Photos-library recording untested on hardware |
| `screens/` | folder | Full-screen React components, no business logic — see `screens/index.md` | ⚠️ mixed — permission/no-device screens verified, tracking overlay/camera controls untested on hardware |
| `tracking/` | folder | Pure decision logic: who to follow, how far to move the gimbal, what to show on screen, how to decode the model's raw output. Unit-tested, no hardware needed — see `tracking/index.md` | ✅ verified |
| `ble/` | folder | BLE transport to the robot's micro:bit — connection lifecycle + gimbal-packet wire encoding, wired into `App.tsx` via `hooks/useGimbalControl.ts` — see `ble/index.md` | ⚠️ mixed — packet/base64 encoding unit-tested (no hardware needed), the connection hook itself never run against real hardware |
| `theme/` | folder | Shared style tokens (colors, and future spacing/typography) — see `theme/index.md` | ✅ verified |

## Depends on
`react`, `react-native`, `expo`, `expo-status-bar`, `react-native-vision-camera`,
`react-native-worklets`, `react-native-vision-camera-resizer`, `react-native-fast-tflite`,
`expo-media-library`, `react-native-ble-plx` (via `hooks/`, `screens/`, and `ble/`),
`assets/models/person-detection.tflite`.

## Depended on by
`index.ts` (repo root) imports `./src/App` as the registered root component.

## Rule for growing this folder
New concerns (tracking-lock logic, athlete-count input, etc.) get their own
sibling folder here (e.g. `src/tracking/`, `src/ble/`) once they exist, each
with the same `hooks / screens (or components) / index.md` shape. Don't pile
unrelated logic into `hooks/` or `screens/` just because they already exist
— see `CLAUDE.md` §7.
