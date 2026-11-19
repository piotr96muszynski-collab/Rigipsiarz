import { describe, expect, it } from 'vitest';
import { allCeilingSystems, ceilingSystemById } from '../catalog/rigips';
import { createAttic } from '../model/factory';
import { atticGrid, roofCornersSupported } from './attic';
import { atticRequirement } from './atticMaterials';
import { clipToRect, faceOutline, minusRect, roofBoardLayout, tsArea } from './atticRoofBoards';
import { ATTIC_STAGGER } from './atticBoards';

const base = { width: 800, length: 1000, kneeLeft: 100, kneeRight: 100, pitch: 45, collarHeight: undefined };
const hipRoof = createAttic({ ...base, ends: ['hip', 'hip'] });
const lRoof = createAttic({ ...base, wings: [{ id: 'w', side: 'left', at: 500, width: 600, length: 400, end: 'gable' }] });

const layout = (a: ReturnType<typeof createAttic>) => {
  const sys = ceilingSystemById(a.systemId);
  const grid = atticGrid(a, sys);
  return { grid, r: roofBoardLayout(a, sys, { ...grid, roof: grid.roof! }) };
};

describe('wielokąty na połaci', () => {
  const sq = [
    { t: 0, s: 0 },
    { t: 100, s: 0 },
    { t: 100, s: 100 },
    { t: 0, s: 100 },
  ];
  it('przycięcie do prostokąta i wycięcie prostokąta', () => {
    expect(tsArea(clipToRect(sq, { t0: 50, t1: 200, s0: -10, s1: 40 }))).toBeCloseTo(50 * 40, 6);
    const rest = minusRect(sq, { t0: 20, t1: 40, s0: 20, s1: 40 });
    expect(rest.reduce((t, p) => t + tsArea(p), 0)).toBeCloseTo(10000 - 400, 6);
  });
});

describe('rozkład płyt na połaciach z narożnikami i koszami', () => {
  for (const [name, a] of [
    ['dach kopertowy', hipRoof],
    ['dach L z koszami', lRoof],
  ] as const) {
    it(`${name}: płyty pokrywają każdą połać dokładnie, bez nakładania`, () => {
      const { grid, r } = layout(a);
      expect(r.faces).toHaveLength(grid.roof!.faces.length);
      for (const fb of r.faces) {
        const face = grid.roof!.faces[fb.face].face;
        for (const l of fb.layers) {
          const sum = l.pieces.reduce((t, p) => t + p.areaCm2, 0) / 10000;
          expect(sum).toBeCloseTo(face.areaM2, 2);
          // każdy element mieści się w arkuszu
          for (const p of l.pieces) {
            expect(p.t1 - p.t0).toBeLessThanOrEqual(l.sheetW + 0.01);
            expect(p.s1 - p.s0).toBeLessThanOrEqual(l.sheetLen + 0.01);
          }
        }
      }
      expect(r.warnings).toEqual([]);
    });
  }

  it('połać narożna (trójkąt): elementy cięte pod kątem przy obu narożnikach', () => {
    const { r } = layout(hipRoof);
    const hip = r.faces.find((f) => f.key === 'hip0')!.layers[0];
    expect(hip.pieces.filter((p) => p.angled).length).toBeGreaterThanOrEqual(4);
    expect(hip.pieces.every((p) => p.cut || !p.angled)).toBe(true);
  });

  it('styki krótkich krawędzi na profilach rusztu i przesunięte w sąsiednich pasach', () => {
    const { grid, r } = layout(hipRoof);
    const fb = r.faces.find((f) => f.key === 'left')!;
    const sup = grid.roof!.faces[fb.face].cd.map((l) => l.s);
    const l = fb.layers[0];
    const cols = [...new Set(l.pieces.map((p) => p.t0))].sort((x, y) => x - y);
    const jointsOf = (t0: number) => l.pieces.filter((p) => p.t0 === t0 && p.s0 > 0.5).map((p) => p.s0);
    for (const c of cols) for (const j of jointsOf(c)) expect(sup.some((s) => Math.abs(s - j) < 0.6)).toBe(true);
    // sąsiednie pasy w środku połaci (pełna wysokość) – styki min. 40 cm od siebie
    const mid = cols.filter((c) => c > 300 && c < 600);
    for (let i = 0; i + 1 < mid.length; i++)
      for (const a of jointsOf(mid[i])) for (const b of jointsOf(mid[i + 1])) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(ATTIC_STAGGER - 0.5);
  });

  it('dwie warstwy: druga przesunięta o pół arkusza, styki omijają pierwszą', () => {
    const sys = allCeilingSystems().find((x) => x.atticFrame && x.layers === 2 && roofCornersSupported(x))!;
    expect(sys).toBeDefined();
    const a = createAttic({ ...base, ends: ['hip', 'hip'], systemId: sys.id, boardId: sys.defaultBoard });
    const { r } = layout(a);
    const [l0, l1] = r.faces.find((f) => f.key === 'left')!.layers;
    expect(l1).toBeDefined();
    const c0 = [...new Set(l0.pieces.map((p) => p.t1))];
    const c1 = [...new Set(l1.pieces.map((p) => p.t1))];
    // styki długich krawędzi warstw się mijają
    expect(c1.filter((c) => c < 900 && c0.some((x) => Math.abs(x - c) < 1))).toEqual([]);
  });

  it('zestawienie: arkusze z rozkładu, więcej niż pole połaci, odpad z docinków pod kątem', () => {
    const r = atticRequirement(hipRoof);
    const sheets = r.boards.sheets.reduce((t, u) => t + u.sheets, 0);
    expect(sheets).toBeGreaterThan(0);
    const boardM2 = Object.entries(r.req.boardArea).reduce((t, [, v]) => t + v, 0);
    expect(boardM2).toBeGreaterThanOrEqual(r.areaM2 - 0.01);
    expect(r.boards.roof?.faces).toHaveLength(4);
    expect(r.assumptions.some((t) => /docięte pod kątem/.test(t))).toBe(true);
    // kosze: elementy połaci głównej przy dobudówce też cięte pod kątem
    const l = atticRequirement(lRoof).boards.roof!.faces.find((f) => f.key === 'left')!.layers[0];
    expect(l.pieces.some((p) => p.angled)).toBe(true);
  });

  it('obrys połaci w układzie (t, s): pole w przestrzeni', () => {
    const { grid } = layout(lRoof);
    for (const g of grid.roof!.faces) {
      const a = faceOutline(g.face).reduce((t, p) => t + tsArea(p), 0) / 10000;
      expect(a).toBeCloseTo(g.face.areaM2, 3);
    }
  });
});
