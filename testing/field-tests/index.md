# testing/field-tests/ — index

Whole-system tests: robot assembled, phone mounted on the gimbal, a real person moving, outdoors
or in a gym. These are the only tests that tell you whether the thing actually works.

Not responsible for: isolating which subsystem is at fault (do that on the bench first — see
`../bench-tests/`).

## Why field tests are different

A field test is the only place these show up, and every one of them is a documented risk:

- **Thermal throttling.** Sustained CV heats the phone; iOS throttles. A 30-second desk test
  proves nothing about a 10-minute session. See `research/computer-vision/frame-budget.md`.
- **Detection range.** A person 2 m away on a desk test is not a person 20 m down a court. Small
  quantized models struggle with distant subjects — the known weak point of the chosen model
  (`research/computer-vision/person-detection-model-choice.md`).
- **Sunlight.** Auto-exposure hunting, glare, and a screen you cannot read.
- **Vibration and mounting.** A gimbal on a moving base shakes the camera in ways a desk doesn't.
- **Battery life** for both phone and robot, under real load.
- **Brownout under real mechanical load** — servos fighting a real gimbal, not spinning free.

## Safety rules for field tests

1. **Phase 1 is gimbal-only.** The wheeled base does not move (PRD §5.1, §6). Drive motors stay
   unpowered until Phase 2 is explicitly started.
2. **First closed-loop run happens with the robot on a stand, wheels off the ground.** If the
   control loop oscillates or runs away, you want it flailing in place, not driving off.
3. **Know how to cut power fast.** Have the battery disconnect within reach before you start.
4. **Don't point-and-hope with a phone on a gimbal.** Confirm the phone is mechanically secure
   before the servos move — a phone is the most expensive part of this robot.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| — | — | No field tests recorded yet | 🔜 planned |

Summary results go in `../REAL_HARDWARE_TEST_LOG.md`. Add a file here for anything bulky — a
session's frame-timing dump, notes across several conditions, links to footage. Name it
`YYYY-MM-DD-<subject>.md`.

## Depends on
`../bench-tests/` — bench first, always.

## Depended on by
`../REAL_HARDWARE_TEST_LOG.md`, `docs/VERIFICATION_REPORT.md`.
