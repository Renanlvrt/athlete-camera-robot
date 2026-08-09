# PRD: Athlete-Tracking Camera Robot

## 0. How to read this document
This is a living project spec for a physical robot + companion phone app that films an athlete
(basketball, running, track, tennis, etc.) by tracking them with computer vision and steering a
camera to follow them. It's written so an AI assistant with no prior context on this project can
pick it up and be productive immediately. Decisions marked **DECIDED** are locked in; decisions
marked **FUTURE / STRETCH** are explicitly deferred and should not be implemented yet unless the
user asks. Anything not covered here should be treated as an open question — ask the user, don't
assume.

---

## 1. Project Summary

A wheeled robot holds a smartphone on a 2-axis gimbal. The phone's camera + on-phone computer
vision detects an athlete during their sport and the robot reorients (initially just the camera
gimbal, later the whole base) to keep them framed, producing hands-free sports footage.

**Current physical state:** all 3D-printed mechanical parts are built. Electronics are partially
wired (motors + servos physically connected). Software has not been started.

---

## 2. Hardware Architecture — DECIDED

### 2.1 Mechanical layout
- **Base:** 4 wheels.
  - 2 rear(ish) wheels driven by 2 DC motors (drive/propulsion).
  - 2 front wheels linked to a single steering servo (Ackermann-style direction control).
- **Tower:** a mast rising from the base, topped with a 2-axis gimbal that holds the phone.
  - **Servo A — "roll" axis:** rotates the phone around the lens axis (like tilting the horizon /
    switching between landscape and portrait framing).
  - **Servo B — "pitch" axis:** tilts the phone up/down (nodding motion), for framing based on
    subject height/distance.
  - Together these 2 servos are referred to as **the gimbal**.
- **Total actuators:** 2 DC motors (drive) + 3 servos (1 steering + 2 gimbal).

### 2.2 Electronics stack
- **Brain:** BBC micro:bit.
- **Motor/servo carrier board:** SparkFun **moto:bit** — plugs onto the micro:bit, provides:
  - 2 screw-terminal motor outputs (used for the 2 drive motors).
  - 2 servo headers (used for the 2 gimbal servos: roll + pitch).
  - A **Qwiic (I2C) connector**, confirmed present on the user's exact board.
- **Servo expansion:** a **PCA9685 16-channel I2C PWM driver** board (not yet purchased) connects
  to the moto:bit's Qwiic/I2C port. This is needed because the moto:bit only exposes 2 servo
  channels but the robot has 3 servos (2 gimbal + 1 steering). The PCA9685 gives 16 channels, so
  all 3 servos can be driven from it if convenient, or it can be used just for the steering servo
  while the gimbal servos stay on the moto:bit's native headers — implementation detail, either
  wiring works electrically.
  - Purchase link (any equivalent I2C PCA9685 module works): HiLetgo PCA9685 16-Channel PWM
    Servo Driver — https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2
- **Spare/unused hardware:** an ELEGOO UNO R3 "Most Complete Starter Kit" is owned but is **not**
  part of the primary electronics design. It's a spare/backup only. (It was originally considered
  for the steering servo, but the PCA9685 approach keeps everything on one microcontroller
  instead, which is simpler.)
- **Power:** a **dedicated battery/power bank** powers the micro:bit + motors + servos —
  independent from the phone's battery. The phone must never be relied on to power the
  electronics (current draw from motors is unsuitable for a phone's power output, and it would
  drain the phone needed for filming). A 3D-printed mount for the power bank is planned.

### 2.3 Phone ↔ Robot communication link — DECIDED
- **Bluetooth Low Energy (BLE)**, phone directly to the micro:bit (micro:bit has built-in BLE).
- Rationale: BLE latency for small command packets (~20–50ms) is negligible compared to the CV
  processing latency, which will dominate the control loop. A wired tether was considered and
  rejected — it would restrict the gimbal's rotation range and add mechanical wear at the
  rotating joint every time the camera moves.
- Message format / GATT service design: **not yet specified** — this is an implementation detail
  to be defined when BLE code is written. At minimum it needs to carry: gimbal roll angle, gimbal
  pitch angle (Phase 1), and later steering angle + drive motor speed (Phase 2+).

---

## 3. Software Architecture — DECIDED

### 3.1 App platform
- **React Native + Expo.**
- Rationale: the developer has a Windows PC and only occasional/borrowed access to a Mac (not
  reliably available). Expo's toolchain lets nearly all development happen from Windows.
- Key native modules expected to be needed (implementation phase, not yet installed):
  - `react-native-vision-camera` — camera access + real-time frame processing for CV.
  - `react-native-ble-plx` — BLE communication with the micro:bit.
  - An on-device person-detection model (e.g. a TFLite or Core ML model via a frame-processor
    plugin) — specific model choice is an open implementation question, not decided yet.

### 3.2 Build & deployment pipeline (no-Mac-owned workflow) — DECIDED
This was the trickiest constraint to solve and is worth preserving exactly:

- **Problem:** Expo's own cloud build service (EAS Build) will build an iOS **simulator** binary
  for free, but building a real-device (arm64, physical iPhone) `.ipa` through EAS requires a
  paid Apple Developer Program account ($99/year) or credentials from one — even though the
  underlying compiler (Xcode) itself doesn't require payment to just *compile* code.
- **Solution:** bypass EAS Build's own device-build step; do the equivalent build manually on a
  **free GitHub Actions macOS runner** instead:
  1. Push the Expo project to a GitHub repo (public repos get free/unlimited macOS Actions
     minutes; private repos get a limited free monthly allowance).
  2. A GitHub Actions workflow runs on a macOS runner (GitHub-hosted, includes Xcode, free — no
     Mac of the developer's own needed) and runs `expo prebuild` then `xcodebuild archive` with
     code signing **disabled** — this step never touches any paid-account-gated Apple service.
  3. The workflow exports a raw **unsigned `.ipa`** file as a downloadable build artifact.
  4. On the Windows PC, **Sideloadly** (a free Windows/Mac tool) signs that unsigned `.ipa` using
     the developer's ordinary **free Apple ID** and installs it on the iPhone directly over USB.
- **Trade-off of this free path:** a free Apple ID's signature expires every **7 days**, so the
  app needs to be re-signed via Sideloadly roughly weekly (a ~2 minute task: plug in phone, click
  Start). There's also a 3-app sideload limit on the phone at once, which is a non-issue here
  (only one app is being installed). This is considered acceptable for active development.
- **Upgrade path (optional, later):** if the weekly re-sign becomes annoying, or the app needs to
  be shared/distributed to someone else for testing, paying for the $99/year Apple Developer
  Program removes the 7-day expiry (signs for a full year) and unlocks TestFlight. **Not needed
  for MVP.**
- The exact GitHub Actions workflow YAML has not been written yet — this is an implementation
  task for later, not part of this planning doc.

### 3.3 Target device
- Developer's phone: **iPhone 16** (non-Pro). No LiDAR — CV approach must work from plain RGB
  camera input only, not depth sensing.

---

## 4. Computer Vision — DECIDED (MVP) + FUTURE

### 4.1 MVP tracking target
- **Generic person detection with bounding boxes.** Not pose/skeleton tracking (unnecessary
  complexity for "keep the subject framed"), not ball detection (much harder problem — fast
  small object, motion blur, needs a specialized/custom-trained model).
- **FUTURE / STRETCH:** ball detection + trajectory prediction (e.g. to anticipate a basketball
  shot). Explicitly deferred — do not build this until the base person-tracking pipeline works
  end-to-end.
- **FUTURE / STRETCH:** full pose/skeleton tracking (useful later for form analysis or fall
  detection, not needed for basic framing).

### 4.2 Multi-athlete handling (rough MVP behavior) — DECIDED, intentionally loose
The user explicitly wants a rough MVP here, not a polished solution:
- At the start of a filming session, the user **types in the number of athletes** being filmed.
- While filming, the system should detect/show **at least half of the athletes** in frame at any
  given time (rough heuristic, not a hard guarantee).
- Of the athletes currently visible, the robot **locks tracking onto one primary athlete at a
  time** (i.e. the gimbal follows one chosen bounding box, not an average of several).
- Exact logic for *which* athlete gets locked (e.g. largest/closest bounding box) is an
  implementation detail to settle when this part is built — treat as flexible for MVP.
- **FUTURE / STRETCH — explicitly logged for later, not to be built now:**
  - Tap-to-select the athlete on screen before starting a session.
  - Re-identification by clothing color/appearance (to keep tracking the same person specifically
    even if they leave and re-enter frame, or to distinguish teammates in similar uniforms).

### 4.3 Performance telemetry + scoring feedback — FUTURE / STRETCH
Surfaced during Live Tracking screen UI design (mockup exploration, not implementation). Not
scoped for MVP and **must not be implemented until the user explicitly asks**, per §0's rule for
FUTURE items — this entry exists so the idea isn't lost, not as a green light to build it.
- **Speed + vertical jump readout:** live telemetry display (e.g. sprint speed in mph, vertical
  jump height in inches) shown during tracking, styled like a broadcast/radar-gun readout
  (bold tabular digits, high-contrast, legible at a glance/distance/angle — consistent with this
  device's outdoor, glanced-at-rather-than-watched usage pattern).
  - Reference precedent: HomeCourt (NEX Team) already ships this class of feature on a single
    phone camera — release angle, vertical leap, and player speed via computer vision, no
    additional hardware. Worth reviewing their approach if/when this is built.
  - Requires: pose/motion analysis beyond MVP's plain bounding-box detection (§4.1), plus a
    calibration approach for converting pixel motion to real-world speed/height (camera
    distance/angle assumptions — not yet designed).
- **Scoring / make detection:** e.g. detecting a basketball made shot and showing a celebratory
  "+2"-style animation with a running point tally.
  - Depends on ball detection + hoop/goal recognition, which §4.1 already flags as a *much
    harder* CV problem than person detection (fast small object, motion blur, needs a
    specialized/custom-trained model) — this is downstream of that stretch goal, not
    independent of it.
- Explicitly **not** required for Phase 1 gimbal-tracking MVP (§5.1) to be considered complete.

---

## 5. Control Logic / Motion — DECIDED (MVP) + phased roadmap

### 5.1 MVP scope: Phase 1 — gimbal-only tracking
- **The wheeled base does not move at all in v1.** Only the 2 gimbal servos (roll + pitch) move,
  to keep the locked-on athlete centered/well-framed in the shot.
- Rationale: this proves out the full pipeline (CV → BLE → servo control) with zero collision
  risk or drivetrain complexity, before adding a moving base into the mix.
- **Steering algorithm for the gimbal:** start with **simple proportional control** — the further
  the athlete's bounding box is from center, the faster/larger the corrective servo movement.
  Full PID control is a **future refinement**, not needed for MVP (the user does not yet know the
  system's real-world behavior well enough to tune a PID controller meaningfully).

### 5.2 FUTURE — Phase 2: base following
- Once gimbal-only tracking works, add basic movement of the wheeled base — e.g. driving forward/
  backward to maintain distance from the athlete, and/or steering to keep the gimbal's pan angle
  within a comfortable range (so the camera isn't constantly cranked to one side).
- Not scoped in detail yet — to be revisited after Phase 1 is working.

### 5.3 FUTURE — Phase 3: cinematic movement
- The longer-term creative goal: have the robot circle/orbit around the athlete or court for more
  dynamic, cinematic shots (not just "point camera at subject"), while maintaining a safe
  distance and avoiding collisions.
- This is the user's eventual "main goal" for the project's feel, but is explicitly **not** part
  of the MVP and depends on Phase 2 (base following) being solid first.

### 5.4 FUTURE — Phase 4 (stretch, unordered)
- Ball detection + trajectory prediction (see §4.1).
- Full pose tracking (see §4.1).
- Obstacle/collision avoidance.
- Refined multi-athlete selection (tap-to-select, re-identification — see §4.2).

---

## 6. Explicit Non-Goals for MVP
To keep scope tight, the following are **not** part of the initial build and should not be
implemented unless the user asks:
- Any base/wheel movement (Phase 1 is gimbal-only).
- PID control (proportional control only for now).
- Ball tracking or pose tracking.
- Sophisticated athlete re-identification or manual subject selection UI.
- App Store distribution / TestFlight / paid Apple Developer account.
- Performance telemetry (speed/vertical jump readouts) or scoring/make-detection animations —
  see §4.3. UI for these was mocked up for direction-setting only; do not build the underlying
  detection or data pipeline without an explicit ask.

---

## 7. Open Questions (not yet decided — flag to user if relevant work comes up)
- Exact BLE GATT message format/protocol between phone and micro:bit.
- Which specific on-device person-detection model/library to use in the frame processor.
- Exact wiring split of the 3 servos across the moto:bit's native headers vs. the new PCA9685
  (electrically either works; not yet chosen).
- Logic for *which* athlete becomes the "locked" one when several are visible.
- GitHub Actions workflow YAML for the unsigned-build pipeline (needs to be written).

---

## 8. Bill of Materials status
**Already owned:**
- 3D-printed chassis, wheels, steering assembly, gimbal tower (fully built).
- 2x DC drive motors, 1x steering servo, 2x gimbal servos (roll + pitch) — physically wired.
- BBC micro:bit.
- SparkFun moto:bit carrier board (confirmed has Qwiic/I2C breakout).
- ELEGOO UNO R3 Most Complete Starter Kit (spare/backup, not in primary design).
- iPhone 16 (non-Pro) — the camera + CV + control app device.

**Needed:**
- PCA9685 16-channel I2C PWM servo driver (~$7) — see link in §2.2.
- Dedicated battery/power bank for robot electronics (separate from phone).
