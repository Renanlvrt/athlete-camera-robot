# Your Steps — copy, paste, done

Everything **you** need to do. Nothing here needs thinking; copy each block into your
terminal in order. Total time: **about 10 minutes tonight.**

Open a terminal in the project folder first:

```
cd C:\Users\renan\Desktop\Side_projects\robot_athlete\athlete_camera_robot
```

---

# TONIGHT — before you leave (~10 min)

## Step 1 — Log in to GitHub  ⚠️ REQUIRED

Without this, the night agent **cannot trigger any builds** and half the night's work is
blocked. `gh` is already installed on your machine; it's just not logged in.

This one is interactive, so type it with the `!` prefix directly in Claude Code, or paste it
in your own terminal:

```
gh auth login
```

Answer the prompts:
- **What account?** → `GitHub.com`
- **Preferred protocol?** → `HTTPS`
- **Authenticate Git with your GitHub credentials?** → `Y` / Yes
- **How would you like to authenticate?** → `Login with a web browser`
- It shows a **one-time code** → copy it, press Enter, paste the code in the browser, click
  Authorize.

Verify it worked:

```
gh auth status
```

You want to see `✓ Logged in to github.com`.

## Step 1.5 — Hide your email from public commits (30 seconds, optional but recommended)

Your commits currently carry **`renan.lavirotte@gmail.com`**, and once pushed to a public repo
that is permanently in the git history — scrapers do harvest it. GitHub gives you a free
noreply alias.

Get your alias: **https://github.com/settings/emails** → tick *"Keep my email addresses
private"* → copy the `12345678+username@users.noreply.github.com` address it shows you.

Then paste this, replacing the address with yours:

```
git config user.email "YOUR_ID+YOUR_USERNAME@users.noreply.github.com"
```

That applies to future commits. The ~5 existing commits would keep the real address; if you'd
rather scrub those too, say so and I'll rewrite them before you push (easy now, much harder
after pushing).

Skip this if you don't mind the address being public — plenty of people don't.

## Step 2 — Create the repo and push  ⚠️ MUST BE PUBLIC

One command. It creates the repo, adds the remote, and pushes:

```
gh repo create athlete-camera-robot --public --source=. --remote=origin --push
```

> **Why public matters:** public repos get **free, unlimited** GitHub Actions macOS minutes.
> Private ones bill macOS at a **10× multiplier** against a small allowance, and a few 20-minute
> iOS builds would burn through it. This is the single assumption the whole no-Mac build
> strategy rests on. Keep it public.

Check it landed:

```
gh repo view --web
```

Your browser opens the repo. You should see all the files.

## Step 3 — Hand the brief to the other Claude

In the **other** Claude Code session, paste exactly this:

```
Read docs/NIGHT_LOOP_BRIEF.md in this repo and follow it completely.
That document is your full brief for tonight's unattended run.

Key points it will tell you, but to set expectations now:
- Do NOT start implementation until docs/DAY_AGENT_DONE.md exists and `git status` is clean.
  Until then, only plan, and write your plan to docs/NIGHT_LOOP_PLAN.md.
- Run with nohup, in acceptEdits permission mode. NOT --dangerously-skip-permissions.
- When you hit the token limit, wait for the ~5 hour reset and then CONTINUE. Do not stop
  until the success measures in section 2 of the brief are met.
- I will be away roughly 12-14 hours and cannot answer anything.
```

That's it. You're free for the night.

---

# TOMORROW MORNING — the hardware session

**Start here:** open `testing/MORNING_TEST_PLAN.md`. The night agent writes it specifically so
you can work down a checklist without thinking, with tests ordered to run in parallel where
possible.

Also read `docs/NIGHT_REPORT.md` (what got done) and `docs/NIGHT_DECISIONS.md` (choices it made
that want your sign-off).

Below is the setup you'll need regardless of how the night went.

## Get the app onto your iPhone (one-time, ~15 min)

### A. Download the build

```
gh run download --name unsigned-app-ipa
```

That drops `unsigned-app.ipa` into the current folder. (If it errors, no successful build
exists yet — check `docs/NIGHT_REPORT.md`.)

### B. Install AltServer on Windows — free

1. Go to **https://altstore.io** → download **AltServer for Windows**.
2. Install and run it. It lives in your system tray (bottom-right, may be under the `^` arrow).

> ⚠️ If you see anything about a **€1.50 subscription**, that's **AltStore PAL** — a completely
> different, EU-only product. You do not want it. **AltStore Classic + AltServer is free.**

### C. Pair your iPhone

1. Plug the iPhone into the PC by USB. Unlock it. Tap **Trust** if asked.
2. Make sure **iTunes** or the **Apple Devices** app is installed (AltServer needs Apple's USB
   driver): https://apps.microsoft.com/detail/9np83lwlpz9k
3. Tray icon → **Install AltStore** → pick your iPhone.
4. Enter your **free** Apple ID when prompted. A free account is fine.

### D. Enable Developer Mode on the iPhone

Settings → **Privacy & Security** → **Developer Mode** → **On** → restart the phone.

### E. Trust the certificate

Settings → **General** → **VPN & Device Management** → tap your Apple ID under
"Developer App" → **Trust**.

### F. Install the app

Open **AltStore** on the iPhone → **My Apps** → **+** (top-left) → pick `unsigned-app.ipa`.

Then open the app. **You should see a live camera preview.**

> After this first setup, AltServer re-signs the app **automatically over Wi-Fi** whenever your
> PC is on and on the same network. The free-Apple-ID signature expires every 7 days, so just
> leave AltServer running and you'll never think about it again.

## Hardware you still need to buy

**PCA9685 16-channel I2C PWM servo driver (~$7)** — **this blocks all servo work.** Nothing in
the gimbal-control path can be tested without it. Order it as early as you can:

https://www.amazon.com/HiLetgo-PCA9685-Channel-12-Bit-Arduino/dp/B01D1D0CX2

(Any equivalent I2C PCA9685 module works.)

## For the BLE bench test

One-time, so the laptop can talk to the micro:bit directly (this proves the link works before
the phone is involved — much easier to debug):

```
pip install bleak
```

Then flash `.claude/skills/ble-ping/scripts/microbit_ble_echo.py` onto the micro:bit using the
online editor at **https://python.microbit.org** (drag the downloaded `.hex` onto the MICROBIT
drive), unplug USB, and run:

```
python .claude/skills/ble-ping/scripts/bench_ping.py
```

---

# Security — what was checked before going public

Audited on 2026-08-09, before the first push:

| Check | Result |
|---|---|
| Secrets, API keys, tokens in tracked files | ✅ none found |
| `.env`, `.pem`, `.p12`, `.mobileprovision`, keystores | ✅ none present, and all now gitignored |
| Hardcoded local paths / personal data in code | ✅ none |
| `.gitignore` actually blocks secret file types | ✅ tested with dummy `.env` / `.p12` / `.mobileprovision` — all ignored |
| GitHub Actions token permissions | ✅ narrowed to `contents: read` |
| Your commit email | ⚠️ public unless you do Step 1.5 |

**Why this project is low-risk by design:** the whole pipeline is built so that **no signing
material ever touches the repo.** CI compiles unsigned; AltStore signs locally on your PC with
your Apple ID. There is no certificate, no provisioning profile, and no API key to leak. If a
`.p12` or `.mobileprovision` ever shows up in this folder, something has gone wrong.

**Two habits worth keeping:**
- Never paste an Apple ID password, app-specific password, or API token into any file here.
  Nothing in this project needs one.
- If you ever *do* commit a secret by accident, rotate it immediately. Deleting the file is not
  enough — it stays in git history forever.

# Quick reference

| What | Command |
|---|---|
| Fast local check (seconds) | `npm run typecheck` |
| Trigger a build | `gh workflow run build-ios-unsigned.yml` |
| Watch the build | `gh run watch` |
| See recent builds | `gh run list --limit 5` |
| Download the latest `.ipa` | `gh run download --name unsigned-app-ipa` |
| Open the repo in a browser | `gh repo view --web` |
| See what the night agent did | `git log --oneline` |

## If something goes wrong

1. `docs/NIGHT_REPORT.md` — the honest summary, including what didn't work.
2. `docs/VERIFICATION_REPORT.md` — everything ever actually tested, and its result.
3. `research/` — why each technical choice was made, with sources.

**One thing to know:** as of tonight, **nothing in this project has ever run on real hardware.**
Expect the first morning to involve real debugging. That's normal and it's planned for — that's
exactly what `testing/MORNING_TEST_PLAN.md` exists to make efficient.
