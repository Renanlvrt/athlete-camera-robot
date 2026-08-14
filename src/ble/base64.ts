/**
 * base64.ts
 *
 * Single responsibility: encode a `Uint8Array` to a Base64 string.
 *
 * Hand-rolled and dependency-free on purpose. Every `react-native-ble-plx`
 * write/read/monitor method takes/returns `Base64` (a plain `string`), but
 * Hermes (RN's JS engine) has no built-in `Buffer` the way Node.js does —
 * reaching for `Buffer.from(...)` without a polyfill throws
 * `ReferenceError: Buffer is not defined` at RUNTIME, not typecheck time, so
 * it's exactly the kind of bug that only shows up on-device. See
 * `research/hardware/ble-plx-app-side-implementation.md`'s "base64 trap"
 * section. The gimbal packet is always exactly 4 bytes, so a small manual
 * encoder is simpler and more honest than adding a polyfill dependency for
 * one call site — same call already made for the dashed-line renderer over
 * `react-native-svg` (`docs/VERIFICATION_REPORT.md`, 2026-08-13 evening).
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard Base64 (RFC 4648 §4) with `=` padding — what every BLE write call expects. */
export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);

    result += BASE64_ALPHABET[(chunk >> 18) & 0x3f];
    result += BASE64_ALPHABET[(chunk >> 12) & 0x3f];
    result += b1 !== undefined ? BASE64_ALPHABET[(chunk >> 6) & 0x3f] : '=';
    result += b2 !== undefined ? BASE64_ALPHABET[chunk & 0x3f] : '=';
  }

  return result;
}
