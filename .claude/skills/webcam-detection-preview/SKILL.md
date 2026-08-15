---
name: webcam-detection-preview
description: >
  Runs the bundled person-detection TFLite model against the developer's laptop webcam (or a
  static image) using a Python port of the app's decode/tracking/overlay logic, and saves an
  annotated frame to disk. Use whenever iterating on detection correctness or the tracking
  overlay's UI/UX (box size, readout layout, colors, thresholds) — it proves out
  model+decode+drawing changes in under a second per frame, instead of a ~20 minute CI build +
  AltStore sideload round trip. With --live --send-ble, it also connects to the robot's
  micro:bit and sends real gimbal-correction packets computed from the webcam feed — a full
  CV -> correction -> BLE -> firmware sandbox with no phone involved at all, useful for isolating
  whether a BLE problem is in the robot/protocol or specific to the phone app. Cannot test
  anything iOS/VisionCamera- or react-native-ble-plx-specific — see "What this does NOT prove"
  below.
---

# Webcam Detection Preview

Fast, no-phone-required loop for iterating on `src/tracking/decodeDetections.ts`,
`src/tracking/computeTrackingReadout.ts`, and `src/screens/TrackingOverlay.tsx`'s visual design,
by running the exact same `assets/models/person-detection.tflite` file locally.

## Why this exists

This project has no local iOS simulator path — every change has to go through
`.claude/skills/build-unsigned-ipa/` (CI build) and a manual AltStore sideload to test on the
real iPhone (see `docs/YOUR_STEPS.md`). That's fine for proving the native pipeline works at all,
but far too slow for finding an off-by-one in the box math or tuning what the overlay looks like.
Most of what actually needs iterating (decode correctness, `isCentered` buffer tuning, box/panel
layout) doesn't touch anything iOS-specific — it's model inference + pure math + 2D drawing, all
of which run identically on Windows.

## Setup (one-time)

```bash
pip install ai-edge-litert
```

`opencv-python` is required too (`import cv2`) — already present in this environment; install it
if missing (`pip install opencv-python`). No other native/GPU setup needed; `ai-edge-litert` runs
the model on CPU via XNNPACK, which is slower than the phone's CoreML delegate but plenty fast for
single-frame testing.

## Run it

```bash
# Grab one webcam frame, run detection, save the annotated result. Sit in frame first.
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py --capture out.png

# Same, but against a fixed test image (reproducible, no need for a live person)
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py --image path/to/photo.jpg --capture out.png

# Live window, for the developer to eyeball themselves in real time. Press 'q' to quit.
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py --live

# Timed, logged, named test session — the one to use for structured multi-scenario testing
# with the developer present. Saves a periodic snapshot + a per-frame CSV (confidence, offset,
# bearing, isCentered) under <output-dir>/<name>/, and --show opens a live window with a big red
# phase-name banner so the developer can watch it happen. Auto-stops after --duration.
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py \
  --session distance_far --duration 15 --output-dir sessions \
  --label "TEST: DISTANCE - FAR" --show

# Any mode also accepts --mirror, which simulates the front/selfie camera: flips the
# frame before feeding the model, then un-mirrors the result so it's still drawn on the
# original frame — exercises decodeDetections.ts's isMirrored path without a real front
# camera. A laptop webcam has no equivalent to actually switch, so this is the only way
# to test front-camera correctness off-device.
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py --mirror --capture out.png

# --live --send-ble: the full-pipeline sandbox. Connects to the robot's micro:bit over
# BLE (same scan/connect logic as src/ble/useBleConnection.ts) and sends a real gimbal
# packet at ~15Hz for whatever the webcam sees, alongside the usual live window. Point
# the webcam at yourself and watch the micro:bit's LED matrix
# (.claude/skills/gimbal-led-simulator/) react. Needs `pip install bleak` — already
# covered if .claude/skills/ble-ping/ has been set up.
python .claude/skills/webcam-detection-preview/scripts/detect_preview.py --live --send-ble
```

## The BLE sandbox (`--live --send-ble`) — why it exists, what it does and doesn't tell you

Added 2026-08-15 after a real report: the app installed on the phone and connected fine to
BLE up through `31898819543`'s build, but a later report showed a bare "BLE: ERROR" with no
detail — and re-testing on the phone after every code change is a slow AltStore round trip.
This mode answers one question fast, from the laptop alone: **is the problem in the robot/BLE
protocol, or specific to the phone app's `react-native-ble-plx` integration?**

- Scan/connect logic is a direct port of `src/ble/useBleConnection.ts` — same broad scan, same
  "service UUID OR name starting with `BBC micro:bit`" match, same characteristic layout.
- `compute_gimbal_correction()`/`encode_gimbal_packet()` are direct ports of
  `computeGimbalCorrection.ts`/`encodeGimbalPacket.ts` — verified by hand against known inputs
  (centred → (0,0), an off-centre athlete → clamped delta, encode/decode round-trip, NaN/Infinity
  → 0) before trusting them, same discipline as everything else duplicated in this file.
- Runs the BLE connection on a background thread (`asyncio` loop) so the main webcam loop stays
  the same synchronous `cv2` code as every other mode — `BleSender.send()` always drops any
  stale queued packet in favour of the newest one, matching `useGimbalControl.ts`'s "always send
  current state, never a backlog" behaviour.
- **If this connects reliably and this fails on the phone**, the problem is almost certainly
  specific to `react-native-ble-plx`/iOS, not the robot, the firmware, or the wire protocol —
  narrows the search a lot. **If this ALSO fails to connect**, the problem is upstream of the
  phone app entirely (the robot, the radio environment, or the protocol itself).
- Confirmed working end-to-end 2026-08-15: webcam opens, model runs, BLE scans, finds, connects,
  and starts sending — logged in `testing/REAL_HARDWARE_TEST_LOG.md` with the same agent-run
  provenance caveat as this project's other BLE bench tests.

Read the saved PNG (the `--capture` mode) to judge box size/position and readout legibility
without needing a live window — this is the mode to use when iterating autonomously. Use
`--session` for anything involving the developer physically doing something (walking, changing
distance, a second person) — the CSV gives quantitative numbers (detection rate, mean confidence,
centred fraction) instead of relying on eyeballing individual frames.

## Keep it in sync with the real app

`scripts/detect_preview.py` is a **deliberate, documented duplication** of six TS files (four
tracking/UI files, plus `computeGimbalCorrection.ts`/`encodeGimbalPacket.ts` as of 2026-08-15),
not a second production implementation — see the file's own header comments for the exact
mapping. If you change a threshold, the drawing design, or the wire protocol in one place, change
it in the other. This is only acceptable because the ported functions are small (a few dozen
lines each) and already unit tested on the TS side (`src/tracking/*.test.ts`, `src/ble/*.test.ts`).

## What this does NOT prove

- **Nothing iOS/VisionCamera-specific.** No frame orientation handling, no GPU resizer, no CoreML
  delegate, no worklet/JS-thread boundary. A bug that's specific to that plumbing (see the
  orientation caveat in `src/hooks/useAthleteDetection.ts`) will not reproduce here.
- **Not a speed/thermal benchmark.** `ai-edge-litert` on a laptop CPU has nothing to do with the
  iPhone's per-frame budget — that's `.claude/skills/cv-framerate-test/`'s job, on the real device.
- **A laptop webcam's framing/distance is not the same as the robot's.** Good detection here is
  evidence the model+decode are sound, not evidence the field-test detection range is adequate
  (`docs/PRD.md` §7).
- **`--send-ble` proves the robot/protocol, never `react-native-ble-plx`/iOS itself.** This uses
  `bleak` on Windows — a completely different BLE stack from the phone app. A connection that
  works here and fails on the phone tells you WHERE to look, not that the phone-side code is
  bug-free once this passes.
