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
| `CameraPreviewScreen.tsx` | file | Renders the full-screen live camera preview plus the tracking overlay for an already-resolved `CameraDevice`. Takes `device`, `frameOutput`, `boxes`, `frameAspectRatio`, `detectionStatus` as props. | ⚠️ needs verification — Stage 4 implemented (`docs/PRD.md` §4), `tsc`/tests pass, but never rendered inside the real RN/VisionCamera pipeline on a device. |
| `TrackingOverlay.tsx` | file | Draws the locked athlete's box + confidence badge (clamped on-screen) and the distance/bearing/centred readout panel. Pure rendering over props. | ⚠️ needs verification on-device (same as above), but its decode/readout/box-placement math is validated against the real bundled model and real people via `.claude/skills/webcam-detection-preview/` — see `docs/VERIFICATION_REPORT.md`, 2026-08-13. Found and fixed two real bugs that way: an oversized/mispositioned box (frame-orientation aspect ratio, fixed in `src/hooks/useAthleteDetection.ts`) and a confidence badge that could render invisibly underneath the status panel (z-order + clamping, fixed here). |
| `frameLayout.ts` | file | Pure geometry: maps a normalised camera-frame box into `'cover'`-fitted view pixel coordinates, and clamps the confidence badge's position to stay on-screen. | ✅ verified — 13 unit tests |
| `frameLayout.test.ts` | file | 13 tests: exact-aspect passthrough, crop on each axis, centred box, zero/negative/NaN inputs, badge clamping on all 4 edges | ✅ verified |

## Depends on
`react-native`, `expo-status-bar`, `react-native-vision-camera` (`Camera`
component + `CameraDevice`/`CameraFrameOutput` types, `CameraPreviewScreen.tsx` only),
`src/theme/colors.ts`, `src/tracking/` (`selectPrimaryAthlete`, `computeTrackingReadout`,
`PersonBox` — `TrackingOverlay.tsx` only), `src/hooks/useAthleteDetection.ts`
(`DetectionStatus` type only, for the prop shape).

## Depended on by
`src/App.tsx` renders exactly one of these per the status returned by
`useCameraSetup()`, passing `useAthleteDetection()`'s output down as props
when rendering `CameraPreviewScreen.tsx`.

## Rule for growing this folder
Stage 4 (bounding-box overlay) is implemented as a sibling `TrackingOverlay.tsx` composed
inside `CameraPreviewScreen.tsx`, per this rule as originally written. Follow the same pattern
for future overlay elements — new logic goes in `src/tracking/` (decisions) or stays here as pure
presentation (`frameLayout.ts`-style), never bolted onto `App.tsx`.
