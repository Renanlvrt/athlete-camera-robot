---
name: webcam-detection-preview
description: >
  Runs the bundled person-detection TFLite model against the developer's laptop webcam (or a
  static image) using a Python port of the app's decode/tracking/overlay logic, and saves an
  annotated frame to disk. Use whenever iterating on detection correctness or the tracking
  overlay's UI/UX (box size, readout layout, colors, thresholds) — it proves out
  model+decode+drawing changes in under a second per frame, instead of a ~20 minute CI build +
  AltStore sideload round trip. Cannot test anything iOS/VisionCamera-specific (frame
  orientation, the GPU resizer, CoreML delegate) — see "What this does NOT prove" below.
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
```

Read the saved PNG (the `--capture` mode) to judge box size/position and readout legibility
without needing a live window — this is the mode to use when iterating autonomously.

## Keep it in sync with the real app

`scripts/detect_preview.py` is a **deliberate, documented duplication** of four TS files, not a
second production implementation — see the file's own header comment for the exact mapping. If
you change a threshold or the drawing design in one place, change it in the other. This is only
acceptable because the ported functions are small (a few dozen lines each) and already unit
tested on the TS side (`src/tracking/*.test.ts`).

## What this does NOT prove

- **Nothing iOS/VisionCamera-specific.** No frame orientation handling, no GPU resizer, no CoreML
  delegate, no worklet/JS-thread boundary. A bug that's specific to that plumbing (see the
  orientation caveat in `src/hooks/useAthleteDetection.ts`) will not reproduce here.
- **Not a speed/thermal benchmark.** `ai-edge-litert` on a laptop CPU has nothing to do with the
  iPhone's per-frame budget — that's `.claude/skills/cv-framerate-test/`'s job, on the real device.
- **A laptop webcam's framing/distance is not the same as the robot's.** Good detection here is
  evidence the model+decode are sound, not evidence the field-test detection range is adequate
  (`docs/PRD.md` §7).
