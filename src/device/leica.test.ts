import { describe, expect, it } from 'vitest';
import { fromHex } from './bosch';
import {
  describeLeica,
  isLeicaCharacteristic,
  LEICA_COMMAND,
  LEICA_DISTANCE,
  LEICA_DISTANCE_UNIT,
  LEICA_INCLINATION,
  LEICA_MEASURE,
  LEICA_SERVICE,
  leicaDistanceCm,
  leicaMeters,
} from './leica';

const f32 = (v: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return b;
};

describe('protokół Leica DISTO (z opisu publicznego, niesprawdzony na sprzęcie)', () => {
  it('UUID usługi i charakterystyk', () => {
    expect(LEICA_SERVICE).toBe('3ab10100-f831-4395-b29d-570977d5bf94');
    expect(LEICA_DISTANCE).toBe('3ab10101-f831-4395-b29d-570977d5bf94');
    expect(LEICA_COMMAND).toBe('3ab10109-f831-4395-b29d-570977d5bf94');
    expect(isLeicaCharacteristic('3AB10101-F831-4395-B29D-570977D5BF94')).toBe(true);
    expect(isLeicaCharacteristic('00004301-0000-0041-5253-534f46540000')).toBe(false);
  });

  it('odczytuje odległość: float32 LE w metrach', () => {
    // 2,345 m = 0x4016147B
    expect(leicaMeters(fromHex('7B 14 16 40')!)).toBeCloseTo(2.345, 5);
    expect(leicaDistanceCm(LEICA_DISTANCE, fromHex('7B 14 16 40')!)).toBe(234.5);
    // 7,001 m
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(7.001))).toBe(700.1);
  });

  it('zaokrągla do milimetra', () => {
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(3.0004))).toBe(300);
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(0.0567))).toBe(5.7);
  });

  it('wartość z innej charakterystyki nie jest odległością', () => {
    expect(leicaDistanceCm(LEICA_INCLINATION, f32(0.5))).toBeNull();
    expect(leicaDistanceCm(LEICA_DISTANCE_UNIT, f32(2))).toBeNull();
    expect(leicaDistanceCm('00004301-0000-0041-5253-534f46540000', f32(2))).toBeNull();
  });

  it('odrzuca błędne i nierealne wartości', () => {
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(0))).toBeNull();
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(-1))).toBeNull();
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(NaN))).toBeNull();
    expect(leicaDistanceCm(LEICA_DISTANCE, f32(9999))).toBeNull();
    expect(leicaDistanceCm(LEICA_DISTANCE, new Uint8Array([1, 2]))).toBeNull();
  });

  it('polecenie pomiaru to ASCII „g”', () => {
    expect(Array.from(LEICA_MEASURE)).toEqual([0x67]);
  });

  it('opisy w dzienniku diagnostyki', () => {
    expect(describeLeica(LEICA_DISTANCE, f32(1.5))).toBe('Leica odległość: 1.5000 m');
    expect(describeLeica(LEICA_INCLINATION, f32(Math.PI / 4))).toBe('Leica nachylenie: 45.0°');
    expect(describeLeica(LEICA_DISTANCE_UNIT, new Uint8Array([3, 0]))).toBe('Leica jednostka odległości: kod 3');
    expect(describeLeica('00002a19-0000-1000-8000-00805f9b34fb', f32(1))).toBeNull();
  });
});
