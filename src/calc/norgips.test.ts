import { describe, expect, it } from 'vitest';
import { BOARDS, CEILING_SYSTEMS, WALL_SYSTEMS, boardById, wallMaxHeight, wallSystemById, ceilingSystemById } from '../catalog/rigips';
import { NORGIPS_BOARDS, NORGIPS_CEILING_SYSTEMS, NORGIPS_WALL_SYSTEMS } from '../catalog/norgips';
import { ceilingConsumption, wallConsumption, type ConsumptionLine } from './materials';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
const all = [...NORGIPS_WALL_SYSTEMS, ...NORGIPS_CEILING_SYSTEMS];

describe('katalog Norgips – spójność', () => {
  it('systemy i płyty Norgips są dołączone do wspólnego katalogu', () => {
    for (const s of NORGIPS_WALL_SYSTEMS) expect(WALL_SYSTEMS).toContain(s);
    for (const s of NORGIPS_CEILING_SYSTEMS) expect(CEILING_SYSTEMS).toContain(s);
    for (const b of NORGIPS_BOARDS) expect(BOARDS).toContain(b);
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length);
  });
  it('każdy system ma producenta, link do norgips.pl, płytę Norgips i odmiany z tabeli', () => {
    for (const s of all) {
      expect(s.maker, s.id).toBe('norgips');
      expect(s.code, s.id).toBeUndefined(); // kody Rigips (3.40.01…) nie dotyczą Norgips
      expect(s.source.url, s.id).toMatch(/^https:\/\/norgips\.pl\/rozwiazania\/[a-z-]+\/$/);
      expect(s.source.approx, s.id).toBeUndefined();
      expect(boardById(s.defaultBoard).maker, s.id).toBe('norgips');
      expect(s.variants?.length, s.id).toBeGreaterThan(0);
      for (const v of s.variants!) {
        expect(boardById(v.board!).id, `${s.id}: ${v.label}`).toBe(v.board);
        expect(boardById(v.board!).maker).toBe('norgips');
      }
    }
  });
  it('obejmuje ściany, szachty, okładziny, sufity i poddasza, z systemami podstawowymi w każdej grupie', () => {
    const wallCats = new Set(NORGIPS_WALL_SYSTEMS.map((s) => s.category));
    expect(wallCats).toEqual(new Set(['działowa', 'podwójna', 'instalacyjna', 'szacht', 'okładzina']));
    for (const c of wallCats) expect(NORGIPS_WALL_SYSTEMS.some((s) => s.category === c && s.basic), c).toBe(true);
    expect(new Set(NORGIPS_CEILING_SYSTEMS.map((s) => s.kind))).toEqual(new Set(['two-level', 'one-level', 'direct']));
    expect(NORGIPS_CEILING_SYSTEMS.some((s) => s.id.startsWith('NG-ZP-') && s.basic)).toBe(true);
    // pozostałe systemy są pod „Pozostałe systemy”
    expect(all.filter((s) => s.basic).length).toBeLessThan(all.length / 2);
  });
  it('wysokość systemu = wysokość z tabeli dla płyty domyślnej', () => {
    for (const s of NORGIPS_WALL_SYSTEMS) {
      const v = s.variants!.find((x) => x.board === s.defaultBoard && !x.doubleStuds && !x.studSpacing);
      if (v?.maxHeight && s.maxHeight) expect(wallMaxHeight(s, s.studSpacing), s.id).toBe(v.maxHeight);
    }
  });
});

describe('katalog Norgips – wartości z tabel norgips.pl', () => {
  it('SD CW 50, 1×12,5: GKB EI 15 / Rw 41 dB, GKF EI 60, bez wełny EI 45, do 3,3 m', () => {
    const s = wallSystemById('NG-SD-CW50-1');
    expect(s.maxHeight).toEqual({ 60: 330 });
    const gkb = s.variants!.find((v) => v.board === 'NG-GKB12.5')!;
    expect(gkb).toMatchObject({ fire: 15, rw: 41, ra1: 39, wool: 50, thickness: 75, mass: 15 });
    const gkf = s.variants!.filter((v) => v.board === 'NG-GKF12.5');
    expect(gkf.map((v) => [v.fire, v.wool])).toEqual([
      [60, 50],
      [45, 0],
    ]);
  });
  it('SD CW 75, 2×12,5: do 5,8 m, EI 60–120', () => {
    const s = wallSystemById('NG-SD-CW75-2');
    expect(s.maxHeight).toEqual({ 60: 580 });
    expect(s.fire).toBe('EI 60 – EI 120');
  });
  it('ściana wysoka SDW: słupki co 30 cm do 9 m, podwójne co 40 cm do 10 m', () => {
    const s = wallSystemById('NG-SDW-CW100-2');
    expect(s.studSpacing).toBe(30);
    expect(wallMaxHeight(s, 30)).toBe(900);
    expect(s.variants!.find((v) => v.doubleStuds && v.studSpacing === 40)?.maxHeight).toBe(1000);
  });
  it('ściana międzylokalowa 2×CW 100 ma odmianę wysoką 6,8 m z zestawienia ścian wysokich', () => {
    const s = wallSystemById('NG-SDM-2CW100-2');
    expect(s.variants!.some((v) => v.maxHeight === 680 && /ścian wysokich/.test(v.label))).toBe(true);
  });
  it('szacht SO: odmiany ze słupkami podwójnymi są wyższe', () => {
    const s = wallSystemById('NG-SO-CW50-1');
    const single = s.variants!.find((v) => v.board === 'NG-GKF12.5' && !v.doubleStuds)!;
    const dbl = s.variants!.find((v) => v.board === 'NG-GKF12.5' && v.doubleStuds)!;
    expect([single.maxHeight, dbl.maxHeight]).toEqual([230, 290]);
    expect(s.sides).toBe(1);
  });
  it('sufit SP: GKB 12,5 z CD co 50 cm, płyty ogniowe co 40 cm (w opisie odmiany)', () => {
    const s = ceilingSystemById('NG-SP-1');
    expect(s.secondarySpacing).toBe(50);
    expect(s.variants!.filter((v) => v.board === 'NG-GKF12.5').every((v) => /CD co 40 cm/.test(v.label))).toBe(true);
    expect(s.variants!.find((v) => v.board === 'NG-GKF12.5')?.fire).toBe(15);
  });
});

describe('katalog Norgips – silnik liczy zgodnie z kalkulatorem Norgips', () => {
  it('SD CW 75, 2×12,5: 4 m² płyt, wkręty 25 mm ok. 10 i 35 mm 24 szt./m²', () => {
    const c = wallConsumption(wallSystemById('NG-SD-CW75-2'));
    expect(q(c, 'board:NG-GKB12.5')).toBeCloseTo(4);
    expect(q(c, 'TN25')).toBeCloseTo(9); // kalkulator: 10
    expect(q(c, 'TN35')).toBeCloseTo(24);
    expect(q(c, 'CW75')).toBeGreaterThan(1.6);
    expect(q(c, 'CW75')).toBeLessThan(2.1); // kalkulator: 1,8 mb/m²
  });
  it('ściana wysoka co 30 cm: dwa razy więcej wkrętów niż co 60 cm', () => {
    const c = wallConsumption(wallSystemById('NG-SDW-CW100-2'));
    expect(q(c, 'TN35')).toBeCloseTo(48); // kalkulator: 48
    expect(q(c, 'CW100')).toBeGreaterThan(3.2); // kalkulator: 3,6
  });
  it('sufit SP 1×12,5: wkręty co 17 cm (25 szt./m²) i wieszaki co 85 cm', () => {
    const c = ceilingConsumption(ceilingSystemById('NG-SP-1'));
    expect(q(c, 'TN25')).toBeCloseTo(25);
    expect(q(c, 'WIESZAK_NONIUSZ')).toBeGreaterThan(1.1);
    expect(q(c, 'WIESZAK_NONIUSZ')).toBeLessThan(1.5); // kalkulator: 1,3
  });
  it('zabudowa poddasza ZP liczy wieszaki ES, bez noniuszy', () => {
    const c = ceilingConsumption(ceilingSystemById('NG-ZP-1'));
    expect(q(c, 'WIESZAK_ES')).toBeGreaterThan(2.5); // kalkulator: 3
    expect(q(c, 'WIESZAK_NONIUSZ')).toBe(0);
  });
});
