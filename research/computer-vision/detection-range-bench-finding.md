# Detection range: a laptop-webcam bench finding (not a field test)

- **Researched:** 2026-08-13
- **Confidence:** high for what was measured (a real model, real frames, a logged CSV over ~3,700
  frames); explicitly **not a substitute** for the field test `docs/PRD.md` §7 says this question
  actually needs — see "What this is NOT" below.
- **Expires:** If the bundled model (`assets/models/person-detection.tflite`) is ever swapped for
  a different one (see `person-detection-model-choice.md`'s open "or EfficientDet-Lite0" branch),
  re-run this bench test — the numbers are specific to this exact SSD-MobileNet-V1 file.
- **Sources:** Direct measurement, `.claude/skills/webcam-detection-preview/`'s `--session` mode,
  `docs/VERIFICATION_REPORT.md`'s 2026-08-13 (later) entry (raw data/session logs, not committed —
  ephemeral scratch output).

## Conclusion

Using the developer's laptop webcam (not the iPhone 16), the bundled model detects a person
reliably out to roughly **8 meters indoors**, with confidence degrading gradually from ~0.78
(close range) to ~0.63 (5-8m). Beyond that, detection becomes intermittent — ~57% of frames
still found the person at an estimated 15-20m down a hallway, with confidence around 0.61 among
the successful ones.

## What this is NOT

This does **not** answer `docs/PRD.md` §7's open question ("is detection range adequate") on its
own. Two real gaps:

1. **Different optics.** A laptop webcam's field of view, resolution, and lens characteristics
   are not the iPhone 16's. A subject that reads as "5m away" in webcam-frame-fraction terms does
   not necessarily correspond to 5m through the actual phone camera the robot will use.
2. **Different physical setup.** No gimbal, no outdoor lighting, no actual robot-mounted framing.

**What it IS good for:** a directional signal that the model itself (given a person is
reasonably lit and unobstructed) has a *meaningfully long* useful range before falling over, not
just a few feet — and a concrete number (0.5-0.6 confidence, not 0.9+) to expect at real
mid-distance, which matters for whether `MIN_CONFIDENCE = 0.4` in `selectPrimaryAthlete.ts`
leaves headroom. It does.

## Developer feedback on this finding

Confidence at 5-8m (0.51-0.63 observed) was called out as **lower than expected** (~0.85-0.90
hoped for). Not acted on in this pass — the fix for that isn't a threshold tweak (there's no
evidence the thresholds are wrong; see `docs/VERIFICATION_REPORT.md`'s calibration section), it's
a model-quality question: a larger model, higher input resolution (the 300×300 input this file
uses is smaller than the 320×320 the original model-choice research flagged as the fallback if
range is inadequate — see `person-detection-model-choice.md`), or both. Logged here as the
concrete next thing to try if range/confidence at distance becomes a blocker, not before.

## Still needs a real field test

`docs/PRD.md` §7 is not closed by this. The next real answer needs: the iPhone 16 camera, outdoor
daylight, and an athlete at realistic filming distances (court/field-relevant, likely 5-15m). This
bench finding is useful context for that test, not a replacement for it.
