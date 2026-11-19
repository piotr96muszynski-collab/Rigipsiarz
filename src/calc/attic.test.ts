import { describe, expect, it } from 'vitest';
import type { Attic } from '../model/types';
import { createAttic, createProject } from '../model/factory';
import { atticGrid, atticSection, cdLinePositions, hangerRafters, pitchForRidge, rafterPositions, ridgeHeightFor } from './attic';
import { atticRequirement } from './atticMaterials';
import { calculateProject } from './materials';
import { CEILING_SYSTEMS } from '../catalog/rigips';
import { recommendCeilings } from './recommend';

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

describe('ruszty poddaszy inne niż CD 60 na uchwytach (karty Rigips 4.70.01–4.71.12, Norgips ZP)', () => {
  const sum = (v: number[] | undefined) => (v ?? []).reduce((s, x) => s + x, 0);
  const lines = (g: ReturnType<typeof atticGrid>) => g.surfaces.reduce((n, s) => n + s.cd.length, 0);

  it('katalog ma wszystkie systemy poddaszy ze strony Rigips i odmiany Norgips', () => {
    const codes = new Set(CEILING_SYSTEMS.filter((s) => s.attic && !s.maker).map((s) => s.code));
    for (const c of ['4.70.01', '4.70.02', '4.70.03', '4.70.04', '4.70.05', '4.70.06', '4.70.07', '4.70.08', '4.70.81', '4.71.11', '4.71.12']) expect(codes, c).toContain(c);
    const ng = CEILING_SYSTEMS.filter((s) => s.attic && s.maker === 'norgips').map((s) => s.id);
    expect(ng).toEqual(expect.arrayContaining(['NG-ZP-1', 'NG-ZP-2', 'NG-ZP-L-1', 'NG-ZP-L-2', 'NG-ZP-KAP-1', 'NG-ZP-KAP-2']));
    // systemy tylko do poddaszy nie trafiają do doboru zwykłych sufitów
    expect(recommendCeilings({ mount: 'attic', room: 'dry', fire: 0 }).some((p) => p.system.atticFrame)).toBe(false);
  });

  it('4.70.02 profile kapeluszowe: wprost do każdej krokwi, zabudowa 28 mm, bez wieszaków', () => {
    const r = atticRequirement(attic({ systemId: 'S-4.70.02-1' }));
    const n = lines(r.grid);
    expect(r.grid.depthMm).toBe(28);
    expect(r.grid.surfaces[0].hangerU).toEqual(r.grid.rafters);
    expect(sum(r.req.pieces.KAPELUSZ)).toBeCloseTo(n * 10, 6);
    expect(r.req.pieces.CD60).toBeUndefined();
    expect(r.req.counts.WIESZAK_ES ?? r.req.counts.UCHWYT_ELAST).toBeUndefined();
    expect(r.req.counts.WKRET_DREWNO).toBe(n * r.grid.rafters.length * 2);
    expect(sum(r.req.pieces.UD30)).toBeGreaterThan(0);
    // wełna pod krokwiami nie mieści się pod profilem 15 mm
    expect(atticGrid(attic({ systemId: 'S-4.70.02-1', woolUnder: 50 })).warnings.join(' ')).toMatch(/nie zmieści się/);
  });

  it('4.70.01 łaty: przekrój z karty wg rozstawu krokwi, wkręty TD do płyt', () => {
    const r = atticRequirement(attic({ systemId: 'S-4.70.01-1', rafterSpacing: 80 }));
    expect(r.grid.profile).toBe('LATA5030');
    expect(r.grid.depthMm).toBe(43);
    expect(r.req.counts.TD35).toBeCloseTo(r.areaM2 * 20, 6);
    expect(r.req.counts.TN25).toBeUndefined();
    expect(r.req.pieces.UD30).toBeUndefined();
    // krokwie co 90 cm: łata 50×30 (max 85 cm) nie wystarcza, karta podaje 60×40 do 100 cm
    const g90 = atticGrid(attic({ systemId: 'S-4.70.01-1', rafterSpacing: 90 }));
    expect(g90.profile).toBe('LATA6040');
    expect(g90.depthMm).toBe(53);
    expect(g90.warnings.join(' ')).not.toMatch(/rozstaw mocowania/);
    expect(atticGrid(attic({ systemId: 'S-4.70.01-1', rafterSpacing: 130 })).warnings.join(' ')).toMatch(/dopuszczalny rozstaw mocowania 1,2/);
  });

  it('4.70.03 Klick-Fix i 4.70.08 C RIGISTIL na uchwytach GL: własne wieszaki i profile', () => {
    const k = atticRequirement(attic({ systemId: 'S-4.70.03-1' }));
    expect(k.req.counts.WIESZAK_KLICK).toBe(k.hangers);
    expect(k.req.counts.LN9).toBeUndefined();
    expect(sum(k.req.pieces.CD60)).toBeGreaterThan(0);
    const g = atticRequirement(attic({ systemId: 'S-4.70.08-1' }));
    expect(g.req.counts.UCHWYT_GL).toBe(g.hangers);
    expect(g.req.counts.LN9).toBe(g.hangers * 4);
    expect(sum(g.req.pieces.C_RIGISTIL)).toBeCloseTo(lines(g.grid) * 10, 6);
    expect(sum(g.req.pieces.U_RIGISTIL)).toBeGreaterThan(0);
    expect(g.req.counts.LACZNIK_GL3).toBeGreaterThan(0);
    expect(g.req.pieces.CD60 ?? g.req.pieces.UD30).toBeUndefined();
    const w = atticRequirement(attic({ systemId: 'S-4.70.07-1' }));
    expect(w.req.counts.WIESZAK_RIGISTIL).toBe(w.hangers);
  });

  it('4.71.11 więźba widoczna: płyty między krokwiami, ruszt w każdym polu, 3 mb taśmy na m²', () => {
    const a = attic({ systemId: 'S-4.71.11-1', rafterSpacing: 80 });
    const r = atticRequirement(a);
    const full = atticRequirement(attic({ rafterSpacing: 80 }));
    expect(r.grid.depthMm).toBeLessThan(0);
    expect(r.hangers).toBe(0);
    expect(r.grid.bays.length).toBeGreaterThanOrEqual(r.grid.rafters.length - 1);
    expect(r.grid.bays.length).toBeLessThanOrEqual(r.grid.rafters.length + 1);
    // powierzchnia płyt bez pasów pod krokwiami
    expect(r.areaM2).toBeLessThan(full.areaM2 * 0.95);
    expect(r.areaM2).toBeGreaterThan(full.areaM2 * 0.8);
    const battens = sum(r.req.pieces.LATA5030);
    expect(battens / r.areaM2).toBeGreaterThan(4.5);
    expect(battens / r.areaM2).toBeLessThan(6.5);
    expect(Object.values(r.req.meters).some((v) => Math.abs(v - r.areaM2 * 3) < 1e-6)).toBe(true);
    expect(r.req.area.WELNA150).toBeCloseTo(r.areaM2, 6);
    // 4.71.12: poprzeczki C RIGISTIL w profilach U RIGISTIL wzdłuż krokwi
    const c = atticRequirement(attic({ systemId: 'S-4.71.12-1', rafterSpacing: 80 }));
    expect(c.req.pieces.U_RIGISTIL).toHaveLength(c.grid.bays.length * 2 * c.grid.surfaces.length);
    expect(sum(c.req.pieces.C_RIGISTIL)).toBeGreaterThan(0);
  });

  it('Norgips ZP: profile kapeluszowe i wieszaki płaskie L', () => {
    const k = atticRequirement(attic({ systemId: 'NG-ZP-KAP-1', boardId: 'NG-GKB12.5' }));
    expect(sum(k.req.pieces.KAPELUSZ)).toBeCloseTo(lines(k.grid) * 10, 6);
    expect(k.grid.cdSpacing).toBe(50);
    expect(k.req.pieces.UD30).toBeUndefined();
    const l = atticRequirement(attic({ systemId: 'NG-ZP-L-1', boardId: 'NG-GKB12.5', woolUnder: 150 }));
    expect(l.req.counts.WIESZAK_PLASKI).toBe(l.hangers);
    expect(l.req.counts.LN9).toBe(l.hangers);
    // wieszak L sięga do 290 mm – 150 mm wełny pod krokwiami mieści się bez ostrzeżenia
    expect(l.warnings.join(' ')).not.toMatch(/nie zmieści się/);
  });
});

describe('ruszt krzyżowy poddasza (Siniat ES/DK, EL/DK, DK/MFC)', () => {
  const es = (o: Partial<Attic> = {}) => attic({ systemId: 'SN-P-ESDK-1', boardId: 'SN-EXP12.5', woolUnder: 0, ...o });

  it('profile nośne pod każdą krokwią, mocowania co max 100 cm, profile pod płyty co 40 cm', () => {
    const g = atticGrid(es());
    expect(g.carrier?.product).toBe('CD60');
    expect(g.cdSpacing).toBe(40);
    // zabudowa min. 73 mm z karty
    expect(g.depthMm).toBe(73);
    for (const s of g.surfaces) {
      expect(s.hangerU).toEqual(g.rafters);
      expect(s.fixS).toEqual(cdLinePositions(s.surface.run, 100));
      expect(s.cd).toEqual(cdLinePositions(s.surface.run, 40));
    }
    expect(g.warnings.some((w) => w.includes('profili nośnych'))).toBe(false);
  });

  it('zestawienie: CD nośne + montażowe, ES na nośnych, łącznik krzyżowy na każdym skrzyżowaniu', () => {
    const r = atticRequirement(es());
    const g = r.grid;
    const R = g.rafters.length;
    const crossings = g.surfaces.reduce((n, s) => n + s.cd.length * R, 0);
    const fixes = g.surfaces.reduce((n, s) => n + s.fixS.length * R, 0);
    expect(r.req.counts.LACZNIK_KRZ).toBe(crossings);
    expect(r.req.counts.WIESZAK_ES).toBe(fixes);
    expect(r.hangers).toBe(fixes);
    expect(r.req.counts.WKRET_DREWNO).toBe(fixes * 2);
    // zużycie CD na m² blisko karty (3,8 mb/m²); krótkie skosy mają skrajne profile przy obu krawędziach, więc trochę więcej
    const cdM = (r.req.pieces.CD60 ?? []).reduce((t, x) => t + x, 0);
    const perM2 = cdM / r.areaM2;
    expect(perM2).toBeGreaterThan(3.4);
    expect(perM2).toBeLessThan(4.3);
    // ES na m²: karta 1,6 szt.
    expect(fixes / r.areaM2).toBeGreaterThan(1);
    expect(fixes / r.areaM2).toBeLessThan(2);
  });

  it('krokwie rzadziej niż 100 cm – ostrzeżenie o rozstawie profili nośnych', () => {
    const g = atticGrid(es({ rafterSpacing: 120 }));
    expect(g.warnings.some((w) => w.includes('profili nośnych'))).toBe(true);
  });

  it('elementy elastyczne EL60 zamiast ES60', () => {
    const r = atticRequirement(attic({ systemId: 'SN-P-ELDK-1', boardId: 'SN-EXP12.5' }));
    expect(r.req.counts.UCHWYT_ELAST).toBe(r.hangers);
    expect(r.req.counts.WIESZAK_ES).toBeUndefined();
  });

  it('DK/MFC: profile MF, kątowniki, bez łączników krzyżowych CD', () => {
    const r = atticRequirement(attic({ systemId: 'SN-P-DKMFC-1', boardId: 'SN-EXP12.5' }));
    const g = r.grid;
    expect(r.req.pieces.MFCP44?.length).toBe(g.rafters.length * g.surfaces.length);
    expect(r.req.pieces.MFCC50?.length).toBe(g.surfaces.reduce((n, s) => n + s.cd.length, 0));
    expect(r.req.pieces.MFCE26?.length).toBeGreaterThan(0);
    expect(r.req.pieces.CD60).toBeUndefined();
    expect(r.req.counts.MFC2330).toBe(r.hangers);
    expect(r.req.counts.LACZNIK_KRZ).toBeUndefined();
    expect(g.depthMm).toBe(83);
  });

  it('wełna pod krokwiami ponad zasięg ES60 + drugi poziom – ostrzeżenie', () => {
    expect(atticGrid(es({ woolUnder: 100 })).warnings.some((w) => w.includes('nie zmieści się na tym wieszaku'))).toBe(false);
    expect(atticGrid(es({ woolUnder: 150 })).warnings.some((w) => w.includes('nie zmieści się na tym wieszaku'))).toBe(true);
  });
});

describe('dobór długości wieszaka do zabudowy pod krokwią', () => {
  const base = { roof: 'gable' as const, width: 800, length: 1000, kneeLeft: 100, kneeRight: 100, pitch: 40, rafterSpacing: 90, firstRafter: 10, rafterWidth: 8, rafterHeight: 18 };
  const mk = (systemId: string, woolUnder: number) => {
    const sys = CEILING_SYSTEMS.find((s) => s.id === systemId)!;
    return atticRequirement(createAttic({ ...base, systemId, boardId: sys.defaultBoard, woolBetween: 150, woolUnder, vaporBarrier: false }));
  };
  const esId = CEILING_SYSTEMS.find((s) => s.attic && !s.atticFrame && (!s.maker || s.maker === 'rigips') && s.hangerType === 'es' && s.layers === 1)!.id;

  it('uchwyt ES Rigips: 75 mm do 70 mm zabudowy, potem 125 mm, powyżej ostrzeżenie', () => {
    expect(mk(esId, 0).grid.hangerSize?.name).toBe('ES 75 mm');
    expect(mk(esId, 50).grid.hangerSize?.name).toBe('ES 75 mm');
    expect(mk(esId, 75).grid.hangerSize?.name).toBe('ES 125 mm');
    expect(mk(esId, 100).grid.hangerSize?.name).toBe('ES 125 mm');
    const over = mk(esId, 150);
    expect(over.grid.hangerSize).toBeUndefined();
    expect(over.warnings.some((w) => w.includes('nie sięgnie') && w.includes('ES 125 mm'))).toBe(true);
  });

  it('dobrana długość trafia do uwagi przy wieszaku na liście materiałów i do założeń', () => {
    const r = mk(esId, 100);
    expect(JSON.stringify(r.req)).toContain('dobrano ES 125 mm');
    expect(r.assumptions.some((t) => t.includes('ES'))).toBe(true);
  });

  it('RIGISTIL GL 2 / GL 9 i wieszak płaski Norgips L-180 / L-270 / L-350', () => {
    expect(mk('S-4.70.08-1', 50).grid.hangerSize?.name).toBe('GL 2 (75 mm)');
    expect(mk('S-4.70.08-1', 100).grid.hangerSize?.name).toBe('GL 9 (125 mm)');
    expect(mk('NG-ZP-L-1', 100).grid.hangerSize?.name).toBe('L-180');
    expect(mk('NG-ZP-L-1', 150).grid.hangerSize?.name).toBe('L-270');
    expect(mk('NG-ZP-L-1', 200).grid.hangerSize?.name).toBe('L-270');
  });

  it('system z jedną długością wieszaka niczego nie dobiera', () => {
    expect(mk('S-4.70.03-1', 50).grid.hangerSize).toBeUndefined();
  });
});
