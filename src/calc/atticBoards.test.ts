import { afterEach, describe, expect, it } from 'vitest';
import type { Attic } from '../model/types';
import { atticGrid } from './attic';
import { ATTIC_MIN_PIECE, ATTIC_STAGGER, atticBoardLayout, cutSheets, rowJoints, splitStrips } from './atticBoards';
import { atticRequirement } from './atticMaterials';
import { setAppBoardLength, setProjectBoardLength } from './boardLength';
import { summarize } from './materials';

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

afterEach(() => {
  setAppBoardLength('auto');
  setProjectBoardLength(undefined);
});

const all = (a: Attic) => {
  const grid = atticGrid(a);
  const b = atticBoardLayout(a, undefined, grid);
  return { grid, b };
};

describe('pasy i styki płyt na poddaszu', () => {
  it('pasy po 120 cm, ostatni węższy niż 30 cm zastąpiony skróceniem poprzedniego', () => {
    expect(splitStrips(0, 1000, 120, 120).slice(-3)).toEqual([840, 960, 1000]);
    // 250 = 2×120 + 10 → 120 + 100 + 30
    expect(splitStrips(0, 250, 120, 120)).toEqual([0, 120, 220, 250]);
    // przesunięta warstwa zaczyna od pół płyty
    expect(splitStrips(0, 300, 60, 120)).toEqual([0, 60, 180, 300]);
  });

  it('styki na elementach rusztu, kawałki nie krótsze niż 30 cm, mijanka min. 40 cm', () => {
    const supports = [10, 50, 90, 130, 170, 210, 250, 290, 330, 370, 410, 450, 466];
    const A = rowJoints(476, 300, supports);
    expect(A).toEqual([290]);
    const B = rowJoints(476, 300, supports, A);
    expect(B.every((j) => supports.includes(j))).toBe(true);
    expect(Math.abs(B[0] - A[0])).toBeGreaterThanOrEqual(ATTIC_STAGGER);
    // arkusz 200 cm na skosie 229 cm: zamiast 29 cm u góry płyta kończy się na profilu niżej
    const s = rowJoints(229, 200, [10, 50, 90, 130, 170, 219]);
    expect(s).toEqual([170]);
  });

  it('rozkrój: resztki ≥ 30 cm idą na kolejne elementy, węższe są odpadem', () => {
    // 4 elementy 120×150 z arkuszy 300: po dwa z arkusza, bez odpadu
    expect(cutSheets(Array(4).fill({ w: 120, l: 150 }), 120, 300)).toEqual({ sheets: 2, wasteCm2: 0 });
    // element 120×280 z arkusza 300: 20 cm odpadu
    expect(cutSheets([{ w: 120, l: 280 }], 120, 300)).toEqual({ sheets: 1, wasteCm2: 20 * 120 });
    // pasy 50 cm: dwa obok siebie w jednym odcinku, 20 cm z boku odpadu
    const r = cutSheets(Array(2).fill({ w: 50, l: 300 }), 120, 300);
    expect(r.sheets).toBe(1);
    expect(r.wasteCm2).toBe(20 * 300);
  });
});

describe('rozkład płyt poddasza', () => {
  it('każda płaszczyzna pokryta bez dziur i nakładek, styki krótkich krawędzi na ruszcie', () => {
    const { grid, b } = all(attic());
    expect(b.surfaces.map((s) => s.id)).toEqual(['left', 'collar', 'right']);
    for (const s of b.surfaces) {
      const g = grid.surfaces.find((x) => x.surface.id === s.id)!;
      for (const l of s.layers) {
        const area = l.pieces.reduce((t, p) => t + (p.u1 - p.u0) * (p.s1 - p.s0), 0) / 10000;
        expect(area).toBeCloseTo(g.areaM2, 4);
        for (const p of l.pieces) {
          expect(p.u1 - p.u0).toBeLessThanOrEqual(l.sheetW + 0.01);
          expect(p.s1 - p.s0).toBeLessThanOrEqual(l.sheetLen + 0.01);
          expect(Math.min(p.u1 - p.u0, p.s1 - p.s0)).toBeGreaterThanOrEqual(ATTIC_MIN_PIECE - 0.5);
          if (p.s0 > 0.5) expect(g.cd.some((c) => Math.abs(c - p.s0) < 0.6)).toBe(true);
        }
      }
    }
    expect(b.warnings).toEqual([]);
  });

  it('sąsiednie pasy mają styki przesunięte o min. 40 cm', () => {
    const { b } = all(attic());
    const collar = b.surfaces.find((s) => s.id === 'collar')!.layers[0];
    const jointsAt = (u0: number) => collar.pieces.filter((p) => p.u0 === u0 && p.s0 > 0).map((p) => p.s0);
    const a = jointsAt(0);
    const c = jointsAt(120);
    expect(a.length).toBeGreaterThan(0);
    for (const j of a) for (const k of c) expect(Math.abs(j - k)).toBeGreaterThanOrEqual(ATTIC_STAGGER);
  });

  it('długość arkusza z ustawienia aplikacji (PR 40): 2,0 m na skosie 2,29 m daje styk na profilu', () => {
    setAppBoardLength(200);
    const { b } = all(attic());
    const left = b.surfaces.find((s) => s.id === 'left')!.layers[0];
    expect(left.sheetLen).toBe(200);
    expect(Math.max(...left.pieces.map((p) => p.s1 - p.s0))).toBeLessThanOrEqual(200);
    expect(Math.min(...left.pieces.map((p) => p.s1 - p.s0))).toBeGreaterThanOrEqual(30);
  });

  it('druga warstwa przesunięta o pół płyty', () => {
    const { b } = all(attic({ systemId: 'KN-D612-2', boardId: 'KN-A13' }));
    const [l0, l1] = b.surfaces[0].layers;
    expect(l0.pieces[0].u1).toBe(120);
    expect(l1.pieces[0].u1).toBe(60);
  });

  it('więźba widoczna: płyty tylko w polach między krokwiami', () => {
    const a = attic({ systemId: 'S-4.71.11-1', rafterSpacing: 80, rafterWidth: 10 });
    const { grid, b } = all(a);
    expect(grid.frame.mount).toBe('between');
    for (const p of b.surfaces[0].layers[0].pieces) expect(grid.bays.some((bay) => p.u0 >= bay.u - 0.1 && p.u1 <= bay.u + bay.w + 0.1)).toBe(true);
  });

  it('okno dachowe wycina płyty w otworze', () => {
    const a = attic();
    const grid = atticGrid(a);
    const plain = atticBoardLayout(a, undefined, grid);
    const holed = atticBoardLayout(a, undefined, grid, [{ surfaceId: 'left', u0: 100, u1: 178, s0: 60, s1: 200 }]);
    const net = (x: typeof plain) => x.sheets.reduce((t, s) => t + s.netM2, 0);
    expect(net(plain) - net(holed)).toBeCloseTo((78 * 140) / 10000, 6);
    expect(holed.surfaces[0].layers[0].pieces.filter((p) => p.notches?.length)).toHaveLength(2);
  });

  it('lista zakupów liczy arkusze z rozkładu (z odpadem resztek < 30 cm)', () => {
    const r = atticRequirement(attic());
    const lines = summarize([r.req], 0).filter((l) => l.group === 'Płyty');
    const sheets = lines.reduce((t, l) => t + l.qty, 0);
    const fromLayout = r.boards.sheets.reduce((t, s) => t + s.sheets, 0);
    // zestawienie nie przekracza rozkroju i nie jest mniejsze niż powierzchnia netto
    expect(sheets).toBeLessThanOrEqual(fromLayout);
    expect(sheets).toBeGreaterThanOrEqual(Math.ceil(r.areaM2 / (1.2 * 3)));
  });
});
