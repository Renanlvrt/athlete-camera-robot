# athlete-camera-robot — Milestone 1 setup

Code for **Milestone 1**: get a live camera preview running on the iPhone via a custom
dev build — no Mac owned, built on a free GitHub Actions macOS runner, signed with a
free Apple ID. Person detection is the *next* milestone, not yet implemented.

Full background/decisions: `docs/PRD.md`.
Repo rules (read this if you're an AI or a new contributor): `CLAUDE.md`.
Start browsing the code from `index.md`.

> **⚠️ None of the steps below have ever been run end to end.** The CI workflow has
> never executed; no build has ever reached the phone. Expect to debug. When you do,
> record what happened in `docs/VERIFICATION_REPORT.md` and
> `testing/REAL_HARDWARE_TEST_LOG.md` — that's how the next person avoids your dead ends.

## Everything here is free

| | Cost |
|---|---|
| GitHub Actions macOS runners | **$0** — free *and unmetered* on **public** repos |
| AltStore Classic + AltServer | **$0** |
| Free Apple ID signing | **$0** — costs friction (7-day certs), not money |
| Apple Developer Program | **not needed** |

The only spend in the whole project is hardware: the PCA9685 (~$7) and a power bank.

**Keep the repo public.** Private repos bill macOS runners at a 10× multiplier against a
limited allowance, which a few 20-minute iOS builds can exhaust.

## What's in this folder

- Expo TypeScript project, source under `src/` (see `src/index.md`).
- `react-native-vision-camera` v5 + its `react-native-nitro-modules` /
  `react-native-nitro-image` dependencies.
- `src/App.tsx` — composition root; requests camera permission and renders one of three
  screens based on `src/hooks/useCameraSetup.ts`.
- `app.json` — camera permission strings and bundle identifiers. Note: VisionCamera v5
  ships **no Expo config plugin**; permissions go in `ios.infoPlist` directly.
- `.github/workflows/build-ios-unsigned.yml` — builds an unsigned `.ipa` on a free
  macOS runner.
- `research/`, `testing/`, `.claude/` — see `index.md`.

---

## Steps

### 1. Push to a public GitHub repo

The pipeline is "push → Actions → artifact," so nothing works until this is done.

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

The repo is already initialized with a baseline commit.

### 2. Install Node.js and dependencies

LTS from nodejs.org, then:

```bash
npm install
```

### 3. Type-check — the only fast feedback you have

```bash
npm run typecheck
```

Runs in seconds and catches most mistakes. Everything else costs a 15–20 minute CI
round, because **`expo prebuild --platform ios` cannot run on Windows at all** (verified
— see `research/phone-integration/expo-cng-constraints.md`). Use this gate constantly.

### 4. Trigger the build

On github.com: your repo → **Actions** → **"Build unsigned iOS app (for sideloading)"**
→ **Run workflow**.

10–20 minutes is normal for a first build. If it fails, the likely causes in order:

1. **Xcode scheme name.** The workflow derives it automatically and prints all available
   schemes in a diagnostic step — read that output rather than guessing.
2. **`npm ci` fails.** Almost always a `package-lock.json` not committed alongside a
   dependency change. Looks like an Xcode problem; isn't one.
3. **`expo prebuild` chokes on a config plugin.** One such bug was already found and
   fixed; see `docs/VERIFICATION_REPORT.md` (2026-08-09, item 5).

### 5. Download the artifact

Open the finished run → **Artifacts** → download `unsigned-app-ipa`.

### 6. Install AltServer on Windows

Download **AltStore Classic** from altstore.io and install AltServer.

> Ignore anything mentioning a subscription — that's **AltStore PAL**, a different
> EU-only product. AltStore Classic on Windows is free.

Plug the iPhone in via USB, trust the computer, then use AltServer to install AltStore
onto the phone. This is a one-time setup.

### 7. Sideload the app

Feed the unsigned `.ipa` to AltServer and sign it with your **free** Apple ID.

After this first USB install, AltServer refreshes the 7-day signature **over Wi-Fi**
automatically whenever the phone and PC are on the same network — so you shouldn't have
to think about expiry again. Keep AltServer running on the PC.

### 8. Trust the certificate on the iPhone

Settings → General → VPN & Device Management → tap your Apple ID under "Developer App"
→ Trust.

(Developer Mode: Settings → Privacy & Security → Developer Mode → on → restart.)

### 9. Open the app

You should see a full-screen live camera preview. **That's the Milestone 1 finish line.**

**Then, before doing anything else:** add an entry to
`testing/REAL_HARDWARE_TEST_LOG.md` — did all three permission/device states behave?
That file currently has zero entries, and this would be the first thing in this project
ever confirmed on real hardware.

---

## What's next

`docs/VERIFICATION_REPORT.md` → "Open items for the next contributor" has the ordered
list. In short: get this build working, then frame-processor timing
(`.claude/skills/cv-framerate-test/`), then BLE (`.claude/skills/ble-ping/`), then
servos, then close the loop.
