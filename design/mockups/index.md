# design/mockups/ — index

Standalone, self-contained HTML mockups of individual screens. Each file
opens directly in a browser with no build step and no dependency on the
actual app code — these are for visual/UX direction-setting only, not
implementations of `src/screens/`.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `live-tracking-screen-mockup.html` | file | Visual mockup of the Live Tracking screen: status pill, cyan tracking reticle, LED-style speed/vertical telemetry dock, and a scoring celebration animation. Includes interactive state toggles for review. | ⚠️ needs verification (design exploration only — telemetry/scoring UI is FUTURE/STRETCH per `docs/PRD.md` §4.3, not yet implemented in `src/`) |

## Depends on
Tabler Icons (CDN, `cdnjs.cloudflare.com`) — the only external dependency, loaded via `<link>` in the HTML file itself.

## Depended on by
Nothing — reference material for whoever builds `src/screens/CameraPreviewScreen.tsx`'s
tracking overlay (or a new sibling component) when that work starts.
