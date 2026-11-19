import { describe, expect, it } from 'vitest';
import { ceilingMoreSummary, openingSummary, wallMoreSummary } from './moreSummary';

describe('wallMoreSummary', () => {
  it('ściana CW: rozstaw, wełna, folia, słupki i końce', () => {
    expect(
      wallMoreSummary({ spacing: 60, cw: true, wool: { on: true, mm: 75 }, vapor: false, ends: ['narożnik', 'narożnik'] }),
    ).toEqual(['rozstaw 60 cm', 'wełna 75 mm', 'bez folii', 'słupki pojedyncze', 'końce: narożnik']);
  });
  it('różne końce i słupki podwójne', () => {
    expect(wallMoreSummary({ spacing: 40, cw: true, doubleStuds: true, ends: ['wolny', 'trójnik'] })).toEqual([
      'rozstaw 40 cm',
      'słupki podwójne',
      'końce: wolny / trójnik',
    ]);
  });
  it('okładzina na łącznikach bez wełny i folii w systemie', () => {
    expect(wallMoreSummary({ spacing: 60, pointFix: true, cw: false })).toEqual(['łączniki co 60 cm']);
  });
});

describe('ceilingMoreSummary', () => {
  it('kierunek, wełna wyłączona, folia', () => {
    expect(ceilingMoreSummary({ direction: 'wzdłuż długości', wool: { on: false, mm: 100 }, vapor: true })).toEqual([
      'profile wzdłuż długości',
      'bez wełny',
      'folia',
    ]);
  });
});

describe('openingSummary', () => {
  it('drzwi i okno', () => {
    expect(openingSummary({ kind: 'door', width: 90, height: 205, sill: 0, offset: 100 }, 'Drzwi 1')).toBe('Drzwi 1: 90×205 cm · 100 cm od początku');
    expect(openingSummary({ kind: 'window', width: 120, height: 120.4, sill: 90, offset: 40 }, 'Okno 2')).toBe(
      'Okno 2: 120×120 cm · parapet 90 cm · 40 cm od początku',
    );
  });
});
