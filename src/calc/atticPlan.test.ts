import { describe, expect, it } from 'vitest';
import { createAttic, createCeiling, createProject } from '../model/factory';
import { buildModel3D, type BoxPart } from '../view3d/model3d';
import { atticFootprint, atticOutline, atticPlacements, atticPlanLines, freeAtticSpot } from './atticPlan';

describe('poddasze na planie', () => {
  it('nowe poddasze trafia pod resztę rysunku, kolejne pod poprzednie', () => {
    const p = createProject();
    expect(freeAtticSpot(p)).toEqual({ x: 0, y: 0 });
    p.ceilings = [createCeiling(p, [{ x: 50, y: 0 }, { x: 450, y: 0 }, { x: 450, y: 300 }, { x: 50, y: 300 }])];
    expect(freeAtticSpot(p)).toEqual({ x: 50, y: 400 });
    p.attics = [createAttic({ id: 'a', plan: freeAtticSpot(p), width: 800, length: 1000 })];
    expect(freeAtticSpot(p)).toEqual({ x: 50, y: 1300 });
  });

  it('poddasza bez zapisanego położenia (stare projekty) układają się kolejno i nie nachodzą na siebie', () => {
    const p = createProject();
    p.attics = [createAttic({ id: 'a', width: 800 }), createAttic({ id: 'b', width: 600 })];
    const s = atticPlacements(p);
    expect(s.get('a')).toEqual({ x: 0, y: 0 });
    expect(s.get('b')).toEqual({ x: 0, y: 900 });
  });

  it('obrys i linie: kalenica w połowie, załamania przy suficie, krokwie w poprzek kalenicy', () => {
    const a = createAttic({ plan: { x: 100, y: 200 }, width: 800, length: 1000, pitch: 45, kneeLeft: 100, kneeRight: 100, collarHeight: 260, rafterSpacing: 90, firstRafter: 10 });
    const l = atticPlanLines(a, a.plan!);
    expect(l.outline[2]).toEqual({ x: 1100, y: 1000 });
    expect(l.ridge).toEqual([{ x: 100, y: 600 }, { x: 1100, y: 600 }]);
    expect(l.folds).toHaveLength(2);
    // załamania symetrycznie względem kalenicy
    expect(l.folds[0][0].y + l.folds[1][0].y).toBeCloseTo(1200, 6);
    expect(l.rafters).toHaveLength(12);
    expect(l.rafters[0]).toEqual([{ x: 110, y: 200 }, { x: 110, y: 1000 }]);
    expect(l.knees).toHaveLength(2);
  });

  it('kalenica pionowo: obrys obrócony, krokwie poziomo', () => {
    const a = createAttic({ plan: { x: 0, y: 0 }, planRot: 90, width: 600, length: 1000, collarHeight: undefined });
    expect(atticFootprint(a)).toEqual({ w: 600, h: 1000 });
    expect(atticOutline(a, a.plan!)[2]).toEqual({ x: 600, y: 1000 });
    const l = atticPlanLines(a, a.plan!);
    expect(l.ridge![0].x).toBeCloseTo(300, 6);
    expect(l.ridge![0].y).toBe(0);
    expect(l.ridge![1].y).toBe(1000);
    expect(l.rafters[0][0].y).toBe(l.rafters[0][1].y);
  });

  it('w 3D poddasze stoi tam, gdzie na planie, także po obrocie kalenicy', () => {
    const range = (rot: 0 | 90) => {
      const p = createProject();
      p.attics = [createAttic({ plan: { x: 300, y: 500 }, planRot: rot, width: 600, length: 1000 })];
      const boards = buildModel3D(p).parts.filter((x) => x.type === 'box' && x.mat.startsWith('board:')) as BoxPart[];
      const xs = boards.map((b) => b.c[0]);
      const zs = boards.map((b) => b.c[2]);
      return { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] };
    };
    const r0 = range(0);
    // środki płyt: wzdłuż kalenicy w połowie długości (3 + 5 m), w poprzek w obrębie szerokości (5…11 m)
    expect(r0.x[0]).toBeCloseTo(8, 6);
    expect(r0.z[0]).toBeGreaterThan(5);
    expect(r0.z[1]).toBeLessThan(11);
    const r90 = range(90);
    expect(r90.z[0]).toBeCloseTo(10, 6);
    expect(r90.x[0]).toBeGreaterThan(3);
    expect(r90.x[1]).toBeLessThan(9);
  });
});
