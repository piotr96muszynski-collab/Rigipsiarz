import { describe, expect, it } from 'vitest';
import { BOSCH_CHANNELS, DIAG_CANDIDATE_SERVICES, buildFrame, crc8, distanceCm, ENABLE_SYNC, floatCandidates, fromHex, isBoschCharacteristic, parseFrame, toHex } from './bosch';

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

describe('usługi BLE różnych modeli', () => {
  it('rozpoznaje charakterystykę nowszych modeli (PLR 30 C) i starszych (GLM 50 C)', () => {
    expect(isBoschCharacteristic('00004301-0000-0041-5253-534F46540000')).toBe(true);
    expect(isBoschCharacteristic('02a6c0d1-0451-4000-b000-fb3210111989')).toBe(true);
    expect(isBoschCharacteristic('00002a19-0000-1000-8000-00805f9b34fb')).toBe(false);
  });
  it('najpierw próbuje usługi nowszych modeli', () => {
    expect(BOSCH_CHANNELS[0].service).toBe('00005301-0000-0041-5253-534f46540000');
  });
});

describe('diagnostyka', () => {
  it('lista kandydatów zawiera obie usługi Bosch', () => {
    for (const c of BOSCH_CHANNELS) expect(DIAG_CANDIDATE_SERVICES).toContain(c.service);
  });
  it('lista kandydatów zawiera usługę Leica DISTO', () => {
    expect(DIAG_CANDIDATE_SERVICES).toContain('3ab10100-f831-4395-b29d-570977d5bf94');
  });
});

describe('ramki z prawdziwego PLR 30 C (dziennik z 2026-11-19)', () => {
  it('odczytuje odległość z ramek wyniku', () => {
    expect(distanceCm(fromHex('C0 55 10 06 00 F2 13 C8 07 E0 40 00 00 00 00 00 00 00 00 FE')!)).toBe(700.1);
    expect(distanceCm(fromHex('C0 55 10 06 00 F3 13 5F 76 DD 40 00 00 00 00 00 00 00 00 C4')!)).toBe(692.1);
  });
  it('sumy kontrolne ramek się zgadzają', () => {
    expect(parseFrame(fromHex('C0 55 10 06 00 F2 13 C8 07 E0 40 00 00 00 00 00 00 00 00 FE')!)?.crcOk).toBe(true);
  });
  it('odpowiedź na włączenie synchronizacji (bez nagłówka C0) nie jest pomiarem', () => {
    expect(distanceCm(fromHex('00 10 02 00 F1 13 00 00 00 00 00 00 00 00 00 00 00 00 EC')!)).toBeNull();
  });
});
