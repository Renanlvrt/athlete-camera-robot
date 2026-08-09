# research/ — index

Durable, sourced findings about the three domains this project spans: computer vision, phone
integration (the Windows→iPhone pipeline), and hardware. This folder exists so that an agent
picking up the project **does not re-run research that has already been done**, and so that
conclusions carry their evidence and their expiry date with them.

This folder is **not** for: project decisions (those live in `docs/PRD.md`), test results (those
live in `testing/`), or implementation notes (those live in the relevant `index.md`).

## The rule

**Before searching the web on any topic in these three domains, read `RESEARCH_LOG.md`.**
If the topic is already there and still fresh, use the existing finding. After doing new
research, append a row to that log and write the finding as its own file. A finding that isn't
written down here will be re-derived from scratch by the next agent, badly.

## Finding file format

Every finding file carries, at the top:

```markdown
# <Title>

- **Researched:** YYYY-MM-DD
- **Confidence:** high | medium | low
- **Expires:** when this should be re-checked, and what would invalidate it
- **Sources:** URLs, one per line

## Conclusion
<The answer, stated plainly, in one or two sentences.>

## Detail
<Why, with the evidence.>
```

Confidence means: **high** = confirmed against primary/official docs or verified locally;
**medium** = consistent across several secondary sources; **low** = inference, not yet proven.
Library ecosystems here (Expo, VisionCamera) move fast — a finding older than ~3 months near a
major version boundary should be treated as suspect.

## Contents

| Name | Type | Responsibility (one line) | Status |
|------|------|----------------------------|--------|
| `RESEARCH_LOG.md` | file | Dated index of every topic researched — check before searching | ✅ verified |
| `computer-vision/` | folder | On-device detection: model choice, frame-processor stack, perf budget — see `computer-vision/index.md` | ✅ verified |
| `phone-integration/` | folder | Windows→CI→iPhone build/sideload pipeline, Expo CNG constraints — see `phone-integration/index.md` | ✅ verified |
| `hardware/` | folder | micro:bit BLE, PCA9685 servo control, power/brownout — see `hardware/index.md` | ✅ verified |

## Depends on
Nothing — this folder is reference material and imports no code.

## Depended on by
`docs/PRD.md` (decisions cite findings here), `.claude/skills/` (skills cite the risk they
address), and any agent doing implementation work in `src/`.
