# .claude/skills/webcam-detection-preview/ — index

A fast, phone-free test loop: runs the bundled TFLite model against the laptop's own webcam (or a
static image) using a Python port of the app's decode/tracking/overlay logic, so detection and UI
bugs can be found in under a second per frame instead of a ~20 minute CI+sideload round trip.
As of 2026-08-15, `--live --send-ble` extends this into a full CV→correction→BLE→firmware
sandbox — see `SKILL.md`'s dedicated section.

Not responsible for: anything iOS/VisionCamera- or `react-native-ble-plx`-specific (frame
orientation, the GPU resizer, the CoreML delegate, the actual RN BLE integration), or on-device
performance/thermal behavior — see `SKILL.md`'s "What this does NOT prove".

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `SKILL.md` | file | What this skill does, when to use it, setup + run commands, the BLE-sandbox mode | ✅ verified |
| `scripts/detect_preview.py` | file | Loads `assets/models/person-detection.tflite`, runs it against a webcam frame, image, or a timed `--session`; ports `decodeDetections.ts`/`selectPrimaryAthlete.ts`/`computeTrackingReadout.ts`/`TrackingOverlay.tsx`; with `--send-ble`, also ports `computeGimbalCorrection.ts`/`encodeGimbalPacket.ts` and connects to the real micro:bit via `bleak` on a background thread, with real auto-reconnect (polls `client.is_connected`, not just write-failure inference) | ✅ verified — CV/overlay half run against ~3,700 real frames, 2026-08-13; BLE-sandbox half confirmed connecting and sending live 2026-08-15, then a real report of a stuck "connected" label after a drop led to fixing `BleSender` to poll live connection state and auto-reconnect (agent-run, see `testing/REAL_HARDWARE_TEST_LOG.md`'s provenance note) |

## Depends on
`assets/models/person-detection.tflite` (the same file the app bundles), `ai-edge-litert`
(pip), `opencv-python` (pip, `cv2`), `numpy`, `bleak` (pip, only for `--send-ble` — same
dependency as `.claude/skills/ble-ping/`).

## Depended on by
Nothing in the app itself — this is a developer tool. Referenced by
`docs/VERIFICATION_REPORT.md` wherever a detection/overlay change was verified through it instead
of a phone test.
