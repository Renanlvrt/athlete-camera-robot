# src/screens/ — index

Full-screen React components. Each renders exactly one UI state and takes
its data as props — **no permission requests, no device lookup, no business
logic lives here** — that's `src/hooks/`. Each file's only job is "given
this state, show this UI."

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `PermissionRequiredScreen.tsx` | file | Renders the "requesting camera permission…" state. Takes no props. | ✅ verified |
| `NoCameraDeviceScreen.tsx` | file | Renders the "no camera device found" state. Takes no props. | ✅ verified |
| `CameraPreviewScreen.tsx` | file | Renders the full-screen live camera preview for an already-resolved `CameraDevice`. Takes `device` as a required prop. | ✅ verified — Stage 3 scope only; does NOT render bounding boxes (Stage 4, not implemented, see `docs/PRD.md` §4). |

## Depends on
`react-native`, `expo-status-bar`, `react-native-vision-camera` (`Camera`
component + `CameraDevice` type, `CameraPreviewScreen.tsx` only),
`src/theme/colors.ts`.

## Depended on by
`src/App.tsx` renders exactly one of these per the status returned by
`useCameraSetup()`.

## Rule for growing this folder
When Stage 4 (bounding-box overlay) is built, it should be a new prop/child
on `CameraPreviewScreen.tsx` (or a sibling `TrackingOverlay.tsx` composed
inside it) — not new logic bolted onto `App.tsx`.
