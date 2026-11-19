import { describe, expect, it } from 'vitest';
import { WALL_SYSTEMS, wallMaxWidth, wallSystemById } from '../catalog/rigips';
import { createProject, createWall } from '../model/factory';
import { analyzeJunctions } from '../geometry/geometry';
import { panelSheets, wallConsumption, wallRequirement, type ConsumptionLine } from './materials';
import { panelRows, wallLayout } from './layout';
import { buildContacts } from '../geometry/contacts';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;

/** Obudowa szerokości L × H (cm) między dwiema ścianami istniejącymi */
function shaft(systemId: string, L: number, H: number, boardId = wallSystemById(systemId).defaultBoard) {
  const p = createProject();
  p.nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: L, y: 0 },
  ];
  p.walls = [createWall(p, 'a', 'b', { systemId, boardId, height: H, studSpacing: 60, insulation: false })];
  const j = analyzeJunctions(p).get(p.walls[0].id)!;
  return { p, w: p.walls[0], j, ...wallRequirement(p, p.walls[0], j) };
}

describe('obudowy szachtów z samych płyt (ruszt „panel”)', () => {
  it('w katalogu: Rigips 3.50.14, 3.50.19, 3.50.22, 3.80.15 i Siniat 25–60 bez konstrukcji', () => {
    const codes = WALL_SYSTEMS.filter((s) => s.frame === 'panel').flatMap((s) => [s.code, ...(s.variants ?? []).map((v) => v.code)]);
    for (const c of ['3.50.14', '3.50.19', '3.50.22', '3.80.15', '25', '27,5', '30', '37,5', '45', '50', '55', '60']) expect(codes).toContain(c);
    for (const s of WALL_SYSTEMS.filter((x) => x.frame === 'panel')) {
      expect(s.panel, s.id).toBeDefined();
      expect(s.sides).toBe(1);
      expect(s.panel!.screws.length).toBeGreaterThanOrEqual(s.layers);
    }
  });

  it('pasy płyt: warstwa nieparzysta zaczyna się od pół arkusza (styki poziome się mijają)', () => {
    expect(panelRows(2.75, 1.2, 0)).toEqual([
      [0, 1.2],
      [1.2, 2.4],
      [2.4, 2.75],
    ]);
    expect(panelRows(2.75, 1.2, 1)).toEqual([
      [0, 0.6],
      [0.6, 1.8],
      [1.8, 2.75],
    ]);
  });

  it('arkusze: wąskie pasy dwóch warstw tnie się z jednego arkusza', () => {
    // pasy 1,2 1,2 0,35 | 0,6 1,2 0,95 → 3 pełne + 0,95 + (0,6 + 0,35)
    expect(panelSheets(2.5, 2.75, 2.6, 1.2, [0, 1])).toBe(5);
    // szersza niż arkusz → każdy pas z dwóch arkuszy
    expect(panelSheets(3.5, 2.4, 3, 1.2, [0])).toBe(4);
  });

  it('Rigips 3.50.14: kątownik po obwodzie, kołki co 75 cm, wkręty z karty (2,5 + 5 szt./m²)', () => {
    const { req, info } = shaft('SZ-PANEL-2RF12.5', 250, 275);
    expect(info.warnings).toEqual([]);
    // obwód: 2 × 2,75 + 2 × 2,5 = 10,5 mb kątownika (karta: 1,5 mb/m² → 10,3 mb)
    expect(req.pieces.KAT_SZYB.reduce((a, b) => a + b, 0)).toBeCloseTo(10.5);
    // zamknięty obwód: ⌈2,75/0,75⌉ = 4 na każdym boku pionowym, ⌈2,5/0,75⌉ = 4 przy posadzce i stropie
    // (16 szt. / 6,875 m² = 2,33 szt./m², karta 2,29)
    expect(req.counts.KOLEK).toBe(16);
    expect(req.counts.TN25).toBeCloseTo(2.5 * 6.875);
    expect(req.counts.TN35).toBeCloseTo(5 * 6.875);
    expect(req.meters.TASMA_USZ30).toBeCloseTo(10.5);
    // płyty 2,6 m (najkrótszy arkusz ≥ 2,5 m), 5 arkuszy na dwie warstwy
    expect(req.boardArea['RF12.5|260']).toBeCloseTo(5 * 2.6 * 1.2);
    // bez słupków i UW
    expect(req.pieces.CW50).toBeUndefined();
    expect(req.pieces.UW50).toBeUndefined();
  });

  it('zużycie na m² blisko karty Rigips (kątownik 1,5 mb, wkręty 2,5 + 5)', () => {
    const c = wallConsumption(wallSystemById('SZ-PANEL-2RF12.5'));
    expect(q(c, 'KAT_SZYB')).toBeGreaterThan(1.35);
    expect(q(c, 'KAT_SZYB')).toBeLessThan(1.65);
    expect(q(c, 'TN25')).toBeCloseTo(2.5);
    expect(q(c, 'TN35')).toBeCloseTo(5);
    // 2 m² płyt + docinki (karta nie liczy odpadu)
    expect(q(c, 'board:RF12.5')).toBeGreaterThanOrEqual(2);
    expect(q(c, 'board:RF12.5')).toBeLessThan(2.5);
  });

  it('3.80.15 Ridurit: wkręty Ridurit 3,5×50 w siatce 25×25 cm (27 szt./m²), maks. 2,0 m szerokości i 5 m wysokości', () => {
    const sys = wallSystemById('SZ-PANEL-2RIDURIT25');
    const c = wallConsumption(sys);
    expect(q(c, 'RIDURIT50')).toBeCloseTo(27);
    expect(wallMaxWidth(sys)).toBe(200);
    expect(shaft(sys.id, 220, 300).info.warnings.some((t) => t.includes('przekracza 2,00 m'))).toBe(true);
    expect(shaft(sys.id, 200, 550).info.warnings.some((t) => t.includes('Wysokość'))).toBe(true);
  });

  it('Siniat 25 (2×12,5): profil C 50 tylko przy ścianach – 0,8 mb/m² przy 2,5 m szerokości, wkręty 4 + 4 szt./m²', () => {
    const c = wallConsumption(wallSystemById('SN-SZ-BK-2'));
    expect(q(c, 'CW50')).toBeCloseTo(0.8);
    expect(q(c, 'TN25')).toBeCloseTo(4);
    expect(q(c, 'TN35')).toBeCloseTo(4);
    expect(q(c, 'UW50')).toBe(0);
    expect(q(c, 'TASMA_USZ50')).toBeCloseTo(0.8);
  });

  it('Siniat: szerokość zależy od płyty (Twarda 2,0 m, Hydro 2,4 m, pozostałe 2,5 m)', () => {
    const sys = wallSystemById('SN-SZ-BK-2');
    expect(wallMaxWidth(sys, 'SN-EXP12.5')).toBe(250);
    expect(wallMaxWidth(sys, 'SN-TW12.5')).toBe(200);
    expect(wallMaxWidth(sys, 'SN-HYDRO12.5')).toBe(240);
    expect(shaft(sys.id, 230, 300, 'SN-TW12.5').info.warnings.some((t) => t.includes('przekracza'))).toBe(true);
    expect(shaft(sys.id, 230, 300, 'SN-EXP12.5').info.warnings).toEqual([]);
    // 4 × 15 mm: wkręty 25/45/55/70 po 4 szt./m², wełna do akustyki
    const c4 = wallConsumption(wallSystemById('SN-SZ-BK-4-15'));
    for (const k of ['TN25', 'TN45', 'TN55', 'TN70']) expect(q(c4, k)).toBeCloseTo(4);
  });

  it('wolny koniec obudowy: ostrzeżenie (płyty muszą się opierać o ściany po obu stronach)', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { systemId: 'SZ-PANEL-2RF12.5', boardId: 'RF12.5', height: 260, studSpacing: 60, insulation: false })];
    p.walls[0].endB = 'free';
    const j = analyzeJunctions(p).get(p.walls[0].id)!;
    const { info } = wallRequirement(p, p.walls[0], j);
    expect(info.warnings.some((t) => t.includes('z obu stron'))).toBe(true);
  });

  it('rysunek i 3D: płyty poziomo na całą szerokość, bez słupków', () => {
    const { p, w, j } = shaft('SZ-PANEL-3RF12.5', 240, 300);
    const l = wallLayout(p, w, j, buildContacts(p));
    expect(l.studs).toEqual([]);
    expect(l.tracks).toEqual([]);
    expect(l.faces).toHaveLength(3);
    for (const f of l.faces) for (const pc of f.pieces) expect(pc.x1 - pc.x0).toBeCloseTo(2.4);
    // warstwa 2 przesunięta o pół arkusza
    expect(l.faces[1].pieces[0].y1).toBeCloseTo(0.6);
  });
});
