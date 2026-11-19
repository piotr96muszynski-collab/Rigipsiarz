import { describe, expect, it } from 'vitest';
import type { Attic } from '../model/types';
import { createProject } from '../model/factory';
import { atticGrid, atticSection, cdLinePositions, hangerRafters, pitchForRidge, rafterPositions, ridgeHeightFor } from './attic';
import { atticRequirement } from './atticMaterials';
import { calculateProject } from './materials';

const attic = (o: Partial<Attic> = {}): Attic => ({
  id: 'a1',
  roof: 'gable',
  width: 800,
  length: 1000,
  kneeLeft: 100,
  kneeRight: 100,
  pitch: 45,
  collarHeight: 260,
  rafterSpacing: 90,
  rafterWidth: 8,
  rafterHeight: 18,
  firstRafter: 10,
  systemId: 'S-PODD-1',
  boardId: 'RB12.5',
  woolBetween: 150,
  woolUnder: 0,
  ...o,
});

describe('przekrój poddasza', () => {
  it('dach dwuspadowy 45° z jętką: dwa skosy i sufit', () => {
    const s = atticSection(attic());
    expect(s.surfaces.map((x) => x.id)).toEqual(['left', 'collar', 'right']);
    // skos od 1,00 do 2,60 m przy 45° → 160·√2
    expect(s.surfaces[0].run).toBeCloseTo(160 * Math.SQRT2, 3);
    expect(s.surfaces[2].run).toBeCloseTo(160 * Math.SQRT2, 3);
    // sufit: 800 − 2·160
    expect(s.surfaces[1].run).toBeCloseTo(480, 3);
    expect(s.ridgeHeight).toBeCloseTo(500, 3);
    expect(s.ridgeX).toBeCloseTo(400, 3);
  });

  it('bez jętki skosy schodzą się w kalenicy', () => {
    const s = atticSection(attic({ collarHeight: undefined }));
    expect(s.surfaces.map((x) => x.id)).toEqual(['left', 'right']);
    expect(s.surfaces[0].run).toBeCloseTo(400 * Math.SQRT2, 3);
    expect(s.hasCollar).toBe(false);
  });

  it('jętka powyżej kalenicy jest pomijana z ostrzeżeniem', () => {
    const s = atticSection(attic({ collarHeight: 600 }));
    expect(s.hasCollar).toBe(false);
    expect(s.warnings.join(' ')).toMatch(/powyżej kalenicy/);
  });

  it('różne ścianki kolankowe przesuwają kalenicę', () => {
    const s = atticSection(attic({ kneeLeft: 50, kneeRight: 150, collarHeight: undefined }));
    // 50 + x = 150 + (800 − x) → x = 450
    expect(s.ridgeX).toBeCloseTo(450, 3);
    expect(s.ridgeHeight).toBeCloseTo(500, 3);
  });

  it('dach jednospadowy: skos od lewej ściany, sufit do prawej', () => {
    const s = atticSection(attic({ roof: 'mono', pitch: 30, kneeLeft: 120, collarHeight: 300 }));
    expect(s.surfaces.map((x) => x.id)).toEqual(['left', 'collar']);
    const x = 180 / Math.tan(Math.PI / 6);
    expect(s.surfaces[0].run).toBeCloseTo(180 / Math.sin(Math.PI / 6), 3);
    expect(s.surfaces[1].run).toBeCloseTo(800 - x, 3);
  });

  it('skos od podłogi (bez ścianki kolankowej) po odsunięciu lica zaczyna się na posadzce', () => {
    const s = atticSection(attic({ kneeLeft: 0, kneeRight: 0, collarHeight: undefined }), 5);
    expect(s.surfaces[0].a.z).toBeCloseTo(0, 6);
    expect(s.surfaces[0].a.x).toBeCloseTo(5 * Math.SQRT2, 3);
  });

  it('lico płyt jest odsunięte od spodu krokwi o grubość zabudowy', () => {
    const s0 = atticSection(attic());
    const s1 = atticSection(attic(), 10);
    // sufit niżej o 10 cm; skos odsunięty w pionie o 10·√2, więc sufit węższy o 2·(10·√2 − 10)
    expect(s1.surfaces[1].a.z).toBeCloseTo(250, 6);
    expect(s1.surfaces[0].a.z).toBeCloseTo(100 - 10 * Math.SQRT2, 3);
    expect(s1.surfaces[1].run).toBeCloseTo(s0.surfaces[1].run - 2 * (10 * Math.SQRT2 - 10), 3);
  });

  it('kąt i wysokość kalenicy przeliczają się w obie strony', () => {
    const a = attic({ pitch: 38, kneeLeft: 90, kneeRight: 110 });
    expect(pitchForRidge(a, ridgeHeightFor(a))).toBeCloseTo(38, 6);
    const m = attic({ roof: 'mono', pitch: 22 });
    expect(pitchForRidge(m, ridgeHeightFor(m))).toBeCloseTo(22, 6);
  });
});

describe('krokwie, profile i wieszaki', () => {
  it('osie krokwi od pierwszej co rozstaw', () => {
    expect(rafterPositions({ length: 1000, rafterSpacing: 90, firstRafter: 10 })).toEqual([10, 100, 190, 280, 370, 460, 550, 640, 730, 820, 910, 1000]);
    expect(rafterPositions({ length: 300, rafterSpacing: 100, firstRafter: 50 })).toEqual([50, 150, 250]);
  });

  it('linie CD: skrajne 10 cm od krawędzi, pośrednie co rozstaw', () => {
    expect(cdLinePositions(200, 40)).toEqual([10, 50, 90, 130, 170, 190]);
    expect(cdLinePositions(90, 40)).toEqual([10, 50, 80]);
    expect(cdLinePositions(15, 40)).toEqual([7.5]);
    const p = cdLinePositions(160 * Math.SQRT2, 50);
    for (let i = 1; i < p.length; i++) expect(p[i] - p[i - 1]).toBeLessThanOrEqual(50 + 1e-6);
  });

  it('wieszaki na co drugiej krokwi, gdy krokwie są gęsto', () => {
    // krokwie co 45 cm, wieszaki max co 100 cm → co druga
    const r = rafterPositions({ length: 500, rafterSpacing: 45, firstRafter: 5 });
    const h = hangerRafters(r, 100);
    expect(h[0]).toBe(r[0]);
    expect(h[h.length - 1]).toBe(r[r.length - 1]);
    for (let i = 1; i < h.length; i++) expect(h[i] - h[i - 1]).toBeLessThanOrEqual(100);
    expect(h.length).toBeLessThan(r.length);
    // krokwie co 90 cm → każda
    const r2 = rafterPositions({ length: 500, rafterSpacing: 90, firstRafter: 5 });
    expect(hangerRafters(r2, 100)).toEqual(r2);
  });

  it('krokwie rzadsze niż dopuszczalny rozstaw wieszaków dają ostrzeżenie', () => {
    const g = atticGrid(attic({ rafterSpacing: 120 }));
    expect(g.warnings.join(' ')).toMatch(/większy niż dopuszczalny rozstaw wieszaków/);
    expect(atticGrid(attic()).warnings).toEqual([]);
  });

  it('wełna pod krokwiami pogłębia zabudowę i ma limit wg wieszaka', () => {
    // 4.70.06: karta 45 mm przy 1×12,5
    expect(atticGrid(attic()).depthMm).toBe(45);
    expect(atticGrid(attic({ woolUnder: 50 })).depthMm).toBe(63);
    // uchwyt elastyczny do 90 mm, wieszak do poddaszy do 150 mm
    expect(atticGrid(attic({ woolUnder: 100 })).warnings.join(' ')).toMatch(/nie zmieści się/);
    expect(atticGrid(attic({ woolUnder: 100, systemId: 'S-4.70.04-1' })).warnings).toEqual([]);
  });
});

describe('materiały poddasza', () => {
  it('ilości wynikają z linii CD i krokwi', () => {
    const a = attic();
    const r = atticRequirement(a);
    const lines = r.grid.surfaces.reduce((n, g) => n + g.cd.length, 0);
    const rafters = r.grid.rafters.length;
    expect(rafters).toBe(12);
    // CD: każda linia na całą długość 10 m, 2 łączniki wzdłużne na linię (odcinki 4 m)
    expect(r.req.pieces.CD60).toHaveLength(lines);
    expect(r.req.pieces.CD60.every((l) => l === 10)).toBe(true);
    expect(r.req.counts.LACZNIK_WZDL).toBe(lines * 2);
    // wieszak na każdym skrzyżowaniu CD z krokwią, 2 wkręty do drewna i 4 pchełki na wieszak
    expect(r.hangers).toBe(lines * rafters);
    expect(r.req.counts.UCHWYT_ELAST).toBe(lines * rafters);
    expect(r.req.counts.WKRET_DREWNO).toBe(lines * rafters * 2);
    expect(r.req.counts.LN9).toBe(lines * rafters * 4);
    // płyty po licu zabudowy
    const area = r.grid.surfaces.reduce((s, g) => s + g.areaM2, 0);
    expect(r.areaM2).toBeCloseTo(area, 6);
    expect(Object.values(r.req.boardArea).reduce((s, v) => s + v, 0)).toBeCloseTo(area, 6);
    expect(r.req.counts.TN25).toBeCloseTo(area * 25, 6);
    // UD 30: obie ściany szczytowe po skosach i suficie + dwie ścianki kolankowe
    const runs = r.grid.surfaces.reduce((s, g) => s + g.surface.run, 0) / 100;
    expect(r.perimeterM).toBeCloseTo(2 * runs + 2 * 10, 6);
    expect(r.req.meters.TASMA_USZ30).toBeCloseTo(r.perimeterM, 6);
  });

  it('zużycie na m² jest zbliżone do karty Rigips 4.70.06', () => {
    const r = atticRequirement(attic());
    const cd = r.req.pieces.CD60.reduce((s, v) => s + v, 0) / r.areaM2;
    // karta: 3,2 mb CD i 4 uchwyty na m² (rozstaw 40 cm, wieszaki co 100 cm)
    expect(cd).toBeGreaterThan(2.5);
    expect(cd).toBeLessThan(3.6);
    expect(r.hangers / r.areaM2).toBeGreaterThan(2.8);
    expect(r.hangers / r.areaM2).toBeLessThan(4.5);
  });

  it('wieszak do poddaszy nie potrzebuje pchełek', () => {
    const r = atticRequirement(attic({ systemId: 'S-4.70.04-1' }));
    expect(r.req.counts.WIESZAK_PODD).toBe(r.hangers);
    expect(r.req.counts.LN9).toBeUndefined();
  });

  it('wełna między krokwiami bez szerokości krokwi, pod krokwiami na całości', () => {
    const r = atticRequirement(attic({ woolBetween: 150, woolUnder: 50 }));
    expect(r.req.area.WELNA150).toBeCloseTo((r.areaM2 * (90 - 8 + 1.5)) / 90, 6);
    expect(r.req.area.WELNA50).toBeCloseTo(r.areaM2, 6);
    expect(atticRequirement(attic({ woolBetween: 0, vaporBarrier: false })).req.area).toEqual({});
  });

  it('paroizolacja domyślnie włączona: folia 1,18 m²/m² i taśmy wg karty Rigips 4.70', () => {
    const r = atticRequirement(attic());
    expect(r.req.area.FOLIA_PAROIZ).toBeCloseTo(r.areaM2 * 1.18, 6);
    expect(r.req.meters.TASMA_PAROIZ).toBeCloseTo(r.areaM2 * 0.98, 6);
    expect(r.req.meters.TASMA_DWUSTR).toBeCloseTo(r.areaM2 * 0.5, 6);
    const off = atticRequirement(attic({ vaporBarrier: false }));
    expect(off.req.area.FOLIA_PAROIZ).toBeUndefined();
    expect(off.req.meters.TASMA_PAROIZ).toBeUndefined();
  });

  it('dwie warstwy płyt i system Knauf D612', () => {
    const r = atticRequirement(attic({ systemId: 'KN-D612-2', boardId: 'KN-A13' }));
    expect(Object.values(r.req.boardArea).reduce((s, v) => s + v, 0)).toBeCloseTo(r.areaM2 * 2, 6);
    expect(r.req.counts.WIESZAK_ES).toBe(r.hangers);
  });

  it('poddasze wchodzi do zestawienia projektu', () => {
    const p = createProject();
    p.attics = [attic()];
    const c = calculateProject(p);
    expect(c.attics.get('a1')!.areaM2).toBeGreaterThan(0);
    expect(c.stats.atticAreaM2).toBeCloseTo(c.attics.get('a1')!.areaM2, 6);
    const names = c.total.map((l) => l.name).join('|');
    expect(names).toMatch(/Uchwyt elastyczny/);
    expect(names).toMatch(/Wkręt do drewna/);
    expect(names).toMatch(/150 mm/);
    // projekt bez poddaszy działa jak dotąd
    expect(calculateProject(createProject()).attics.size).toBe(0);
  });
});
