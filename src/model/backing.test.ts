import { describe, expect, it } from 'vitest';
import { calculateProject, liningKey } from '../calc/materials';
import { liningLayout, pointFixGrid } from '../calc/layout';
import { buildContacts, findCollisions } from '../geometry/contacts';
import { interiorSide, isNewWall, masonrySide } from '../geometry/geometry';
import { buildModel3D, DISC_R, type CylPart } from '../view3d/model3d';
import { ensureLiningBacking, needsBacking, withLiningBacking } from './backing';
import { createLining, createOpening, createProject } from './factory';
import { addWall } from './ops';

const pts = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 500, y: 400 },
  { x: 0, y: 400 },
];

describe('mur za ścianą narysowaną w systemie okładziny', () => {
  it('ATLAS M-System: nowa ściana zmienia się w mur z okładziną po stronie płyt', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 }, { systemId: 'A-W-L100', boardId: 'RB12.5', studSpacing: 60 })!;
    w.openings.push(createOpening('door', 100));
    expect(needsBacking(p)).toBe(true);
    const r = ensureLiningBacking(p);
    expect(r.converted).toEqual([w.id]);
    expect(isNewWall(w)).toBe(false);
    expect(w.backing).toBe(true);
    expect(w.thickness).toBe(25);
    expect(w.linings).toEqual([{ side: 1, systemId: 'A-W-L100', boardId: 'RB12.5', studSpacing: 60, insulation: false }]);
    expect(w.openings[0].reinforced).toBe(false);
    // mur po przeciwnej stronie niż okładzina, mimo braku zamkniętego obrysu
    expect(masonrySide(p, w)).toBe(1);
    expect(needsBacking(p)).toBe(false);
    // okładzina nadal liczona w materiałach (łączniki ATLAS)
    const calc = calculateProject(p);
    expect(calc.walls.size).toBe(0);
    expect(calc.linings.get(liningKey(w.id, 1))!.req.counts.ATLAS_3G_L100).toBeGreaterThan(0);
  });

  it('CD 60 na uchwytach ES też dostaje mur, zwykła ściana CW nie', () => {
    const p = createProject();
    const cd = addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 }, { systemId: 'O-CD-1' })!;
    const cw = addWall(p, { x: 0, y: 100 }, { x: 300, y: 100 }, { systemId: 'W-CW75-1' })!;
    ensureLiningBacking(p);
    expect(cd.kind).toBe('existing');
    expect(cd.linings?.[0].systemId).toBe('O-CD-1');
    expect(isNewWall(cw)).toBe(true);
  });

  it('okładzina narysowana na istniejącym murze trafia na ten mur zamiast tworzyć drugi', () => {
    const p = createProject();
    pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
    const wall0 = p.walls[0]; // y = 0, pomieszczenie po stronie y > 0
    // linia okładziny 3 cm od lica, po stronie pomieszczenia
    const lw = addWall(p, { x: 0, y: 3 }, { x: 500, y: 3 }, { systemId: 'A-W-L150' })!;
    const r = ensureLiningBacking(p);
    expect(r.merged).toEqual([lw.id]);
    expect(p.walls.some((x) => x.id === lw.id)).toBe(false);
    expect(p.walls).toHaveLength(4);
    expect(wall0.linings).toHaveLength(1);
    expect(wall0.linings![0].side).toBe(interiorSide(p, wall0));
    expect(wall0.linings![0].systemId).toBe('A-W-L150');
  });

  it('pokój narysowany w M-System: okładziny obracają się do wnętrza po zamknięciu obrysu', () => {
    const p = createProject();
    // przeciwnie do ruchu wskazówek zegara – strona 1 (normalna) wskazuje na zewnątrz
    const ccw = [...pts].reverse();
    ccw.forEach((pt, i) => addWall(p, pt, ccw[(i + 1) % 4], { systemId: 'A-W-L100' }));
    ensureLiningBacking(p);
    for (const w of p.walls) {
      expect(w.kind).toBe('existing');
      expect(w.linings![0].side).toBe(interiorSide(p, w));
    }
    expect(findCollisions(p)).toHaveLength(0);
  });

  it('withLiningBacking nie kopiuje projektu, gdy nie ma nic do zrobienia', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(withLiningBacking(p)).toBe(p);
  });
});

describe('siatka łączników ATLAS M-System', () => {
  it('skrajne rzędy 7 cm od każdego brzegu, kolumny w osiach styków płyt (instrukcja ATLAS)', () => {
    const g = pointFixGrid(0, 2.4, 2.6, 0.6, 0.5);
    expect(g.xs).toEqual([0.07, 0.6, 1.2, 1.8, 2.33]);
    // 7 … 253 cm, równo co 49,2 cm (nie więcej niż 50)
    expect(g.ys).toHaveLength(6);
    expect(g.ys[0]).toBeCloseTo(0.07);
    expect(g.ys.at(-1)).toBeCloseTo(2.53);
    for (let i = 1; i < g.ys.length; i++) expect(g.ys[i] - g.ys[i - 1]).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(g.points).toHaveLength(30);
  });

  it('oś pośrednia tuż przy skrajnej odpada, odstępy nie przekraczają rozstawu', () => {
    // 4,85 m: oś 4,80 m leżałaby 2 cm od skrajnej (4,78 m)
    const xs = pointFixGrid(0, 4.85, 1, 0.6, 0.5).xs;
    expect(xs.at(-1)).toBeCloseTo(4.78);
    expect(xs).not.toContain(4.8);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('pomija łączniki w świetle otworu', () => {
    const g = pointFixGrid(0, 3, 2.6, 0.6, 0.5, [{ x0: 1, x1: 2, sill: 0, top: 2.05 }]);
    // kolumny 1,2 i 1,8 m wypadają w drzwiach; w świetle drzwi są rzędy 7, 56, 105 i 155 cm
    expect(g.ys.filter((y) => y < 2.03)).toHaveLength(4);
    expect(g.points.length).toBe(g.xs.length * g.ys.length - 2 * 4);
    expect(g.points.every((q) => !(q.x > 1.02 && q.x < 1.98 && q.y < 2.03))).toBe(true);
  });

  it('rysunek okładziny muru ma siatkę łączników na zakresie okładziny', () => {
    const p = createProject();
    pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
    const w = p.walls[0];
    w.linings = [createLining(interiorSide(p, w) || 1, 'A-W-L100')];
    const l = liningLayout(p, w, w.linings[0], buildContacts(p));
    expect(l.fixers).toBeDefined();
    expect(l.fixers!.xs[0]).toBeCloseTo(0.07);
    expect(l.fixers!.xs.at(-1)).toBeCloseTo(4.93);
    expect(l.fixers!.ys).toHaveLength(6);
    // styki płyt na kolumnach łączników
    for (const x of l.faces[0].joints) expect(l.fixers!.xs.some((c) => Math.abs(c - x) < 0.01)).toBe(true);
  });
});

describe('łączniki ATLAS w 3D', () => {
  it('okładzina muru: talerzyk pod płytą, trzpień w murze, po jednym na punkt siatki', () => {
    const p = createProject();
    pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
    const w = p.walls[0]; // y = 0, pomieszczenie po stronie y > 0
    w.linings = [createLining(interiorSide(p, w) || 1, 'A-W-L100')];
    const m = buildModel3D(p, calculateProject(p));
    const cyl = m.parts.filter((x): x is CylPart => x.type === 'cyl' && x.owner === w.id);
    const discs = cyl.filter((x) => x.mat === 'disc');
    const grid = liningLayout(p, w, w.linings[0]).fixers!;
    expect(discs).toHaveLength(grid.points.length);
    expect(cyl.filter((x) => x.mat === 'anchor')).toHaveLength(grid.points.length);
    for (const d of discs) {
      expect(d.r).toBe(DISC_R);
      // talerzyk między licem muru (z = 0) a płytą (odstęp 32 mm)
      expect(d.c[2]).toBeGreaterThan(0);
      expect(d.c[2]).toBeLessThan(0.032);
      expect(Math.abs(d.axis[2])).toBeCloseTo(1);
    }
  });

  it('sufit ATLAS: łączniki nad płytą w siatce z wyliczeń, bez profili', async () => {
    const { createCeiling } = await import('./factory');
    const { ceilingFixerGrid } = await import('../calc/materials');
    const p = createProject();
    const c = createCeiling(p, pts, { systemId: 'A-S-L100', height: 250 });
    p.ceilings.push(c);
    const parts = buildModel3D(p).parts;
    const discs = parts.filter((x): x is CylPart => x.type === 'cyl' && x.mat === 'disc');
    expect(discs).toHaveLength(ceilingFixerGrid(c).points.length);
    expect(discs.every((d) => d.c[1] > 2.5 && d.c[1] < 2.53 && d.layer === 'ceilingFrame')).toBe(true);
    expect(parts.some((x) => x.type === 'box' && x.mat === 'ud')).toBe(false);
  });
});
