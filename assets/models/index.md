# assets/models/ — index

The on-device machine-learning model(s) bundled with the app.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `person-detection.tflite` | file | Quantized SSD-MobileNet-V1, 300×300 uint8 RGB input, COCO-trained, NMS baked in. Decoded by `src/tracking/decodeDetections.ts`. | ⚠️ needs verification — sourced and format-confirmed (`research/computer-vision/person-detection-model-asset.md`), but inference has never run on the real device |

Sourced from `https://storage.googleapis.com/download.tensorflow.org/models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip`
(Apache 2.0, `tensorflow/models`), 2026-08-12. 4.18 MB.

## Depends on
Nothing — a static binary asset.

## Depended on by
`src/hooks/useAthleteDetection.ts`.
