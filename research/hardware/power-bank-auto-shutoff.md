# USB power bank auto-shutoff on low-current devices (micro:bit, and likely idle PCA9685)

- **Researched:** 2026-08-16, triggered by a real report — the user's power bank stopped
  delivering current to the micro:bit after a few seconds.
- **Confidence:** **high** — confirmed against the official micro:bit developer documentation
  itself (`tech.microbit.org`), which explicitly names this exact failure mode, plus multiple
  independent hobbyist/community sources describing the same root cause and the same class of
  fixes.
- **Expires:** Effectively doesn't — this is a stable, well-understood property of how cheap
  USB power banks are designed, not something that changes with library/firmware versions.
  Re-check only if a completely different power source is chosen later.
- **Sources:**
  - https://tech.microbit.org/hardware/powersupply/ — **official micro:bit hardware docs**,
    explicitly states "some USB battery packs will switch off automatically when the current
    drawn from them is too low" and confirms the JST battery connector avoids this
  - https://support.microbit.org/support/solutions/articles/19000013982-connecting-a-power-supply-to-the-micro-bit
  - https://blog.adafruit.com/2020/03/09/keeping-smart-power-banks-alive-while-drawing-low-currents/
  - https://github.com/jameszah/usb-powerbank-keepalive
  - https://www.instructables.com/Hacking-USB-Power-Banks-to-Overwrite-Auto-Off/
  - https://forum.arduino.cc/index.php?topic=307935.0

## Conclusion

**Not a bug in this project, not a dead end — a known, solved problem with cheap USB power
banks.** For the micro:bit's own logic power specifically, **stop using the USB power bank
entirely and use the micro:bit's own native JST-PH battery connector with a 2×AAA holder
instead.** ~$3-5, sold by SparkFun/Kitronik/Pi Hut/Adafruit/Amazon as "micro:bit battery holder
2xAAA JST-PH." This isn't a workaround — it's the connector the board was designed to be
battery-powered from, and it has no smart load-detection circuitry to misbehave in the first
place.

## Why this happens

Every USB power bank runs its own boost converter internally, which draws standby current even
when "idle." To avoid wasting battery life when a phone finishes charging and is left plugged
in, the power bank's controller watches the OUTPUT current and cuts it off once it stays below
roughly **50-100mA for some tens of seconds** — the assumption being "nothing is really drawing
power, so nothing is really connected."

A bare micro:bit sitting mostly idle (LED matrix mostly static, BLE radio only transmitting in
short bursts, no motors/servos attached yet) draws on the order of **~30mA** per the micro:bit's
own docs — comfortably inside the "looks disconnected" zone for most power banks. This is a
property of the POWER BANK'S firmware/hardware design, not anything about the micro:bit, the
BLE code, or this project's firmware being wrong.

## The fix that matters for this project right now

**Micro:bit logic power → 2×AAA battery holder into the JST-PH connector.** Confirmed by the
official micro:bit hardware page to sidestep this exact problem, since a raw battery has no
load-detection logic to misfire. Voltage range for this connector is 1.7V–3.6V (per that same
page); 2×AAA alkaline (~3V nominal, ~1.5V each) sits comfortably in range. No resistors, no
circuits, no soldering — it's a direct plug-in accessory.

**Do not use this holder to also power the PCA9685/servos.** That's already a separate power
rail by design (`research/hardware/pca9685-servo-control.md`'s "Power" section) — a AAA holder
can't supply anywhere near the current 2-3 servos need, and mixing servo current back through the
micro:bit's own rail is exactly the brownout risk `research/hardware/power-brownout-risk.md`
already warns about. Keep them electrically separate, as already planned.

## If the SAME issue shows up on the servo/PCA9685 power rail later

Not yet tested (no PCA9685 power test has happened) — worth knowing about now rather than
rediscovering it during `servo-bounds-test`. Servos actively moving draw far more than the
50-100mA shutoff threshold, so this is unlikely to bite once the gimbal is actually being
commanded — but SERVOS SITTING IDLE (holding position, no movement commanded) draw much less,
and could plausibly trip the same shutoff if that rail is also fed from a similar "smart" USB
power bank. If that happens, options in order of preference:

1. **Same fix, same principle: a raw, non-USB battery pack** for the servo rail instead of a
   phone-style power bank — e.g. a 2S/3S LiPo with a basic BMS (common, cheap RC-hobby part), or
   another simple AA/AAA holder sized for the actual servo current draw. No smart circuitry, no
   shutoff risk, by construction.
2. **A dummy-load resistor across the power bank's output**, if sticking with the existing power
   bank is preferred. Community sources cite ~150Ω drawing an extra ~33mA as a common starting
   point, with some banks needing closer to 100mA (a ~50Ω, 1W+ resistor) — this needs to be
   sized for the SPECIFIC power bank's actual shutoff threshold, which is not published and
   would need to be found by experiment (start with a lower-power resistor and see if it's
   enough; increase if not). Wastes battery capacity continuously as heat — a real trade-off for
   a device meant to run through a filming session.
3. **A cheap purpose-built "power bank keep-alive" dongle** (search that term, or "power bank
   activator") — small breakout boards/circuits sold exactly to solve this, pulse a small load
   periodically rather than continuously to save some of the wasted capacity from option 2.
4. Check if the bank's own product page/manual documents a "trickle charge" or low-current mode
   (some higher-end brands like certain Anker PowerCore models have a button-press toggle for
   this) — the user's current Bextoo power bank's listing (captured earlier in this project's
   research) does not mention any such mode, so this is unlikely to apply to it specifically.

## What this does NOT resolve

Whether the servo/PCA9685 rail will actually need any of the above — that's a real, open,
hardware-dependent question that only `servo-bounds-test` can answer (per
`research/hardware/power-brownout-risk.md`'s own standing rule: power behavior under real load
cannot be resolved by research, only measured). This file exists so that if/when it comes up,
it's a five-minute "oh, that's the known thing" instead of a fresh investigation.
