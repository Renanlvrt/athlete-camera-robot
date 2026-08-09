# CLAUDE.md — Operating Rules for This Repository

This project is edited by multiple AI agents (Claude and others) and multiple
people, often in parallel, often without shared context. This file is the
constitution that makes that safe. **Read this before touching any file.**
If you are an AI agent, treat every rule below as a hard constraint, not a
suggestion.

The project itself: `docs/PRD.md`. Read it before implementing anything —
it marks decisions as **DECIDED** or **FUTURE / STRETCH**; never build a
FUTURE item unless the user explicitly asks in the current conversation.

---

## 0. Skills-First Development (mandatory — read before Section 1)

This project uses Claude Code's **Agent Skills** system for every discrete, reusable piece of
work (build a pipeline step, test a hardware behavior, run a CLI check, etc.) instead of
writing one-off code inline in the main app or throwaway code in chat. This is a *different
system* from the `index.md` navigation rule in Section 1, and the two don't replace each
other: `index.md` is how an agent **finds its way** around the repo; a Skill is how an agent
**performs a repeatable task correctly, the same way, every time.** A skill folder contains
both.

### 0.1 Before doing ANY discrete task, check for an existing skill

Before writing implementation code for a specific, nameable capability — "build the unsigned
ipa," "ping the micro:bit over BLE," "sweep the gimbal servos," "measure CV frame time" —
look in `.claude/skills/`. If a skill already exists for it, **read its `SKILL.md` and use
it.** Do not re-implement the capability inline, and do not silently fork a slightly-different
version of it — if the existing skill doesn't quite do what's needed, update the skill itself
(and its `index.md`/registry entry) rather than writing a parallel one-off.

### 0.2 If no skill exists, create one first

If the task is a discrete, nameable, reusable capability and nothing in `.claude/skills/`
covers it:

1. Create `.claude/skills/<skill-name>/` — kebab-case, name describes the action
   (`build-unsigned-ipa`, not `ios-stuff`).
2. Write `SKILL.md` inside it. **The filename must be exactly `SKILL.md`** (all caps,
   that exact name) — this is what Claude Code scans for to auto-discover and load skills
   from this folder; a differently-named or differently-cased file will not be picked up.
   See §0.4 for the required format.
3. Write `index.md` inside it too, in the same format as every other `index.md` in this repo
   (Section 1) — this keeps the skill navigable the same way as any other folder, even though
   `SKILL.md` (not `index.md`) is the file Claude Code actually loads automatically.
4. Put any Python (or other executable) code the skill needs in a `scripts/` subfolder inside
   the skill's own folder. Never leave loose one-off scripts at the repo root, in `src/`, or
   only in chat output — if it's worth running, it's worth being a skill script.
5. Add a row for it in `.claude/skills/SKILLS_REGISTRY.md` (name, one-line purpose, path).
6. Only then implement or invoke the skill to actually do the task.

Not every task deserves a skill — a one-off exploratory experiment, or a change confined to
editing a single existing app file with no reusable behavior, doesn't need one. The test:
**would running this again, unchanged, later actually be useful?** If yes, it's a skill.

### 0.3 Skill folder anatomy (mandatory shape)

```
.claude/skills/<skill-name>/
├── SKILL.md            ← required, exact filename — Claude Code auto-loads this
├── index.md             ← required by Section 1's repo-wide rule — navigation, not auto-loaded
└── scripts/              ← all executable code for this skill lives here
    └── <script>.py
```

Optional, same as any Agent Skill, add only when actually needed:
- `references/` — docs Claude should read only when the task calls for that level of detail
  (keeps `SKILL.md` itself short).
- `assets/` — static files the skill produces or depends on (templates, fixtures, sample
  payloads).

### 0.4 `SKILL.md` format (required)

```markdown
---
name: <skill-name>              # matches the folder name exactly
description: >
  <One or two sentences: what this does AND when to use it. Be specific about triggering
  conditions, not just the abstract capability — e.g. not "handles BLE" but "connects to the
  micro:bit over BLE and sends/receives a test payload; use whenever verifying the phone-robot
  link is alive before testing anything downstream of it.">
---

# <Skill Title>

<Step-by-step instructions for actually performing the task. Point at `scripts/<file>.py` by
relative path rather than inlining large code blocks in this file — SKILL.md should stay
short; the implementation lives in scripts/.>
```

### 0.5 Where skills physically live

Project-level skills (specific to this robot/app) go in `.claude/skills/` at the repo root —
this is the location Claude Code auto-loads for anyone working in this repo, on any machine.
Do not create skill folders under `src/` or `docs/`; those keep their existing meaning from
Section 5's directory map.

### 0.6 High-priority skills for this project

Per the project's known risk areas (`docs/PRD.md` and the CV-implementation risk research),
these are worth creating **before** writing the corresponding feature code inline, since each
one directly de-risks a documented failure mode:

| Skill | What it does | Risk it addresses |
|---|---|---|
| `build-unsigned-ipa` | Triggers the GitHub Actions macOS build and confirms the artifact downloads. | No-Mac pipeline / Xcode drift — catch failures here, not mid-feature-work. |
| `ble-ping` | Minimal connect + send/receive a dummy payload to the micro:bit over BLE. | Validates the phone↔micro:bit link independent of any CV or control code. |
| `servo-bounds-test` | Sweeps gimbal roll/pitch servos to their limits from the micro:bit side. | Confirms no BLE brownout / power issue before wiring in live tracking. |
| `cv-framerate-test` | Runs a dummy TFLite model through a Frame Processor, logs per-frame timing. | Proves the real device hits the 16–33ms frame budget before building the real model on top. |

Go to real hardware with each of these as early as possible — per the project's own
sim-to-real-gap concern, a skill that only "works" against a simulator or a bench mock isn't
done until it's been run against the actual iPhone/micro:bit.

---

## 1. The Index System (mandatory)

**Every directory in this repo, with no exception, contains an `index.md`.**
This is how an AI with zero prior context finds its way through hundreds of
files without reading all of them.

### 1.1 What an `index.md` must contain

```markdown
# <folder path> — index

<One paragraph: what this folder is responsible for, and what it is
explicitly NOT responsible for.>

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `Foo.tsx` | file | Renders X | ✅ verified |
| `bar/` | folder | Everything related to Y — see `bar/index.md` | ✅ verified |

## Depends on
<Which other folders/files this folder's code imports from. If none, say "Nothing outside this folder.">

## Depended on by
<Which other folders import from this one, if known. "Unknown" is acceptable but should be fixed when discovered.>
```

### 1.2 Status tags (use exactly these, nothing else)

| Tag | Meaning |
|---|---|
| ✅ verified | Builds/type-checks, matches `docs/PRD.md`, has been actually run or tested and the result is recorded in `docs/VERIFICATION_REPORT.md`. |
| ⚠️ needs verification | Exists, believed correct, but has NOT been run/tested — say exactly what is untested. |
| ❌ deprecated | Superseded. Must say *by what*, and nothing else in the repo may depend on it. Do not delete silently — mark it, then remove once nothing references it. |
| 🔜 planned | Referenced by the PRD as FUTURE/STRETCH. Does not exist yet. Do not build it preemptively. |

### 1.3 The update protocol (mandatory, every single change)

Any commit/edit that adds, removes, renames, or changes the responsibility
of a file **must, in the same change**:

1. Update the `index.md` of the directory that file lives in.
2. If a folder was added or removed, update the **parent** `index.md`'s
   `Contents` table too.
3. Update the root `index.md` only if a **top-level** folder was added or
   removed.
4. If the change makes a previously-`✅ verified` file stale (see §4), flip
   its status to `⚠️ needs verification` or `❌ deprecated` — do not leave a
   stale ✅.

**An index.md that is out of date is worse than no index.md** — it actively
misleads the next agent. If you are not willing to update the relevant
index.md files, you are not done with the task.

---

## 2. Naming Conventions (mandatory)

| Thing | Convention | Example |
|---|---|---|
| React component file | `PascalCase.tsx`, filename === the default export name | `CameraPreviewScreen.tsx` |
| Hook file | `useCamelCase.ts` | `useCameraSetup.ts` |
| Plain module / util file | `camelCase.ts` | `colors.ts` |
| Folder | `lowercase`, plural if it holds many similar things | `screens/`, `hooks/` |
| Type / interface | `PascalCase`, no `I` prefix | `CameraSetupResult` |
| Constant | `camelCase` for objects, `SCREAMING_SNAKE_CASE` only for true global magic numbers | `colors`, `MAX_ATHLETES` |

A file name must describe what the file *does*, not what stage/date it was
written in (no `AppV2.tsx`, `newCamera.ts`, `App_final.tsx`). If you are
replacing a file's approach, edit the file in place (and update its
`index.md` entry) — don't leave the old one next to it "just in case." Old
approaches live in git history, not in the working tree.

---

## 3. Single-Responsibility Rule (NASA/JPL-style)

Adapted from JPL's "Power of Ten" rules for this app-development context:

1. **One function does one thing.** If you're using "and" to describe what a
   function does, split it.
2. **One file exports one primary thing** — one component, one hook, or one
   tightly-related group of pure constants/types. `App.tsx` composes; it does
   not also style, fetch, or permission-check.
3. **No hidden control flow.** No function may reach outside its own
   parameters/closures to mutate state the caller can't see coming from the
   function's name and signature.
4. **Explicit types everywhere on public surfaces.** Every exported
   function/hook has a written return type; no relying on inference for
   anything another file imports.
5. **No silent failure.** A function that can fail returns a value/type that
   forces the caller to handle it (discriminated union, thrown typed error),
   never `undefined`-and-hope or a swallowed `catch`.
6. **Bounded, obvious control flow.** No recursion without an explicit,
   provably-terminating bound. Prefer a `switch` over an exhaustive
   discriminated union (as in `src/App.tsx`) over chained booleans/ternaries
   — it makes "did I handle every case" checkable by the compiler.
7. **Keep functions short.** If a function scrolls past one screen, it is
   probably doing more than one thing — extract.

Example of this rule applied in this repo: the old single `App.tsx` that
handled permissions, device lookup, AND three different render states was
split into `src/hooks/useCameraSetup.ts` (state only) and three screens in
`src/screens/` (render only), composed by a `src/App.tsx` that does nothing
but route. Follow this pattern for every future feature (BLE pairing screen,
athlete-count entry screen, tracking-lock UI, etc.) — one hook per concern,
one component per screen, a thin composition root.

---

## 4. Verification Protocol (mandatory before marking anything ✅)

"It compiles in my head" is not verification. Before marking a file or a
feature `✅ verified` in any `index.md`:

1. Run `npm run typecheck` (`tsc --noEmit`) and confirm zero errors.
2. Cross-check the change against `docs/PRD.md` — does it match a
   **DECIDED** item, and does it avoid building a **FUTURE / STRETCH** item
   that wasn't explicitly requested?
3. If the change touches native modules / config plugins / CI, actually
   check the current upstream documentation for that library — library APIs
   (e.g. Expo SDK version, `react-native-vision-camera`) change often enough
   that memory/training data is not sufficient. Search, don't assume.
4. Record what you tested and the result in `docs/VERIFICATION_REPORT.md`
   (append, don't overwrite — it's a running log). Include what you did
   **not** test and why (e.g. "no macOS runner available in this sandbox").
5. Only then set the status tag to ✅ in the relevant `index.md`.

**This is exactly the failure mode this file exists to prevent:** a file
implemented long ago, under different assumptions, that nobody re-verified,
quietly breaking the current build. See `docs/VERIFICATION_REPORT.md` for a
real example found in this repo (the missing `react-native-nitro-modules`
dependency and the missing Expo config plugin for the camera library).

---

## 5. Directory Map

```
athlete-camera-robot/
├── CLAUDE.md                 ← you are here
├── index.md                  ← root map, read this second
├── README.md                 ← human quickstart (build/sign/install steps)
├── .claude/
│   └── skills/                ← Section 0: one folder per reusable skill
│       ├── index.md
│       ├── SKILLS_REGISTRY.md ← human-readable table of every skill, keep in sync
│       └── <skill-name>/
│           ├── SKILL.md
│           ├── index.md
│           └── scripts/
├── docs/
│   ├── index.md
│   ├── PRD.md                 ← project spec / decisions log — source of truth for scope
│   └── VERIFICATION_REPORT.md ← running log of what was actually tested, and when
├── src/                       ← all application source (everything index.ts loads)
│   ├── index.md
│   ├── App.tsx                 ← composition root ONLY
│   ├── hooks/                  ← state/logic, no rendering
│   │   └── index.md
│   ├── screens/                ← rendering, no business logic
│   │   └── index.md
│   └── theme/                  ← shared style tokens
│       └── index.md
├── index.ts                  ← Expo entry point (must stay at repo root)
├── app.json                  ← Expo config, incl. native config plugins
├── package.json
├── tsconfig.json
└── .github/
    ├── index.md
    └── workflows/
        └── index.md
```

`index.ts`, `app.json`, `package.json`, `tsconfig.json`, `package-lock.json`
stay at the repository root because Expo/npm tooling requires or strongly
expects them there — do not move them into `src/` even though this file
otherwise pushes everything into subfolders.

---

## 6. Growing This Project

When adding the next feature (BLE, on-device person detection, gimbal
control, etc.):

1. Check `docs/PRD.md` — is it **DECIDED** for the current phase? If it's
   **FUTURE**, stop and confirm with the user first.
2. Check `.claude/skills/` (Section 0) — is there a discrete, reusable capability inside
   this feature (a hardware test, a build step, a standalone check)? If so, use the existing
   skill or create a new one for that piece before writing it inline.
3. Create a new subfolder under `src/` only if the feature is genuinely a
   new concern (e.g. `src/ble/`, `src/tracking/`). Otherwise add to an
   existing folder that matches its responsibility.
4. Write the `index.md` for any new folder *before or alongside* the first
   file in it — never leave a folder undocumented even temporarily.
5. Follow §2 and §3 above without exception.
6. Update `docs/VERIFICATION_REPORT.md` with what you tested.
7. If you deprecate something, mark it `❌ deprecated` (§1.2) and grep the
   whole repo for imports of it before deleting.
