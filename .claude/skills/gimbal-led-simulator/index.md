# .claude/skills/gimbal-led-simulator/ — index

A safe, servo-free way to validate the full CV → BLE → firmware pipeline before trusting any of
it to move real hardware. Receives the exact same gimbal-correction packets
`gimbal-control-firmware` will eventually drive servos with, but only ever touches the LED
matrix. Built 2026-08-15 at the user's explicit request — they want this fully working as an
MVP sign-off before connecting the micro:bit to any motor or servo.

Not responsible for: driving servos (`../gimbal-control-firmware/`), the BLE link itself
(`../ble-ping/`), or anything on the phone side (`src/ble/`, `src/hooks/useGimbalControl.ts` —
this skill consumes their output unmodified).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `SKILL.md` | file | What it shows and why, build/flash steps, the human test procedure, report fields | ⚠️ needs verification — mechanically smoke-tested (see below), visual mapping unconfirmed |
| `scripts/pxt.json` | file | MakeCode project config, same no-pairing config as `../ble-ping/`/`../gimbal-control-firmware/` | ✅ verified — identical to the config proven in `ble-ping`'s real 20/20-ping pass |
| `scripts/main.ts` | file | Polls the raw BLE UART buffer, decodes the signed packet, shows an arrow/square/X on the LED matrix depending on the value (or its absence) | ⚠️ needs verification — compiles cleanly, flashed, and mechanically smoke-tested (connects over BLE, accepts a centred packet + two directional packets, disconnects cleanly, no crash) via an ad-hoc script, **but the actual LED output was never visually confirmed** — no agent can see an LED matrix (`CLAUDE.md` §5.2) |

## Design decisions worth knowing

- **Same wire protocol as `gimbal-control-firmware`, on purpose.** The phone app's `send()` call
  doesn't know or care which firmware is listening — swapping between this and the real
  servo-driving firmware is just a re-flash, no app changes.
- **Arrow points TOWARD centre, not the servo chase direction.** `computeGimbalCorrection.ts`'s
  own sign convention has a positive delta mean "chase the athlete this way" (same direction they
  drifted). This firmware shows the opposite (point toward where centre is) because that's what
  was actually asked for — see `main.ts`'s own doc comment for the worked example.
- **"Centred" is read directly off the wire, not inferred.** A (0,0) packet only happens because
  of `computeGimbalCorrection.ts`'s deadband — this firmware trusts that rather than re-deriving
  "close enough to centre" from anything else.
- **"No athlete" is a timeout, not a value.** There is no wire representation for "nobody
  detected" — `useGimbalControl.ts` simply stops sending. 1.5 seconds of silence is the trigger.
- **`plotImage`, not `plotLeds`/`showIcon`/`showArrow`.** `plotLeds` requires an inline string
  literal at every call site (a real MakeCode compiler restriction, hit and fixed while building
  this); `showIcon`/`showArrow` block the calling code for their display interval, which would
  stall the packet-processing loop. Pre-built `Image` objects rendered via the non-blocking
  `plotImage(0)` avoid both problems.

## Depends on
`../ble-ping/` (no-pairing config and binary-safe polling pattern, both hardware-confirmed
there first). `src/ble/encodeGimbalPacket.ts` for the wire format —if that changes, this file's
decode logic must change with it. `src/tracking/computeGimbalCorrection.ts`'s deadband semantics
for why (0,0) means "centred."

## Depended on by
Nothing in the repo yet — this is a standalone validation tool the user runs directly against
the app, not something other code calls into.
