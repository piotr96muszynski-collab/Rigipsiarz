import { describe, expect, it } from 'vitest';
import { BurstDetector, parseMeterText } from './keyboardMeter';

const typed = (text: string, gap: number, start = 1000) => {
  const d = new BurstDetector();
  [...text].forEach((_, i) => d.key(start + i * gap));
  return d;
};

describe('dalmierz udający klawiaturę', () => {
  it('rozpoznaje szybką serię znaków jako wpis z dalmierza', () => {
    expect(typed('2.345', 15).isBurst('2.345')).toBe(true);
    expect(typed('2345', 40).isBurst('2345')).toBe(true);
  });

  it('pisanie przez człowieka nie jest serią', () => {
    expect(typed('2.345', 120).isBurst('2.345')).toBe(false);
    expect(typed('25', 10).isBurst('25')).toBe(false); // za krótko
  });

  it('seria musi obejmować cały tekst pola', () => {
    const d = new BurstDetector();
    d.key(0); // człowiek wpisał „1”…
    [...'234'].forEach((_, i) => d.key(500 + i * 10)); // …potem szybka seria
    expect(d.isBurst('1234')).toBe(false);
    expect(d.isBurst('234')).toBe(true);
  });

  it('reset po fokusie', () => {
    const d = typed('2.345', 10);
    d.reset();
    expect(d.isBurst('2.345')).toBe(false);
  });

  it('odczytuje formaty dalmierzy', () => {
    expect(parseMeterText('2.345')).toBe(234.5);
    expect(parseMeterText('2,345')).toBe(234.5);
    expect(parseMeterText('2.345 m')).toBe(234.5);
    expect(parseMeterText('2.345m\n')).toBe(234.5);
    expect(parseMeterText('2345')).toBe(234.5); // tryb mm
    expect(parseMeterText('2345 mm')).toBe(234.5);
    expect(parseMeterText('234.5 cm')).toBe(234.5);
    expect(parseMeterText('0.0567')).toBe(5.7);
  });

  it('odrzuca tekst, który nie jest wymiarem', () => {
    expect(parseMeterText('')).toBeNull();
    expect(parseMeterText('8\' 2"')).toBeNull();
    expect(parseMeterText('abc')).toBeNull();
  });
});
