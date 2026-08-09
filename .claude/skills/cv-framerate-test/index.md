# .claude/skills/cv-framerate-test/ — index

Measures real per-frame processing time on the iPhone 16, in two stages (empty processor, then
with the TFLite model), under sustained load. The gate that must pass before tracking logic is
built on the CV pipeline.

Not responsible for: detection *accuracy* (that's a field test — see `testing/field-tests/`), or
the tracking maths that consumes detections (future `src/tracking/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | Two-stage procedure, the 5-minute thermal rule, how to read the numbers | ⚠️ needs verification (never run) |
| `scripts/FrameTimingScreen.tsx` | file | Isolated screen: frame processor + rolling median/p95/worst display | ⚠️ needs verification (does not typecheck until worklets packages are installed) |

## Depends on
`research/computer-vision/frame-budget.md` (what the budget is and why thermal matters) and
`research/computer-vision/frame-processor-stack-v5.md` (which packages, and the v4 traps).
Requires `react-native-worklets` + `react-native-vision-camera-worklets`, **not yet installed**.

## Depended on by
Future `src/tracking/` — no tracking work should start until this test passes.
