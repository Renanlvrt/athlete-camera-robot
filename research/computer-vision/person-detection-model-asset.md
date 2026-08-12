# Person detection: a concrete, downloadable TFLite model file

- **Researched:** 2026-08-12
- **Confidence:** high across the board — URL, file format, output tensor order, AND the
  person-class index (originally medium; upgraded 2026-08-12 after a follow-up session with
  actual unzip access read `labelmap.txt` byte-for-byte and confirmed it directly — see "Person
  class index" below).
- **Expires:** This is a 2018-vintage model hosted at a stable Google Cloud Storage URL under
  `download.tensorflow.org` — TF has kept these URLs alive for years and they're still the ones
  cited by TF's own `tensorflow/models` docs today. Re-check only if the URL 404s, or if this
  project later swaps to EfficientDet-Lite (per `person-detection-model-choice.md`'s "or
  EfficientDet-Lite0" alternative) and needs a different asset.
- **Sources:**
  - https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip
    (fetched directly, see Detail)
  - https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/running_on_mobile_tensorflowlite.md
  - https://github.com/EdjeElectronics/TensorFlow-Lite-Object-Detection-on-Android-and-Raspberry-Pi/blob/master/TFLite_detection_video.py
  - https://github.com/EdjeElectronics/TensorFlow-Lite-Object-Detection-on-Android-and-Raspberry-Pi/blob/master/deploy_guides/Raspberry_Pi_Guide.md
  - https://github.com/tensorflow/models/blob/master/research/object_detection/data/mscoco_label_map.pbtxt
  - https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/tf1_detection_zoo.md
  - https://github.com/tensorflow/models (repo root, Apache-2.0 `LICENSE`)

## Conclusion

Use **`https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip`**
(2.7 MB zip, confirmed live and downloaded directly) — unzip to get `detect.tflite` (the model,
bundle this) and `labelmap.txt` (reference for the class list; do not need to ship it, the app
only needs class index 0). It is a uint8-quantized SSD-MobileNet-V1 with `TFLite_Detection_PostProcess`
baked in: **4 output tensors, NMS already done, no NMS to write app-side**, and **person is
output class index `0`**.

## Detail

### The file, verified directly

Fetched the URL directly rather than trusting a tutorial's claim that it resolves. Result: a real
ZIP (`PK` signature), **2.7 MB**, containing `detect.tflite` and `labelmap.txt` — exactly the
files this project needs. This is the canonical "COCO SSD MobileNet starter model" that TF's own
docs, the Android TFLite example app, and dozens of independent tutorials all point at — but here
it was hit directly rather than assumed from agreement between tutorials (the failure mode
`CLAUDE.md` §4.1 warns about).

This is an **SSD-MobileNet-V1** (not V2/EfficientDet as the sibling research file's "or"
suggested) — it is the specific file TF has hosted at this exact URL since 2018 and is what's
actually reachable today. If V2 or EfficientDet-Lite0 turn out to matter later (smaller/faster),
that's a follow-up research task, not blocking — V1 quant satisfies PRD §4.1's "generic person
boxes" requirement and matches the "quantized SSD-style COCO model" the existing decision calls for.

Input: `normalized_input_image_tensor`, **300×300**, uint8. (The existing model-choice research
suggested starting at 192×192 or 320×320 — this specific file is fixed at 300×300 by its graph;
that's close enough to the "or 320×320" branch and shouldn't need re-deriving the whole decision,
but note it if the input-size assumption is load-bearing elsewhere.)

### Output tensor format — confirmed against `tensorflow/models`' own doc, not a blog

Per `running_on_mobile_tensorflowlite.md` (TF's own repo, not a tutorial): the `add_postprocessing`
conversion flag "enables the model to take advantage of a custom optimized detection
post-processing operation which can be thought of as a **replacement for
`tf.image.non_max_suppression`**." **NMS is already baked in — the app does not need to implement
its own.**

Four output tensors, in this order (confirmed against both the TF doc and the widely-used
EdjeElectronics reference implementation's tensor-reading code, which explicitly branches on
TF1-style vs. TF2-style output ordering — this file is **TF1-style**):

| Index | Tensor | Shape | Dtype | Semantics |
|---|---|---|---|---|
| 0 | `detection_boxes` | `[1, 10, 4]` | float32 | Per box: **`[ymin, xmin, ymax, xmax]`**, each normalized to `[0, 1]` relative to the 300×300 input — **not** `[x, y, w, h]`, and not pixel coordinates. |
| 1 | `detection_classes` | `[1, 10]` | float32 (holds integer class ids) | 0-indexed class id, index into the compacted label list (see below). Cast to int. |
| 2 | `detection_scores` | `[1, 10]` | float32 | Confidence `0..1` per box, same ordering as boxes/classes. |
| 3 | `num_detections` | `[1]` | float32 | Count of valid detections — but note this custom post-process op always fills all 10 slots; use the score threshold below to decide validity rather than trusting a low `num_detections` to mean the tail entries are garbage. Filter by score. |

**Max detections: 10** (this specific converted model's fixed output size — not configurable
without re-converting). A typical usable confidence threshold cited across the reference
implementations is **~0.5**; that's a starting point for tuning, not a hard spec from the model
itself — no source states a "correct" threshold, it's an app-level choice. Even though the model's
*weights* are uint8-quantized, the post-process op's four outputs are plain **float32** — no manual
dequantization step needed for boxes/classes/scores/count.

Even though `react-native-fast-tflite` just runs `model.runSync()` on the raw graph (no MediaPipe
Tasks runtime involved), this file is exactly compatible with that: it's a plain `.tflite` graph
whose last op is the custom `TFLite_Detection_PostProcess` op, which TFLite's built-in kernel
registry supports directly — it does **not** require MediaPipe.

### Person class index — 0

**CONFIRMED DIRECTLY, 2026-08-12:** unzipped the file and read `labelmap.txt` byte-for-byte —
line 1 is `???` (placeholder), line 2 is `person`. After stripping the placeholder line,
`detection_classes[i] == 0` → `person`, exactly as predicted below. This replaces the original
"medium confidence, two lines of corroborating reasoning" note with a direct read.

Original reasoning, still valid and now doubly-confirmed: every tool that consumes this exact
model (EdjeElectronics' scripts, the TF Android sample) strips the placeholder line and then
indexes `labels[int(detection_classes[i])]` directly, with no further offset. Cross-checked
against `tensorflow/models`' canonical `mscoco_label_map.pbtxt`, where **`id: 1` is `person`** —
the first real class, id-1-indexed to line up with the model's 0-indexed output.

If the app instead reads `labelmap.txt` at runtime without stripping the placeholder, remember to
either drop line 0 first, or add 1 to the raw line index when looking up `detection_classes[i]`.
Simplest and most robust for this project: **skip shipping/parsing `labelmap.txt` at all — just
hard-code "class index 0 == person"** and filter on that, since PRD §4.1 only needs the one class.

### What I could not fully verify

- Did not benchmark this specific file's on-device inference time — that's `frame-budget.md`'s
  territory and needs the real iPhone (`cv-framerate-test` skill), not research.
- Did not compare this V1 file's accuracy/speed against the V2 or EfficientDet-Lite0 alternatives
  the sibling decision file left open — out of scope for "find a working file now."

### Bundled, 2026-08-12

`detect.tflite` copied into `assets/models/person-detection.tflite` (4.18 MB — a little over the
"a few MB" estimate in `person-detection-model-choice.md` but still an acceptable app-bundle
addition) and wired into `src/hooks/useAthleteDetection.ts`. `labelmap.txt` was not bundled —
per the reasoning above, the app hard-codes `PERSON_CLASS_ID = 0`
(`src/tracking/decodeDetections.ts`) rather than parsing the label file at runtime.

### License

Apache License 2.0 — this model ships from the `tensorflow/models` project (repo-level
`LICENSE` file is Apache-2.0), and TF's own model zoo docs describe models as released under it.
No more restrictive per-model license notice was found for this specific file. Fine to bundle in
the app.
