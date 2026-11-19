import { describe, expect, it } from 'vitest';
import { calculateProject, ceilingGrid } from '../calc/materials';
import { atticRequirement } from '../calc/atticMaterials';
import { createAttic, createCeiling, createOpening, createProject, createWall, quickAtticProject, sampleProject, uid } from '../model/factory';
import type { Project } from '../model/types';
import { overlapArea, wallSection } from '../geometry/contacts';
import { boardSheets, buildModel3D, subtractRects, type BoxPart, type PanelPart } from './model3d';

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
    const panels = buildModel3D(p, calc).parts.filter((x): x is PanelPart => x.type === 'panel' && x.layer === 'wallBoards');
    const a = boxes(p, 'wallBoards').reduce((s, b) => s + b.s[0] * b.s[1], 0) + panels.reduce((s, b) => s + b.area, 0);
    expect(a).toBeCloseTo(net * 2, 3);
  });

  it('płyty przy drzwiach wycięte w kształt L jedną bryłą (jak na rysunku)', () => {
    const p = wall(400);
    p.walls[0].openings.push(createOpening('door', 120, { reinforced: false }));
    const calc = calculateProject(p);
    const panels = buildModel3D(p, calc).parts.filter((x): x is PanelPart => x.type === 'panel');
    expect(panels.length).toBeGreaterThanOrEqual(2);
    for (const pn of panels) {
      expect(pn.loops[0].length).toBe(6); // L: sześć wierzchołków
      expect(pn.layer).toBe('wallBoards');
    }
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
    ], { height: 250, slabHeight: 300 });
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

describe('narożniki w 3D z modelu styków', () => {
  const plan = (b: BoxPart) => {
    const [L, , T] = b.s;
    const c = Math.cos(-b.rotY);
    const s = Math.sin(-b.rotY);
    return [
      [-L / 2, -T / 2],
      [L / 2, -T / 2],
      [L / 2, T / 2],
      [-L / 2, T / 2],
    ].map(([u, n]) => ({ x: b.c[0] + u * c - n * s, y: b.c[2] + u * s + n * c }));
  };
  const lCorner = (systemId: string) => {
    const p = createProject();
    p.nodes = [
      { id: 'n0', x: 0, y: 0 },
      { id: 'n1', x: 300, y: 0 },
      { id: 'n2', x: 300, y: 250 },
    ];
    p.walls = [
      createWall(p, 'n0', 'n1', { id: 'w1', systemId, boardId: 'RB12.5', height: 260 }),
      createWall(p, 'n1', 'n2', { id: 'w2', systemId, boardId: 'RB12.5', height: 260 }),
    ];
    return p;
  };

  for (const sys of ['W-CW75-1', 'W-CW75-2', 'W-2CW75-2'])
    it(`${sys}: płyty i ruszt dwóch ścian nie przenikają się, a narożnik zewnętrzny jest domknięty`, () => {
      const p = lCorner(sys);
      const parts = buildModel3D(p, calculateProject(p)).parts.filter(
        (x): x is BoxPart => x.type === 'box' && (x.layer === 'wallBoards' || x.layer === 'wallFrame') && x.c[1] - x.s[1] / 2 < 0.5 && x.c[1] + x.s[1] / 2 > 0.5,
      );
      const w1 = parts.filter((x) => x.owner === 'w1');
      const w2 = parts.filter((x) => x.owner === 'w2');
      for (const a of w1) for (const b of w2) expect(overlapArea(plan(a), plan(b))).toBeLessThan(1e-6);
      // punkt tuż przy zewnętrznym rogu (x > 3, y < 0) leży w płycie
      const sec = wallSection(p.walls[0]);
      const t = sec.core + sec.bt[0] * sec.layers[0];
      const outer = { x: 3 + t - 0.002, y: -t + 0.002 };
      const inside = (poly: { x: number; y: number }[], q: { x: number; y: number }) =>
        poly.every((A, i) => {
          const B = poly[(i + 1) % poly.length];
          return (B.x - A.x) * (q.y - A.y) - (B.y - A.y) * (q.x - A.x) >= 0;
        }) ||
        poly.every((A, i) => {
          const B = poly[(i + 1) % poly.length];
          return (B.x - A.x) * (q.y - A.y) - (B.y - A.y) * (q.x - A.x) <= 0;
        });
      expect(parts.some((x) => x.layer === 'wallBoards' && inside(plan(x), outer))).toBe(true);
    });
});

describe('poddasze w 3D', () => {
  const project = () => {
    const p = createProject();
    p.attics = [createAttic({ id: 'att', length: 500, width: 800, pitch: 45, kneeLeft: 100, kneeRight: 100, collarHeight: 260, woolUnder: 0 })];
    return p;
  };

  it('profile CD, wieszaki i płyty z tej samej siatki co zestawienie', () => {
    const p = project();
    const r = atticRequirement(p.attics![0]);
    const m = buildModel3D(p);
    const boxes = m.parts.filter((x) => x.type === 'box');
    const lines = r.grid.surfaces.reduce((n, g) => n + g.cd.length, 0);
    expect(boxes.filter((x) => x.mat === 'cdMain')).toHaveLength(lines);
    expect(boxes.filter((x) => x.mat === 'hanger')).toHaveLength(r.hangers);
    // płyty: każdy element z rozkładu (ten sam co na rysunku i liście zakupów) to osobna bryła
    const pieces = r.boards.surfaces.flatMap((s) => s.layers.flatMap((l) => l.pieces));
    const plates = boxes.filter((x) => x.mat.startsWith('board:')) as BoxPart[];
    expect(plates).toHaveLength(pieces.length);
    expect(plates.reduce((t, b) => t + b.s[0] * b.s[2], 0)).toBeCloseTo(r.areaM2, 4);
    // krokwie po obu stronach przy każdej osi + jętki
    expect(boxes.filter((x) => x.mat === 'timber')).toHaveLength(r.grid.rafters.length * 3);
    expect(boxes.filter((x) => x.mat === 'vapor')).toHaveLength(r.grid.surfaces.length);
  });

  it('okno dachowe: ościeżnica z szybą, 4 glify, obramowanie i przerwane linie CD', () => {
    const p = project();
    const base = buildModel3D(p).parts;
    p.attics![0].windows = [{ id: 'w', side: 'left', width: 78, height: 118, u: 145, sill: 160 }];
    const r = atticRequirement(p.attics![0]);
    const x = r.windows.list[0];
    const parts = buildModel3D(p).parts;
    const boxes = parts.filter((q): q is BoxPart => q.type === 'box');
    expect(boxes.filter((q) => q.mat === 'glass')).toHaveLength(1);
    const panels = parts.filter((q): q is PanelPart => q.type === 'panel' && q.owner === 'att');
    expect(panels).toHaveLength(2);
    // każda przerwana linia to dwa odcinki zamiast jednego, plus 4 profile obramowania
    const cd = (list: typeof parts) => list.filter((q) => q.type === 'box' && q.mat === 'cdMain').length;
    expect(cd(parts)).toBe(cd(base) + x.interrupted.length + x.cross.length + x.side.length);
  });

  it('ruszt krzyżowy: nośne pod krokwiami, montażowe w poprzek, wieszaki na nośnych', () => {
    const p = project();
    p.attics![0].systemId = 'SN-P-ESDK-1';
    p.attics![0].boardId = 'SN-EXP12.5';
    const r = atticRequirement(p.attics![0]);
    const boxes = buildModel3D(p).parts.filter((x) => x.type === 'box');
    const lines = r.grid.surfaces.reduce((n, g) => n + g.cd.length, 0);
    expect(boxes.filter((x) => x.mat === 'cdSec')).toHaveLength(lines);
    expect(boxes.filter((x) => x.mat === 'cdMain')).toHaveLength(r.grid.rafters.length * r.grid.surfaces.length);
    expect(boxes.filter((x) => x.mat === 'hanger')).toHaveLength(r.hangers);
  });

  it('skosy są pochylone o kąt dachu, sufit poziomy na wysokości jętek', () => {
    const m = buildModel3D(project());
    const boards = m.parts.filter((x) => x.type === 'box' && x.mat.startsWith('board:')) as BoxPart[];
    const tilt = [...new Set(boards.map((b) => Math.round((Math.abs(b.rotX ?? 0) * 180) / Math.PI)))].sort((a, b) => a - b);
    expect(tilt).toEqual([0, 45]);
    const flat = boards.find((b) => !b.rotX)!;
    // lico płyt 45 mm pod jętką (karta 4.70.06), środek płyty 12,5 mm wyżej o połowę grubości
    expect(flat.c[1]).toBeCloseTo(2.6 - 0.045 + 0.00625, 4);
    // profile CD leżą nad płytą (bliżej krokwi), nie pod nią
    const cd = m.parts.filter((x) => x.type === 'box' && x.mat === 'cdMain' && !x.rotX) as BoxPart[];
    expect(cd[0].c[1]).toBeGreaterThan(flat.c[1]);
    // model sięga do kalenicy: 1,00 + 4,00·tg45° = 5,00 m + krokiew
    expect(m.bounds.max[1]).toBeGreaterThan(5);
    expect(m.bounds.min[2]).toBeLessThanOrEqual(0);
  });
});

describe('poddasze z narożnikami i koszami w 3D', () => {
  it('płyty jako wielokąty na połaciach, krokwie narożne i koszowe jako belki', () => {
    const a = createAttic({ ends: ['hip', 'gable'], wings: [{ id: 'w', side: 'left', at: 500, width: 400, length: 300, end: 'hip' }] });
    const m = buildModel3D(quickAtticProject(a));
    const faces = m.parts.filter((x) => x.type === 'face' && x.layer === 'ceilingBoards');
    const beams = m.parts.filter((x) => x.type === 'beam');
    expect(faces.length).toBeGreaterThan(5);
    expect(beams.some((b) => b.type === 'beam' && b.layer === 'existing')).toBe(true);
    for (const v of [...m.bounds.min, ...m.bounds.max]) expect(Number.isFinite(v)).toBe(true);
    // obrót kalenicy o 90° przenosi całość
    const r = buildModel3D(quickAtticProject({ ...a, planRot: 90 }));
    expect(r.parts.length).toBe(m.parts.length);
  });
});
