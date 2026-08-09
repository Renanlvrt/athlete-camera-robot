# Person detection: TFLite, not Apple's Vision framework

- **Researched:** 2026-08-09
- **Confidence:** high
- **Expires:** Re-check if (a) someone publishes a maintained VisionCamera v5 frame-processor
  plugin wrapping Apple Vision, or (b) this project ever gains reliable Mac access — either
  would reopen the comparison.
- **Sources:**
  - https://github.com/mrousavy/react-native-fast-tflite/blob/main/README.md
  - https://visioncamera.margelo.com/docs/guides/frame-processors-plugins-overview
  - https://docs.expo.dev/guides/adopting-prebuild/
  - https://mrousavy.com/blog/VisionCamera-Pose-Detection-TFLite

## Conclusion

Use **`react-native-fast-tflite`** with a quantized COCO person-detection model, with the CoreML
delegate enabled through its Expo config plugin. Do **not** use Apple's Vision framework
(`VNDetectHumanRectanglesRequest`) for this project, despite it being the technically elegant
choice on iOS.

## Detail

### Why Apple Vision looks right and is wrong here

On paper Apple's Vision framework wins: it's built into iOS, Neural-Engine accelerated, needs no
bundled model file, and `VNDetectHumanRectanglesRequest` does exactly the job. An earlier
research pass on this project recommended it for those reasons.

That recommendation was made without the build constraint in view. The disqualifier:

1. **No maintained npm package exposes Apple Vision person detection as a VisionCamera frame
   processor plugin.** The community plugins that exist wrap ML Kit, barcode readers, and OCR —
   not Vision's human-rectangle request.
2. So using it means **writing a Swift Nitro Module by hand.**
3. This project uses Expo's Continuous Native Generation, and `ios/` is **regenerated from
   scratch on every `expo prebuild`** — which happens on every CI run. Hand-written Swift placed
   there is destroyed each time. Surviving that requires packaging it as a local Expo module with
   its own config plugin: a real, native-toolchain-heavy piece of work.
4. **There is no Mac** (see `../phone-integration/expo-cng-constraints.md`). You cannot compile
   Swift locally, cannot open Xcode, cannot read a native compiler error without pushing to CI
   and waiting ~20 minutes. Iterating on hand-written Swift through that loop is the worst
   development experience available in this project.

The cost isn't the code — it's that the feedback loop for that code is 20 minutes long and
blind.

### Why fast-tflite fits the constraint

`react-native-fast-tflite` is an ordinary npm package that ships its own Expo config plugin.
**Zero native code to write, nothing for CNG to destroy.** Setup is entirely declarative:

```json
{
  "plugins": [
    ["react-native-fast-tflite", { "enableCoreMLDelegate": true }]
  ]
}
```

`enableCoreMLDelegate` is the important part — it routes inference through CoreML onto the
Neural Engine, recovering most of the hardware-acceleration advantage that made Apple Vision
attractive. Not every model op is CoreML-compatible; ops that aren't fall back to CPU, so model
choice matters (below).

Models load as bundled assets, which means adding `'tflite'` to `resolver.assetExts` in
`metro.config.js`. Consequence worth knowing: **the model can be swapped at runtime without
rebuilding the app.** Given that a rebuild here costs a CI round plus a re-sideload, that is a
significant iteration-speed win — model tuning stops being gated on the build pipeline.

### Model recommendation

A **uint8-quantized SSD-MobileNet-V2** or **EfficientDet-Lite0** trained on COCO, filtered to
class 0 (`person`). Input 192×192 or 320×320.

- Quantized (uint8, not float32) — smaller, faster, better CoreML delegate coverage.
- COCO-pretrained is sufficient: PRD §4.1 wants generic person boxes, not athlete-specific
  recognition. No custom training.
- Start at 192×192. Bump to 320×320 only if detection range proves too short in a field test —
  athletes are often far from the camera, and small-subject detection is the likely weak point.
  Measure before changing (`testing/`), don't guess.

### API note — v4 tutorials will mislead you

VisionCamera v5 **no longer requires `NitroModules.box()`** around the model. Since v5 is built on
Nitro and uses `react-native-worklets`, worklets access the TFLite HybridObject directly. Most
tutorials online predate this. If you see `.box()`, the tutorial is v4-era; check everything else
in it too.

### Known cost of this choice

- A model file (a few MB) ships in the app bundle. Acceptable.
- Bounding-box quality from a small quantized COCO model is worse than Apple Vision's
  purpose-built human detector, especially for distant or partially-occluded athletes.
  **This is the real trade-off being accepted**, and it's accepted because a working mediocre
  detector beats an excellent one that can't be built from Windows. Revisit if detection quality
  turns out to be the thing blocking the MVP — but measure it in a field test first.
