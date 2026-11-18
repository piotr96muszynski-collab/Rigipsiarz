import { describe, expect, it } from 'vitest';
import { calculateProject, ceilingGrid } from '../calc/materials';
import { createCeiling, createOpening, createProject, createWall, sampleProject, uid } from '../model/factory';
import type { Project } from '../model/types';
import { boardSheets, buildModel3D, subtractRects, type BoxPart } from './model3d';

function wall(lengthCm: number, heightCm = 260, angleDeg = 0): Project {
  const p = createProject();
  const r = (angleDeg * Math.PI) / 180;
  p.nodes = [
    { id: uid(), x: 100, y: 50 },
    { id: uid(), x: 100 + lengthCm * Math.cos(r), y: 50 + lengthCm * Math.sin(r) },
  ];
  p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { height: heightCm, systemId: 'W-CW75-1', boardId: 'RB12.5' })];
  return p;
}

const area = (rs: { x0: number; x1: number; y0: number; y1: number }[]) =>
  rs.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
const boxes = (p: Project, layer: string) =>
  buildModel3D(p, calculateProject(p)).parts.filter((x): x is BoxPart => x.type === 'box' && x.layer === layer);

describe('odejmowanie prostokątów', () => {
  it('wycina otwór ze środka', () => {
    const r = subtractRects({ x0: 0, x1: 3, y0: 0, y1: 2.6 }, [{ x0: 1, x1: 2, y0: 0, y1: 2 }]);
    expect(area(r)).toBeCloseTo(3 * 2.6 - 2);
  });
  it('otwór poza prostokątem nic nie zmienia', () => {
    const r = subtractRects({ x0: 0, x1: 1, y0: 0, y1: 1 }, [{ x0: 2, x1: 3, y0: 0, y1: 1 }]);
    expect(r).toHaveLength(1);
  });
});

describe('rozkład płyt na ścianie', () => {
  it('ściana 3 m × 2,6 m: arkusze 120 cm, ostatni docięty', () => {
    const s = boardSheets(3, 2.6, 1.2, 2.6, 0, []);
    expect(s.map((r) => +(r.x1 - r.x0).toFixed(2))).toEqual([1.2, 1.2, 0.6]);
    expect(area(s)).toBeCloseTo(7.8);
  });
  it('druga strona przesunięta o pół arkusza', () => {
    const s = boardSheets(3, 2.6, 1.2, 2.6, 0.6, []);
    expect(s[0].x1 - s[0].x0).toBeCloseTo(0.6);
    expect(area(s)).toBeCloseTo(7.8);
  });
  it('ściana wyższa niż arkusz dostaje dostawki', () => {
    const s = boardSheets(1.2, 3.5, 1.2, 3, 0, []);
    expect(s).toHaveLength(2);
    expect(area(s)).toBeCloseTo(4.2);
  });
  it('płyty omijają otwór', () => {
    const hole = { x0: 1, x1: 1.9, y0: 0, y1: 2.05 };
    const s = boardSheets(3, 2.6, 1.2, 2.6, 0, [hole]);
    expect(area(s)).toBeCloseTo(7.8 - 0.9 * 2.05);
    for (const r of s) {
      const overlap = Math.min(r.x1, hole.x1) - Math.max(r.x0, hole.x0) > 0.001 && Math.min(r.y1, hole.y1) - Math.max(r.y0, hole.y0) > 0.001;
      expect(overlap).toBe(false);
    }
  });
});

describe('model 3D ściany', () => {
  it('powierzchnia płyt = powierzchnia netto × strony × warstwy', () => {
    const p = wall(300);
    p.walls[0].openings.push(createOpening('door', 100));
    const calc = calculateProject(p);
    const net = calc.walls.get(p.walls[0].id)!.info.netAreaM2;
    const a = boxes(p, 'wallBoards').reduce((s, b) => s + b.s[0] * b.s[1], 0);
    expect(a).toBeCloseTo(net * 2, 3);
  });

  it('każdy słupek z silnika jest w modelu (w otworze – dwa krótkie lub jeden nad drzwiami)', () => {
    const p = wall(300);
    const cw = boxes(p, 'wallFrame').filter((b) => b.mat === 'cw');
    expect(cw).toHaveLength(calculateProject(p).walls.get(p.walls[0].id)!.info.studPositions.length);
  });

  it('ściana leży w miejscu z planu, także obrócona', () => {
    const p = wall(400, 260, 90);
    const all = buildModel3D(p, calculateProject(p));
    expect(all.bounds.min[2]).toBeGreaterThan(0.4);
    expect(all.bounds.max[2]).toBeLessThan(4.6);
    expect(all.bounds.max[1]).toBeCloseTo(2.6, 2);
    for (const b of boxes(p, 'wallFrame')) expect(Math.abs(b.c[0] - 1)).toBeLessThan(0.1);
  });

  it('UW w posadzce przerwany w drzwiach', () => {
    const p = wall(300);
    p.walls[0].openings.push(createOpening('door', 100));
    const floor = boxes(p, 'wallFrame').filter((b) => b.mat === 'uw' && b.c[1] < 0.05);
    expect(floor).toHaveLength(2);
    expect(floor.reduce((s, b) => s + b.s[0], 0)).toBeCloseTo(2.1);
  });
});

describe('model 3D sufitu', () => {
  it('profile CD zgodne z siatką z silnika, płyta na wysokości sufitu', () => {
    const p = createProject();
    const c = createCeiling(p, [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ], { height: 250 });
    p.ceilings = [c];
    const parts = buildModel3D(p).parts;
    const segs = ceilingGrid(c).reduce((s, g) => s + g.segments.length, 0);
    const cd = parts.filter((x) => x.type === 'box' && (x.mat === 'cdMain' || x.mat === 'cdSec'));
    expect(cd).toHaveLength(segs);
    expect(parts.filter((x) => x.type === 'box' && x.mat === 'ud')).toHaveLength(4);
    const slab = parts.find((x) => x.type === 'slab')!;
    expect(slab.type === 'slab' && slab.y).toBeCloseTo(2.5);
  });

  it('w suficie dwupoziomowym nośne są nad montażowymi', () => {
    const p = createProject();
    p.ceilings = [createCeiling(p, [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }])];
    const parts = buildModel3D(p).parts.filter((x): x is BoxPart => x.type === 'box');
    const main = parts.find((x) => x.mat === 'cdMain')!;
    const sec = parts.find((x) => x.mat === 'cdSec')!;
    expect(main.c[1]).toBeGreaterThan(sec.c[1]);
  });

  it('projekt przykładowy buduje się bez błędów', () => {
    const p = sampleProject();
    const m = buildModel3D(p, calculateProject(p));
    expect(m.parts.length).toBeGreaterThan(50);
    for (const x of m.parts) if (x.type === 'box') x.c.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});
