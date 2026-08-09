# Windows → iPhone: the free build & install pipeline

- **Researched:** 2026-08-09
- **Confidence:** high (GitHub's own changelog + pricing pages; AltStore's own FAQ)
- **Expires:** Re-check the runner image yearly (`macos-26` will eventually be superseded), and
  re-check GitHub's public-repo pricing if it ever changes — that's the load-bearing assumption.
- **Sources:**
  - https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/
  - https://github.com/actions/runner-images/issues/14167
  - https://faq.altstore.io/altstore-classic/altserver
  - https://faq.altstore.io/altstore-pal/what-is-altstore-pal
  - https://github.com/resources/insights/2026-pricing-changes-for-github-actions

## Conclusion

The whole pipeline costs **$0**: a public GitHub repo builds an unsigned `.ipa` on a free macOS
runner, and **AltStore Classic + AltServer** signs it with a free Apple ID and auto-refreshes it
over Wi-Fi.

## Detail

### Cost — the load-bearing fact

**Public repositories get free, unmetered GitHub Actions minutes, including macOS runners.**
There is no minute cap on any plan. This is the single assumption the entire no-Mac strategy
rests on.

If this repo is ever made **private**, that changes materially: macOS runners bill at a **10×
multiplier** against a limited monthly free allowance, and a handful of 15–20 minute iOS builds
can exhaust it. Keep the repo public, or budget for far fewer CI rounds and much heavier local
pre-checking.

### Runner image — pin it

`macos-26` is generally available, and `macos-latest` was migrated to point at it between June
and July 2026. Default Xcode on that image moved 16.4 → 26.4.1 → 26.6 over the course of 2026.

**Pin `runs-on: macos-26` explicitly.** Using `macos-latest` means a GitHub-side image rollover
can break the build with no change on our side — and the resulting failure will look like a code
problem, not an infrastructure one. Bump the pin deliberately, never by surprise.

### Why not EAS Build

Expo's own cloud service builds an iOS **simulator** binary for free, but a real-device arm64
`.ipa` through EAS requires a paid Apple Developer account. The paywall is on *signing*, not
compiling — plain `xcodebuild` has never required payment to compile. So the workflow compiles
with `CODE_SIGNING_ALLOWED=NO` and hands back a raw unsigned `.ipa`, which gets signed locally
instead.

An `.ipa` is just a zip with the `.app` inside a `Payload/` directory, which is why the workflow
assembles it with `zip` rather than `xcodebuild -exportArchive` — the export step insists on a
signing identity, exactly what we're avoiding.

### Sideloading — AltStore Classic, and the naming trap

| Tool | Cost | Refresh | Verdict |
|---|---|---|---|
| **AltStore Classic + AltServer** | **$0** | Automatic, over Wi-Fi, whenever the PC is on the same network | **Chosen** |
| Sideloadly | $0 | Manual: USB, click Start, ~2 min, weekly | Fallback #1 |
| SideStore | $0 | On-device, no computer needed after setup | Fallback #2 — more moving parts |
| Apple Developer Program | $99/yr | 1-year certs, TestFlight | Not needed; PRD §3.2 keeps it FUTURE |

**The naming trap:** searching "AltStore" surfaces a €1.50 subscription. That is **AltStore PAL**,
a completely different product — an EU-only alternative app marketplace under the DMA. It is not
what this project uses, and it's free now anyway (Epic Games grant). **AltStore Classic +
AltServer on Windows has always been free.**

All free-Apple-ID paths share the same limits regardless of tool: **7-day certificates** and a
**3-app** sideload limit. The 3-app limit is irrelevant here (one app). The 7-day expiry is the
real friction, and it's exactly what AltServer's background Wi-Fi refresh removes — which is why
it beats Sideloadly's manual USB step for someone at the robot daily.

SideStore removes the "computer must be on the network" requirement using a pairing file plus an
on-device VPN helper. Genuinely useful, but pairing files expire, the VPN helper apps get pulled
from the App Store periodically, and iOS updates break the chain. Since the Windows PC is where
development happens anyway, AltServer is the simpler free path.

### The loop, end to end

```
Windows: edit code, npm run typecheck
   ↓ git push
GitHub Actions (macos-26): npm ci → typecheck → expo prebuild → xcodebuild archive
                            → zip Payload/ → unsigned-app.ipa artifact
   ↓ download
Windows: AltServer signs with free Apple ID → installs to iPhone over USB (first time) / Wi-Fi
   ↓
iPhone 16: Settings → General → VPN & Device Management → Trust
```

Budget ~15–20 minutes for a CI round. That number is why local `npm run typecheck` matters so
much: it's the only gate that runs in seconds, and it catches the majority of mistakes.
