# VisionCamera v5 frame-processor stack

- **Researched:** 2026-08-09
- **Confidence:** high for the package set (official docs); medium for the resizer choice
- **Expires:** On any VisionCamera major version bump. v5 was a Nitro rewrite released April
  2026 and it moved things that v4 tutorials still describe the old way.
- **Sources:**
  - https://visioncamera.margelo.com/docs/guides/frame-processors
  - https://blog.margelo.com/whats-new-in-visioncamera-v5
  - https://swmansion.com/blog/behind-the-scenes-of-react-native-multithreading-vision-camera-v5-x-react-native-worklets-a102c37b32ae/
  - https://github.com/mrousavy/vision-camera-resize-plugin
  - https://www.npmjs.com/package/react-native-vision-camera

## Conclusion

Frame processors in v5 need **`react-native-worklets`** (Software Mansion) plus
**`react-native-vision-camera-worklets`**. Neither is currently installed in this project, so
**no frame processor can run today.** The v4 package `react-native-worklets-core` is the wrong
one.

## Detail

### Required packages

| Package | Role | Installed? |
|---|---|---|
| `react-native-vision-camera` ^5.2.1 | Camera + frame processor host | ✅ |
| `react-native-nitro-modules` | v5 core (v5 is a Nitro rewrite) | ✅ |
| `react-native-nitro-image` | v5 photo type | ✅ |
| `react-native-worklets` | The worklets runtime — **Software Mansion's** | ❌ **missing** |
| `react-native-vision-camera-worklets` | Bridges VisionCamera's frame output to worklets | ❌ **missing** |
| `react-native-vision-camera-resizer` | Frame → model input size + YUV↔RGB, GPU-accelerated | ❌ **missing** |

Official wording: *"The `CameraFrameOutput` requires react-native-vision-camera-worklets (and
react-native-worklets) to be installed."*

### Trap 1 — `worklets-core` is v4

v5 modularized the frame-processor engine and decoupled it from any one worklets
implementation. The default now runs on Software Mansion's `react-native-worklets`. Almost every
frame-processor tutorial online still says `react-native-worklets-core`. Installing that here
will produce confusing runtime failures rather than a clean error.

### Trap 2 — the resizer split

A TFLite model needs its input at a fixed size and colorspace, so a resize step is mandatory
between the camera frame and `model.runSync()`. There are two packages with confusingly similar
names:

- **`vision-camera-resize-plugin`** — the well-known one, CPU/SIMD. Its published peer deps still
  pin `react-native-vision-camera >= 3.8.2` and `react-native-worklets-core >= 0.2.4`. **v4-era.**
- **`react-native-vision-camera-resizer`** — depends on VisionCamera Core, GPU-accelerated,
  reported ~5× faster. **This is the v5 one, and the right pick for an ML pipeline.**

Confidence on this specific point is *medium* — it rests on package metadata and the v5 release
notes rather than a first-party migration guide. Verify the peer ranges at install time.

### Trap 3 — `.box()` is gone

v5 does **not** require `NitroModules.box()` around the TFLite model. Worklets reach
HybridObjects directly. Copying a v4 snippet that boxes the model is a common failure.

### Trap 4 — metro config

`.tflite` is not a Metro asset type by default. Without adding it to `resolver.assetExts` in
`metro.config.js`, the model import silently fails to bundle. This project has **no
`metro.config.js` at all** yet.

### Install discipline

`expo ~57.0.9` + `react-native 0.86.2` + `typescript ~6.0.3` is a very new triple, and the peer
ranges of these five additions are the most likely install failure in the project. Run
`npm install` locally and settle peer conflicts **before** spending a CI round, and commit the
regenerated `package-lock.json` in the same change — CI uses `npm ci`, which fails hard when the
lockfile disagrees with `package.json`, in a way that reads like an unrelated Xcode problem.
