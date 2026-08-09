---
name: cv-framerate-test
description: >
  Measures real per-frame processing time on the iPhone 16 using an isolated test screen —
  first with an empty frame processor (plumbing only), then with the TFLite model loaded. Use
  before building any tracking feature on top of the CV pipeline, and whenever detection feels
  laggy, to establish whether the frame budget is actually being met under sustained load.
---

# CV Framerate Test

Proves the frame-processor pipeline hits its time budget on the real device **before** any
tracking logic is built on top of it. Budget and rationale:
`research/computer-vision/frame-budget.md`.

## Run it in two stages — this is the whole point

**Stage 1: empty frame processor.** No model, no resizing, just a worklet that records
timestamps. This measures the *plumbing* — VisionCamera v5 + worklets + the Windows→CI→AltStore
path. If this fails, the failure is in setup, and you get a readable error instead of a
mysterious slowdown with five suspects.

**Stage 2: add the model.** Resizer + `model.runSync()`. Now the delta from Stage 1 is
attributable to inference specifically.

Skipping Stage 1 is the mistake this skill exists to prevent. Debugging "it's slow" with the
plumbing, the resizer, and the model all unproven at once wastes a day.

## Prerequisites

Stage 1 needs packages this project does **not yet have** — see
`research/computer-vision/frame-processor-stack-v5.md`:

```bash
npx expo install react-native-worklets react-native-vision-camera-worklets
```

Stage 2 additionally needs:

```bash
npx expo install react-native-vision-camera-resizer react-native-fast-tflite
```

Plus `metro.config.js` with `'tflite'` in `resolver.assetExts`, and the fast-tflite Expo plugin
with `enableCoreMLDelegate: true` in `app.json`.

**Run `npm install` and settle peer conflicts locally before spending a CI round** — that
version triple is new and peer ranges are the likeliest failure. Commit the regenerated
`package-lock.json` in the same change, or CI's `npm ci` fails in a way that looks like an Xcode
problem.

## Procedure

1. Wire `scripts/FrameTimingScreen.tsx` into `src/App.tsx` temporarily as the active screen.
2. Build (`.claude/skills/build-unsigned-ipa/`) and install via AltStore.
3. Point the camera at a normal scene. Let it run.
4. **Run it for at least 5 minutes.** Not 30 seconds. See below.
5. Read the on-screen stats: current ms, rolling median, p95, and the worst frame.

## The 5-minute rule

A cold phone will hit the budget and tell you nothing. Sustained CV is a **thermal** problem:
the device heats, iOS throttles, and the numbers that matter are the ones after several minutes
— outdoors, in sun, screen bright, phone clamped to a gimbal mount with no airflow.

A framerate test shorter than the real use case is not a test. Filming sessions run for minutes;
measure minutes.

## Interpreting the result

| Sustained median | Verdict |
|---|---|
| ≤16 ms | Comfortable. Headroom for a bigger model or higher input resolution. |
| 16–33 ms | Fine — this holds 30fps, which is the MVP target. |
| 33–66 ms | Run the detector every 2nd frame. Tracking degrades gracefully; the preview stays smooth. |
| >66 ms | Something is wrong. Check the CoreML delegate is actually engaged and the model is quantized, before blaming the phone. |

Watch **p95 and worst-frame**, not just the median. Consistent 25 ms is better than a 15 ms
median with regular 90 ms spikes — spikes are what make tracking visibly stutter.

## Report back

Append to `testing/REAL_HARDWARE_TEST_LOG.md`:

- Stage 1 (empty) and Stage 2 (with model), separately.
- Median / p95 / worst, at **1 minute and at 5 minutes** — the difference is the throttling.
- Did the preview stay smooth while the processor ran?
- Phone warm to the touch? Battery % drop over the run?
- Model file and input resolution used.

## Notes

- Remove the temporary wiring from `src/App.tsx` afterwards. Don't leave a test screen in the
  composition root — `CLAUDE.md` §2 forbids leaving old approaches lying around.
- If Stage 1 itself fails to build, the cause is almost certainly the worklets packages. v5 uses
  `react-native-worklets`, **not** `react-native-worklets-core`; most tutorials say the latter.
