import { describe, expect, it } from 'vitest';
import { createAttic } from '../model/factory';
import type { RoofWindow } from '../model/types';
import { atticGrid } from './attic';
import { atticRequirement } from './atticMaterials';
import { atticWindowCutouts, atticWindowGeometry, cdLineSegments, ROOF_WINDOW_SIZES } from './atticWindows';

// krokwie co 90 cm od 10 cm, szer. 8 cm: między osiami 100 i 190 jest 82 cm w świetle – okno 78 cm (szczelina 2 cm)
const win = (o: Partial<RoofWindow> = {}): RoofWindow => ({ id: 'w1', side: 'left', width: 78, height: 118, u: 145, sill: 160, sizeCode: 'VELUX MK06', ...o });
const attic = (o: Partial<RoofWindow> = {}) => createAttic({ windows: [win(o)], pitch: 45, collarHeight: 300 });

describe('okna dachowe – geometria glifów', () => {
  it('glif dolny pionowo, górny poziomo: długości z głębokości ościeżnicy i kąta dachu', () => {
    const a = attic();
    const grid = atticGrid(a);
    const [x] = atticWindowGeometry(a, grid).list;
    // ościeżnica na wierzchu krokwi: 18 cm krokwi + zabudowa pod krokwią
    const depth = 18 + grid.depthMm / 10;
    expect(x.depth).toBeCloseTo(depth, 6);
    expect(x.lower).toBeCloseTo(depth / Math.cos(Math.PI / 4), 6);
    expect(x.upper).toBeCloseTo(depth / Math.sin(Math.PI / 4), 6);
    // dolny narożnik glifu leży pionowo pod dolną krawędzią ościeżnicy, górny – na tej samej wysokości co górna
    expect(x.faceBottom.x).toBeCloseTo(x.frameBottom.x, 6);
    expect(x.faceTop.z).toBeCloseTo(x.frameTop.z, 6);
    expect(x.frameBottom.z).toBe(160);
    // otwór w płytach dłuższy niż okno: po skosie o rzut obu glifów
    const run = x.s1 - x.s0;
    expect(run).toBeGreaterThan(118);
    expect(run).toBeCloseTo(118 + depth * Math.tan(Math.PI / 4) + depth / Math.tan(Math.PI / 4), 0);
    expect(x.u1 - x.u0).toBe(78);
  });

  it('okno między krokwiami: bez ostrzeżeń; krokiew w otworze – ostrzeżenie o wymianach', () => {
    expect(atticWindowGeometry(attic()).warnings).toEqual([]);
    const w = atticWindowGeometry(attic({ u: 100 })).warnings;
    expect(w.some((t) => /przechodzi przez otwór/.test(t) && /wymianami 30–50 cm/.test(t))).toBe(true);
    // szczelina większa niż 2,5 cm z boku
    const narrow = atticWindowGeometry(attic({ width: 55, u: 145 })).warnings;
    expect(narrow.some((t) => /do 0,03 m z każdej strony/.test(t))).toBe(true);
  });

  it('obramowanie otworu: poprzeczki od krokwi do krokwi, boczne po skosie, przerwane linie CD', () => {
    const a = attic();
    const grid = atticGrid(a);
    const [x] = atticWindowGeometry(a, grid).list;
    expect(x.flank).toEqual([100, 190]);
    expect(x.cross.map((c) => [c.u0, c.u1])).toEqual([
      [100, 190],
      [100, 190],
    ]);
    expect(x.side).toHaveLength(2);
    expect(x.interrupted.length).toBeGreaterThan(0);
    const s = x.interrupted[0];
    const seg = cdLineSegments(a.length, s, 'left', [x]);
    expect(seg).toEqual([
      [0, x.side[0].u],
      [x.side[1].u, a.length],
    ]);
    // linia na drugim skosie bez przerwy
    expect(cdLineSegments(a.length, s, 'right', [x])).toEqual([[0, a.length]]);
  });

  it('otwory dla rozkładu płyt w układzie lica płaszczyzny', () => {
    const a = attic();
    const [c] = atticWindowCutouts(a);
    expect(c).toMatchObject({ windowId: 'w1', surfaceId: 'left', u0: 106, u1: 184 });
    expect(c.s0).toBeGreaterThan(0);
  });

  it('okno za wysoko: górny glif przycięty do skosu z ostrzeżeniem', () => {
    const a = attic({ sill: 250 });
    const g = atticWindowGeometry(a);
    expect(g.warnings.some((t) => /górny glif wychodzi/.test(t))).toBe(true);
    expect(g.list[0].s1).toBeCloseTo(g.list[0].g.surface.run, 1);
  });

  it('dach jednospadowy: okno zawsze na lewym skosie', () => {
    const a = createAttic({ roof: 'mono', collarHeight: undefined, width: 500, pitch: 35, windows: [win({ side: 'right' })] });
    expect(atticWindowGeometry(a).list[0].surfaceId).toBe('left');
  });

  it('rozmiary VELUX i FAKRO z oznaczeniami', () => {
    expect(ROOF_WINDOW_SIZES.find((s) => s.code === 'MK06')).toMatchObject({ maker: 'VELUX', width: 78, height: 118 });
    expect(ROOF_WINDOW_SIZES.filter((s) => s.maker === 'FAKRO').length).toBeGreaterThan(10);
  });
});

describe('okna dachowe – materiały', () => {
  it('mniej płyt i wełny pod krokwiami o otwór, więcej o glify; kołnierz, narożniki, akryl, łączniki', () => {
    const base = createAttic({ pitch: 45, collarHeight: 300 });
    const a = attic();
    const r0 = atticRequirement(base);
    const r1 = atticRequirement(a);
    const x = r1.windows.list[0];
    const cut = ((x.u1 - x.u0) * (x.s1 - x.s0)) / 10000;
    expect(r1.areaM2).toBeCloseTo(r0.areaM2 - cut, 6);
    expect(r1.req.area.WELNA50).toBeCloseTo(r0.req.area.WELNA50 - cut + x.revealM2, 6);
    const boards = (r: typeof r0) => Object.values(r.req.boardArea).reduce((t, v) => t + v, 0);
    expect(boards(r1)).toBeCloseTo(boards(r0) - cut + x.revealM2, 6);
    expect(r1.req.counts.KOLNIERZ_PARO).toBe(1);
    expect(r1.req.counts.LACZNIK_JEDNO).toBe(4 + 2 * x.interrupted.length);
    expect(r1.req.counts.AKRYL).toBeGreaterThan(0);
    expect((r1.req.pieces.NAROZNIK ?? []).length).toBeGreaterThan((r0.req.pieces.NAROZNIK ?? []).length);
    const h = r1.grid.frame.hanger!;
    expect(r1.req.counts[h]).toBeGreaterThan(r0.req.counts[h]);
    expect(r1.assumptions.some((t) => /glif dolny pionowo, górny poziomo/.test(t))).toBe(true);
  });

  it('bez paroizolacji nie ma kołnierza', () => {
    const a = { ...attic(), vaporBarrier: false };
    expect(atticRequirement(a).req.counts.KOLNIERZ_PARO).toBeUndefined();
  });

  it('bez okien wynik bez zmian', () => {
    const a = createAttic();
    expect(atticRequirement(a).windows.list).toEqual([]);
    expect(atticRequirement({ ...a, windows: [] }).req).toEqual(atticRequirement(a).req);
  });
});

describe('okna dachowe – dach z narożnikami', () => {
  it('okna pominięte z ostrzeżeniem, zestawienie bez kołnierza', () => {
    const a = { ...attic(), ends: ['hip', 'hip'] as ['hip', 'hip'] };
    const g = atticWindowGeometry(a);
    expect(g.list).toEqual([]);
    expect(g.warnings[0]).toMatch(/pominięto/);
    const r = atticRequirement(a);
    expect(r.warnings.some((t) => /Okna dachowe \(1\) pominięto/.test(t))).toBe(true);
    expect(r.req.counts.KOLNIERZ_PARO).toBeUndefined();
  });
});
