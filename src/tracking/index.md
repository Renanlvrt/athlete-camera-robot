# src/tracking/ — index

The decision-making layer of the control loop: given what the camera saw, decide **who** to
follow and **how far to move** the gimbal.

Everything here is a **pure function over plain data**. No React, no native modules, no camera,
no BLE. That is deliberate and it is the point of this folder: it makes the entire control
algorithm **unit-testable on Windows with no hardware attached** — the only part of the robot's
behaviour that can be proven correct before the robot exists.

Not responsible for: getting frames or running the model (`src/hooks/useAthleteDetection.ts`),
sending bytes to the robot (future `src/ble/`), or drawing anything (`src/screens/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `types.ts` | file | Shared vocabulary: `PersonBox`, `GimbalCorrection`, `GimbalTuning`, tuning defaults | ✅ verified |
| `selectPrimaryAthlete.ts` | file | Every detection → the one athlete to lock onto. Takes an optional `previousLock` (2026-08-16) — if given, prefers whichever current box continuity-matches it (by IoU, with center-distance as a fallback for boxes shrunk by occlusion) over the largest-area heuristic, which is now only used to (re)acquire a lock. Continuity matches use a lower confidence floor (`CONTINUITY_MIN_CONFIDENCE` = 0.25) than fresh acquisition (`MIN_CONFIDENCE` = 0.4) — the ByteTrack two-stage association pattern, added 2026-08-16 per `research/computer-vision/occlusion-robustness.md`, so a real athlete's box dipping in confidence under partial occlusion doesn't lose the lock as long as it's still spatially where the lock was. State (remembering what the previous lock was, and for how long) is NOT here — see `src/hooks/useLockedAthlete.ts`. | ✅ verified |
| `computeGimbalCorrection.ts` | file | Locked athlete's offset → roll/pitch deltas (proportional, clamped) | ✅ verified |
| `computeTrackingReadout.ts` | file | Locked athlete's offset → human-readable distance/bearing + `isCentered`, for the on-screen UI | ✅ verified |
| `decodeDetections.ts` | file | Raw SSD-MobileNet-V1 output tensors → `PersonBox[]`, filtered to the person class, with an `orientation` option that rotates the box into upright space (for a non-`'up'` `Frame.orientation`) applied BEFORE an `isMirrored` option that un-mirrors `x` for front-camera frames | ✅ verified |
| `selectPrimaryAthlete.test.ts` | file | 19 tests: confidence gating, largest-area, tie determinism, purity, and (2026-08-16) 9 continuity-matching tests — keeps following the previous lock over a now-larger box, IoU match on slight movement, center-distance match on an occlusion-shrunk box, fallback to largest-area when nothing continues, fallback to `no-athletes`, continuity candidates below `CONTINUITY_MIN_CONFIDENCE` still rejected, a below-`MIN_CONFIDENCE`-but-above-`CONTINUITY_MIN_CONFIDENCE` box accepted as a continuity match, that same lower floor NOT applying to fresh acquisition, and unaffected behaviour when `previousLock` is omitted | ✅ verified |
| `computeGimbalCorrection.test.ts` | file | 16 tests: sign convention, proportionality, deadband, step cap, NaN, convergence | ✅ verified |
| `computeTrackingReadout.test.ts` | file | 12 tests: bearing convention in all 4 directions, buffer boundary, NaN/Infinity, purity | ✅ verified |
| `decodeDetections.test.ts` | file | 23 tests: class/score filtering, multi-detection ordering, degenerate/inverted/NaN boxes, slot bound, purity, `isMirrored` flip on both sides of the frame, and all 4 `orientation` cases (identity, 180°, ±90° with dimension swap, rotation-then-mirror composition, post-rotation degenerate box) | ✅ verified |

**Verified how:** `npm test` → 70/70 passing across this folder (112/112 repo-wide);
`npm run typecheck` → zero errors. Recorded in `docs/VERIFICATION_REPORT.md`. Note these tags
cover the *logic*; the tuning **constants** and `PERSON_CLASS_ID`/tensor-order assumptions behind
`decodeDetections.ts` are unvalidated against the real model running on real hardware until a
field test (see below). The `orientation`/`orientBox()` rotation math specifically has already
shipped once believing itself correct (tests passing, EXIF-derived reasoning) and still failed a
real back-camera phone test — see `docs/VERIFICATION_REPORT.md`'s 2026-08-16 entry. Treat it as
`⚠️ needs verification` in practice for real-hardware correctness, tests-passing notwithstanding,
until a fresh phone report confirms the current (`'left'`/`'right'` swap fixed) version.

## Design decisions worth knowing

- **Normalised coordinates (0..1), never pixels.** Model input resolution, camera resolution and
  preview resolution all differ and all change. Pixel maths would break silently when one does.
- **Deltas, not absolute angles.** The phone doesn't know true servo position; the micro:bit owns
  that and applies its own mechanical clamps.
- **Proportional control only.** PRD §5.1 — PID is explicitly FUTURE. Do not add I or D terms.
- **`maxStep` is a safety feature, not smoothing.** Capping per-update movement is a documented
  brownout mitigation (`research/hardware/power-brownout-risk.md`); a full-speed multi-servo slam
  can reset the micro:bit.
- **The vertical sign is inverted.** Screen `y` grows downward, pitch grows upward. This is the
  most likely bug in the folder and has a dedicated test.

## ⚠️ What is NOT proven

The **logic** is tested. The **tuning constants** in `defaultGimbalTuning` (gain 30, deadband
0.05, maxStep 5) are conservative starting guesses that have never touched hardware. Expect to
tune them in the first field test and update them here with measured values.

The `convergence` test simulates the closed loop with a crude "1° ≈ 0.01 frame widths"
stand-in. It proves the controller doesn't diverge *in that model* — it is not a substitute for
watching the real gimbal.

## Depends on
Nothing. No imports outside this folder — that isolation is what makes it testable.

## Depended on by
`src/hooks/useAthleteDetection.ts` (`decodeDetections.ts`); `src/hooks/useLockedAthlete.ts`
(`selectPrimaryAthlete.ts`) — the ONLY call site for `selectPrimaryAthlete`, see
`src/hooks/index.md`; `src/screens/TrackingOverlay.tsx` (`computeTrackingReadout.ts` only, plus
`PrimaryAthleteResult` from `types.ts` for its prop type); `src/hooks/useGimbalControl.ts`
(`computeGimbalCorrection.ts`, plus `PrimaryAthleteResult` for its prop type). `src/ble/encodeGimbalPacket.ts`
takes `types.ts`'s `GimbalCorrection` as input.
