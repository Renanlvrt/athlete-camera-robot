# Robot Integration Plan

Written 2026-08-14, the night the phone-side control loop (`src/tracking/`, `src/ble/`,
`src/hooks/useGimbalControl.ts`) went from "computes corrections nobody sends" to "actually
wired to a BLE transport" — and the same night the user confirmed the micro:bit, PCA9685, and
gimbal are physically wired. This is the detailed plan for closing the loop onto the real robot,
requested directly by the user ("I therefore want to transfer this into the robot... plan this
in detail").

**Read `CLAUDE.md` §5.2 before running any step below: an agent may never mark a hardware
behaviour as working.** Every step here ends with "report back to `testing/`" — that's not
boilerplate, it's the actual gate. Nothing in this document becomes `✅ verified` until a human
runs it and reports.

## How the phone ↔ micro:bit connection actually works, step by step

This is the mechanism, for context before touching hardware — not a new procedure, everything
below is already built (`src/ble/`) or already flashed as firmware skills. Written because
"plan the connection" was asked directly; skip to §1 if you just want the current status.

**BLE, not WiFi.** Bluetooth Low Energy is a short-range radio link (roughly room-sized range,
much lower power than WiFi) designed for exactly this kind of small, frequent command packet —
not for streaming video or large files. The micro:bit has no WiFi hardware at all, only BLE.

**GATT — the data model BLE uses.** A BLE peripheral (the micro:bit) exposes named
**characteristics** grouped into **services**. This project uses one standard, pre-defined
service — the **Nordic UART Service** — which exposes two characteristics: one the phone writes
into (RX, from the micro:bit's perspective) and one the phone can listen to (TX). It behaves like
a simple two-way pipe of bytes, which is why it's the easiest thing to debug first
(`research/hardware/microbit-ble-link.md`).

**What happens when the app is opened, in order:**
1. **Central vs peripheral.** The phone is always the one that goes looking (**central**); the
   micro:bit sits there advertising its presence (**peripheral**) and waits. This direction never
   reverses.
2. **Bluetooth radio check.** `useBleConnection.ts` first waits for the phone's Bluetooth radio
   itself to report ready (`State.PoweredOn`) — if Bluetooth is off on the phone, or the app
   isn't authorized, the app shows that directly (`BLE: OFF` / `BLE: NOT AUTHORIZED`) rather than
   silently doing nothing.
3. **Scanning.** Once ready, the phone scans specifically for devices advertising the Nordic UART
   service UUID (not a broad "list everything nearby" scan — narrower, faster, less battery).
   `BleStatusBadge` shows `BLE: SCANNING…` during this.
4. **The micro:bit must be advertising to be found.** This only happens once the gimbal-control
   firmware (or `ble-ping`'s echo script, for the bench test) is actually flashed and running —
   nothing to scan for otherwise. The micro:bit's own display shows `B` while it's advertising,
   waiting for the phone.
5. **Connect + discover.** The instant the phone's scan sees the right advertisement, it stops
   scanning, connects, and asks the micro:bit what services/characteristics it actually has
   (`discoverAllServicesAndCharacteristicsForDevice`) — this confirms the Nordic UART
   characteristics are really there before anything tries to write to them. `BLE: CONNECTING…`
   covers this.
6. **Connected — the steady state.** `BLE: CONNECTED` on the badge, `C` on the micro:bit's
   display. From here, every ~1/15th of a second (`useGimbalControl.ts`'s rate limit, matching
   PRD §7's 10-20Hz requirement), if there's a locked athlete, the phone encodes a correction
   into the 4-byte packet and writes it to the RX characteristic — "without response," meaning it
   doesn't wait for an acknowledgment before the next frame can be processed (occasional dropped
   packets are expected and fine; the next one supersedes it).
7. **Reconnecting automatically.** If the link drops unexpectedly (walking out of range, the
   gimbal's own movement briefly disrupting the radio, a momentary hiccup) — not the app
   deliberately disconnecting — the phone notices via `onDeviceDisconnected`, shows
   `BLE: LOST — RECONNECTING…`, and automatically restarts scanning every 3 seconds until it
   finds the micro:bit again. **This didn't exist until tonight** — it was added specifically
   because "make the connection work" implies surviving a transient drop, not just the first
   connect. No app relaunch needed for a normal, brief drop.

**No pairing.** `ble-ping`'s echo script explicitly disables BLE pairing (`pairing=False`) to
keep the bench test simple, and the gimbal firmware follows the same pattern — there's no PIN
exchange or trusted-device list involved, the phone just connects directly by service UUID every
time. Fine for this project's threat model (a robot on a private network of one phone + one
micro:bit); would need revisiting only if this were ever a multi-device or security-sensitive
scenario, which it isn't.

**What can't be planned further, only tested:** whether the real signal range/reliability is
good enough while the robot is actually moving and the phone is mounted on top of it (a very
different RF environment than a bench test), and how long a real reconnect actually takes in
practice. Both are exactly what `ble-ping` and the full field test (§3.4) exist to answer.

## 1. Where things actually stand right now

**Phone app side — code exists, typechecks, unit-tested where testable, NONE of it run against
real BLE hardware:**

| Piece | File(s) | What it does |
|---|---|---|
| Decide who to follow | `src/tracking/selectPrimaryAthlete.ts` | Largest confident box wins (MVP heuristic, PRD §4.2) |
| Decide how far to move | `src/tracking/computeGimbalCorrection.ts` | Proportional control, deadband, step-limited — outputs a **delta**, not an absolute angle |
| Encode for the wire | `src/ble/encodeGimbalPacket.ts` | Delta (degrees) → 4-byte signed packet |
| Talk to the micro:bit | `src/ble/useBleConnection.ts` | Scan/connect/discover/write over Nordic UART, auto-reconnects (3s retry) after an unexpected drop |
| Tie it together, rate-limited | `src/hooks/useGimbalControl.ts` | ~15Hz, per PRD §7's 10-20Hz requirement |
| Show it's working | `src/screens/BleStatusBadge.tsx` | On-screen `BLE: CONNECTED` / `SCANNING…` / etc. |

**Robot side — firmware WRITTEN tonight but never flashed or run:**

| Piece | File | What it does |
|---|---|---|
| Prove the link | `.claude/skills/ble-ping/scripts/main.ts` (MakeCode — rewritten 2026-08-15) | Echoes a ping — no servos involved. **✅ Actually passed, real 20/20-ping bench test.** |
| Find safe servo range | `.claude/skills/servo-bounds-test/scripts/microbit_servo_sweep.py` | Manual button-driven sweep, finds mechanical limits |
| Actually drive the gimbal | `.claude/skills/gimbal-control-firmware/scripts/main.ts` (MakeCode — rewritten 2026-08-15) | Receives the phone's packets, drives PCA9685 — **ships with a placeholder safe range**, see §3 |
| Validate the pipeline with zero servo risk | `.claude/skills/gimbal-led-simulator/scripts/main.ts` | Same packets, LED matrix instead of servos — see §3.1.5 |

**Hardware — per the user's direct confirmation:** micro:bit, PCA9685, and both gimbal servos
are physically wired. Micro:bit revision confirmed V2 — see §2's checklist. **Power: the USB
power bank has a confirmed problem (2026-08-16) powering the micro:bit's own logic supply — see
`research/hardware/power-bank-auto-shutoff.md` and §2's updated checklist item below.** Whether
the same issue affects the PCA9685/servo rail is still untested — see
`research/hardware/pca9685-servo-control.md`'s power section.

## 2. Prerequisites checklist — confirm before starting §3

- [ ] Robot **on a stand, wheels off the ground**. Phase 1 is gimbal-only (PRD §5.1) — drive
      motors should stay unpowered through this entire plan.
- [ ] **Phone removed from the gimbal mount** for every step except the very last (§3.4). You
      are deliberately driving servos toward untested limits; don't risk the phone.
- [ ] **Micro:bit powered via its native JST-PH battery connector (2×AAA holder), NOT the USB
      power bank.** Confirmed 2026-08-16: the USB power bank auto-shuts-off after a few seconds
      powering the bare micro:bit (its ~30mA idle draw trips the bank's low-current cutoff) — see
      `research/hardware/power-bank-auto-shutoff.md`. The JST-PH connector has no such shutoff
      logic. Cheap holder (~$3-5), no soldering — the actual fix, not a workaround.
- [ ] **Power bank connected to the PCA9685's V+/GND screw terminals via a USB breakout or cut
      cable** (not a direct USB plug — the PCA9685 has no USB port). See
      `research/hardware/pca9685-servo-control.md`'s "This project's actual power source"
      section for the exact wiring and why 5V is fine voltage-wise for the servos. Confirm common
      ground with the moto:bit (already satisfied if the Qwiic cable is intact — it carries its
      own ground wire). **Watch for the same auto-shutoff symptom here** while servos are idle
      (not being commanded) — untested; if it happens, same fix family applies, see
      `research/hardware/power-bank-auto-shutoff.md`'s "if the same issue shows up on the servo
      rail" section.
- [ ] **Battery disconnect within reach** for the servo-related steps (§3.2, §3.3, §3.4). For a
      USB power bank this just means "unplug the USB cable" — confirm that's physically easy to
      do quickly, not buried under other wiring.
- [x] **Micro:bit revision identified — very likely V2.** Checked 2026-08-14 by reading
      `DETAILS.TXT` on the mounted `MICROBIT` USB drive (this is a plain identifier readout, not
      a hardware behaviour test — reading a file, not observing BLE/servo/anything working, so
      it doesn't fall under `CLAUDE.md` §5.2's human-only rule). Unique ID begins `9905...` —
      per `support.microbit.org`, the ID prefix's device-code digit is `03`/`04` for confirmed V2
      boards and `00`/`01` for V1; `05` isn't in that specific support article's table but
      follows the same V2-family numbering (high confidence, not 100%). **Confirm physically
      before flashing anything BLE-heavy:** look at the board's bottom edge — V2's is
      **bumpy/scalloped**, V1's is **flat** — and/or tap the gold front logo; V2 treats it as a
      touch sensor (lights up in some default firmware), V1 does not. If either confirms V2,
      trust it — flash without the v1 flash-capacity concern.
- [ ] The phone has the latest build installed (§4 covers triggering that build).

## 3. Sequencing — do these in order, each is a real gate for the next

Do not skip ahead. Each step is designed to isolate exactly one new variable — if something goes
wrong at step N, steps 1..N-1 having already passed tells you where to look.

### 3.1 `ble-ping` — prove the link exists at all

Run `.claude/skills/ble-ping/` exactly as its `SKILL.md` describes: bench test from the Windows
laptop first (`bench_ping.py`), then the phone test. This is the cheapest possible test — no
servos, no app control loop, just "can two devices exchange 4 bytes reliably." **Do not proceed
to §3.2 until this passes**, per that skill's own dependency note.

**Status 2026-08-15: the bench half is done** — real 20/20-ping pass, see
`testing/REAL_HARDWARE_TEST_LOG.md`. The phone half is still open.

Report to `testing/REAL_HARDWARE_TEST_LOG.md` as the skill describes: found/connected/echoed,
latency numbers, whether the link survives 60s idle.

### 3.1.5 `gimbal-led-simulator` — prove the whole pipeline, with zero servo risk

**Added 2026-08-15 at the user's explicit request**, and treated as a hard gate before §3.2/§3.3
below: they will not connect the micro:bit to any motor or servo until the full CV → BLE →
firmware pipeline is validated as an MVP some other way. Run
`.claude/skills/gimbal-led-simulator/` — it uses the exact same wire protocol
`gimbal-control-firmware` will eventually use, but only ever draws on the LED matrix.

This is the first REAL end-to-end test of the app's own BLE code (`src/ble/useBleConnection.ts`,
`src/hooks/useGimbalControl.ts`) — `ble-ping`'s bench test only proved the protocol and firmware
with a standalone Python script, never the app itself. Move a real person in front of the camera
and confirm the LED matrix reacts correctly (arrow direction, centred square, no-athlete X) —
see the skill's own `SKILL.md` for the exact procedure. **Do not proceed to §3.2 until this is
confirmed working** — it's the actual MVP sign-off, not `ble-ping`.

### 3.2 `servo-bounds-test` — find the real safe range

Run `.claude/skills/servo-bounds-test/`. This produces two numbers that matter downstream:
the real roll min/max and pitch min/max in degrees, with margin already subtracted per its own
procedure.

**Immediately after this passes**, before moving to §3.3:
1. Open `.claude/skills/gimbal-control-firmware/scripts/microbit_gimbal_control.py`.
2. Replace `ROLL_SAFE_MIN`, `ROLL_SAFE_MAX`, `PITCH_SAFE_MIN`, `PITCH_SAFE_MAX` (currently a
   placeholder ±30° guess) with the real measured values.
3. Also update `src/tracking/types.ts`'s `defaultGimbalTuning` if the measured range suggests
   `maxStep: 5` (degrees per update) is too aggressive for the real mechanism — e.g. if the
   whole safe range is only ±20°, a 5° step is a quarter of full travel per update, which may
   feel jerky. This is a judgement call from what you observe, not a fixed rule.

Report to `testing/REAL_HARDWARE_TEST_LOG.md`: roll min/max, pitch min/max, what binding felt
like, brownout results under stress (both axes simultaneously, held against a limit, half-charged
battery — the skill's own procedure covers all of this).

### 3.3 `gimbal-control-firmware` — close the loop, gimbal only, no camera yet

Flash the updated firmware (§3.2 must have already updated its safe-range constants). Before
involving the phone app at all, do a manual sanity check: can you make the phone (running just
`ble-ping`'s app-side test, or a temporary manual "send a fixed correction" hack) move the gimbal
by a known amount and see it land in the right place? This isolates "does the firmware correctly
turn a packet into a servo command" from "does the whole app's control loop work."

If you don't want to build a throwaway manual-send test, it's acceptable to skip straight to
§3.4 and treat the first real app-driven movement as this test — just know that if something's
wrong, it's harder to tell whether the bug is in the firmware's packet handling or the app's
control loop.

Report to `testing/REAL_HARDWARE_TEST_LOG.md`: did a manually-triggered movement land correctly,
in the correct direction, on both axes?

### 3.4 Full field test — phone mounted, app running, live tracking

Only now does the phone go back on the gimbal.

1. Launch the app. Confirm `BleStatusBadge` reaches `BLE: CONNECTED`.
2. Stand in frame. Confirm the tracking box, readout panel, and dashed line all look right (this
   part is already covered by earlier phone tests — it's a sanity check here, not new ground).
3. Move slowly side to side, then up and down. **Watch the gimbal, not the phone screen** — does
   it follow in the correct direction, smoothly, without slamming or oscillating?
4. Walk fully out of frame. The gimbal should stop and hold — no drift, no hunting.
5. Have someone else step into frame while you're still there (multi-person case, already
   bench-tested for the *detection* side — this is the first time it's tested with the gimbal
   actually moving in response).

This is realistically the point where `docs/PRD.md` §7's still-open questions (primary-athlete
switching under live dynamic movement, detection range with the real iPhone optics, real
power/brownout behaviour) finally get real answers instead of bench approximations. Expect to
come back and retune `defaultGimbalTuning` (gain/deadband/maxStep) based on what you see — that's
expected, not a sign something is broken.

Report to `testing/field-tests/` (this is the first entry that belongs there rather than in
`bench-tests/` — see `testing/index.md` for the distinction) and update
`docs/PRD.md` §7's "still genuinely open" items with what was actually observed.

## 4. Before any of §3 — get the phone build with tonight's fixes installed

Tonight's phone-app changes (back-camera box rotation fix, Photos-library recording,
`useGimbalControl`/`BleStatusBadge`) need a fresh CI build before §3.4 can use them; §3.1-3.3
don't need the phone app's BLE code at all (they use `ble-ping`'s own bench/phone test scripts),
so they can happen before or in parallel with getting the new build installed. See
`docs/VERIFICATION_REPORT.md`'s latest entry for the build/run ID once it's triggered.

## 5. What's still explicitly NOT in scope for this plan

Per `docs/PRD.md` §6 and §0 of `CLAUDE.md` (never build FUTURE items without being asked):

- **No drive-motor / base movement.** Phase 1 is gimbal-only. Nothing in `src/` or the firmware
  above touches the steering servo or drive motors, and this plan doesn't either.
- **No PID.** `computeGimbalCorrection.ts` is proportional-only, deliberately, per PRD §5.1.
- **No auto-recentre on BLE disconnect.** The firmware holds position — see its own doc comment
  for why this is a deliberate choice, not a gap.
- **No tap-to-select or re-identification.** `selectPrimaryAthlete.ts`'s largest-box heuristic
  stays as-is; PRD §4.2 explicitly defers anything smarter.

If the field test in §3.4 reveals one of these is actually needed sooner than planned, that's a
conversation to have with the user, not a unilateral scope expansion.
