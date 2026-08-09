# src/tracking/ — index

The decision-making layer of the control loop: given what the camera saw, decide **who** to
follow and **how far to move** the gimbal.

Everything here is a **pure function over plain data**. No React, no native modules, no camera,
no BLE. That is deliberate and it is the point of this folder: it makes the entire control
algorithm **unit-testable on Windows with no hardware attached** — the only part of the robot's
behaviour that can be proven correct before the robot exists.

Not responsible for: getting frames (`src/hooks/`), running the model (future
`useAthleteDetection`), sending bytes to the robot (future `src/ble/`), or drawing anything
(`src/screens/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `types.ts` | file | Shared vocabulary: `PersonBox`, `GimbalCorrection`, `GimbalTuning`, tuning defaults | ✅ verified |
| `selectPrimaryAthlete.ts` | file | Every detection → the one athlete to lock onto | ✅ verified |
| `computeGimbalCorrection.ts` | file | Locked athlete's offset → roll/pitch deltas (proportional, clamped) | ✅ verified |
| `selectPrimaryAthlete.test.ts` | file | 12 tests: confidence gating, largest-area, tie determinism, purity | ✅ verified |
| `computeGimbalCorrection.test.ts` | file | 16 tests: sign convention, proportionality, deadband, step cap, NaN, convergence | ✅ verified |

**Verified how:** `npm test` → 28/28 passing; `npm run typecheck` → zero errors. Recorded in
`docs/VERIFICATION_REPORT.md`. Note these tags cover the *logic*; the tuning **constants** are
unvalidated guesses until a field test (see below).

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
Nothing yet. Future `useAthleteDetection.ts` will feed it, and future `src/ble/` will transmit
its output.
