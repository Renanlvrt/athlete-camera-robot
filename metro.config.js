// Metro bundler config.
//
// Sole purpose right now: teach Metro that `.tflite` is an ASSET, not source.
// Without this, importing a model file silently fails to bundle and the failure
// surfaces at runtime on the device as a confusing null model.
//
// Consequence worth knowing: because the model ships as an asset rather than
// being compiled in, it can be swapped without rebuilding the app. Given a
// rebuild here costs a ~20 minute CI round plus a re-sideload, that makes model
// tuning dramatically cheaper. See research/computer-vision/person-detection-model-choice.md

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

module.exports = config;
