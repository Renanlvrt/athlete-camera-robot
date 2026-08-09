# The per-frame time budget

- **Researched:** 2026-08-09
- **Confidence:** high on the arithmetic; **the real numbers are unmeasured** — no device test
  has been run yet.
- **Expires:** Superseded the moment `cv-framerate-test` produces real numbers on the iPhone 16.
  Replace the estimates below with measurements and log them in `testing/`.
- **Sources:**
  - https://visioncamera.margelo.com/docs/guides/frame-processors-tips
  - `person-detection-model-choice.md` (same folder)

## Conclusion

The whole per-frame pipeline must finish in **≤33 ms** to hold 30fps, and **≤16 ms** to hold
60fps. Target 30fps for the MVP; 60fps buys nothing when the physical servos are the slow part
of the loop.

## Detail

### Where the budget goes

At 30fps, ~33 ms per frame, spent roughly on:

| Stage | Notes |
|---|---|
| Frame delivery | Free — VisionCamera hands it over on the camera thread |
| Resize + colorspace convert | GPU resizer keeps this small; the CPU one may not |
| TFLite inference | **The dominant cost.** CoreML delegate on the Neural Engine is what makes this viable |
| Box filtering + primary-athlete selection | Negligible — pure JS on a handful of boxes |
| BLE send | **Must not be per-frame.** Rate-limit to ~10–20 Hz |

No estimate of the inference number is given here on purpose. Published TFLite benchmarks are
run on different hardware, different thermal states, and often float vs. quantized variants —
quoting one would create a false anchor. **Measure it.**

### Frame processors don't have to run every frame

Detection at 30 Hz is not required for good tracking. A person doesn't move far in 66 ms.
If inference proves too slow, run the detector every Nth frame and let the preview stay at full
rate — the tracking loop degrades gracefully, the preview does not. This is the first lever to
pull before compromising on model quality or resolution.

### What actually threatens the budget

Sustained CV on a phone is a **thermal** problem more than a compute one. A cold device hitting
its budget for 30 seconds proves little; an athlete-filming session runs for minutes, outdoors,
in the sun, with the screen at high brightness and the phone bolted to a gimbal with no airflow.
iOS will throttle. **Any framerate test that doesn't run for several minutes is not a valid
test** — this is the single most important thing to get right in `cv-framerate-test`, and the
reason that skill logs sustained timing rather than a peak number.

Also worth watching in the same test: battery drain rate, and whether the preview stays smooth
while the detector runs (they're on different threads, but contention shows up under thermal
pressure).
