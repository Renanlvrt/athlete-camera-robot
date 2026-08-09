# Morning Test Plan

Written by the night-shift agent, 2026-08-09, for the first hardware session. Work down this
checklist top to bottom — it's ordered so the highest-value, most-blocking items come first,
and it marks explicitly which tracks can run at the same time so nothing sits idle waiting on
something else.

**Read `docs/NIGHT_REPORT.md` first if you haven't** — it says what changed overnight. The one
fact that changes everything below: **the CI build now works.** `.github/workflows/build-ios-unsigned.yml`
ran green 3/3 attempts overnight (`docs/VERIFICATION_REPORT.md`, "CI workflow ran green, first
attempt, twice"). Getting the app onto your phone is no longer blocked on anything except doing
the AltStore setup — start there.

---

## 0. What's ready vs. what isn't (read this before picking a section)

| Section below | Status | Blocked by |
|---|---|---|
| §3 Install the app | ✅ **ready now** | Nothing — CI is green, an artifact exists |
| §4 On-device screen check | ✅ **ready now** | §3 (needs the app installed) |
| §5 BLE bench test (laptop↔micro:bit) | ✅ **ready now** | Nothing — doesn't need the phone at all |
| §6 BLE phone test | ❌ **not runnable yet** | `src/ble/` doesn't exist in the app yet — checked directly, `src/` currently has no BLE code at all. This is app-feature work, not a test-plan gap. Do not attempt until a coding session has added a BLE screen/hook. |
| §7 CV framerate test | ⚠️ **needs a coding step first** | `scripts/FrameTimingScreen.tsx` exists and is verified against the real VisionCamera v5 API, but nothing wires it into `src/App.tsx` yet. An agent needs to do that temporary wiring (5 min) before this test can run — see §7. |
| §8 Servo bounds test | ❌ **hard-blocked** | **PCA9685 not yet purchased** (`docs/PRD.md` §8). Nothing servo-side can be tested without it. Order it now if you haven't: https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2 (~$7, a few days shipping). §8 below still has prep you can do without the board. |

So: **§3, §4, §5 are the real morning work.** §6 needs app code written first. §7 needs one
small temporary edit first. §8 needs a part in the mail.

---

## 1. Prerequisites checklist

Physical:
- [ ] iPhone 16, charged, unlocked, USB cable
- [ ] Windows PC, this repo checked out, on the same Wi-Fi network you'll use day-to-day (AltServer's Wi-Fi re-sign needs this)
- [ ] BBC micro:bit + its USB cable
- [ ] Robot's dedicated battery/power bank, charged (only needed once you reach §8 — not needed for §3–§5)
- [ ] Multimeter, if you have one (optional, only useful for §8's voltage measurement)

Software/accounts:
- [ ] A free Apple ID (any iCloud account works — no paid Developer Program needed)
- [ ] AltServer for Windows: https://altstore.io → **AltServer for Windows** (not "AltStore PAL", see the naming trap in §3)
- [ ] iTunes or the Apple Devices app (AltServer needs Apple's USB driver): https://apps.microsoft.com/detail/9np83lwlpz9k
- [ ] Python 3 + `pip install bleak` (for the BLE bench test, §5)
- [ ] `gh` CLI authenticated (`gh auth status`) — already done as of tonight, shouldn't need re-doing

**Loudly flagged, since it blocks a whole section:** PCA9685 16-channel I2C PWM servo driver —
**not yet purchased.** See §0 and §8.

---

## 2. Suggested timeline (two tracks, run them concurrently)

```
 Track A (phone)                          Track B (micro:bit / laptop)
 ───────────────────────────────────      ───────────────────────────────────
 §3 Download .ipa, install AltServer,     §5.1 Flash microbit_ble_echo.py
 pair phone, install app        ~15 min   (python.microbit.org, drag .hex)  ~5 min
        │                                          │
        ▼                                          ▼
 §4 Check the 3 on-device screen states    §5.2 Run bench_ping.py from the
 (permission / no-camera / preview) ~5 min  laptop, 20 pings              ~5 min
        │                                          │
        └───────────────┬──────────────────────────┘
                         ▼
              Both done — write up §5's and §4's results together
              in REAL_HARDWARE_TEST_LOG.md                          ~10 min
                         │
                         ▼
              §7 CV framerate test (needs one coding step first,
              then a ~15-20 min CI round, then a 5+ min soak)   ~30-40 min
```

Total for everything actually runnable this morning (§3–§5, §7): **~60-75 minutes**, most of it
either waiting on a download/build or a 5-minute soak you don't have to watch closely. §6 and §8
are blocked (see §0) — don't block your morning on them.

---

## 3. Install the app on the iPhone

**Time-box: 15 min. Abort condition:** if AltServer can't see the phone after 5 minutes of
troubleshooting USB/trust prompts, stop and note exactly which step failed — don't fight it
past that, it's almost always the USB driver or a missed "Trust This Computer" prompt, both
fixed faster on a second attempt than by persisting.

1. Download the artifact:
   ```
   gh run download --name unsigned-app-ipa
   ```
   Or run `.claude/skills/build-unsigned-ipa/scripts/verify_artifact.py --run-id <id>` first if
   you want the automated sanity checks re-run — see `docs/NIGHT_REPORT.md` for the run IDs
   already verified overnight (no need to trigger a new build unless you've changed something).
2. Install AltServer for Windows, run it (system tray, may be under the `^` overflow arrow).
   > ⚠️ **Naming trap:** searching "AltStore" surfaces a €1.50/month subscription product. That's
   > **AltStore PAL**, a different EU-only app. You want **AltStore Classic + AltServer** — free.
3. Plug the iPhone in by USB, unlock it, tap **Trust** if prompted.
4. Tray icon → **Install AltStore** → pick your iPhone → enter your free Apple ID.
5. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** → restart the phone.
6. **Settings → General → VPN & Device Management** → tap your Apple ID under "Developer App" →
   **Trust**.
7. Open **AltStore** on the phone → **My Apps** → **+** → pick `unsigned-app.ipa`.
8. Open the app.

**Expected result:** the app opens to a camera permission prompt, then (once granted) a live
camera preview.

**Predicted failure modes:**
| Symptom | Likely cause | Fix |
|---|---|---|
| AltServer tray icon never sees the phone | Missing Apple USB driver | Install iTunes or the Apple Devices app (link in §1), replug |
| "Trust This Computer" never appears | Phone was locked during plug-in | Unlock the phone, replug |
| App installs but crashes instantly on open | Missing Info.plist usage-description string for a new permission, or a native-module init failure | Check the crash log in Settings → Privacy & Security → Analytics & Improvements → Analytics Data, filename starts with the app name. Compiling clean in CI (which happened) doesn't guarantee a clean runtime init — this is exactly the gap CI can't see. Report the crash log content in your test log entry so it can be diagnosed. |
| "Unable to Install" / untrusted developer | Step 6 skipped or done before install | Redo step 6 after installing, then reopen the app |
| Free Apple ID 7-day signature expiry | Expected behavior, not a bug | AltServer re-signs automatically over Wi-Fi as long as it's running on this PC and the phone's on the same network |

**Report back** (append to `testing/REAL_HARDWARE_TEST_LOG.md`, template at the top of that
file): did it install, did it open, did the camera permission prompt appear, did the preview
render. Any crash log content verbatim.

---

## 4. On-device screen-state check

Closes `docs/VERIFICATION_REPORT.md`'s open item #3 ("Confirm the three `useCameraSetup` states
are reachable on-device"). Depends on §3.

**Time-box: 5 min. Abort condition:** none — this is quick and low-risk; if something's wrong
it's informative either way.

1. **Permission-required screen**: on first launch, before granting camera permission, confirm
   `src/screens/PermissionRequiredScreen.tsx`'s UI is what's shown.
2. **Camera-preview screen**: after granting permission (and assuming the iPhone 16 has a usable
   camera device, which it will), confirm `src/screens/CameraPreviewScreen.tsx` shows a live feed.
3. **No-camera-device screen**: harder to trigger deliberately on a real iPhone (it has a
   camera). Skip forcing this one — note it as "not exercised, no camera-less device available"
   rather than guessing.

**Report back:** which screens were actually seen, whether the preview was smooth or laggy at a
glance (a real measurement comes later in §7), any visual glitches (safe-area insets, notch
overlap — this app has never been seen on a physical notch/Dynamic Island before).

---

## 5. BLE bench test (laptop ↔ micro:bit)

Runs `.claude/skills/ble-ping/`. Doesn't need the phone — can run in parallel with §3.
**Time-box: 10 min. Abort condition:** if the micro:bit never appears in the scan after a
reflash and a fresh battery/USB power cycle, stop and report it as a hardware issue rather than
retrying the script more than 2-3 times — a scan failure this basic is not a script bug.

1. Flash `.claude/skills/ble-ping/scripts/microbit_ble_echo.py` via https://python.microbit.org
   (drag the downloaded `.hex` onto the MICROBIT USB drive). Confirm the display shows a `B`.
2. Unplug USB (BLE and USB serial can interfere — see the skill's Notes section).
3. `pip install bleak`, then:
   ```
   python .claude/skills/ble-ping/scripts/bench_ping.py
   ```
4. It sends 20 pings and prints round-trip latency for each plus a summary.

**Expected result:** `ACK:PING` for all 20, latency ~20-80 ms.

**Predicted failure modes** (from the skill's own interpretation table, repeated here so you
don't have to flip files):
| What you see | What it means |
|---|---|
| Device never found in scan | Not advertising — reflash, check for the `B` on the display |
| Connects then immediately drops | Usually power — see `research/hardware/power-brownout-risk.md` (though at bench scale, with no servos attached yet, this would be surprising — more likely a fresh-flash glitch, retry once) |
| Connects, no echo | Link is up, program logic is wrong — a useful half-result, not a failure to panic over |
| Latency > 200 ms or wildly variable | Interference, or the micro:bit is busy — note it, it constrains the control loop's send rate |

**Also record:** micro:bit revision (v1 or v2 — check the back of the board). v1 has much less
flash for the BLE stack and this matters for later feature work.

**Report back:** found/connected/echoed, latency min/median/max over the 20 pings, whether the
link survived 60s idle without dropping, board revision. Use the template in
`testing/REAL_HARDWARE_TEST_LOG.md`.

---

## 6. BLE phone test — NOT RUNNABLE YET

`.claude/skills/ble-ping/`'s "phone test" stage needs `react-native-ble-plx` wired into an
actual screen/hook in the app (a `src/ble/` module or equivalent). **That code does not exist
yet** — checked directly against `src/` on 2026-08-09, only `App.tsx`, `hooks/`, `screens/`,
`theme/`, and `tracking/` exist. This isn't a testing gap, it's unbuilt app functionality.

**Don't attempt this section.** Once BLE app code exists in a future session, this section
should be filled in with real steps — until then, skip straight to §7 or stop for the morning
after §3-§5.

---

## 7. CV framerate test (needs one small edit first)

Runs `.claude/skills/cv-framerate-test/`. **Prerequisite step, do this first:** ask whichever
Claude Code agent you have running to temporarily wire
`.claude/skills/cv-framerate-test/scripts/FrameTimingScreen.tsx` into `src/App.tsx` as the
active screen (the skill's own §"Procedure" step 1 describes this — it's meant to be temporary,
removed afterward per `CLAUDE.md` §2, so don't let it linger as a second permanent screen).

**Time-box: ~35 min total** (a CI round is ~15-20 min, then a mandatory 5-minute soak, plus
install time). **Abort condition:** if Stage 1 (empty frame processor, no model) itself fails to
build or crashes on open, stop immediately and don't proceed to Stage 2 — see the predicted
cause below. Debugging with the model also in the mix at that point wastes time.

1. Confirm the temporary wiring above is in place, commit it on a scratch/local basis if you
   want a clean revert point.
2. Build via `.claude/skills/build-unsigned-ipa/scripts/trigger_build.py` (now proven to work,
   see `docs/NIGHT_REPORT.md`), install via AltStore (§3's steps).
3. Point the camera at a normal scene, **let it run for at least 5 minutes** — a 30-second test
   proves nothing; this is a thermal problem more than a compute one
   (`research/computer-vision/frame-budget.md`).
4. Read the on-screen stats: current ms, rolling median, p95, worst frame — **at both the
   1-minute and 5-minute marks**, so the throttling delta is visible.
5. **Afterward: remove the temporary `src/App.tsx` wiring.** Don't leave a test screen in the
   composition root.

**Interpreting the result** (from the skill):
| Sustained median | Verdict |
|---|---|
| ≤16 ms | Comfortable headroom |
| 16-33 ms | Fine — holds the 30fps MVP target |
| 33-66 ms | Run the detector every 2nd frame; tracking degrades gracefully |
| >66 ms | Something's wrong — check the CoreML delegate is actually engaged before blaming the phone |

**Predicted failure mode:** if Stage 1 fails to build at all, the cause is almost certainly the
worklets packages — v5 uses `react-native-worklets`, **not** `react-native-worklets-core`, and
most tutorials online say the latter (`CLAUDE.md` §4.1). These packages are already installed
(day agent's SM-2 work, verified in tonight's CI runs) — so a build failure here would be a
genuinely new problem, not this known footgun. Check `references/common-failures.md` under
`.claude/skills/build-unsigned-ipa/` first regardless.

**Report back:** Stage 1 and Stage 2 numbers separately, median/p95/worst at 1 min and 5 min,
whether the preview stayed smooth, phone temperature/battery drop, model file + input
resolution used.

---

## 8. Servo bounds test — blocked on the PCA9685

`.claude/skills/servo-bounds-test/`. **Cannot run at all until the PCA9685 arrives** (PRD §8,
~$7, https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2). If you
haven't ordered it, do that now — it's the single biggest thing standing between tonight's
software progress and any real gimbal test.

**What you *can* prep today, without the board:**
- [ ] Get the robot onto a stand with the wheels off the ground (required before any servo test
      — Phase 1 is gimbal-only, drive motors must stay unpowered per `docs/PRD.md` §5.1/§6).
- [ ] Remove the phone from the gimbal mount if it's currently attached — the servo sweep script
      deliberately drives toward mechanical limits and you don't want the phone on it for the
      first run.
- [ ] Locate the battery disconnect and confirm it's within reach — you'll want this the moment
      the PCA9685 test starts, not five minutes into it.
- [ ] Read `research/hardware/pca9685-servo-control.md` and
      `research/hardware/power-brownout-risk.md` once, so the centiseconds footgun and the
      brownout failure chain are fresh when the board does arrive.

Once the board is wired in, follow `.claude/skills/servo-bounds-test/SKILL.md` directly — it's
a complete, ready-to-run procedure (safety checklist, sweep controls, brownout stress steps,
exactly what to report). Nothing here duplicates it; this section exists only to flag the
blocker loudly and bank the prep work that doesn't need the part.

---

## 9. After this session

- Update `testing/REAL_HARDWARE_TEST_LOG.md` with every result, including partial/failed ones —
  see that file's entry template.
- Flip any `⚠️ needs verification` tags to `✅` or `❌` in the relevant `index.md` files
  (`src/hooks/index.md`, `src/screens/index.md` for §4; `.claude/skills/ble-ping/index.md` for
  §5; `.claude/skills/cv-framerate-test/index.md` for §7) — only for what you actually observed.
- If §6 or §8 stayed blocked, that's expected and fine — they were flagged as blocked going in.
