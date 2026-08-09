# .github/ — index

GitHub-specific configuration. Currently just the CI workflow that builds the unsigned iOS
`.ipa` — the piece that makes iPhone development possible from a Windows PC with no Mac.

Not responsible for: signing or installing the app (that happens locally via AltStore — see
`README.md`), or anything about what the app does.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `workflows/` | folder | CI workflow definitions — see `workflows/index.md` | ✅ verified — ran green twice, 2026-08-09 |

## Depends on
`package.json` / `package-lock.json` (the workflow runs `npm ci`), `app.json` (it runs
`expo prebuild`), and a **public** GitHub repo for free unmetered macOS runner minutes — see
`research/phone-integration/windows-to-iphone-pipeline.md`.

## Depended on by
`.claude/skills/build-unsigned-ipa/`, `README.md`, `docs/PRD.md` §3.2.
