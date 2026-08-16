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
| `CameraPreviewScreen.tsx` | file | Renders the full-screen live camera preview plus the tracking overlay, camera controls, BLE status badge, and (2026-08-16, temporary) `DebugReadout`, for an already-resolved `CameraDevice`. Takes `device`, `frameOutput`, `videoOutput`, `primary` (the already-decided `PrimaryAthleteResult`, not raw `boxes` — see 2026-08-16 note below), `frameAspectRatio`, `detectionStatus`, `facing`/`onToggleFacing`, `recordingStatus`/`saveStatus`/`onStartRecording`/`onStopRecording`, `bleState`, and (2026-08-16) `cameraPosition`/`rawOrientation`/`boxCount` for `DebugReadout` as props. | ⚠️ needs verification — Stage 4 implemented (`docs/PRD.md` §4), `tsc`/tests pass, but never rendered inside the real RN/VisionCamera pipeline on a device. |
| `BleStatusBadge.tsx` | file | Small always-visible label (top-left) showing the robot BLE link's state (`OFF`/`SCANNING…`/`CONNECTED`/`LOST`/etc). Tappable (added 2026-08-15) — calls `onRetry` to manually restart the connection, and shows `state.error.message` when in `'error'`/`'connection-lost'`. Pure rendering over props. | ⚠️ needs verification — `tsc` passes. Real report 2026-08-16: on the phone, BLE gets stuck at `'connecting'` forever (never reaches `'connected'` or an error state) even though the exact same micro:bit connects fine from the Windows sandbox — under active diagnosis, see `src/ble/index.md`. |
| `TrackingOverlay.tsx` | file | Draws the locked athlete's box + confidence badge (clamped on-screen), a dashed line from box-center to screen-center, and the distance/bearing/centred readout panel (including a compact up-down/left-right vector breakdown). Takes `primary` (a `PrimaryAthleteResult`) as a prop rather than `boxes` + deciding itself (changed 2026-08-16 — see below). Pure rendering over props. | ⚠️ needs verification on-device — a real report (2026-08-14) found the box still wrong on the back camera in a different way than before (both axes, not just mirrored), root-caused (2026-08-14) then found still broken on a real phone and re-root-caused (2026-08-16, `orientBox`'s `'left'`/`'right'` cases were swapped — see `src/tracking/index.md`); user reported "seems better" 2026-08-16 but not yet a full confirmation. Its decode/readout/box-placement math is validated against the real bundled model and real people via `.claude/skills/webcam-detection-preview/` — see `docs/VERIFICATION_REPORT.md`. |
| `CameraControls.tsx` | file | The front/back toggle button, the record/stop button, and a status line that shows either the recording state or (once idle) the Photos-save state (`SAVING TO PHOTOS…` / `SAVED TO PHOTOS` / `SAVE TO PHOTOS FAILED`). Pure rendering over props and callbacks. | ⚠️ needs verification — `tsc` passes, untested on-device (front/back, recording, and the new Photos save all need real hardware). A real report (2026-08-14) confirmed recording itself worked but nothing appeared in Photos — expected, since the previous version only ever wrote to a temp file; `src/hooks/useVideoRecording.ts` now copies into Photos via `expo-media-library`. |
| `frameLayout.ts` | file | Pure geometry: maps a normalised camera-frame box into `'cover'`-fitted view pixel coordinates, clamps the confidence badge's position to stay on-screen, and computes the position/length/rotation for the dashed center-line. | ✅ verified — 17 unit tests |
| `frameLayout.test.ts` | file | 17 tests: exact-aspect passthrough, crop on each axis, centred box, zero/negative/NaN inputs, badge clamping on all 4 edges, line-geometry (length/angle/rotation-reproduces-endpoints) | ✅ verified |
| `DebugReadout.tsx` | file | **TEMPORARY** (added 2026-08-16, delete once orientation is confirmed correct on both cameras) — small on-screen text showing `cameraPosition`, raw `Frame.orientation`, `isMirrored`, detection count, and `frameAspectRatio`, so the next real-device report is measured data instead of a third blind guess at the rotation math. Pure rendering over props. | ⚠️ needs verification — `tsc` passes, never rendered on a device yet; that's the whole point of shipping it. |

## Depends on
`react-native`, `expo-status-bar`, `react-native-vision-camera` (`Camera`
component + `CameraDevice`/`CameraFrameOutput`/`CameraVideoOutput`/`CameraPosition` types,
`CameraPreviewScreen.tsx` only), `src/theme/colors.ts`, `src/tracking/` (`computeTrackingReadout`,
`PrimaryAthleteResult` — `TrackingOverlay.tsx` only; it no longer calls `selectPrimaryAthlete`
itself, see 2026-08-16 note above), `src/tracking/decodeDetections.ts` (`BufferOrientation` type
— `DebugReadout.tsx` only), `src/hooks/useAthleteDetection.ts`
(`DetectionStatus` type), `src/hooks/useCameraSetup.ts` (`CameraFacing` type),
`src/hooks/useVideoRecording.ts` (`RecordingStatus`/`SaveStatus` types),
`src/ble/useBleConnection.ts` (`BleConnectionState` type — `BleStatusBadge.tsx` only) — types
only, for prop shapes.

## Depended on by
`src/App.tsx` renders exactly one of these per the status returned by
`useCameraSetup()`, passing `useAthleteDetection()`'s, `useVideoRecording()`'s,
`useLockedAthlete()`'s, and `useGimbalControl()`'s output down as props when rendering
`CameraPreviewScreen.tsx`.

## Rule for growing this folder
Stage 4 (bounding-box overlay) is implemented as a sibling `TrackingOverlay.tsx` composed
inside `CameraPreviewScreen.tsx`, per this rule as originally written. Follow the same pattern
for future overlay elements — new logic goes in `src/tracking/` (decisions) or stays here as pure
presentation (`frameLayout.ts`-style), never bolted onto `App.tsx`.
