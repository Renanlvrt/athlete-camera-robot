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
| `CameraPreviewScreen.tsx` | file | Renders the full-screen live camera preview plus the tracking overlay and camera controls for an already-resolved `CameraDevice`. Takes `device`, `frameOutput`, `videoOutput`, `boxes`, `frameAspectRatio`, `detectionStatus`, `facing`/`onToggleFacing`, `recordingStatus`/`onStartRecording`/`onStopRecording` as props. | ⚠️ needs verification — Stage 4 implemented (`docs/PRD.md` §4), `tsc`/tests pass, but never rendered inside the real RN/VisionCamera pipeline on a device. |
| `TrackingOverlay.tsx` | file | Draws the locked athlete's box + confidence badge (clamped on-screen), a dashed line from box-center to screen-center, and the distance/bearing/centred readout panel (including a compact up-down/left-right vector breakdown). Pure rendering over props. | ⚠️ needs verification on-device (same as above), but its decode/readout/box-placement math is validated against the real bundled model and real people via `.claude/skills/webcam-detection-preview/` — see `docs/VERIFICATION_REPORT.md`. Found and fixed two real bugs that way: an oversized/mispositioned box (frame-orientation aspect ratio, fixed in `src/hooks/useAthleteDetection.ts`) and a confidence badge that could render invisibly underneath the status panel (z-order + clamping, fixed here). |
| `CameraControls.tsx` | file | The front/back toggle button and the record/stop button. Pure rendering over props and callbacks. | ⚠️ needs verification — new 2026-08-13, `tsc` passes, untested on-device (front/back and recording both need real hardware). |
| `frameLayout.ts` | file | Pure geometry: maps a normalised camera-frame box into `'cover'`-fitted view pixel coordinates, clamps the confidence badge's position to stay on-screen, and computes the position/length/rotation for the dashed center-line. | ✅ verified — 17 unit tests |
| `frameLayout.test.ts` | file | 17 tests: exact-aspect passthrough, crop on each axis, centred box, zero/negative/NaN inputs, badge clamping on all 4 edges, line-geometry (length/angle/rotation-reproduces-endpoints) | ✅ verified |

## Depends on
`react-native`, `expo-status-bar`, `react-native-vision-camera` (`Camera`
component + `CameraDevice`/`CameraFrameOutput`/`CameraVideoOutput` types, `CameraPreviewScreen.tsx`
only), `src/theme/colors.ts`, `src/tracking/` (`selectPrimaryAthlete`, `computeTrackingReadout`,
`PersonBox` — `TrackingOverlay.tsx` only), `src/hooks/useAthleteDetection.ts`
(`DetectionStatus` type), `src/hooks/useCameraSetup.ts` (`CameraFacing` type),
`src/hooks/useVideoRecording.ts` (`RecordingStatus` type) — types only, for prop shapes.

## Depended on by
`src/App.tsx` renders exactly one of these per the status returned by
`useCameraSetup()`, passing `useAthleteDetection()`'s and `useVideoRecording()`'s output down as
props when rendering `CameraPreviewScreen.tsx`.

## Rule for growing this folder
Stage 4 (bounding-box overlay) is implemented as a sibling `TrackingOverlay.tsx` composed
inside `CameraPreviewScreen.tsx`, per this rule as originally written. Follow the same pattern
for future overlay elements — new logic goes in `src/tracking/` (decisions) or stays here as pure
presentation (`frameLayout.ts`-style), never bolted onto `App.tsx`.
