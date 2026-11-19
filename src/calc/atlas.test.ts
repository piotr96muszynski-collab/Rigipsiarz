import { describe, expect, it } from 'vitest';
import { ATLAS_CEILING_SYSTEMS, ATLAS_PACK, ATLAS_WALL_SYSTEMS } from '../catalog/atlas';
import { PRODUCTS, ceilingSystemById, isLiningSystem, wallFrameDepth, wallSystemById } from '../catalog/rigips';
import { calculateProject, ceilingConsumption, ceilingGrid, ceilingRequirement, pointFixCount, wallConsumption, type ConsumptionLine } from './materials';
import { createCeiling, createProject, createWall } from '../model/factory';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
const keys = (lines: ConsumptionLine[]) => lines.map((l) => l.key).sort();

describe('ATLAS M-System 3G – katalog', () => {
  it('systemy są osobną grupą, okładzinami istniejących ścian, ze źródłem i istniejącymi produktami', () => {
    for (const s of ATLAS_WALL_SYSTEMS) {
      expect(s.category).toBe('atlas');
      expect(isLiningSystem(s), s.id).toBe(true);
      expect(PRODUCTS[s.fixer!.product], s.id).toBeDefined();
      expect(s.source.url).toMatch(/^https:\/\//);
    }
    for (const s of ATLAS_CEILING_SYSTEMS) {
      expect(s.kind).toBe('point-fix');
      expect(s.layers).toBe(1); // karta: na sufitach tylko jedna warstwa
      expect(PRODUCTS[s.fixer!.product], s.id).toBeDefined();
      if (s.fixer!.extension) expect(PRODUCTS[s.fixer!.extension], s.id).toBeDefined();
    }
    expect(wallSystemById('A-W-L100').id).toBe('A-W-L100');
    expect(ceilingSystemById('A-S-L250-P300').id).toBe('A-S-L250-P300');
  });
  it('okładziny Rigips (CD, klej) też są okładzinami, ściany działowe nie', () => {
    expect(isLiningSystem(wallSystemById('O-KLEJ'))).toBe(true);
    expect(isLiningSystem(wallSystemById('O-CD-1'))).toBe(true);
    expect(isLiningSystem(wallSystemById('W-CW75-2'))).toBe(false);
  });
  it('łącznik zestawu sprzedawany w opakowaniach po 21 szt.', () => {
    expect(PRODUCTS.ATLAS_3G_L100.pack).toBe(ATLAS_PACK);
    expect(ATLAS_PACK).toBe(21);
  });
  it('grubość okładziny w rzucie = średni odstęp płyty od muru', () => {
    expect(wallFrameDepth(wallSystemById('A-W-L100'))).toBe(32); // 14–50 mm
    expect(wallFrameDepth(wallSystemById('A-W-L200'))).toBe(125);
  });
});

describe('ATLAS M-System 3G – wyliczenia', () => {
  it('siatka łączników liczy rzędy i kolumny przy krawędziach', () => {
    expect(pointFixCount(1.2, 1, 0.6, 0.5)).toBe(3 * 3);
    expect(pointFixCount(5, 2.75, 0.6, 0.5)).toBe(10 * 7);
    // otwór 1×2 m przy siatce 0,6×0,5 → 6 łączników mniej
    expect(pointFixCount(5, 2.75, 0.6, 0.5, 2)).toBe(64);
  });
  it('ściana: tylko płyta, łączniki, spoinowanie ATLAS – bez profili i wkrętów TN', () => {
    const c = wallConsumption(wallSystemById('A-W-L100'));
    expect(keys(c)).toEqual(['ATLAS_3G_L100', 'ATLAS_GTA', 'ATLAS_STONER', 'TASMA_SPOIN', 'board:RB12.5']);
    expect(q(c, 'board:RB12.5')).toBeCloseTo(1);
    expect(q(c, 'ATLAS_3G_L100')).toBeCloseTo(70 / 13.75);
    expect(q(c, 'ATLAS_STONER')).toBeCloseTo(0.25);
  });
  it('na dużej ścianie zużycie zbliża się do wydajności z karty (60×50 → ok. 6 m² z opakowania)', () => {
    const n = pointFixCount(20, 10, 0.6, 0.5);
    const m2PerPack = (20 * 10 * ATLAS_PACK) / n;
    expect(m2PerPack).toBeGreaterThan(5.4);
    expect(m2PerPack).toBeLessThan(6.5);
  });
  it('ściana dwuwarstwowa: siatka 60×60, płyta 2 m²/m²', () => {
    const c = wallConsumption(wallSystemById('A-W-L100-2'));
    expect(q(c, 'board:RB12.5')).toBeCloseTo(2);
    expect(q(c, 'ATLAS_3G_L100')).toBeCloseTo((10 * 6) / 13.75);
    expect(q(c, 'ATLAS_STONER')).toBeCloseTo(0.5);
  });
  it('wełna nie jest liczona – zamiast niej ostrzeżenie', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { systemId: 'A-W-L100', boardId: 'RB12.5', height: 260, studSpacing: 60, insulation: true })];
    const calc = calculateProject(p);
    const r = calc.walls.get(p.walls[0].id)!;
    expect(Object.keys(r.req.area)).toEqual([]);
    expect(r.info.warnings.join(' ')).toMatch(/wełny/);
    expect(r.info.studPositions).toEqual([]);
    // skrajne 7 cm od krawędzi (instrukcja ATLAS): kolumny 7, 60 … 360, 393 cm = 8;
    // rzędy 7 … 253 cm co ≤ 50 cm (5 odstępów po 49,2) = 6 → 48 szt. → 3 opakowania
    const line = calc.total.find((l) => l.key === 'ATLAS_3G_L100')!;
    expect(line.qty).toBe(48);
    expect(line.packs).toBe(3);
  });
  it('sufit 10×8 m: łączniki jak w prostokątnej siatce 40×50, bez profili CD/UD', () => {
    const c = ceilingConsumption(ceilingSystemById('A-S-L100'));
    // 50 cm wzdłuż płyt (10 m: 7, 50 … 950, 993 = 21), 40 cm w poprzek (8 m: 7, 40 … 760, 793 = 21)
    expect(q(c, 'ATLAS_3G_L100')).toBeCloseTo((21 * 21) / 80);
    expect(q(c, 'CD60')).toBe(0);
    expect(q(c, 'UD30')).toBe(0);
    expect(q(c, 'KOTWA')).toBe(0);
    expect(q(c, 'TN25')).toBe(0);
  });
  it('sufit z przedłużką liczy przedłużki 1:1 z łącznikami', () => {
    const c = ceilingConsumption(ceilingSystemById('A-S-L250-P300'));
    expect(q(c, 'ATLAS_PLUS_L300')).toBeCloseTo(q(c, 'ATLAS_3G_L250'));
  });
  it('sufit nie ma linii rusztu (rysunek, 3D)', () => {
    const p = createProject();
    const c = createCeiling(
      p,
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      { systemId: 'A-S-L100', boardId: 'RB12.5', insulation: false, direction: 0 },
    );
    expect(ceilingGrid(c)).toEqual([]);
    const r = ceilingRequirement(c);
    // wzdłuż płyt co 50 cm: 7, 50 … 350, 393 (9); w poprzek co 40 cm: 7, 40 … 280, 293 (9)
    expect(r.req.counts.ATLAS_3G_L100).toBe(81);
    expect(r.warnings).toEqual([]);
  });
});
