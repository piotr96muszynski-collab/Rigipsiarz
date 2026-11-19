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
    // najpierw 7 i 253 cm, potem co 50 cm od dolnego rzędu: 7, 57, 107, 157, 207, 253
    expect(g.ys).toEqual([0.07, 0.57, 1.07, 1.57, 2.07, 2.53]);
    expect(g.ys[0]).toBeCloseTo(0.07);
    expect(g.ys.at(-1)).toBeCloseTo(2.53);
    for (let i = 1; i < g.ys.length; i++) expect(g.ys[i] - g.ys[i - 1]).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(g.points).toHaveLength(30);
  });

  it('krążek pośredni blisko skrajnego zostaje – łączniki są wtedy gęściej', () => {
    // 4,90 m: skrajna kolumna 4,83 m, oś styku 4,80 m zostaje 3 cm obok
    const xs = pointFixGrid(0, 4.9, 1, 0.6, 0.5).xs;
    expect(xs.slice(-2)).toEqual([4.8, 4.83]);
    expect(xs[0]).toBe(0.07);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(0.6 + 1e-9);
    // 2,40 m wysokości: rzędy 7, 57 … 207, a górny skrajny 233 cm – 26 cm wyżej, nic nie znika
    const ys = pointFixGrid(0, 1, 2.4, 0.6, 0.5).ys;
    expect(ys).toEqual([0.07, 0.57, 1.07, 1.57, 2.07, 2.33]);
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

describe('łączniki ATLAS przy ścianach i stykach płyt', () => {
  it('sufit z ukośną ścianą: rząd łączników 7 cm od każdej ściany, także ukośnej', async () => {
    const { createCeiling } = await import('./factory');
    const { ceilingFixerGrid } = await import('../calc/materials');
    const p = createProject();
    // ścięty narożnik: ukos od (300, 0) do (400, 100)
    const poly = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 400, y: 100 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    const c = createCeiling(p, poly, { systemId: 'A-S-L100' });
    const g = ceilingFixerGrid(c);
    const a = poly[1];
    const b = poly[2];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const distToDiag = (q: { x: number; y: number }) => Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / L;
    const onDiag = g.points.filter((q) => Math.abs(distToDiag(q) - 7) < 0.6);
    // ukos ≈ 141 cm, odcinek 7 cm od niego krótszy – łączniki na końcach i co ≤ 40 cm
    expect(onDiag.length).toBeGreaterThanOrEqual(4);
    // żaden łącznik nie leży bliżej ściany niż 7 cm
    for (const q of g.points)
      for (let i = 0; i < poly.length; i++) {
        const s0 = poly[i];
        const s1 = poly[(i + 1) % poly.length];
        const dx = s1.x - s0.x;
        const dy = s1.y - s0.y;
        const t = Math.max(0, Math.min(1, ((q.x - s0.x) * dx + (q.y - s0.y) * dy) / (dx * dx + dy * dy)));
        expect(Math.hypot(q.x - s0.x - t * dx, q.y - s0.y - t * dy)).toBeGreaterThan(6.4);
      }
  });

  it('sufit: każdy styk płyt leży na rzędzie albo kolumnie łączników', async () => {
    const { createCeiling } = await import('./factory');
    const { ceilingFixerGrid } = await import('../calc/materials');
    const { ceilingBoardLayout } = await import('../calc/layout');
    const p = createProject();
    const c = createCeiling(p, [{ x: 0, y: 0 }, { x: 610, y: 0 }, { x: 610, y: 470 }, { x: 0, y: 470 }], { systemId: 'A-S-L100' });
    const g = ceilingFixerGrid(c);
    for (const pc of ceilingBoardLayout(c).pieces) {
      if (pc.x0 > 1) expect(g.xs.some((x) => Math.abs(x - pc.x0) < 0.5)).toBe(true);
      if (pc.y0 > 1) expect(g.ys.some((y) => Math.abs(y - pc.y0) < 0.5)).toBe(true);
    }
  });

  it('sufit: bez docinków węższych niż 30 cm – poprzednia płyta krótsza', async () => {
    const { createCeiling } = await import('./factory');
    const { ceilingBoardLayout } = await import('../calc/layout');
    const p = createProject();
    for (const [w, h] of [
      [505, 250],
      [510, 365],
      [770, 245],
    ]) {
      const c = createCeiling(p, [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], { systemId: 'S-CD-2P-1' });
      for (const pc of ceilingBoardLayout(c).pieces) {
        expect(pc.x1 - pc.x0).toBeGreaterThanOrEqual(29.5);
        expect(pc.y1 - pc.y0).toBeGreaterThanOrEqual(29.5);
      }
    }
  });

  it('ściana wyższa niż arkusz: na poziomym styku płyt jest rząd łączników', () => {
    const p = createProject();
    pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 330 }));
    const w = p.walls[0];
    w.linings = [createLining(interiorSide(p, w) || 1, 'A-W-L100')];
    const l = liningLayout(p, w, w.linings[0]);
    const ys = l.faces[0].pieces.flatMap((pc) => [pc.y0, pc.y1]).filter((y) => y > 0.01 && y < 3.29);
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) expect(l.fixers!.ys.some((r) => Math.abs(r - y) < 0.002)).toBe(true);
    // ilość w materiałach = łączniki z rysunku
    const calc = calculateProject(p);
    expect(calc.linings.get(liningKey(w.id, w.linings[0].side))!.req.counts.ATLAS_3G_L100).toBe(l.fixers!.points.length);
  });
});
