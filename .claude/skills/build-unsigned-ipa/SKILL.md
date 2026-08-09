---
name: build-unsigned-ipa
description: >
  Triggers the GitHub Actions macOS-runner workflow that builds an unsigned iOS .ipa for this
  project (no paid Apple Developer account, no local Mac needed), then confirms the artifact
  actually downloaded and looks valid. Use whenever a native dependency changed, before
  sideloading to the iPhone, or any time you need to verify the no-Mac build pipeline itself
  still works after a dependency bump or an Xcode version change on the runner.
---

# Build Unsigned IPA

Verifies the full "no Mac owned" build pipeline described in `docs/PRD.md` §3.2: push →
GitHub Actions macOS runner → unsigned `.ipa` artifact. This skill does **not** sideload or
sign anything — that's a manual Sideloadly step on the Windows machine, done by the user.

## Steps

1. Confirm the working tree is committed and pushed — the workflow only runs against what's
   on GitHub, not local uncommitted changes.
2. Run `scripts/trigger_build.py` to dispatch the `Build unsigned iOS app (for Sideloadly)`
   workflow via the GitHub CLI/API and poll for completion.
3. On success, run `scripts/verify_artifact.py` to download the `unsigned-app-ipa` artifact
   and sanity-check it (non-zero size, contains `Payload/*.app`, `Info.plist` parses).
4. On failure, pull the failed step's log and check it against the known-failure patterns in
   `references/common-failures.md` (Xcode version drift, Nitro Modules version mismatch,
   signing-identity leakage into the export step — see the CV-implementation risk research
   doc for background) before treating it as a novel bug.
5. Report: build succeeded/failed, artifact size, and (if failed) which known-failure pattern
   it matches, if any.

## Notes

- This skill assumes `gh` (GitHub CLI) is authenticated on the machine running it. If not,
  say so rather than failing silently — the user needs to run `gh auth login` once.
- Never modify signing configuration to "fix" a failure without flagging it — the whole point
  of this pipeline is that signing stays disabled at the CI stage (see PRD §3.2); the actual
  signing happens later, locally, via Sideloadly.

## Status

Scaffold only — `scripts/trigger_build.py` and `scripts/verify_artifact.py` are not yet
implemented. Flesh these out against the real workflow file at
`.github/workflows/build-ios-unsigned.yml` once that workflow has been run successfully at
least once (see `docs/VERIFICATION_REPORT.md`).
