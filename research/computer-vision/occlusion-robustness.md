# Detection accuracy on partially-occluded / partially-in-frame athletes

- **Researched:** 2026-08-16
- **Confidence:** **medium overall** — architecture-level claims and the app-level ByteTrack
  precedent are well-sourced (see per-section notes); the one thing that would make this "high" —
  a direct occluded-vs-unoccluded AP number for *this exact* 2018 SSD-MobileNet-V1 quant model —
  could not be found and is flagged as an open gap below. Do not treat this file as having found
  a magic number; treat it as "the mechanism is well understood, the exact size of the effect for
  this specific old model is not."
- **Expires:** The architecture-level reasoning (anchor/receptive-field limits, SSD's own stated
  augmentation strategy) doesn't rot — it's about a 2016/2018-vintage architecture that isn't
  going to be retroactively re-designed. Re-check only if: (a) this project swaps the bundled
  model (re-derive against the new model's own docs/paper, don't assume this transfers), (b) the
  `react-native-vision-camera-resizer` version changes and `ScaleMode` options change, or (c) a
  future field test produces occlusion-specific numbers that supersede the "no direct numeric
  benchmark found" gap noted below.
- **Sources:**
  - https://arxiv.org/abs/1512.02325 (Liu et al., "SSD: Single Shot MultiBox Detector" — the
    original paper; fetched via PDF, see caveat in Detail §1)
  - https://arxiv.org/pdf/2101.08845 ("Occlusion Handling in Generic Object Detection: A Review")
  - https://arxiv.org/pdf/2210.10046 / https://www.robots.ox.ac.uk/~vgg/research/tpod/ ("A
    Tri-Layer Plugin to Improve Occluded Detection", BMVC 2022 — defines the Occluded-COCO /
    Separated-COCO benchmarks)
  - https://arxiv.org/pdf/2409.12760 (COCO-OLAC / COCO-Occ benchmark paper — describes how
    occlusion benchmarks are derived from COCO, since base COCO has no `occluded`/`truncated`
    flag)
  - https://blog.tensorflow.org/2021/06/easier-object-detection-on-mobile-with-tf-lite.html
    (TensorFlow's own blog — official mAP/latency/size table for MobileNetV1-SSD vs
    EfficientDet-Lite0–4 vs SSD-MobileNetV2, Pixel 4 CPU)
  - https://www.ejtech.io/learn/tflite-object-detection-model-comparison (independent practitioner
    benchmark, SSD-MobileNet-V1-quant vs V2 vs EfficientDet-Lite-D0 — used only as a second data
    point, not as primary evidence, per `CLAUDE.md` §4.1)
  - https://arxiv.org/pdf/2110.06864 (Zhang et al., "ByteTrack: Multi-Object Tracking by
    Associating Every Detection Box", ECCV 2022) and
    https://datature.io/blog/introduction-to-bytetrack-multi-object-tracking-by-associating-every-detection-box
    (practitioner explainer, used only to corroborate the paper's own two-stage mechanism)
  - `node_modules/react-native-vision-camera-resizer/lib/specs/ResizerFactory.nitro.d.ts` and
    `node_modules/react-native-vision-camera-resizer/src/specs/ResizerFactory.nitro.ts` (read
    directly — see Detail §2)
  - `src/tracking/selectPrimaryAthlete.ts`, `src/hooks/useLockedAthlete.ts`,
    `src/tracking/decodeDetections.ts`, `src/hooks/useAthleteDetection.ts` (read directly, to
    avoid recommending anything already built)

## Conclusion

Yes — SSD-MobileNet-V1 (2018, quantized) is architecturally weaker on partially-occluded/
truncated people than newer detectors, for well-documented reasons (shallow-feature small-object
weakness, and the original paper's own admission that edge-truncated objects are harder), and a
same-cost-class swap (EfficientDet-Lite0) would likely help *somewhat* per official TF benchmarks
(25.69% vs ~21% COCO mAP, still real-time-class on-device) — but no source found gives a direct
occlusion-specific number for this exact model, so the size of that specific improvement is
inferred, not measured. **The higher-leverage, zero-model-swap fix is app-level**: switch the
resizer's `scaleMode` from `'stretch'` to `'contain'` (this app is currently mis-configured for
occlusion at the frame edge — stretch distorts exactly the truncated-body aspect ratios most at
risk, and the resizer library supports letterboxing directly, confirmed by reading its own
`.d.ts`), and extend the existing continuity-lock logic to accept lower-confidence boxes
specifically for continuing an existing lock (the ByteTrack pattern) rather than lowering the
global threshold, which is a well-documented anchor-based-tracking practice, not a guess.

## Detail

### 1. Is SSD-MobileNet-V1 inherently worse at partial/occluded detection, and why?

**Small objects — well-established, high confidence.** SSD's own architecture pools different
object scales onto different-depth feature maps; the shallow, high-resolution maps used for
small objects carry comparatively little semantic information (this is *the* well-known critique
of the original design, cited repeatedly in the object-detection literature — e.g. the review at
arxiv.org/pdf/2101.08845 and dozens of "improved SSD" papers whose entire premise is fixing this).
A partially-occluded or frame-edge-truncated person is, from the detector's point of view,
functionally similar to a small object: less visible area, less texture/context to match against
an anchor template. This is architecture, not training-data luck, so it doesn't get better by
retraining the same graph.

**Frame-edge truncation — medium confidence, single-source caveat.** A WebFetch summary of the
original SSD paper (arxiv.org/abs/1512.02325, PDF fetched and summarized by the fetch tool's
model rather than read character-by-character by me) reports the paper states objects "partially
outside of the image or severely truncated are much harder to detect," and describes the paper's
own data-augmentation strategy — random patch/crop sampling and an "expand"/zoom-out operation —
as specifically intended to simulate partially-visible and small objects during training. I could
not independently re-verify the exact wording against the raw PDF text in this session (the
summarization step is a real gap, flagged per this project's own "confident guess dressed as
fact" caution), but the *substance* — SSD's paper describes patch-sampling augmentation whose
explicit purpose is robustness to partial visibility and small scale — matches well-established,
widely-repeated secondary description of SSD's training pipeline, so I'm treating the substance as
medium-high confidence and the exact quoted wording as unverified.

**Would a same-cost-class newer model help? Directionally yes, magnitude unmeasured.** Official
TensorFlow benchmarks (blog.tensorflow.org, Pixel 4, 4 CPU threads) give a same-source, same-
methodology comparison table:

| Model | Size | Latency | COCO mAP |
|---|---|---|---|
| MobileNetV1-SSD (float, non-quant — TF's own comparison baseline) | — | — | ~21% |
| SSD MobileNetV2 320×320 | 6.7 MB | 24 ms | 20.2% |
| EfficientDet-Lite0 | 4.4 MB | 37 ms | 25.69% |
| EfficientDet-Lite1 | 5.8 MB | 49 ms | 30.55% |
| EfficientDet-Lite2 | 7.2 MB | 69 ms | 33.97% |

Two things worth noting: (1) EfficientDet-Lite0's overall mAP is meaningfully higher than either
SSD variant at a comparable/slightly-slower latency — still plausibly inside this project's
16–33ms frame budget once CoreML-accelerated on an iPhone 16 (per `docs/PRD.md` §3.3/§4.1's
existing target), though this Pixel-4-CPU number is not a stand-in for that and needs the
`cv-framerate-test` skill to confirm; (2) **SSD-MobileNetV2 320×320 actually scores *lower* mAP
than V1 in TF's own table**, which is a useful caution against assuming "newer version number =
strictly better" — the V1→V2 change is a backbone/speed trade, not an accuracy win at this
input size, and would NOT be an improvement here (do not swap to plain SSD-MobileNetV2 in the
hope of fixing occlusion). EfficientDet-Lite0/1 (which use a BiFPN — a feature-fusion design
built to combine multi-scale features better than SSD's independent per-layer prediction) are the
architecturally relevant "would this help occlusion" candidates, not SSD-V2.

**What I could not determine:** no source found gives an occlusion-specific or truncation-specific
AP breakdown for any of these exact TFLite models. The Occluded-COCO/Separated-COCO benchmarks
(arxiv.org/pdf/2210.10046, arxiv.org/pdf/2409.12760) exist and are exactly the right kind of
evaluation, but the papers using them benchmark Mask R-CNN/Cascade Mask R-CNN with Swin
backbones — large server-class models, not MobileNet-class ones — so there is no direct
"SSD-MobileNet-V1 scores X% on Occluded-COCO, EfficientDet-Lite0 scores Y%" comparison to cite.
**This is an honest gap, not an oversight**: the mobile-detector literature benchmarks speed/mAP:
size trade-offs almost exclusively on standard (not occlusion-stratified) COCO. The directional
conclusion (shallower/simpler feature fusion = worse on partial evidence) is architecturally
sound and widely asserted, but "how much better would EfficientDet-Lite0 be on THIS app's specific
occluded-athlete frames" is not answerable from documents — it would need an actual side-by-side
run of both models against real occluded-athlete footage, which is `cv-framerate-test`-adjacent
but a distinct benchmarking task, not a research question.

**MoveNet / pose-based alternative — considered and a poor fit for this app's requirements,
independent of occlusion robustness.** MoveNet is architecturally more occlusion-tolerant in the
sense that it reasons about individual keypoints rather than a single box (a partially-visible
person can still yield several confident keypoints), and its docs (blog.tensorflow.org's MoveNet
posts) describe an ROI-crop-and-track mechanism across frames. But: (1) the single-person
MoveNet variants (Lightning/Thunder) assume one dominant subject and don't natively return
multiple candidate people to choose from, which conflicts with `docs/PRD.md` §4.2's decided
requirement to detect multiple athletes and pick a primary one — a MultiPose variant exists but
adds real complexity (per-person keypoint grouping, then deriving a bounding box from keypoints
rather than getting one natively) for a problem (occlusion robustness) this research did not find
strong direct on-device evidence would be solved better than by the cheaper app-level fixes below.
Not recommended as a first move; flagging as a bigger, unresearched swap if the app-level and
EfficientDet-Lite0 options both prove insufficient.

### 2. App-level techniques (no model swap)

**`scaleMode` — read directly from the resizer's own type definitions, high confidence.**
`node_modules/react-native-vision-camera-resizer` exposes exactly three scale modes
(`ResizerFactory.nitro.ts`/`.d.ts`, read directly, not inferred): `'cover'` (centered crop,
preserves aspect ratio), `'contain'` (letterbox/pillarbox with black bars, preserves aspect
ratio, keeps the full source visible), and `'stretch'` (fills the output by squashing/stretching
each axis independently — **what `useAthleteDetection.ts` currently uses**, per its own doc
comment explaining why: it keeps the box math simple because stretched-frame coordinates equal
full-camera-frame normalized coordinates with no extra transform).

This is directly relevant to the reported failure mode. A person cut off at the frame edge (legs
missing, or only the torso visible) already has an extreme/unusual aspect ratio compared to a
full standing person — `'stretch'` then *further* distorts that already-unusual box by squashing
the 4:3-ish camera frame into the model's square 300×300 input non-uniformly on each axis. SSD's
anchor boxes are defined at a fixed small set of aspect ratios (this is the same anchor-design
limitation discussed in §1); an aspect-ratio-distorted partial body is more likely to fall between
those anchor shapes than a partial body whose aspect ratio was preserved. `'contain'` would remove
this compounding distortion (padding with black bars instead, at the cost of some processed area
being "wasted" on the letterbox bars — a real trade-off, not a free win) while `'cover'` would be
actively worse for this specific failure mode (a centered crop can cut off even MORE of an
already-partial body at the frame edge). **This is architecturally-sound reasoning from a primary
source (the type definitions) about a real, confirmed distortion mechanism — but I did not find,
and did not expect to find, a source benchmarking `'stretch'` vs `'contain'` specifically for this
model; the direction of the effect is well-supported, the magnitude is not measured.**

**Lowering `MIN_CONFIDENCE`/`DEFAULT_MIN_SCORE` globally — a real trade-off, not free, medium
confidence.** General object-detection literature (search results on precision/recall curves) is
unambiguous that lowering a confidence threshold trades precision for recall — more true partial-
body detections survive, but so does more background noise, which `selectPrimaryAthlete.ts`'s own
doc comment already explicitly worries about ("following one makes the camera lurch away from the
real subject"). Blanket-lowering `MIN_CONFIDENCE` (0.4, gates ALL boxes including fresh
acquisition) is the blunt version of this trade and isn't obviously worth it.

**The sharper, well-precedented version: ByteTrack's two-stage confidence pattern — high
confidence this is a real, established practice; not yet applied here.** ByteTrack (Zhang et al.,
ECCV 2022, arxiv.org/pdf/2110.06864) is a widely-cited, still-current (as of 2026) multi-object-
tracking method built around exactly this problem: standard practice discards detections below a
threshold outright, which loses real objects during occlusion/blur specifically *because* their
confidence dips below threshold while still visible enough to be non-background signal. ByteTrack
instead runs a **second association stage that matches low-confidence boxes against already-
tracked objects by spatial proximity/IoU**, and only uses the high-confidence boxes to start NEW
tracks. This is architecturally very close to — but meaningfully different from — what this repo
already has: `selectPrimaryAthlete.ts` already has a two-tier structure (continuity match via
`findContinuedLock`, then fresh-acquisition via largest-box), but **both tiers currently gate on
the same flat `MIN_CONFIDENCE = 0.4`** (see the `if (box.confidence < MIN_CONFIDENCE) continue;`
check inside `findContinuedLock` itself, and the identical check in the fresh-acquisition loop).
The ByteTrack-precedented change would be: keep (or even raise) the confidence floor for
**fresh acquisition** (avoids locking onto background noise), but **lower the confidence floor
specifically inside `findContinuedLock`** for boxes that spatially match a `previousLock` — a
partially-occluded athlete whose box just dropped to, say, 0.25 confidence but is still sitting
right where the lock last was is exactly the case ByteTrack's second stage is built for, and it's
a narrow, low-false-positive-risk change because it's gated by spatial continuity, not confidence
alone. This is a genuinely new idea relative to what's built today (the existing continuity logic
matches on IoU/center-distance, but only among boxes that already passed the same threshold as
everything else) — distinct from, and complementary to, `useLockedAthlete.ts`'s existing
`LOCK_MEMORY_MS` grace-period, which handles the *zero-detections-at-all* case, not the
*detected-but-below-threshold* case this addresses.

**Temporal smoothing / carrying forward a box through a low-confidence frame — already
substantially built, medium-high confidence this is redundant to re-recommend as new.**
`useLockedAthlete.ts`'s `LOCK_MEMORY_MS` (1000ms) grace period already does the closest thing to
this: it keeps offering the last-known lock position for continuity-matching for up to a second
after a frame produces no match at all. The one gap (see above) is that this only covers the
"detector returned nothing above threshold" case, not "detector returned something, just below
threshold, in roughly the right place" — which is a different, narrower gap than a fresh
"add temporal smoothing" recommendation would suggest. Framing it as "extend the existing
mechanism to trust weak-but-spatially-plausible boxes" is more accurate than "add smoothing."

### 3. Concrete cited evidence on COCO's occluded/truncated evaluation

**Correction to the question's premise, medium-high confidence:** base COCO's own annotation
schema (the `iscrowd` flag plus polygon/segmentation masks) does **not** natively carry explicit
boolean `truncated`/`occluded` flags the way PASCAL VOC's XML format does. What exists instead are
**derived benchmarks built on top of COCO val2017** — Occluded-COCO and Separated-COCO (defined in
arxiv.org/pdf/2210.10046, "A Tri-Layer Plugin to Improve Occluded Detection", BMVC 2022; described
similarly by the more recent COCO-OLAC/COCO-Occ work at arxiv.org/pdf/2409.12760), which
programmatically derive occlusion labels by checking whether an instance's ground-truth mask is
connected (occluded, if a mask is disrupted by another object's mask but still one contiguous
region) or split into disconnected pieces (separated). These are legitimate, citable, current
research benchmarks — but as noted in §1, the papers using them evaluate large models (Mask R-CNN/
Cascade Mask R-CNN + Swin backbones), not TFLite-class mobile detectors, and I was not able to
extract the papers' actual numeric AP-drop tables through the tools available this session (the
PDF exceeded WebFetch's size limit; the project page's numbers are embedded in a table image, not
extractable text). **This is the single clearest unresolved item in this research pass**: the
benchmarks needed to give a real "occluded AP" number exist, but a number specific to any
MobileNet-class or TFLite model was not found and may not exist in the published literature at
all — occlusion-robustness papers for edge/mobile detectors specifically appear to be a much
thinner body of work than for server-class detectors.

## What I could not determine (flag for follow-up, not for hardware-tester — this needs either
more literature digging or an actual model-swap experiment, not a physical test)

- No occlusion-specific or truncation-specific AP number for SSD-MobileNet-V1 (any variant),
  EfficientDet-Lite0, or any other TFLite-class model. The general "shallower feature fusion is
  worse on partial evidence" reasoning is sound; its magnitude for this app's real footage is not
  measurable from documents.
- Could not independently re-verify the exact quoted wording from the original SSD paper about
  truncated objects (WebFetch's summarization step is a real, acknowledged gap here) — the
  substance is corroborated by well-known secondary description of SSD's augmentation strategy,
  but treat the exact phrasing as unconfirmed.
- Did not benchmark `'stretch'` vs `'contain'` resize distortion's actual effect on this specific
  bundled model's output — the mechanism (aspect-ratio distortion compounding an already-atypical
  partial-body box shape, colliding with SSD's fixed anchor aspect ratios) is well-reasoned from
  primary sources but unmeasured.
