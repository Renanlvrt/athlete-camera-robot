import { encodeGimbalPacket } from './encodeGimbalPacket';
import type { GimbalCorrection } from '../tracking/types';

/** Decode the packet back to degrees using DataView — an independent path from the encoder. */
function decode(bytes: Uint8Array): { rollDelta: number; pitchDelta: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    rollDelta: view.getInt16(0, false) / 10,
    pitchDelta: view.getInt16(2, false) / 10,
  };
}

describe('encodeGimbalPacket', () => {
  it('is always exactly 4 bytes', () => {
    expect(encodeGimbalPacket({ rollDelta: 0, pitchDelta: 0 })).toHaveLength(4);
    expect(encodeGimbalPacket({ rollDelta: 3.2, pitchDelta: -4.7 })).toHaveLength(4);
  });

  it('round-trips zero', () => {
    const decoded = decode(encodeGimbalPacket({ rollDelta: 0, pitchDelta: 0 }));
    expect(decoded).toEqual({ rollDelta: 0, pitchDelta: 0 });
  });

  it('round-trips a typical positive correction to one decimal place', () => {
    const decoded = decode(encodeGimbalPacket({ rollDelta: 4.2, pitchDelta: 1.5 }));
    expect(decoded.rollDelta).toBeCloseTo(4.2);
    expect(decoded.pitchDelta).toBeCloseTo(1.5);
  });

  it('round-trips a negative correction — the whole reason this format is signed', () => {
    const decoded = decode(encodeGimbalPacket({ rollDelta: -3.7, pitchDelta: -0.1 }));
    expect(decoded.rollDelta).toBeCloseTo(-3.7);
    expect(decoded.pitchDelta).toBeCloseTo(-0.1);
  });

  it('handles roll and pitch independently (no byte-order cross-talk)', () => {
    const decoded = decode(encodeGimbalPacket({ rollDelta: 5, pitchDelta: -5 }));
    expect(decoded.rollDelta).toBeCloseTo(5);
    expect(decoded.pitchDelta).toBeCloseTo(-5);
  });

  it('encodes NaN and Infinity as zero rather than throwing or corrupting the packet', () => {
    const inputs: GimbalCorrection[] = [
      { rollDelta: NaN, pitchDelta: 0 },
      { rollDelta: 0, pitchDelta: Infinity },
      { rollDelta: -Infinity, pitchDelta: NaN },
    ];
    for (const input of inputs) {
      expect(() => encodeGimbalPacket(input)).not.toThrow();
      const decoded = decode(encodeGimbalPacket(input));
      expect(decoded.rollDelta).toBe(0);
      expect(decoded.pitchDelta).toBe(0);
    }
  });

  it('clamps an unrealistically large delta to the int16 range instead of overflowing', () => {
    const decoded = decode(encodeGimbalPacket({ rollDelta: 100000, pitchDelta: -100000 }));
    expect(decoded.rollDelta).toBeCloseTo(3276.7);
    expect(decoded.pitchDelta).toBeCloseTo(-3276.8);
  });

  it('is a pure function — does not mutate the input object', () => {
    const correction: GimbalCorrection = { rollDelta: 2, pitchDelta: -2 };
    const snapshot = { ...correction };
    encodeGimbalPacket(correction);
    expect(correction).toEqual(snapshot);
  });
});
