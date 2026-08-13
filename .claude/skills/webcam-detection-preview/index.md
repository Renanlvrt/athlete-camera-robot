# .claude/skills/webcam-detection-preview/ — index

A fast, phone-free test loop: runs the bundled TFLite model against the laptop's own webcam (or a
static image) using a Python port of the app's decode/tracking/overlay logic, so detection and UI
bugs can be found in under a second per frame instead of a ~20 minute CI+sideload round trip.

Not responsible for: anything iOS/VisionCamera-specific (frame orientation, the GPU resizer, the
CoreML delegate), or on-device performance/thermal behavior — see `SKILL.md`'s "What this does
NOT prove".

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `SKILL.md` | file | What this skill does, when to use it, setup + run commands | ✅ verified |
| `scripts/detect_preview.py` | file | Loads `assets/models/person-detection.tflite`, runs it against a webcam frame or image, ports `decodeDetections.ts`/`selectPrimaryAthlete.ts`/`computeTrackingReadout.ts`/`TrackingOverlay.tsx`, draws the overlay, saves/shows the result | ✅ verified — run against the real bundled model and real webcam frames, 2026-08-13 |

## Depends on
`assets/models/person-detection.tflite` (the same file the app bundles), `ai-edge-litert`
(pip), `opencv-python` (pip, `cv2`), `numpy`.

## Depended on by
Nothing in the app itself — this is a developer tool. Referenced by
`docs/VERIFICATION_REPORT.md` wherever a detection/overlay change was verified through it instead
of a phone test.
