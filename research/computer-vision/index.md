# research/computer-vision/ — index

Findings about getting real-time person detection running on the iPhone 16's camera feed: which
detection approach, which packages, and what the per-frame time budget actually is.

Not responsible for: the tracking/control logic that consumes detections (that's `src/tracking/`
and `docs/PRD.md` §5), or camera setup (that's `src/hooks/useCameraSetup.ts`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `frame-processor-stack-v5.md` | file | Exact package set VisionCamera v5 needs for frame processors, and the v4→v5 traps | ✅ verified |
| `person-detection-model-choice.md` | file | Why TFLite via `react-native-fast-tflite`, not Apple's Vision framework | ✅ verified |
| `person-detection-model-asset.md` | file | The concrete downloadable `.tflite` file URL, its output tensor format, and the person class index | ✅ verified |
| `detection-range-bench-finding.md` | file | Laptop-webcam bench measurement of detection range/confidence vs. distance — bounds but does not replace the required field test | ✅ verified (as a bench finding; explicitly NOT a substitute for `docs/PRD.md` §7's field test) |
| `frame-budget.md` | file | What "fast enough" means here and how it's measured | ⚠️ needs verification (budget is arithmetic; real numbers need the device) |
| `occlusion-robustness.md` | file | Why the bundled SSD-MobileNet-V1 struggles on partially-occluded/truncated athletes, and ranked app-level + model-swap fixes | ⚠️ needs verification (literature/reasoning only — no occlusion-specific AP number found for this exact model, and no fix has been implemented or field-tested yet) |

## Depends on
`../phone-integration/expo-cng-constraints.md` — the no-Mac constraint is what eliminates most
of the CV options, so read that first if a conclusion here looks surprising.

## Depended on by
`docs/PRD.md` §4, `.claude/skills/cv-framerate-test/`, and future `src/tracking/`.
