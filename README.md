# athlete-camera-robot — Milestone 1 setup

This is the code for **Milestone 1** from the project plan: get a live camera preview
running on the iPhone via a custom dev build (no Mac owned, built via GitHub Actions,
signed via Sideloadly with a free Apple ID). Person-detection (bounding boxes) is the
*next* milestone, not yet implemented.

Full background/decisions: see `docs/PRD.md`.
Repo organization rules (read this if you're an AI or new contributor): see `CLAUDE.md`.
Start browsing the code from `index.md`.

## What's in this folder
- Expo TypeScript project scaffolded, source under `src/` (see `src/index.md`).
- `react-native-vision-camera` + its required `react-native-nitro-modules` /
  `react-native-nitro-image` dependencies installed.
- `src/App.tsx` — composition root; requests camera permission and renders one
  of three screens (`src/screens/`) based on `src/hooks/useCameraSetup.ts`.
- `app.json` — camera permission strings, bundle identifiers, and the
  `react-native-vision-camera` Expo config plugin.
- `.github/workflows/build-ios-unsigned.yml` — builds an unsigned `.ipa` on a
  free GitHub-hosted macOS runner (bypasses EAS Build's paid-account
  requirement). **Not yet run for real — see `docs/VERIFICATION_REPORT.md`.**

## Steps to follow once you're at your laptop

### 1. Get the code onto your machine
- If you already created the empty GitHub repo from your phone: clone it, then copy
  all these files into it, commit, and push. **OR**
- If you haven't made the repo yet: create one on github.com, then push this folder to it.

```bash
cd athlete-camera-robot
git init                      # skip if you cloned an existing repo
git add .
git commit -m "Milestone 1: camera preview skeleton (reorganized + verified)"
git remote add origin <your-repo-url>   # skip if already set from clone
git push -u origin main
```

### 2. Install Node.js locally (if not already installed)
Download the LTS version from nodejs.org, then in the project folder:
```bash
npm install
```

### 3. Type-check (fast, catches most mistakes before you spend a build)
```bash
npm run typecheck
```

### 4. Sanity check in Expo Go first (fast, no build needed)
This won't show the camera (that needs the custom native module), but confirms the
basic project runs before you touch the CI pipeline:
```bash
npx expo start
```
Scan the QR code with the Expo Go app on your phone. You should see a blank/loading
screen (camera permission will fail in Expo Go — that's expected, ignore it for now).

### 5. Trigger the GitHub Actions build
- Push your code (step 1) if you haven't already — the workflow needs to be in the
  repo on GitHub to run.
- On github.com, go to your repo → **Actions** tab → **"Build unsigned iOS app (for
  Sideloadly)"** → **Run workflow** button → confirm.
- Wait for it to finish (10–20 minutes is normal for a first build).
- If it fails: click into the failed step and read the error. This workflow has
  never been run before (see `docs/VERIFICATION_REPORT.md`) — the most likely
  first failure is the `xcodebuild -scheme` name; the workflow file has a
  comment explaining how to find the correct one.

### 6. Download the build artifact
- Once the workflow succeeds, open the run, scroll to **Artifacts**, download
  `unsigned-app-ipa` (a zip containing `unsigned-app.ipa`).

### 7. Install Sideloadly on Windows
- Download from sideloadly.io, install, open it.
- Plug your iPhone into the PC via USB, trust the computer if prompted.

### 8. Sign and install
- Drag `unsigned-app.ipa` into Sideloadly.
- Enter your Apple ID (free account is fine) when prompted.
- Click Start. It signs the app and installs it on your phone.

### 9. Trust the developer certificate on the iPhone
- Settings → General → VPN & Device Management → tap your Apple ID under
  "Developer App" → Trust.
- (Developer Mode should already be on from the earlier phone-only step — if not:
  Settings → Privacy & Security → Developer Mode → on → restart.)

### 10. Open the app
You should see a live camera preview, full-screen, on your iPhone. **This is the
Milestone 1 finish line for Stage 3.** Person detection (bounding boxes) is the next
piece of work — not included yet.

## Remember
- The app's signature expires in **7 days** (free Apple ID limitation). To keep using
  it, just repeat steps 7–8 with the same ipa (no need to rebuild) — or rebuild first
  if you've changed the code.
- After the very first real CI run, update `docs/VERIFICATION_REPORT.md` and
  `.github/workflows/index.md` with what actually happened.
