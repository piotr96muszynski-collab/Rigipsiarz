import { dist, existingRooms, isNewWall, masonrySide, nodeMap, projectOnSegment, wallEnds } from '../geometry/geometry';
import { createExistingWall, createWall, uid } from './factory';
import type { Id, Point, Project, Wall } from './types';

/** Zwraca id istniejącego węzła w pobliżu lub tworzy nowy */
export function ensureNode(p: Project, pt: Point, tolerance = 1): Id {
  const hit = p.nodes.find((n) => dist(n, pt) <= tolerance);
  if (hit) return hit.id;
  const id = uid();
  p.nodes.push({ id, x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 });
  return id;
}

export function addWall(p: Project, from: Point, to: Point, overrides: Partial<Wall> = {}): Wall | null {
  if (dist(from, to) < 10) return null;
  const a = ensureNode(p, from);
  const b = ensureNode(p, to);
  if (a === b) return null;
  if (p.walls.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return null;
  const w = overrides.kind === 'existing' ? createExistingWall(p, a, b, overrides) : createWall(p, a, b, overrides);
  p.walls.push(w);
  return w;
}

export function removeOrphanNodes(p: Project) {
  const used = new Set(p.walls.flatMap((w) => [w.a, w.b]));
  p.nodes = p.nodes.filter((n) => used.has(n.id));
}

export function deleteWall(p: Project, id: Id) {
  p.walls = p.walls.filter((w) => w.id !== id);
  removeOrphanNodes(p);
}

/** Zmiana długości ściany – przesuwa węzeł b wzdłuż osi ściany (lub odłącza go, jeśli jest wspólny) */
export function setWallLength(p: Project, w: Wall, lengthCm: number) {
  const nodes = nodeMap(p);
  const [a, b] = wallEnds(p, w, nodes);
  const L = dist(a, b);
  if (L < 0.01 || lengthCm < 10) return;
  const ux = (b.x - a.x) / L;
  const uy = (b.y - a.y) / L;
  const target = { x: a.x + ux * lengthCm, y: a.y + uy * lengthCm };
  // węzeł wspólny przesuwa się razem z połączonymi ścianami
  const nb = p.nodes.find((n) => n.id === w.b)!;
  nb.x = Math.round(target.x * 10) / 10;
  nb.y = Math.round(target.y * 10) / 10;
  // otwory poza ścianą – przycinamy
  for (const o of w.openings) o.offset = Math.max(0, Math.min(o.offset, lengthCm - o.width));
}

export function moveNode(p: Project, id: Id, pt: Point) {
  const n = p.nodes.find((x) => x.id === id);
  if (n) {
    n.x = pt.x;
    n.y = pt.y;
  }
}

/** Scala węzeł z innym, jeśli po przesunięciu leżą w tym samym miejscu */
export function mergeNodeIfOverlaps(p: Project, id: Id, tolerance = 1) {
  const n = p.nodes.find((x) => x.id === id);
  if (!n) return;
  const other = p.nodes.find((x) => x.id !== id && dist(x, n) <= tolerance);
  if (!other) return;
  for (const w of p.walls) {
    if (w.a === id) w.a = other.id;
    if (w.b === id) w.b = other.id;
  }
  p.walls = p.walls.filter((w) => w.a !== w.b);
  removeOrphanNodes(p);
}

export interface SnapResult {
  point: Point;
  kind: 'node' | 'wall' | 'grid' | 'angle' | 'none';
}

/**
 * Przyciąganie: węzły → krawędzie ścian → kąt 0/45/90° od punktu startu → siatka.
 * `tol` w cm (zależny od powiększenia).
 */
export function snapPoint(p: Project, pt: Point, tol: number, from?: Point, grid = 5, ignoreNode?: Id): SnapResult {
  let best: Point | null = null;
  let bestD = tol;
  for (const n of p.nodes) {
    if (n.id === ignoreNode) continue;
    const d = dist(n, pt);
    if (d < bestD) {
      bestD = d;
      best = { x: n.x, y: n.y };
    }
  }
  if (best) return { point: best, kind: 'node' };

  let res: Point = { ...pt };
  let kind: SnapResult['kind'] = 'none';
  if (from) {
    const dx = pt.x - from.x;
    const dy = pt.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const ang = Math.atan2(dy, dx);
      const step = Math.PI / 4;
      const snapped = Math.round(ang / step) * step;
      if (Math.abs(snapped - ang) < (7 * Math.PI) / 180) {
        const l = Math.round(len / grid) * grid;
        res = { x: from.x + Math.cos(snapped) * l, y: from.y + Math.sin(snapped) * l };
        kind = 'angle';
      }
    }
  }
  if (kind === 'none') {
    res = { x: Math.round(pt.x / grid) * grid, y: Math.round(pt.y / grid) * grid };
    kind = 'grid';
  }
  // przyciąganie do istniejącej ściany (trójnik)
  const nodes = nodeMap(p);
  for (const w of p.walls) {
    if (ignoreNode && (w.a === ignoreNode || w.b === ignoreNode)) continue;
    const [a, b] = wallEnds(p, w, nodes);
    const pr = projectOnSegment(pt, a, b);
    if (pr.d < tol * 0.7 && pr.t > 0.02 && pr.t < 0.98) return { point: pr.point, kind: 'wall' };
  }
  return { point: res, kind };
}

/**
 * Nowa ściana nie może przechodzić przez istniejący mur: koniec odcinka from→to
 * zostaje przycięty do pierwszego lica muru, w które wchodzi. Mur leży po stronie
 * zewnętrznej osi ściany obrysu (oś = lico od strony pomieszczenia), a przy murze
 * bez wyznaczonego wnętrza – symetrycznie wokół osi.
 */
export function clipToMasonry(p: Project, from: Point, to: Point): { point: Point; clipped: boolean } {
  const existing = p.walls.filter((w) => !isNewWall(w));
  if (!existing.length) return { point: to, clipped: false };
  const len = dist(from, to);
  if (len < 1) return { point: to, clipped: false };
  const rooms = existingRooms(p);
  const nodes = nodeMap(p);
  let best = 1;
  for (const w of existing) {
    const a = nodes.get(w.a);
    const b = nodes.get(w.b);
    if (!a || !b) continue;
    const L = dist(a, b);
    if (L < 1) continue;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    // normalna jak w rysunku planu: (-uy, ux)
    const nx = -uy;
    const ny = ux;
    const t = w.thickness ?? 25;
    const inner = masonrySide(p, w, rooms);
    const vMin = inner === 1 ? -t : inner === -1 ? 0 : -t / 2;
    const vMax = vMin + t;
    const ext = t / 2; // narożniki muru są przedłużone
    const loc = (q: Point) => ({ u: (q.x - a.x) * ux + (q.y - a.y) * uy, v: (q.x - a.x) * nx + (q.y - a.y) * ny });
    const f = loc(from);
    const e = loc(to);
    const du = e.u - f.u;
    const dv = e.v - f.v;
    // Liang–Barsky w układzie ściany
    let tE = 0;
    let tL = 1;
    let ok = true;
    const edge = (pp: number, q: number) => {
      if (Math.abs(pp) < 1e-9) {
        if (q < 0) ok = false;
        return;
      }
      const r = q / pp;
      if (pp < 0) tE = Math.max(tE, r);
      else tL = Math.min(tL, r);
    };
    edge(-du, f.u + ext);
    edge(du, L + ext - f.u);
    edge(-dv, f.v - vMin);
    edge(dv, vMax - f.v);
    if (!ok || tE >= tL) continue;
    // start na licu lub w murze – nie przycinamy; samo dotknięcie lica na końcu też jest w porządku
    if (tE * len < 0.5 || (1 - tE) * len < 0.5) continue;
    best = Math.min(best, tE);
  }
  if (best >= 1) return { point: to, clipped: false };
  return { point: { x: from.x + (to.x - from.x) * best, y: from.y + (to.y - from.y) * best }, clipped: true };
}

/** Pozycja punktu wzdłuż ściany (cm od węzła a) */
export function offsetAlongWall(p: Project, w: Wall, pt: Point): number {
  const [a, b] = wallEnds(p, w);
  const pr = projectOnSegment(pt, a, b);
  return pr.t * dist(a, b);
}

export function hitWall(p: Project, pt: Point, tol: number): Wall | null {
  const nodes = nodeMap(p);
  let best: Wall | null = null;
  let bestD = tol;
  for (const w of p.walls) {
    const [a, b] = wallEnds(p, w, nodes);
    const d = projectOnSegment(pt, a, b).d;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
