# Driving servos: moto:bit + PCA9685

- **Researched:** 2026-08-09
- **Confidence:** medium — the board is **not yet purchased** (PRD §8), so none of this has been
  run. Treat as preparation, not fact.
- **Expires:** On first successful servo sweep. Replace with measured values and log in `testing/`.
- **Sources:**
  - https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2 (the board in PRD §2.2)
  - `docs/PRD.md` §2.2

## Conclusion

Drive all three servos from the PCA9685 over I2C/Qwiic. The two things that will cost you an
afternoon if missed: **the servo pulse unit is centiseconds, not milliseconds**, and **the
PCA9685's servo power rail must not come from the micro:bit's 3V line**.

## Detail

### Wiring choice

PRD §2.2 leaves it open whether the 2 gimbal servos stay on the moto:bit's native headers with
only the steering servo on the PCA9685, or all 3 move to the PCA9685. Electrically both work.

**Recommendation: put all three on the PCA9685.** One code path, one timing model, one power
rail to reason about. Splitting them means two different servo APIs in the micro:bit program for
no benefit. This closes another of PRD §7's open questions — provisionally, pending the board
actually arriving.

### The centiseconds footgun

Servo pulse widths are conventionally quoted in **milliseconds**: ~1.0 ms = 0°, ~1.5 ms = 90°,
~2.0 ms = 180°. Several micro:bit PCA9685 extensions instead take the value in **centiseconds**
(hundredths of a millisecond), so those same positions are **100 / 150 / 200**.

Pass milliseconds to an API expecting centiseconds and every servo slams to one extreme —
looking exactly like a wiring fault or a dead servo. **Check the units in whichever extension
you use before concluding the hardware is broken.**

### Frequency

Set the PCA9685 PWM frequency to **50 Hz** for standard analog hobby servos. It powers on at
~200 Hz, which will make servos buzz, jitter, or sit unresponsive. This is a one-line init that
is very easy to forget.

### Angle limits — find them before trusting them

Nominal range is 0–180°, but this gimbal is a **physical 3D-printed assembly**. The real safe
range is whatever the printed parts allow before binding, and it is certainly narrower than
0–180° on at least one axis. Driving a servo into a mechanical hard stop makes it stall, draw
maximum current continuously, heat up, and strip its gears.

**Establish the real limits empirically and clamp to them in code** before any closed-loop
tracking runs. That is exactly what the `servo-bounds-test` skill is for, and why it's a
prerequisite for Phase 4 rather than a nice-to-have.

### Power — read `power-brownout-risk.md`

The PCA9685 has a **separate V+ terminal for servo power**, deliberately isolated from the logic
supply. Servos must be fed from the dedicated battery there, **never** from the micro:bit's 3V
rail — three servos moving simultaneously draw far more than the micro:bit can source, and the
result is a brownout that resets the board and drops the BLE connection mid-track.

Common ground between the PCA9685, the battery, and the micro:bit is required. Missing it
produces bizarre intermittent behavior that looks like a software bug.
