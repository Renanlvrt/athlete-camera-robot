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
| BLE phone↔micro:bit | Never attempted | `react-native-ble-plx` not installed |
| Servo control | Never attempted | PCA9685 not yet purchased (`docs/PRD.md` §8) |
| Closed-loop tracking | Never attempted | All of the above |

BLE, servo, and closed-loop tracking remain untested — nothing in the entry above touched robot
electronics at all.
