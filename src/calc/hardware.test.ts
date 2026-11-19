// Uchwyty ES okładzin, wieszaki i łączniki sufitów: te same miejsca w wyliczeniach, na rysunkach i w 3D
import { describe, expect, it } from 'vitest';
import { bracketPositions, liningLayout } from './layout';
import { calculateProject, ceilingCrossings, liningKey } from './materials';
import { buildContacts } from '../geometry/contacts';
import { interiorSide } from '../geometry/geometry';
import { createCeiling, createLining, createOpening, createProject } from '../model/factory';
import { addWall } from '../model/ops';
import type { Project } from '../model/types';
import { buildModel3D, type BoxPart, type CylPart } from '../view3d/model3d';

const pts = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 500, y: 400 },
  { x: 0, y: 400 },
];

/** Pomieszczenie z muru, pierwsza ściana z okładziną CD 60 na ES (i oknem) */
function lined(systemId = 'O-CD-1', window = true): Project {
  const p = createProject();
  pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
  const w = p.walls[0];
  w.linings = [createLining(interiorSide(p, w) || 1, systemId)];
  if (window) w.openings.push(createOpening('window', 150));
  return p;
}

const count = (p: Project, key: string, product: string) => calculateProject(p).linings.get(key)!.req.counts[product] ?? 0;

describe('rozmieszczenie uchwytów ES na profilu CD', () => {
  it('profil 2,6 m, max co 100 cm: 3 uchwyty równo, skrajne pół odstępu od końców', () => {
    const ys = bracketPositions(0, 2.6, 1);
    expect(ys).toHaveLength(3);
    expect(ys[0]).toBeCloseTo(2.6 / 6, 3);
    expect(ys[1] - ys[0]).toBeCloseTo(2.6 / 3, 3);
    expect(2.6 - ys[2]).toBeCloseTo(2.6 / 6, 3);
  });
  it('odstęp nigdy większy niż z karty (Norgips co 120 cm)', () => {
    for (const H of [1.1, 2.4, 2.75, 3.6, 5]) {
      const ys = bracketPositions(0, H, 1.2);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeLessThanOrEqual(1.2 + 1e-9);
      expect(ys).toHaveLength(Math.ceil(H / 1.2 - 1e-9));
    }
  });
  it('krótki odcinek pod oknem ma jeden uchwyt w połowie', () => {
    expect(bracketPositions(0, 0.85, 1)).toEqual([0.425]);
    expect(bracketPositions(1, 1.005, 1)).toEqual([]);
  });
});

describe('uchwyty ES okładziny muru', () => {
  it('na rysunku tyle uchwytów, ile w zestawieniu materiałów (z oknem)', () => {
    const p = lined();
    const w = p.walls[0];
    const l = liningLayout(p, w, w.linings![0], buildContacts(p));
    expect(l.brackets).toBeDefined();
    expect(l.brackets!.spacing).toBeCloseTo(1);
    const key = liningKey(w.id, w.linings![0].side);
    expect(l.brackets!.points).toHaveLength(count(p, key, 'WIESZAK_ES'));
    // jeden kołek na uchwyt
    expect(l.brackets!.points.length).toBeGreaterThan(0);
  });

  it('uchwyty stoją na osiach profili CD z rysunku, w okładzinie (nie w oknie)', () => {
    const p = lined();
    const w = p.walls[0];
    const l = liningLayout(p, w, w.linings![0]);
    const o = l.openings[0];
    for (const q of l.brackets!.points) {
      expect(l.studs.some((s) => Math.abs(Math.min(Math.max(s.x, 0.03), l.L - 0.03) - q.x) < 0.002)).toBe(true);
      expect(q.x > o.x0 + 0.02 && q.x < o.x1 - 0.02 && q.y > o.sill && q.y < o.top).toBe(false);
      expect(q.y).toBeGreaterThan(0);
      expect(q.y).toBeLessThan(l.H);
    }
  });

  it('rozstaw z karty systemu: Norgips OS co 120 cm daje mniej uchwytów niż Rigips 3.21.10 co 100 cm', () => {
    const rig = lined('O-CD-1', false);
    const nor = lined('NG-OS-CD-1', false);
    const n = (p: Project) => liningLayout(p, p.walls[0], p.walls[0].linings![0]).brackets!;
    expect(n(nor).spacing).toBeCloseTo(1.2);
    // 2,6 m: 3 uchwyty przy 100 cm, 3 przy 120 cm; 2,4 m różni oba systemy
    for (const p of [rig, nor]) p.walls[0].height = 240;
    expect(n(nor).points.length).toBeLessThan(n(rig).points.length);
  });

  it('inne okładziny nie mają uchwytów ES', () => {
    const p = lined('O-KLEJ', false);
    expect(liningLayout(p, p.walls[0], p.walls[0].linings![0]).brackets).toBeUndefined();
  });

  it('3D: każdy uchwyt ma blachę na murze i kołek, profile CD jak na rysunku', () => {
    const p = lined();
    const w = p.walls[0];
    const l = liningLayout(p, w, w.linings![0]);
    const parts = buildModel3D(p).parts.filter((x) => x.owner === w.id);
    const anchors = parts.filter((x): x is CylPart => x.type === 'cyl' && x.mat === 'anchor');
    expect(anchors).toHaveLength(l.brackets!.points.length);
    // blacha + dwa ramiona na uchwyt
    expect(parts.filter((x) => x.type === 'box' && x.mat === 'hanger')).toHaveLength(l.brackets!.points.length * 3);
    const segs = l.studs.reduce((a, s) => a + s.segments.length, 0);
    expect(parts.filter((x) => x.type === 'box' && x.mat === 'cdMain')).toHaveLength(segs);
    for (const [i, a] of anchors.entries()) expect(a.c[1]).toBeCloseTo(l.brackets!.points[i].y);
  });
});

describe('łączniki i wieszaki sufitu w 3D', () => {
  const ceiling = (systemId: string) => {
    const p = createProject();
    const c = createCeiling(p, pts, { systemId, height: 250 });
    p.ceilings = [c];
    return { p, c };
  };
  const conn = (p: Project) => buildModel3D(p).parts.filter((x): x is BoxPart => x.type === 'box' && x.mat === 'connector');

  it('dwupoziomowy: łącznik krzyżowy na każdym skrzyżowaniu, liczba = zestawienie', () => {
    const { p, c } = ceiling('S-CD-2P-1');
    const n = ceilingCrossings(c).length;
    expect(n).toBeGreaterThan(0);
    expect(calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_KRZ).toBe(n);
    // strzemię + dwa ramiona; sufit 5 m – profile 4 m dostają łączniki wzdłużne
    const splices = calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_WZDL ?? 0;
    expect(conn(p)).toHaveLength(n * 3 + splices);
  });

  it('jednopoziomowy: dwa łączniki na skrzyżowanie', () => {
    const { p, c } = ceiling('S-CD-1P-1');
    const n = ceilingCrossings(c).length;
    expect(calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_JEDNO).toBe(n * 2);
    const splices = calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_WZDL ?? 0;
    expect(conn(p)).toHaveLength(n * 2 + splices);
  });

  it('wieszaki w 3D tyle, ile w zestawieniu', () => {
    const { p, c } = ceiling('S-CD-2P-1');
    const hangers = buildModel3D(p).parts.filter((x) => x.type === 'box' && x.mat === 'hanger');
    expect(hangers).toHaveLength(calculateProject(p).ceilings.get(c.id)!.req.counts.WIESZAK_NONIUSZ);
  });
});
