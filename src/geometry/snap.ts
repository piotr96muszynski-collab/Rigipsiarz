// Przyciąganie z liniami pomocniczymi: do osi innych ścian, do pionu/poziomu innych węzłów
// i do kątów prostych (oraz co 45°) względem ścian, z którymi przesuwany punkt jest połączony.
// Używane przy rysowaniu ściany, przeciąganiu węzła i przesuwaniu całych ścian. Jednostki: cm.

import type { Id, Point, Project, Wall } from '../model/types';
import { dist, nodeMap, projectOnSegment } from './geometry';

export type GuideKind = 'align' | 'axis' | 'angle';

/** Linia pomocnicza: przechodzi przez `at` w kierunku `dir` (wektor jednostkowy) */
export interface Guide {
  at: Point;
  dir: Point;
  kind: GuideKind;
}

export interface GuideSnap {
  point: Point;
  kind: 'node' | 'wall' | 'guide' | 'grid';
  /** linie, do których punkt został przyciągnięty (do narysowania) */
  guides: Guide[];
}

/** Punkt, od którego liczymy kąt (drugi koniec ściany) */
export interface Anchor {
  at: Point;
  /** węzeł punktu – kąt prosty liczymy też względem innych ścian w tym węźle */
  nodeId?: Id;
  /** ściana, której kąt właśnie ustalamy (pomijana przy kątach względnych) */
  skipWall?: Id;
}

const unit = (x: number, y: number): Point => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const parallel = (a: Point, b: Point) => Math.abs(cross(a, b)) < 1e-3;

/** Odległość punktu od prostej i wektor przesunięcia na nią */
function toLine(pt: Point, g: Guide): { d: number; v: Point } {
  const t = (pt.x - g.at.x) * g.dir.x + (pt.y - g.at.y) * g.dir.y;
  const q = { x: g.at.x + g.dir.x * t, y: g.at.y + g.dir.y * t };
  return { d: dist(pt, q), v: { x: q.x - pt.x, y: q.y - pt.y } };
}

/** Linie pomocnicze dla punktu, który nie należy do węzłów `moved` */
export function guidesFor(p: Project, moved: Set<Id>, anchors: Anchor[]): Guide[] {
  const nodes = nodeMap(p);
  const out: Guide[] = [];
  // pion i poziom przez pozostałe węzły
  for (const n of p.nodes) {
    if (moved.has(n.id)) continue;
    out.push({ at: n, dir: { x: 1, y: 0 }, kind: 'align' }, { at: n, dir: { x: 0, y: 1 }, kind: 'align' });
  }
  // osie nieruchomych ścian (przedłużenie ściany w linii)
  for (const w of p.walls) {
    if (moved.has(w.a) || moved.has(w.b)) continue;
    const A = nodes.get(w.a);
    const B = nodes.get(w.b);
    if (!A || !B || dist(A, B) < 1) continue;
    const dir = unit(B.x - A.x, B.y - A.y);
    if (Math.abs(dir.x) > 0.9999 || Math.abs(dir.y) > 0.9999) continue; // pokrywa się z pionem/poziomem
    out.push({ at: A, dir, kind: 'axis' });
  }
  return [...out, ...angleGuides(p, moved, anchors)];
}

/** Kąty od punktów zaczepienia: co 45° oraz prostopadle i równolegle do ścian w tym węźle */
export function angleGuides(p: Project, moved: Set<Id>, anchors: Anchor[]): Guide[] {
  const nodes = nodeMap(p);
  const out: Guide[] = [];
  for (const an of anchors) {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      out.push({ at: an.at, dir: { x: Math.cos(a), y: Math.sin(a) }, kind: 'angle' });
    }
    if (!an.nodeId) continue;
    for (const w of p.walls) {
      if (w.id === an.skipWall || (w.a !== an.nodeId && w.b !== an.nodeId)) continue;
      const far = nodes.get(w.a === an.nodeId ? w.b : w.a);
      if (!far || moved.has(far.id)) continue;
      const d = unit(far.x - an.at.x, far.y - an.at.y);
      out.push({ at: an.at, dir: d, kind: 'angle' }, { at: an.at, dir: { x: -d.y, y: d.x }, kind: 'angle' });
    }
  }
  return out;
}

/**
 * Najmniejsze przesunięcie (wspólne dla wszystkich punktów), które kładzie któryś punkt na linii
 * pomocniczej; potem drugie – wzdłuż pierwszej linii – do przecięcia z kolejną linią.
 */
function solve(points: { pt: Point; guides: Guide[] }[], tol: number): { shift: Point; used: { guide: Guide; index: number }[] } {
  let best: { d: number; v: Point; guide: Guide; index: number } | null = null;
  points.forEach(({ pt, guides }, index) => {
    for (const g of guides) {
      const r = toLine(pt, g);
      if (r.d < tol && (!best || r.d < best.d - 1e-6)) best = { ...r, guide: g, index };
    }
  });
  if (!best) return { shift: { x: 0, y: 0 }, used: [] };
  const b1 = best as { d: number; v: Point; guide: Guide; index: number };
  const shift = b1.v;
  const d1 = b1.guide.dir;
  let second: { d: number; t: number; guide: Guide; index: number } | null = null;
  points.forEach(({ pt, guides }, index) => {
    const q = { x: pt.x + shift.x, y: pt.y + shift.y };
    for (const g of guides) {
      if (parallel(g.dir, d1)) continue;
      const r = toLine(q, g);
      if (r.d >= tol) continue;
      // przesunięcie wzdłuż d1, które kładzie q na linii g
      const den = cross(d1, g.dir);
      const t = cross({ x: g.at.x - q.x, y: g.at.y - q.y }, g.dir) / den;
      if (Math.abs(t) >= tol * 1.5) continue;
      if (!second || Math.abs(t) < Math.abs(second.t) - 1e-6) second = { d: r.d, t, guide: g, index };
    }
  });
  const used = [{ guide: b1.guide, index: b1.index }];
  if (second) {
    const s2 = second as { t: number; guide: Guide; index: number };
    shift.x += d1.x * s2.t;
    shift.y += d1.y * s2.t;
    used.push({ guide: s2.guide, index: s2.index });
  }
  return { shift, used };
}

const roundTo = (v: number, g: number) => Math.round(v / g) * g;

/** Najbliższy węzeł (poza przesuwanymi) w promieniu tol */
function nearNode(p: Project, pt: Point, tol: number, moved: Set<Id>) {
  let best: Point | null = null;
  let bd = tol;
  for (const n of p.nodes) {
    if (moved.has(n.id)) continue;
    const d = dist(n, pt);
    if (d < bd) {
      bd = d;
      best = { x: n.x, y: n.y };
    }
  }
  return best;
}

/**
 * Przyciąganie pojedynczego punktu (koniec rysowanej ściany albo przeciągany węzeł):
 * węzeł → linie pomocnicze (oś ściany, pion/poziom węzła, kąt od punktów zaczepienia) → krawędź ściany → siatka.
 */
export function snapGuided(
  p: Project,
  pt: Point,
  tol: number,
  opts: { anchors?: Anchor[]; moved?: Set<Id>; grid?: number } = {},
): GuideSnap {
  const moved = opts.moved ?? new Set<Id>();
  const grid = opts.grid ?? 5;
  const anchors = opts.anchors ?? [];
  const node = nearNode(p, pt, tol, moved);
  if (node) return { point: node, kind: 'node', guides: [] };

  const guides = guidesFor(p, moved, anchors);
  const { shift, used } = solve([{ pt, guides }], tol);
  if (used.length) {
    let q = { x: pt.x + shift.x, y: pt.y + shift.y };
    if (used.length === 1) {
      // na jednej linii – długość od punktu zaczepienia (albo współrzędna) zaokrąglona do siatki
      const g = used[0].guide;
      const t = (q.x - g.at.x) * g.dir.x + (q.y - g.at.y) * g.dir.y;
      const tr = g.kind === 'angle' ? roundTo(t, grid) : t + roundAxis(q, g, grid);
      q = { x: g.at.x + g.dir.x * tr, y: g.at.y + g.dir.y * tr };
    }
    return { point: q, kind: 'guide', guides: used.map((u) => u.guide) };
  }
  // dojście do środka innej ściany (trójnik)
  const nodes = nodeMap(p);
  for (const w of p.walls) {
    if (moved.has(w.a) || moved.has(w.b)) continue;
    const A = nodes.get(w.a);
    const B = nodes.get(w.b);
    if (!A || !B) continue;
    const pr = projectOnSegment(pt, A, B);
    if (pr.d < tol * 0.7 && pr.t > 0.02 && pr.t < 0.98) return { point: pr.point, kind: 'wall', guides: [] };
  }
  return { point: { x: roundTo(pt.x, grid), y: roundTo(pt.y, grid) }, kind: 'grid', guides: [] };
}

/** Na pionie/poziomie: dosuwa wolną współrzędną do siatki */
function roundAxis(q: Point, g: Guide, grid: number): number {
  if (Math.abs(g.dir.x) > 0.9999) return roundTo(q.x, grid) - q.x;
  if (Math.abs(g.dir.y) > 0.9999) return roundTo(q.y, grid) - q.y;
  return 0;
}

/** Punkty zaczepienia kąta dla węzła: drugie końce jego ścian (nieprzesuwane) */
export function anchorsOf(p: Project, nodeId: Id, moved: Set<Id>): Anchor[] {
  const nodes = nodeMap(p);
  const out: Anchor[] = [];
  for (const w of p.walls) {
    if (w.a !== nodeId && w.b !== nodeId) continue;
    const farId = w.a === nodeId ? w.b : w.a;
    if (moved.has(farId)) continue;
    const far = nodes.get(farId);
    if (far) out.push({ at: far, nodeId: farId, skipWall: w.id });
  }
  return out;
}

export interface MoveSnap {
  delta: Point;
  guides: Guide[];
  kind: 'node' | 'guide' | 'grid';
}

/**
 * Przesuwanie kilku węzłów naraz (całe ściany): przesunięcie zaokrąglone do siatki i dociągnięte tak,
 * żeby któryś przesuwany węzeł trafił w węzeł, w oś innej ściany, w pion/poziom innego węzła
 * albo w kąt prosty względem nieruchomej ściany, z którą jest połączony.
 */
export function snapMove(p: Project, moved: Set<Id>, delta: Point, tol: number, grid = 5): MoveSnap {
  const nodes = nodeMap(p);
  const base = [...moved].map((id) => nodes.get(id)).filter((n): n is NonNullable<typeof n> => !!n);
  // węzeł na węźle
  for (const n of base) {
    const q = { x: n.x + delta.x, y: n.y + delta.y };
    const hit = nearNode(p, q, tol, moved);
    if (hit) return { delta: { x: delta.x + hit.x - q.x, y: delta.y + hit.y - q.y }, guides: [], kind: 'node' };
  }
  const d0 = { x: roundTo(delta.x, grid), y: roundTo(delta.y, grid) };
  const fixedGuides = guidesFor(p, moved, []);
  const pts = base.map((n) => ({
    pt: { x: n.x + d0.x, y: n.y + d0.y },
    guides: [...fixedGuides, ...angleGuides(p, moved, anchorsOf(p, n.id, moved))],
  }));
  // dla wyboru najbliższej linii liczymy od położenia niezaokrąglonego
  const raw = base.map((n, i) => ({ pt: { x: n.x + delta.x, y: n.y + delta.y }, guides: pts[i].guides }));
  const { shift, used } = solve(raw, tol);
  if (!used.length) return { delta: d0, guides: [], kind: 'grid' };
  const out = { x: delta.x + shift.x, y: delta.y + shift.y };
  if (used.length === 1) {
    // na pionie/poziomie druga składowa przesunięcia trzyma się siatki
    const g = used[0].guide;
    if (Math.abs(g.dir.x) > 0.9999) out.x = d0.x;
    else if (Math.abs(g.dir.y) > 0.9999) out.y = d0.y;
  }
  return { delta: out, guides: used.map((u) => u.guide), kind: 'guide' };
}

export interface AngleMark {
  at: Point;
  /** kierunki ramion (rad, w układzie planu) */
  from: number;
  to: number;
  deg: number;
}

/** Kąty między kolejnymi ścianami w węzłach (bez 180°) – do opisu przy przesuwaniu i rysowaniu */
export function angleMarks(p: Project, nodeIds: Iterable<Id>, extra: { nodeId?: Id; at: Point; to: Point }[] = []): AngleMark[] {
  const nodes = nodeMap(p);
  const out: AngleMark[] = [];
  const done = new Set<Id>();
  const add = (at: Point, dirs: number[]) => {
    if (dirs.length < 2) return;
    dirs.sort((a, b) => a - b);
    for (let i = 0; i < dirs.length; i++) {
      const a = dirs[i];
      const b = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + Math.PI * 2;
      const deg = ((b - a) * 180) / Math.PI;
      if (deg > 179.5 || deg < 0.5) continue;
      out.push({ at, from: a, to: b, deg });
    }
  };
  const dirsAt = (id: Id, n: Point) =>
    p.walls
      .filter((w: Wall) => w.a === id || w.b === id)
      .map((w) => nodes.get(w.a === id ? w.b : w.a))
      .filter((f): f is NonNullable<typeof f> => !!f && dist(f, n) > 0.5)
      .map((f) => Math.atan2(f.y - n.y, f.x - n.x));
  for (const id of nodeIds) {
    if (done.has(id)) continue;
    done.add(id);
    const n = nodes.get(id);
    if (n) add(n, dirsAt(id, n));
  }
  for (const e of extra) {
    if (dist(e.at, e.to) < 1) continue;
    const dirs = e.nodeId ? dirsAt(e.nodeId, e.at) : [];
    if (!dirs.length) continue;
    const nd = Math.atan2(e.to.y - e.at.y, e.to.x - e.at.x);
    // przy rysowaniu: tylko kąt między nową ścianą a najbliższymi ramionami
    const all = [...dirs, nd].sort((a, b) => a - b);
    const i = all.indexOf(nd);
    const prev = all[(i - 1 + all.length) % all.length];
    const next = all[(i + 1) % all.length];
    const norm = (x: number) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (const [a, b] of [
      [prev, nd],
      [nd, next],
    ]) {
      const span = norm(b - a);
      const deg = (span * 180) / Math.PI;
      if (deg > 179.5 || deg < 0.5) continue;
      out.push({ at: e.at, from: a, to: a + span, deg });
    }
  }
  return out;
}
