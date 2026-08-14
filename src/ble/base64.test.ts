import { bytesToBase64 } from './base64';

/**
 * Ground truth comes from Node's own `Buffer`, available because Jest runs
 * under Node — but this project has no `@types/node` (deliberately: adding
 * it would make `Buffer` typecheck everywhere in `src/`, masking the exact
 * "works under Jest, throws on Hermes" gap `base64.ts`'s doc comment exists
 * to avoid). This local, minimally-typed handle keeps that check scoped to
 * this one test file instead.
 */
const nodeBuffer = (
  globalThis as unknown as {
    Buffer: { from(bytes: Uint8Array): { toString(encoding: 'base64'): string } };
  }
).Buffer;

describe('bytesToBase64', () => {
  it('encodes an empty array as an empty string', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  // Ground truth for every non-trivial case below comes from Node's own
  // Buffer implementation — trusted, independent of this hand-rolled
  // encoder, and available here because tests run under Node/Jest (this is
  // exactly the environment split base64.ts's own doc comment describes:
  // Node has Buffer, Hermes/RN does not).
  const cases: Array<number[]> = [
    [0],
    [255],
    [0, 0],
    [1, 2],
    [255, 255],
    [0, 0, 0],
    [1, 2, 3],
    [255, 255, 255],
    [1, 2, 3, 4], // the actual gimbal packet length
    [0, 0, 0, 0],
    [255, 255, 255, 255],
    [1, 2, 3, 4, 5, 6, 7],
  ];

  it.each(cases)('matches Buffer.toString("base64") for %j', (...byteValues) => {
    const bytes = new Uint8Array(byteValues);
    expect(bytesToBase64(bytes)).toBe(nodeBuffer.from(bytes).toString('base64'));
  });

  it('pads a 4-byte packet (the actual gimbal packet length) to a length-8 string with "=="', () => {
    // 4 bytes = one full 3-byte group + a 1-byte remainder, which base64
    // always pads with "==" (RFC 4648 §4) — confirmed against Buffer above,
    // this test just makes the exact shape explicit for the packet length
    // src/ble/encodeGimbalPacket.ts actually produces.
    const result = bytesToBase64(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
    expect(result).toHaveLength(8);
    expect(result.endsWith('==')).toBe(true);
  });

  it('does not mutate its input', () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const snapshot = [...bytes];
    bytesToBase64(bytes);
    expect([...bytes]).toEqual(snapshot);
  });
});
