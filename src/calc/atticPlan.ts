// Poddasze na rzucie: położenie w planie, obrys i linie (kalenica, krokwie, załamania skos/sufit).
// Kalenica biegnie wzdłuż osi X planu (lewa ściana okapowa na krawędzi o mniejszym Y) albo, po obrocie
// o 90°, wzdłuż osi Y (lewa ściana okapowa na krawędzi o większym X) – tak samo jak w widoku 3D.

import { ceilingSystemById } from '../catalog/rigips';
import type { Attic, Point, Project } from '../model/types';
import { atticGrid } from './attic';

/** Wymiary obrysu na planie (wzdłuż X i Y), cm */
export const atticFootprint = (a: Pick<Attic, 'length' | 'width' | 'planRot'>): { w: number; h: number } =>
  a.planRot === 90 ? { w: a.width, h: a.length } : { w: a.length, h: a.width };

/** Punkt poddasza (u wzdłuż kalenicy, v w poprzek od lewej ściany okapowej) w układzie planu */
export const atticToPlan = (a: Pick<Attic, 'width' | 'planRot'>, o: Point, u: number, v: number): Point =>
  a.planRot === 90 ? { x: o.x + a.width - v, y: o.y + u } : { x: o.x + u, y: o.y + v };

/** Odstęp nowego poddasza od reszty rysunku, cm */
const GAP = 100;

/** Zakres zajęty na planie przez ściany, sufity i poddasza z ustalonym położeniem */
function planBounds(p: Project, skipId?: string): { minX: number; maxY: number } | null {
  const pts: Point[] = [...p.nodes, ...p.ceilings.flatMap((c) => c.points)];
  for (const a of p.attics ?? []) {
    if (a.id === skipId || !a.plan) continue;
    const f = atticFootprint(a);
    pts.push({ x: a.plan.x, y: a.plan.y }, { x: a.plan.x + f.w, y: a.plan.y + f.h });
  }
  if (!pts.length) return null;
  return { minX: Math.min(...pts.map((q) => q.x)), maxY: Math.max(...pts.map((q) => q.y)) };
}

/** Wolne miejsce dla nowego poddasza: pod resztą rysunku, wyrównane do jego lewej krawędzi */
export function freeAtticSpot(p: Project): Point {
  const b = planBounds(p);
  return b ? { x: b.minX, y: b.maxY + GAP } : { x: 0, y: 0 };
}

/**
 * Położenie każdego poddasza w planie (lewy górny narożnik, cm). Poddasza bez zapisanego położenia
 * (projekty sprzed rysowania na planie) układają się kolejno pod resztą rysunku.
 */
export function atticPlacements(p: Project): Map<string, Point> {
  const out = new Map<string, Point>();
  const b = planBounds(p);
  let y = b ? b.maxY + GAP : 0;
  const x = b ? b.minX : 0;
  for (const a of p.attics ?? []) {
    if (a.plan) {
      out.set(a.id, { x: a.plan.x, y: a.plan.y });
      continue;
    }
    out.set(a.id, { x, y });
    y += atticFootprint(a).h + GAP;
  }
  return out;
}

export function atticOutline(a: Attic, o: Point): Point[] {
  const f = atticFootprint(a);
  return [
    { x: o.x, y: o.y },
    { x: o.x + f.w, y: o.y },
    { x: o.x + f.w, y: o.y + f.h },
    { x: o.x, y: o.y + f.h },
  ];
}

export interface AtticPlanLines {
  outline: Point[];
  /** Kalenica (dach dwuspadowy); w jednospadowym brak */
  ridge?: [Point, Point];
  /** Załamania skos / sufit pod jętkami po licu płyt */
  folds: [Point, Point][];
  /** Osie krokwi */
  rafters: [Point, Point][];
  /** Krawędzie ze ścianką kolankową (mur) */
  knees: [Point, Point][];
}

/** Linie poddasza do narysowania na rzucie – z tej samej siatki co rysunki i 3D */
export function atticPlanLines(a: Attic, o: Point): AtticPlanLines {
  const g = atticGrid(a, ceilingSystemById(a.systemId));
  // linia równoległa do kalenicy w odległości v od lewej ściany okapowej
  const across = (v: number): [Point, Point] => [atticToPlan(a, o, 0, v), atticToPlan(a, o, a.length, v)];
  const collar = g.section.surfaces.find((s) => s.kind === 'collar');
  const folds: [Point, Point][] = [];
  if (collar) {
    if (collar.a.x > 1) folds.push(across(collar.a.x));
    if (collar.b.x < a.width - 1) folds.push(across(collar.b.x));
  }
  const knees: [Point, Point][] = [];
  if (a.kneeLeft > 0) knees.push(across(0));
  if (a.roof === 'mono' || a.kneeRight > 0) knees.push(across(a.width));
  return {
    outline: atticOutline(a, o),
    ridge: a.roof === 'gable' ? across(g.structure.ridgeX) : undefined,
    folds,
    rafters: g.rafters.map((u) => [atticToPlan(a, o, u, 0), atticToPlan(a, o, u, a.width)]),
    knees,
  };
}
