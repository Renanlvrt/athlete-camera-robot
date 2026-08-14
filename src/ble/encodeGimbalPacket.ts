/**
 * encodeGimbalPacket.ts
 *
 * Single responsibility: turn a `GimbalCorrection` (roll/pitch deltas, in
 * degrees) into the fixed 4-byte wire packet the micro:bit expects.
 *
 * Pure function over plain numbers, no BLE/native imports — unit-testable on
 * Windows with no hardware, same as everything in `src/tracking/`.
 *
 * WIRE FORMAT (per `research/hardware/microbit-ble-link.md`'s 2026-08-14
 * correction): `[roll_hi, roll_lo, pitch_hi, pitch_lo]` — two big-endian
 * SIGNED int16 (two's complement), each a DELTA in tenths of a degree.
 * Signed because `computeGimbalCorrection.ts` deliberately outputs deltas,
 * not absolute angles — the phone doesn't know the servo's true position;
 * the micro:bit adds this delta to its own running position and applies its
 * own mechanical clamps. An earlier research draft proposed an unsigned
 * absolute-angle format that could not represent a negative correction at
 * all; this file is written against the corrected version.
 */

import type { GimbalCorrection } from '../tracking/types';

const INT16_MIN = -32768;
const INT16_MAX = 32767;

/** Degrees → tenths of a degree, rounded, clamped to what an int16 can hold, NaN/Infinity → 0. */
function degreesToClampedTenths(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const tenths = Math.round(degrees * 10);
  return Math.max(INT16_MIN, Math.min(INT16_MAX, tenths));
}

/** Write a signed 16-bit big-endian integer (two's complement) into `bytes` at `offset`. */
function writeInt16BE(bytes: Uint8Array, offset: number, value: number): void {
  const unsigned = value < 0 ? value + 0x10000 : value;
  bytes[offset] = (unsigned >> 8) & 0xff;
  bytes[offset + 1] = unsigned & 0xff;
}

/**
 * Encode a gimbal correction into the fixed 4-byte wire packet.
 *
 * Non-finite deltas (NaN/Infinity — possible from a malformed model output
 * propagating through, though `computeGimbalCorrection.ts` already guards
 * against this) encode as zero rather than throwing or sending garbage over
 * BLE — no silent failure, but also no crash on a bad frame.
 */
export function encodeGimbalPacket(correction: GimbalCorrection): Uint8Array {
  const bytes = new Uint8Array(4);
  writeInt16BE(bytes, 0, degreesToClampedTenths(correction.rollDelta));
  writeInt16BE(bytes, 2, degreesToClampedTenths(correction.pitchDelta));
  return bytes;
}
