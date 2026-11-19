import { describe, expect, it } from 'vitest';
import { boardById, sideBoards, sideLayers, wallSystemById } from '../catalog/rigips';
import { wallSystemShort } from '../catalog/systemLabel';
import { createProject, createWall } from '../model/factory';
import { applyWallChoice } from '../model/ops';
import { wallSection } from '../geometry/contacts';
import { analyzeJunctions } from '../geometry/geometry';
import { wallLayout } from './layout';
import { wallConsumption, wallInsulation, wallRequirement, type ConsumptionLine } from './materials';
import { recommendWalls } from './recommend';
import { wallThicknessMm } from './joints';
import type { Wall } from '../model/types';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;

/** Ściana 5,00 × 2,75 m między istniejącymi ścianami (jak element odniesienia zużycia) z własnymi płytami strony B */
function wallOf(systemId: string, over: Partial<Wall> = {}) {
  const sys = wallSystemById(systemId);
  const p = createProject();
  p.nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 500, y: 0 },
  ];
  p.walls = [createWall(p, 'a', 'b', { systemId: sys.id, boardId: sys.defaultBoard, height: 275, studSpacing: sys.studSpacing, insulation: true, ...over })];
  const w = p.walls[0];
  const j = analyzeJunctions(p).get(w.id)!;
  return { p, w, sys, j, ...wallRequirement(p, w, j, sys) };
}

const boardM2 = (req: ReturnType<typeof wallOf>['req'], id: string) =>
  Object.entries(req.boardArea)
    .filter(([k]) => k.startsWith(`${id}|`))
    .reduce((a, [, v]) => a + v, 0);

describe('silnik: inne poszycie strony B', () => {
  it('system bez sideB – obie strony jak strona A, okładzina bez strony B', () => {
    const s = wallSystemById('W-CW75-2');
    expect(sideBoards(s, { boardId: 'RF12.5' }, 1)).toEqual(['RF12.5', 'RF12.5']);
    expect(sideLayers(s)).toEqual([2, 2]);
    const lin = wallSystemById('O-CD-1');
    expect(sideBoards(lin, { boardId: lin.defaultBoard }, 1)).toEqual([]);
  });

  it('Siniat 75A50/RTG: Ogień Plus po stronie A, płyta RTG po stronie B, słupki co 62,5 cm, taśma z ołowiem', () => {
    const s = wallSystemById('SN-W-A50-RTG-1');
    expect(s.studSpacing).toBe(62.5);
    expect(sideBoards(s, { boardId: s.defaultBoard }, 1)).toEqual(['SN-RTG0.5']);
    expect(boardById('SN-RTG0.5').width).toBe(62.5);
    const c = wallConsumption(s);
    // po 1 m² płyty na m² ściany z każdej strony (karta: 1,0 + 1,0)
    expect(q(c, 'board:SN-OP12.5')).toBeGreaterThan(0.95);
    expect(q(c, 'board:SN-OP12.5')).toBeLessThan(1.2);
    expect(q(c, 'board:SN-RTG0.5')).toBeGreaterThan(0.95);
    expect(q(c, 'board:SN-RTG0.5')).toBeLessThan(1.2);
    // karta: taśma z ołowiem 2,4 mb/m² przy słupkach co 625 mm
    expect(q(c, 'TASMA_OLOW')).toBeCloseTo(2.4, 1);
    // grubość ściany: C50 + 12,5 + (12,5 + 0,5 ołowiu)
    expect(wallThicknessMm(s, s.defaultBoard)).toBeCloseTo(75.5);
  });

  it('RTG: wybrana grubość ołowiu (odmiana z karty) zmienia płytę strony B, wysokość i grubość ściany', () => {
    const { req, w, sys } = wallOf('SN-W-A75-RTG-2', { sideBBoards: ['SN-RTG2', 'SN-OP12.5'] });
    expect(boardM2(req, 'SN-RTG2')).toBeGreaterThan(5 * 2.75 - 0.01);
    expect(boardM2(req, 'SN-RTG0.5')).toBe(0);
    // strona A 2 × Ogień Plus, strona B 1 × Ogień Plus (zewnętrzna) → 3 warstwy Ogień Plus
    expect(boardM2(req, 'SN-OP12.5')).toBeGreaterThan(3 * 5 * 2.75 - 0.01);
    expect(wallThicknessMm(sys, w.boardId, w.innerBoardId, w.sideBBoards)).toBeCloseTo(75 + 25 + 14.5 + 12.5);
    const sec = wallSection(w);
    expect(sec.layers).toEqual([2, 2]);
    expect(sec.bt[1]).toBeCloseTo((14.5 + 12.5) / 2 / 1000);
  });

  it('rozkład płyt: strona B ma własną płytę i arkusz 62,5 cm, styki na słupkach co 62,5 cm', () => {
    const { p, w, j } = wallOf('SN-W-A50-RTG-1');
    const l = wallLayout(p, w, j);
    const b = l.faces.find((f) => f.side === 1)!;
    expect(b.board).toBe('SN-RTG0.5');
    expect(b.sheet.width).toBeCloseTo(0.625);
    for (const x of b.joints) expect(Math.abs(x / 0.625 - Math.round(x / 0.625))).toBeLessThan(1e-6);
    expect(l.faces.find((f) => f.side === 0)!.board).toBe('SN-OP12.5');
  });

  it('wybór odmiany zapisuje płyty strony B, a powrót do domyślnych je usuwa', () => {
    const { w, sys } = wallOf('SN-W-A50-RTG-1');
    const v = sys.variants!.find((x) => x.sideB?.[0] === 'SN-RTG3')!;
    applyWallChoice(w, { system: sys, boardId: v.board!, sideBBoards: v.sideB, studSpacing: 62.5, doubleStuds: false });
    expect(w.sideBBoards).toEqual(['SN-RTG3']);
    applyWallChoice(w, { system: sys, boardId: v.board!, sideBBoards: sys.sideB, studSpacing: 62.5, doubleStuds: false });
    expect(w.sideBBoards).toBeUndefined();
  });

  it('Siniat SLA (ściana kinowa): 2×15 + 18 / 15 + 2×18, łączniki Phoni SL zamiast pasków, wełna w obu rzędach', () => {
    const s = wallSystemById('SN-W-SLA-CC100');
    const { req, w, info } = wallOf(s.id, { doubleStuds: true });
    const A = info.netAreaM2;
    // karta: 3,0 m² płyt 15 mm i 3,0 m² płyt 18 mm na m² ściany
    expect(boardM2(req, 'SN-OP15') / A).toBeGreaterThan(2.99);
    expect(boardM2(req, 'SN-OP15') / A).toBeLessThan(3.2);
    expect(boardM2(req, 'SN-OP18') / A).toBeGreaterThan(2.99);
    expect(boardM2(req, 'SN-OP18') / A).toBeLessThan(3.2);
    // karta: Phoni SL 0,8 szt./m² przy 60 cm
    expect(req.counts.PHONI_SL).toBe(Math.ceil(A * 0.8));
    expect(wallInsulation(w, s)?.layers).toBe(2);
    // minimalna grubość z karty: 350 mm
    expect(wallThicknessMm(s, w.boardId, w.innerBoardId)).toBeCloseTo(350);
    expect(wallSystemShort(s).length).toBeLessThanOrEqual(36);
  });

  it('Rigips 3.37.022: 2×12,5 GKBI / 1×12,5 Aquaroc – płyty, wkręty i spoinowanie płyty cementowej po stronie B', () => {
    const s = wallSystemById('W-CW75-2-AQ1');
    expect(s.code).toBe('3.37.022');
    const { req, info } = wallOf(s.id);
    const A = info.netAreaM2;
    // kalkulator Rigips: 200 m² płyt g-k i 100 m² płyty do stref mokrych na 100 m² ściany
    expect(boardM2(req, 'RBI12.5') / A).toBeCloseTo(2, 0);
    expect(boardM2(req, 'AQUAROC12.5') / A).toBeCloseTo(1, 0);
    expect(req.meters.TASMA_AQ).toBeGreaterThan(0);
    expect((req.counts.AQ25 ?? 0) + (req.counts.AQ35 ?? 0)).toBeGreaterThan(0);
    expect(wallThicknessMm(s, s.defaultBoard)).toBeCloseTo(112.5);
  });

  it('Rigips 3.41.021 AKU: dwa rzędy CW 75 Aku, 2×12,5 Aku z każdej strony + płyta między rzędami', () => {
    const s = wallSystemById('W-2CW75AKU-2AKU-PD');
    const c = wallConsumption(s);
    // kalkulator: 500 m² płyt na 100 m² ściany
    expect(q(c, 'board:AKU12.5')).toBeGreaterThan(4.95);
    expect(q(c, 'board:AKU12.5')).toBeLessThan(5.4);
    expect(q(c, 'CW75AKU')).toBeGreaterThan(0);
  });

  it('dobór: strefa mokra po jednej stronie wystarcza, w pomieszczeniu suchym ściana z Aquaroc nie wypiera zwykłej', () => {
    const base = { purpose: 'partition' as const, heightCm: 270, room: 'dry' as const, fire: 0 as const, acoustic: 'any' as const, hang: false };
    expect(recommendWalls({ ...base, room: 'wet' }).some((p) => p.system.sideB?.includes('AQUAROC12.5'))).toBe(true);
    expect(recommendWalls({ ...base, profile: 75, layers: 2 })[0].system.sideB).toBeUndefined();
  });
});
