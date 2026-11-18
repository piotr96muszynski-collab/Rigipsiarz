import type { Ceiling, Id, PlanNode, Point, Project, Wall } from '../model/types';
import { wallSystemById } from '../catalog/rigips';

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function nodeMap(p: Project): Map<Id, PlanNode> {
  return new Map(p.nodes.map((n) => [n.id, n]));
}

export function wallEnds(p: Project, w: Wall, nodes = nodeMap(p)): [PlanNode, PlanNode] {
  const a = nodes.get(w.a);
  const b = nodes.get(w.b);
  if (!a || !b) throw new Error(`Ściana ${w.id} ma brakujący węzeł`);
  return [a, b];
}

export function wallLength(p: Project, w: Wall, nodes = nodeMap(p)): number {
  const [a, b] = wallEnds(p, w, nodes);
  return dist(a, b);
}

/** Rzut punktu na odcinek: parametr t (0..1) i odległość */
export function projectOnSegment(pt: Point, a: Point, b: Point): { t: number; d: number; point: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, d: dist(pt, point), point };
}

export type JunctionKind = 'free' | 'existing-wall' | 'corner' | 'inline' | 'tee-through' | 'tee-abut' | 'cross';

export interface EndInfo {
  kind: JunctionKind;
}

export interface WallJunctions {
  /** Rodzaj połączenia na końcu a i b */
  endA: JunctionKind;
  endB: JunctionKind;
  /** Dodatkowe słupki CW pełnej wysokości wynikające z połączeń (narożniki, trójniki) */
  extraStuds: number;
  /** Krawędzie zewnętrzne do zabezpieczenia narożnikiem ochronnym (szt. krawędzi o wysokości ściany) */
  externalEdges: number;
}

const ANGLE_INLINE_DEG = 170;

function angleBetween(center: Point, p1: Point, p2: Point): number {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Analiza połączeń ścian. Reguły (uproszczone wg detali Rigips):
 * - narożnik L: +1 słupek CW (do przykręcenia płyt od wewnątrz), 1 krawędź zewnętrzna
 * - trójnik T: ściana przechodząca dostaje +1 słupek CW
 * - skrzyżowanie X: +2 słupki CW
 * - koniec przy istniejącej ścianie: słupek kotwiony do muru (kołki + taśma)
 * - wolny koniec: 2 krawędzie z narożnikiem ochronnym
 */
export function analyzeJunctions(p: Project): Map<Id, WallJunctions> {
  const nodes = nodeMap(p);
  const byNode = new Map<Id, Wall[]>();
  for (const w of p.walls) {
    for (const nid of [w.a, w.b]) {
      const list = byNode.get(nid) ?? [];
      list.push(w);
      byNode.set(nid, list);
    }
  }
  const result = new Map<Id, WallJunctions>();
  for (const w of p.walls) result.set(w.id, { endA: 'free', endB: 'free', extraStuds: 0, externalEdges: 0 });

  const other = (w: Wall, nid: Id) => nodes.get(w.a === nid ? w.b : w.a)!;

  for (const w of p.walls) {
    const info = result.get(w.id)!;
    const sides = wallSystemById(w.systemId).sides;
    for (const end of ['a', 'b'] as const) {
      const nid = end === 'a' ? w.a : w.b;
      const node = nodes.get(nid)!;
      const connected = (byNode.get(nid) ?? []).filter((x) => x.id !== w.id);
      let kind: JunctionKind;
      if (connected.length === 0) {
        // Czy koniec opiera się o środek innej ściany (trójnik)?
        const host = p.walls.find((o) => {
          if (o.id === w.id || o.a === nid || o.b === nid) return false;
          const [oa, ob] = wallEnds(p, o, nodes);
          const pr = projectOnSegment(node, oa, ob);
          return pr.d < 2 && pr.t > 0.001 && pr.t < 0.999;
        });
        if (host) {
          kind = 'tee-abut';
          result.get(host.id)!.extraStuds += 1;
        } else {
          kind = (end === 'a' ? w.endA : w.endB) === 'existing-wall' ? 'existing-wall' : 'free';
          if (kind === 'free') info.externalEdges += sides === 2 ? 2 : 1;
        }
      } else if (connected.length === 1) {
        const ang = angleBetween(node, other(w, nid), other(connected[0], nid));
        if (ang >= ANGLE_INLINE_DEG) {
          kind = 'inline';
        } else {
          kind = 'corner';
          // dodatkowy słupek i narożnik liczymy tylko raz – przypisujemy ścianie o „mniejszym” id
          if (w.id < connected[0].id) {
            info.extraStuds += 1;
            info.externalEdges += 1;
          }
        }
      } else if (connected.length === 2) {
        kind = 'tee-through';
        if ([w, ...connected].sort((x, y) => (x.id < y.id ? -1 : 1))[0].id === w.id) info.extraStuds += 1;
      } else {
        kind = 'cross';
        if ([w, ...connected].sort((x, y) => (x.id < y.id ? -1 : 1))[0].id === w.id) info.extraStuds += 2;
      }
      if (end === 'a') info.endA = kind;
      else info.endB = kind;
    }
  }
  return result;
}

// ---------- Wielokąty (sufity) ----------

export function polygonArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function polygonPerimeterEdges(pts: Point[]): number[] {
  return pts.map((a, i) => dist(a, pts[(i + 1) % pts.length]));
}

export function pointInPolygon(pt: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Przecięcie poziomej linii y = c z wielokątem. Zwraca odcinki [x0, x1] leżące wewnątrz.
 * Dla axis = 'y' liczy przecięcie pionowej linii x = c (zwraca zakresy y).
 */
export function scanline(pts: Point[], c: number, axis: 'x' | 'y'): [number, number][] {
  const P = axis === 'x' ? pts : pts.map((p) => ({ x: p.y, y: p.x }));
  const xs: number[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    if (a.y > c !== b.y > c) xs.push(a.x + ((c - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((m, n) => m - n);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.5) out.push([xs[i], xs[i + 1]]);
  return out;
}

export function bbox(pts: Point[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function ceilingArea(c: Ceiling) {
  return polygonArea(c.points);
}
