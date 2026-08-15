# Driving servos: moto:bit + PCA9685

- **Researched:** 2026-08-09; updated 2026-08-14 with the user's actual hardware (board
  purchased and wired to the moto:bit's Qwiic/I2C port, confirmed by the user; power source
  identified — see "This project's actual power source" below).
- **Confidence:** medium on the general PCA9685/moto:bit facts (datasheet-level, unrun);
  **low** on anything specific to the actual power bank until `servo-bounds-test` is run with it
  — see `power-brownout-risk.md`, this is explicitly not resolvable by research.
- **Expires:** On first successful servo sweep. Replace with measured values and log in `testing/`.
- **Sources:**
  - https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2 (the board in PRD §2.2)
  - `docs/PRD.md` §2.2, §8
  - The user's actual power bank listing (Bextoo 27,000mAh, 22.5W fast charge, USB-A/USB-C
    output) — general USB power-bank electrical characteristics, not board-specific data.

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

### Channel assignment — must match the firmware exactly

`.claude/skills/gimbal-control-firmware/scripts/microbit_gimbal_control.py` hard-codes:

```
CHANNEL_ROLL  = 0   # PCA9685 channel 0 — the roll-axis gimbal servo
CHANNEL_PITCH = 1   # PCA9685 channel 1 — the pitch-axis gimbal servo
```

Plug the roll servo's signal wire into the **channel 0** header and the pitch servo's into
**channel 1**. If they're wired to different channels, either re-wire them or change these two
constants before flashing — whichever is less physical effort. Channel 2+ is reserved for the
steering servo whenever Phase 2 (base movement, `docs/PRD.md` §5.2) starts — not used by
anything yet, leave it unconnected or connect it now for convenience, it won't be driven until
that phase's firmware exists.

### Confirming an existing Qwiic/I2C connection is wired correctly

The user has already connected the PCA9685 to the moto:bit via Qwiic — nothing to newly wire
here, but worth a 30-second visual/continuity check before trusting it:

- **Qwiic cables are keyed** (the connector only inserts one way) — if it went in, it's
  physically correct; there's no way to reverse the 4 wires (GND/3.3V/SDA/SCL) by accident with
  a genuine Qwiic cable.
- If a generic 4-pin JST-SH cable (not a real SparkFun/Qwiic one) was used instead, double-check
  wire-for-wire against the connector's silkscreen labels on both boards — those are NOT
  guaranteed keyed the same way, and a swapped SDA/SCL is a real, easy-to-make mistake that looks
  exactly like "the servos don't respond" or an I2C bus error.
- Only one PCA9685 address jumper set is relevant if a second I2C device is ever added to the
  same Qwiic chain (default address `0x40`, matches `PCA9685_ADDR` in both
  `servo-bounds-test`'s and `gimbal-control-firmware`'s scripts) — not a concern with just one
  PCA9685 on the bus, mentioned here only so it isn't a mystery later if a second board is added.

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

### Power — read `power-brownout-risk.md` and `power-bank-auto-shutoff.md`

**Real report, 2026-08-16: this power bank stopped delivering current to the micro:bit's own
logic supply after a few seconds.** Confirmed root cause and fix in
`research/hardware/power-bank-auto-shutoff.md` — the power bank's low-current auto-shutoff, not
a wiring or firmware problem. Fix for the micro:bit's own power: use its native JST-PH battery
connector with a 2×AAA holder instead of USB. That fix does NOT automatically extend to the
servo/PCA9685 rail below, which is a separate power path — see that file's "if the same issue
shows up on the servo rail" section if it recurs there once servo power is actually tested.

The PCA9685 has a **separate V+ terminal for servo power**, deliberately isolated from the logic
supply. Servos must be fed from the dedicated battery there, **never** from the micro:bit's 3V
rail — three servos moving simultaneously draw far more than the micro:bit can source, and the
result is a brownout that resets the board and drops the BLE connection mid-track.

Common ground between the PCA9685, the battery, and the micro:bit is required. Missing it
produces bizarre intermittent behavior that looks like a software bug.

### This project's actual power source — a USB phone power bank

The user's power bank is a standard consumer USB power bank (Bextoo 27,000mAh, 22.5W fast
charging, USB-A + USB-C outputs) — not a raw battery pack with bare leads or a barrel jack. This
changes the wiring step, and has real electrical implications worth understanding rather than
just wiring blind:

**Voltage — actually fine.** Without a fast-charge negotiation (which nothing here will trigger —
that requires specific resistor/data-line signaling from the connected device, which a servo or
the PCA9685 doesn't do), a USB port outputs a plain **5V**. Standard analog hobby servos are
typically rated **4.8–6V**, so 5V sits comfortably in spec. No voltage regulator needed for the
servos themselves.

**Physical connection — needs a USB breakout, doesn't come for free.** The PCA9685's servo-power
input is a screw terminal (V+ and GND pins), not a USB port. Two practical options, in order of
preference:
1. **A USB-A (or USB-C) breakout/pigtail board** (~$2-5, common on Amazon/AliExpress — search
   "USB breakout board screw terminal") — plugs into the power bank, exposes screw terminals or
   header pins for 5V and GND. Cleanest, reusable, no cable sacrificed.
2. **A cut USB cable** — take a spare USB-A cable, cut off the non-power-bank end, strip the
   outer jacket, and identify the **red wire (VBUS, +5V)** and **black wire (GND)**. Discard or
   insulate the other two (usually green/white — D+/D− data lines, not used here). Connect red →
   PCA9685 `V+`, black → PCA9685 `GND`. *Wire colors are a near-universal USB convention but not
   a guaranteed standard — if a multimeter is available, confirm red-to-black reads ~5V before
   connecting anything expensive to it.*

**Common ground still applies.** The PCA9685's `GND` (from the power bank) and the moto:bit/
micro:bit's `GND` (from the Qwiic connection) must be the same electrical ground — Qwiic already
carries a shared ground wire in its 4-pin cable, so as long as that connection is intact, this is
already satisfied. Don't add a second, separate ground path; one shared reference is what matters.

**Current — probably fine for Phase 1, revisit for Phase 2.** The listing advertises 3 output
ports capable of "simultaneously" charging 3 devices, which implies each port can sustain at
least ~1-2A independently — comfortably enough for 2-3 small hobby servos under normal movement
(each typically draws well under 1A except during a stall). **This is a Phase 1 (gimbal-only)
assessment.** `docs/PRD.md` §5.1/§6 already keeps the 2 DC drive motors unpowered during all
current testing, which is good, because a phone power bank is a much shakier bet for motor stall
current — revisit the power source when Phase 2 (base movement) actually starts, don't assume
this bank scales to that.

**The one real unknown, and it's exactly what `servo-bounds-test`'s existing procedure already
checks:** some power banks include "smart" low-current-draw auto-shutoff (designed to detect
"nothing is plugged in anymore" and save power) that can misfire against a load pattern it
doesn't recognize as a phone. Hobby servos' current draw is spiky (near-zero when holding
position, a burst when moving) rather than the steady draw a phone charging session looks like —
this is genuinely untested with this specific bank and cannot be resolved by research (see
`power-brownout-risk.md`). No new test procedure is needed for this: run
`.claude/skills/servo-bounds-test/` exactly as written, using this power bank as the power
source, and its existing brownout-stress steps (both axes simultaneously, held against a limit,
watching for a micro:bit reset) will surface this exact failure mode if it exists.
