# assets/ — index

Static files bundled into the app. Currently just the on-device ML model. Not responsible for
any code — everything here is data loaded via `require(...)` from `src/hooks/`.

## Contents

| Name | Type | Responsibility (one line) | Status |
|---|---|---|---|
| `models/` | folder | The bundled TFLite person-detection model — see `models/index.md` | ✅ verified — real file, sourced and confirmed, see `research/computer-vision/person-detection-model-asset.md` |

## Depends on
Nothing.

## Depended on by
`src/hooks/useAthleteDetection.ts` (`require('../../assets/models/person-detection.tflite')`).
Requires `'tflite'` in `metro.config.js`'s `resolver.assetExts` to bundle at all.
