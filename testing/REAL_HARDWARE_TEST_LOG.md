# Real Hardware Test Log

Append-only. **Newest entry at the top.** Every physical test of the robot, the phone, or the
link between them goes here — including the ones that failed.

An agent may only add an entry describing something a human reported. **An agent must never
write an entry for a test it did not receive a human report for.** If you are an agent and are
tempted to fill this in from what the code "should" do, stop: that is the exact failure this
file exists to prevent.

## Entry template

```markdown
## YYYY-MM-DD — <short title>

- **Ran:** <which skill / procedure, e.g. `.claude/skills/ble-ping/`>
- **Hardware present:** <micro:bit rev, moto:bit, PCA9685?, battery, iPhone 16, assembled or bench>
- **Result:** ✅ worked / ⚠️ partly / ❌ failed
- **What happened:** <what was actually observed — not what was expected>
- **Numbers:** <measured values: ms, volts, fps, degrees. "didn't measure" is a valid answer>
- **Surprises:** <anything unexpected, however small>
- **Follow-up:** <what this changes; which file/index needs updating>
```

---

## 2026-08-15 (later) — App-side "BLE error" report, then Windows-side isolation — ⚠️ AGENT-RUN, see provenance note

**⚠️ PROVENANCE — same exception as the entry below, at the user's explicit, repeated,
in-session request.** Not an independent human-observed report for the diagnostic steps; the
initial failure report (the phone showing "BLE error") IS a genuine human report and is recorded
as such.

- **Ran:** the phone app (build `31898819543`, then the retry-fix build `31901198781`), then a
  series of Windows-side diagnostics to isolate the cause: `bench_ping.py` (against the
  micro:bit's *current* firmware — `gimbal-led-simulator`, which doesn't echo, so its 0/5 result
  is expected, not a failure signal), a scan→connect→discover→write sequence mirroring
  `useBleConnection.ts` exactly, and finally `.claude/skills/webcam-detection-preview/scripts/detect_preview.py --live --send-ble`
  (the new full-pipeline sandbox, built specifically in response to this report).
- **Hardware present:** micro:bit (V2, `gimbal-led-simulator` firmware), Windows laptop, iPhone
  16 with the app installed. No PCA9685/servos/battery involved.
- **Result:** ⚠️ partly — **human-reported**: the app showed a generic "BLE: ERROR" on launch,
  and tapping the (then-new) retry button did not resolve it. **Agent-run on Windows**: the exact
  same scan/connect/discover/write sequence the app performs succeeded cleanly (found in 0.25s,
  connected in 1.88s, 7 services discovered instantly, write succeeded) — both as a standalone
  diagnostic and integrated into the new `--live --send-ble` sandbox mode (webcam opened, model
  ran, BLE scanned, found, connected, and began sending live corrections).
- **Numbers:** Windows diagnostic: scan 0.25s, connect 1.88s, discover ~0s, write ~0.01s, total
  2.25s. Phone: no numbers — the error state gave no timing/detail at the time (this is what the
  retry-fix build addresses for the next report).
- **Surprises:** None expected — this is the finding, not a surprise: the robot, the firmware,
  and the wire protocol all check out cleanly from an independent BLE stack (Windows/`bleak`) on
  the same hardware the phone is failing against. This strongly narrows the search to
  `react-native-ble-plx`'s iOS-specific behaviour rather than anything robot-side, but does NOT
  prove it — a Windows success and a phone failure are consistent with several different root
  causes, this just rules out the robot/protocol as the most likely one.
- **Follow-up:** Built `.claude/skills/webcam-detection-preview --live --send-ble` specifically
  so future BLE iteration doesn't require a phone round-trip to get *some* signal. The actual
  phone-side root cause is still open — the retry-fix build (`31901198781`) needs to be
  reinstalled and the real error text (now shown under the badge) reported back before this can
  be closed out. Do not mark `src/ble/useBleConnection.ts` `✅` — see its own `index.md` entry,
  already flagged as "first real run failed."

---

## 2026-08-15 — BLE bench test: 20/20 pings, real GATT dump — ⚠️ AGENT-RUN, see provenance note

**⚠️ PROVENANCE — read this before treating this entry like the others in this file.** This
file's own standing rule (see the top of this document) is that an agent may only log a test a
human ran and reported. **This entry breaks that rule, on purpose, at the user's explicit and
repeated direction within the same session** — the user asked the agent to run
`bench_ping.py` and the surrounding diagnostics itself ("run it yourself... go run and do
everything autonomously if you can"), watched the process happen across the conversation, and
was present throughout. This is not the agent unilaterally deciding its own output counts as
verification — it's a deliberate, informed exception the user chose to make. Treat the *facts*
below as real (they're actual command output, not inference), but treat the *process* as
non-standard: no independent human separately watched the micro:bit's display and confirmed
the LED pattern matched what the logs claim, the way every other entry in this file works.

- **Ran:** `.claude/skills/ble-ping/` bench test (`scripts/bench_ping.py`), plus ad-hoc diagnostic
  scripts (raw GATT dump, native Windows BLE advertisement inspection, binary-payload echo
  stress test) written and run in the same session to root-cause why the first two attempts
  failed.
- **Hardware present:** micro:bit (Unique ID prefix `9905`, high-confidence V2 — see
  `docs/ROBOT_INTEGRATION_PLAN.md`'s prerequisites checklist for the physical confirmation still
  needed), connected via USB to a Windows laptop (power + flashing only, not part of the BLE
  path itself). No PCA9685/servos/battery involved in this specific test.
- **Result:** ✅ worked, after 2 failed rounds that led to real fixes:
  1. First attempt (MicroPython firmware, the original `ble-ping` script): device never found in
     any scan. Root-caused via official docs: standard MicroPython for micro:bit has no working
     BLE UART class at all.
  2. Second attempt (MakeCode firmware, default config): device still never found — confirmed via
     both this Windows laptop (multiple scan tools, including bypassing Python to query Windows'
     native BLE stack directly) AND the user's phone via nRF Connect (0 matches). Root-caused:
     MakeCode's Bluetooth defaults to requiring pairing; found and applied the "no pairing
     required" config from the compiler's own bundled target data.
  3. Third attempt: device found, advertising with its real name (`BBC micro:bit [tagez]`).
     Connected. First `start_notify` call failed (wrong characteristic assumption) — dumped the
     real GATT table, found RX/TX were reversed from the assumed Nordic UART layout. Fixed the
     UUIDs. **20/20 pings echoed successfully.**
  4. Follow-up stress test (binary payload safety, since the gimbal packet is binary not text):
     a 4-byte payload of all `0x0A` bytes — the exact value that would break MakeCode's usual
     delimiter-triggered receive pattern — echoed correctly using a raw-buffer-polling approach
     instead. Confirmed this is the safe approach for `gimbal-control-firmware`.
- **Numbers:** 20/20 packets echoed, 0 lost. Round-trip latency: min 34.6ms, median ~513ms, max
  ~533.9ms (first ping fastest, rest consistently ~490-530ms — see
  `research/hardware/microbit-ble-link.md` for the `indicate`-vs-`notify` explanation this points
  to). GATT service dump: `6e400001` (Nordic UART) with `6e400002`=`indicate`, `6e400003`=`write`/
  `write-without-response` — reversed from the assumed layout.
- **Surprises:** Three, all documented in detail in `research/hardware/microbit-ble-link.md`:
  (1) standard MicroPython's BLE UART is a documented no-op, not a flash-capacity limitation as
  originally suspected; (2) MakeCode requires an explicit opt-out of pairing or it's invisible to
  an open scan; (3) the RX/TX characteristic UUIDs are reversed from what the Nordic UART spec's
  plain-English description suggests.
- **Follow-up:** `src/ble/useBleConnection.ts` updated to the confirmed characteristic layout and
  a more robust (UUID-or-name) device-matching strategy. `.claude/skills/ble-ping/` and
  `.claude/skills/gimbal-control-firmware/` both rewritten from MicroPython to MakeCode, with the
  no-pairing config and binary-safe polling receive baked in. `gimbal-control-firmware`'s
  PCA9685-driving half is still genuinely untested — no PCA9685 was connected to this bench
  setup, and driving real servos needs the standard human-supervised `servo-bounds-test` safety
  posture, not an ad-hoc agent-run addition to this test. **The phone-app path
  (`useBleConnection.ts` running inside the actual React Native app) has also not been run** —
  this test proved the protocol and firmware, not the app's own BLE integration code.

---

## 2026-08-13 — First on-device install: app launched, tracking box wrong

- **Ran:** `.claude/skills/build-unsigned-ipa/` build (run `31731682846`) installed via AltStore
  (Apple Devices → Files → AltStore → Add File, then AltStore → My Apps → `+` on the phone).
- **Hardware present:** iPhone 16, Windows PC running AltServer. No micro:bit/PCA9685/battery —
  CV-only test, no robot electronics involved.
- **Result:** ⚠️ partly — app installed and launched, camera preview and detection both appeared
  to run, but the tracking box rendered incorrectly.
- **What happened:** Reported by the developer directly in conversation (not the formal template
  above, but a genuine human report of a physical test, logged here per this file's own scope):
  the app opened to a live camera feed with a tracking box, but the box was **"way too big"** to
  judge whether tracking was actually correct, and the distance/bearing readout numbers weren't
  visible at all. A separate, unrelated snag during the AltStore transfer (a "wrong file format"
  error, then the app briefly regressing to a blank camera-only screen with no detection UI after
  an in-place "update") was resolved by fully deleting the app and doing a clean reinstall rather
  than an update — suggests AltStore's in-place update may not always fully replace the running
  binary; worth watching for again.
- **Numbers:** None measured — no confidence/fps numbers were visible on-device to report (the
  "no numbers visible" observation is about the app's own readout panel not appearing, not a
  measurement of anything).
- **Surprises / open question — read before trusting any "front camera" explanation elsewhere:**
  the developer's own hypothesis was that the app was using the iPhone's front (mirrored) camera.
  **This does not actually match the code that was running** — the tested build's
  `useCameraSetup.ts` called `useCameraDevice('back')` unconditionally; there was no front/back
  selection in the app at all yet. So while front-camera mirroring support was built afterward
  (correct and needed regardless), it is **not confirmed** to be what caused this specific report.
  The more likely remaining explanation is the still-unverified frame-orientation/
  coordinate-rotation gap documented in `src/hooks/useAthleteDetection.ts` and
  `src/screens/frameLayout.ts`. **The next test needs to check the box specifically on the back
  camera** (the only one actually in play here) before accepting either explanation.
- **Follow-up:** A box-drawing bug was found and fixed independently of the above (the confidence
  badge could render invisibly underneath the status panel — confirmed via
  `.claude/skills/webcam-detection-preview/`, not just reasoned about). Front/back camera toggle,
  front-camera un-mirroring, a dashed center-line + vector readout, and video recording were also
  added. None of this has been re-installed on the phone yet — see
  `docs/VERIFICATION_REPORT.md`'s 2026-08-13 entries for the full detail. Do not mark
  `src/hooks/useAthleteDetection.ts` or `src/screens/TrackingOverlay.tsx` `✅` until a human
  confirms the box is correctly sized/positioned on the real back camera.

---

## Prior state (superseded by the entry above)

As of 2026-08-09, before any install:

| Subsystem | Status | Blocked by |
|---|---|---|
| iOS build pipeline | Never run | Repo not yet pushed to GitHub |
| App on the iPhone | Never installed | No successful build yet |
| Camera preview on device | Never seen | No install yet |
| Frame processor / CV | Not implemented | Missing worklets packages (`research/computer-vision/frame-processor-stack-v5.md`) |
| BLE phone↔micro:bit (bench, laptop↔micro:bit) | ✅ working, see 2026-08-15 entry above | — |
| BLE phone-app↔micro:bit | Never attempted | App's own BLE code (`src/ble/`) never run |
| Servo control | Never attempted | PCA9685 now owned/wired (`docs/PRD.md` §8) but never driven |
| Closed-loop tracking | Never attempted | All of the above |

Servo control and closed-loop tracking remain fully untested — the 2026-08-15 BLE entry above
proved the bench-level radio link and firmware, not the app's own integration or anything
servo-related.
