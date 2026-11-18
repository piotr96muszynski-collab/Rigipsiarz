import { describe, expect, it } from 'vitest';
import { buildFrame, crc8, distanceCm, ENABLE_SYNC, floatCandidates, fromHex, parseFrame, toHex } from './bosch';

/** Ramka wyniku taka, jak opisują ją otwarte projekty: C0 55 10 <tryb> … float32 LE od bajtu 7 */
function resultFrame(meters: number, mode = 0x06): Uint8Array {
  const payload = new Uint8Array(16);
  payload[0] = mode;
  new DataView(payload.buffer).setFloat32(4, meters, true);
  return buildFrame(0x55, Array.from(payload));
}

describe('protokół Bosch', () => {
  it('polecenie synchronizacji ma znaną postać C0 55 02 01 00 1A', () => {
    expect(toHex(ENABLE_SYNC)).toBe('C0 55 02 01 00 1A');
  });

  it('CRC-8 (0xA6, start 0xAA)', () => {
    expect(crc8([0xc0, 0x55, 0x02, 0x01, 0x00])).toBe(0x1a);
  });

  it('odczytuje odległość z ramki wyniku', () => {
    const f = resultFrame(2.345);
    expect(f.length).toBe(20);
    const p = parseFrame(f)!;
    expect(p.crcOk).toBe(true);
    expect(p.mode).toBe(0x06);
    expect(p.meters).toBeCloseTo(2.345, 5);
    expect(distanceCm(f)).toBe(234.5);
  });

  it('zaokrągla do milimetra', () => {
    expect(distanceCm(resultFrame(3.0004))).toBe(300);
    expect(distanceCm(resultFrame(0.0567))).toBe(5.7);
  });

  it('pomija inne tryby (np. powierzchnię) i wartości spoza zakresu', () => {
    expect(distanceCm(resultFrame(12.5, 0x08))).toBeNull();
    expect(distanceCm(resultFrame(0))).toBeNull();
    expect(distanceCm(resultFrame(-1))).toBeNull();
    expect(distanceCm(resultFrame(999))).toBeNull();
  });

  it('pomija dane, które nie są ramką Bosch', () => {
    expect(parseFrame(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(parseFrame(new Uint8Array([0xc0, 0x55, 0x10, 0x06]))).toBeNull();
    expect(distanceCm(new Uint8Array([0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a]))).toBeNull();
  });

  it('oznacza złą sumę kontrolną, ale nie odrzuca ramki', () => {
    const f = resultFrame(1.5);
    f[19] ^= 0xff;
    expect(parseFrame(f)!.crcOk).toBe(false);
    expect(distanceCm(f)).toBe(150);
  });

  it('diagnostyka znajduje float z odległością', () => {
    const c = floatCandidates(resultFrame(4.2));
    expect(c.some((x) => x.offset === 7 && Math.abs(x.meters - 4.2) < 1e-4)).toBe(true);
  });

  it('hex w obie strony', () => {
    expect(toHex(fromHex('c0 55 02 01 00 1a')!)).toBe('C0 55 02 01 00 1A');
    expect(toHex(fromHex('0xC0,0x55')!)).toBe('C0 55');
    expect(fromHex('C0 5')).toBeNull();
    expect(fromHex('zz')).toBeNull();
  });
});
