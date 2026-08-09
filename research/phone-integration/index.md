# research/phone-integration/ — index

Findings about the hardest structural constraint in this project: **developing an iOS app from a
Windows PC with no Mac and no paid Apple Developer account.** Covers the CI build pipeline, Expo
Continuous Native Generation limits, and free sideloading onto the iPhone.

Not responsible for: what the app does once installed (see `../computer-vision/`), or the BLE
link to the robot (see `../hardware/`).

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `expo-cng-constraints.md` | file | What Windows + CNG forbid, and the two bugs that already cost us | ✅ verified locally |
| `windows-to-iphone-pipeline.md` | file | GitHub Actions macOS build → free sideload; costs and tool choice | ✅ verified |

## Depends on
Nothing. This folder's constraints are *inputs* to the other two domains.

## Depended on by
Everything. `../computer-vision/person-detection-model-choice.md` is decided by the constraint
documented here; `docs/PRD.md` §3.2; `.github/workflows/build-ios-unsigned.yml`;
`.claude/skills/build-unsigned-ipa/`.
