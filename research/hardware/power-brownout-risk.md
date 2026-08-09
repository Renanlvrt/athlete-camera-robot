# Power & brownout — OPEN QUESTION

- **Researched:** 2026-08-09
- **Confidence:** **low, and deliberately so.** This file exists to say clearly that research
  cannot answer this. It has to be measured on the real robot.
- **Expires:** When `servo-bounds-test` has been run on the assembled robot and the result is in
  `testing/REAL_HARDWARE_TEST_LOG.md`.
- **Sources:** `docs/PRD.md` §2.2, §2.3, §8

## Conclusion

**Do not resolve this by searching.** Whether this specific robot browns out depends on the
actual servos, the actual battery, the actual wiring, and the actual mechanical load — none of
which are in any datasheet. Measure it.

## Why this file exists

An agent asked "will the power setup work?" will happily produce a confident-sounding answer
from generic servo current figures. That answer would be worthless here, and worse, it would
look authoritative enough to skip the real test. This file is a stop sign.

## What the risk actually is

The failure chain:

1. Two or three servos move at once, or one stalls against a mechanical limit.
2. Instantaneous current spikes well above the servos' idle or nominal draw. Stall current for a
   hobby servo can be several times its rated running current.
3. Supply voltage sags.
4. The micro:bit — the *most* voltage-sensitive part of the system — resets or drops BLE.
5. The phone's tracking loop is now shouting into a void. The gimbal freezes mid-shot, or worse,
   holds its last commanded position against a hard stop and keeps drawing stall current.

This is the reason PRD §2.3 insists the electronics run from a battery **independent of the
phone**, and it's why `servo-bounds-test` exists as a gate before closed-loop tracking.

## What to actually measure

On the real robot, per `.claude/skills/servo-bounds-test/`:

- Does the micro:bit stay connected during a **full-speed multi-servo sweep**? (Not one servo
  moving slowly — that will pass and prove nothing.)
- Does it survive a **deliberate stall** — servo commanded into a mechanical limit for ~2 seconds?
- What does the battery voltage do under that load, if a multimeter is available?
- Does behaviour change as the battery discharges? A pack at 50% behaves differently from a
  fresh one, and a filming session is long.

## Mitigations, in order of preference

1. **Clamp the commanded angle range in software** to the mechanically safe range, so stalls
   can't be commanded at all. Free, and it also protects the servo gears.
2. **Rate-limit and slew-limit** motion — proportional control (PRD §5.1) already helps here, but
   an explicit max-degrees-per-update cap prevents full-speed slams.
3. **Bulk capacitor** across the servo power rail to absorb transients. A few dollars.
4. Separate the servo supply from the logic supply entirely, if 1–3 aren't enough.

Note that 1 and 2 are **software** mitigations that live in `computeGimbalCorrection.ts`. Design
that function with clamping and slew limits from the start rather than retrofitting them after
the first brownout.
