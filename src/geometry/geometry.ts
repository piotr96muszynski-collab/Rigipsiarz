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
 * Ściana „ciągła” w trójniku i skrzyżowaniu: para najbardziej współliniowych ścian w węźle.
 * Ta sama reguła obowiązuje w wyliczeniach, w modelu styków i w widoku 3D.
 */
export function throughPair(center: Point, list: Wall[], far: (w: Wall) => Point): [Wall, Wall] {
  let best: [Wall, Wall] = [list[0], list[1]];
  let bestAng = -1;
  for (let i = 0; i < list.length; i++)
    for (let k = i + 1; k < list.length; k++) {
      const a = angleBetween(center, far(list[i]), far(list[k]));
      if (a > bestAng + 1e-9) {
        bestAng = a;
        best = [list[i], list[k]];
      }
    }
  return best;
}

/**
 * Pierwszeństwo ścian w połączeniach: wcześniej narysowana (niższa pozycja na liście ścian projektu)
 * jest „ciągła”. Nie porównujemy losowych id – inaczej ten sam projekt z innymi id dawał inne ilości.
 */
export function wallPrecedes(p: Project, w1: Wall, w2: Wall): boolean {
  const i1 = p.walls.indexOf(w1);
  const i2 = p.walls.indexOf(w2);
  if (i1 !== i2) return i1 >= 0 && (i2 < 0 || i1 < i2);
  return w1.id < w2.id;
}

/** Pierwsza wg pierwszeństwa ściana z listy */
export const firstWall = (p: Project, list: Wall[]) => list.reduce((best, w) => (wallPrecedes(p, w, best) ? w : best));

/** Ściana, która w narożniku L przechodzi do zewnętrznego lica (druga do niej dochodzi) */
export const cornerThrough = (p: Project, w1: Wall, w2: Wall) => (wallPrecedes(p, w2, w1) ? w2 : w1);

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
  // istniejące ściany (obrys) nie są zabudową – dla nowych ścian są tylko „murem”, do którego się kotwi
  const fresh = p.walls.filter(isNewWall);
  const existing = p.walls.filter((w) => !isNewWall(w));
  const byNode = new Map<Id, Wall[]>();
  for (const w of fresh) {
    for (const nid of [w.a, w.b]) {
      const list = byNode.get(nid) ?? [];
      list.push(w);
      byNode.set(nid, list);
    }
  }
  const result = new Map<Id, WallJunctions>();
  for (const w of fresh) result.set(w.id, { endA: 'free', endB: 'free', extraStuds: 0, externalEdges: 0 });
  const touchesExisting = (nid: Id, node: Point) =>
    existing.some((o) => {
      if (o.a === nid || o.b === nid) return true;
      const oa = nodes.get(o.a);
      const ob = nodes.get(o.b);
      return !!oa && !!ob && projectOnSegment(node, oa, ob).d < 2;
    });

  const other = (w: Wall, nid: Id) => nodes.get(w.a === nid ? w.b : w.a)!;
  const throughOwner = (nid: Id, node: Point, list: Wall[]) =>
    firstWall(p, throughPair(node, list, (x) => other(x, nid)));

  for (const w of fresh) {
    const info = result.get(w.id)!;
    const sides = wallSystemById(w.systemId).sides;
    for (const end of ['a', 'b'] as const) {
      const nid = end === 'a' ? w.a : w.b;
      const node = nodes.get(nid)!;
      const connected = (byNode.get(nid) ?? []).filter((x) => x.id !== w.id);
      let kind: JunctionKind;
      if (connected.length === 0 && touchesExisting(nid, node)) {
        kind = 'existing-wall';
      } else if (connected.length === 0) {
        // Czy koniec opiera się o środek innej ściany (trójnik)?
        const host = fresh.find((o) => {
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
          // dodatkowy słupek i narożnik liczymy tylko raz – przypisujemy ścianie ciągłej (wcześniej narysowanej)
          if (wallPrecedes(p, w, connected[0])) {
            info.extraStuds += 1;
            info.externalEdges += 1;
          }
        }
      } else {
        kind = connected.length === 2 ? 'tee-through' : 'cross';
        // dodatkowe słupki dostaje ściana ciągła (z pary współliniowej – ta wcześniej narysowana)
        if (throughOwner(nid, node, [w, ...connected]).id === w.id) info.extraStuds += kind === 'cross' ? 2 : 1;
      }
      if (end === 'a') info.endA = kind;
      else info.endB = kind;
    }
  }
  return result;
}

// ---------- Wielokąty (sufity) ----------
/** Ten sam obrys (te same wierzchołki z dokładnością do 1 cm, dowolny punkt startowy i kierunek) */
export function sameOutline(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  if (a.length !== b.length || !a.length) return false;
  const near = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.abs(p.x - q.x) <= 1 && Math.abs(p.y - q.y) <= 1;
  return b.every((q) => a.some((p) => near(p, q))) && a.every((p) => b.some((q) => near(p, q)));
}


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

export const isNewWall = (w: Wall) => w.kind !== 'existing';

/**
 * Strona istniejącej ściany zwrócona do wnętrza obrysu: 1 = lewa (normalna (-dy, dx)), -1 = prawa,
 * 0 = wnętrze po obu stronach lub obrys niezamknięty. Liczona z zamkniętych obrysów samych
 * istniejących ścian, więc linia ściany to lico od strony pomieszczenia.
 */
export function interiorSide(p: Project, w: Wall, rooms: Point[][] = existingRooms(p)): 1 | -1 | 0 {
  const nodes = nodeMap(p);
  const a = nodes.get(w.a);
  const b = nodes.get(w.b);
  if (!a || !b) return 0;
  const L = dist(a, b) || 1;
  const nx = -(b.y - a.y) / L;
  const ny = (b.x - a.x) / L;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const probe = (k: number) => rooms.some((r) => pointInPolygon({ x: mid.x + nx * k * 3, y: mid.y + ny * k * 3 }, r));
  const left = probe(1);
  const right = probe(-1);
  if (left && !right) return 1;
  if (right && !left) return -1;
  return 0;
}

/**
 * Strona lica istniejącej ściany, od której linia na planie wyznacza mur (mur leży po stronie
 * przeciwnej). Jak `interiorSide`, a przy ścianie poza zamkniętym obrysem – strona jedynej
 * okładziny (np. mur postawiony automatycznie za okładziną ATLAS M-System lub CD 60).
 */
export function masonrySide(p: Project, w: Wall, rooms: Point[][] = existingRooms(p)): 1 | -1 | 0 {
  const inner = interiorSide(p, w, rooms);
  if (inner) return inner;
  const sides = new Set((w.linings ?? []).map((l) => l.side));
  return sides.size === 1 ? [...sides][0] : 0;
}

/** Zamknięte obrysy utworzone przez istniejące ściany (ściany zewnętrzne mieszkania) */
export function existingRooms(p: Project): Point[][] {
  const nodes = nodeMap(p);
  const walls = p.walls.filter((w) => !isNewWall(w) && nodes.has(w.a) && nodes.has(w.b));
  if (walls.length < 3) return [];
  // ściany obrysu jako krawędzie grafu; ściany ścian stykają się w węzłach
  const adj = new Map<Id, Id[]>();
  for (const w of walls) {
    adj.set(w.a, [...(adj.get(w.a) ?? []), w.b]);
    adj.set(w.b, [...(adj.get(w.b) ?? []), w.a]);
  }
  const ang = (f: Id, t: Id) => Math.atan2(nodes.get(t)!.y - nodes.get(f)!.y, nodes.get(t)!.x - nodes.get(f)!.x);
  const seen = new Set<string>();
  const faces: Point[][] = [];
  for (const [u, vs] of adj)
    for (const v of vs) {
      if (seen.has(`${u}>${v}`)) continue;
      const face: Id[] = [];
      let a = u;
      let b = v;
      for (let g = 0; g < 500; g++) {
        const k = `${a}>${b}`;
        if (seen.has(k)) break;
        seen.add(k);
        face.push(a);
        const back = ang(b, a);
        let next: Id | null = null;
        let best = Infinity;
        for (const c of adj.get(b) ?? []) {
          if (c === a && (adj.get(b) ?? []).length > 1) continue;
          let t = ang(b, c) - back;
          while (t <= 0) t += Math.PI * 2;
          if (t < best) {
            best = t;
            next = c;
          }
        }
        if (!next) break;
        a = b;
        b = next;
        if (a === u && b === v) break;
      }
      if (face.length >= 3 && a === u && b === v) {
        const poly = face.map((id) => ({ x: nodes.get(id)!.x, y: nodes.get(id)!.y }));
        // obie orientacje (także obrys zewnętrzny całego grafu) są przydatne: punkt po stronie
        // pomieszczenia leży w którymś z obrysów, punkt na zewnątrz – w żadnym
        faces.push(poly);
      }
    }
  return faces;
}

/**
 * Przedłużenie muru istniejącej ściany za węzeł w narożniku obrysu, cm (wzdłuż osi ściany).
 * Linia ściany to lico od strony pomieszczenia, mur leży na zewnątrz, więc:
 * - narożnik wypukły (mur po zewnętrznej stronie kąta): mur dochodzi do zewnętrznego lica
 *   drugiej ściany – przedłużenie o jej grubość,
 * - narożnik wklęsły (druga ściana biegnie w stronę muru, np. wewnętrzny róg pokoju w kształcie L):
 *   mur kończy się w węźle, na licu drugiej ściany – przedłużenie 0,
 * - ściany w jednej linii: koniec w węźle.
 * `null` = w węźle nie ma innej istniejącej ściany (wolny koniec) albo nie wiadomo, gdzie leży mur.
 */
export function masonryEndExtension(
  p: Project,
  w: Wall,
  end: 'a' | 'b',
  inner: 1 | -1 | 0,
  nodes = nodeMap(p),
): number | null {
  if (!inner) return null;
  const nid = end === 'a' ? w.a : w.b;
  const A = nodes.get(w.a);
  const B = nodes.get(w.b);
  if (!A || !B) return null;
  const L = dist(A, B);
  if (L < 1e-6) return null;
  // kierunek od węzła w głąb ściany i normalna w stronę muru
  const s = end === 'a' ? 1 : -1;
  const u = { x: ((B.x - A.x) / L) * s, y: ((B.y - A.y) / L) * s };
  const nx = -(B.y - A.y) / L;
  const ny = (B.x - A.x) / L;
  const m = { x: -inner * nx, y: -inner * ny };
  let best: { sin: number; ext: number } | null = null;
  for (const o of p.walls) {
    if (o.id === w.id || isNewWall(o) || (o.a !== nid && o.b !== nid)) continue;
    const N = nodes.get(nid);
    const F = nodes.get(o.a === nid ? o.b : o.a);
    if (!N || !F) continue;
    const Lo = dist(N, F);
    if (Lo < 1e-6) continue;
    const d = { x: (F.x - N.x) / Lo, y: (F.y - N.y) / Lo };
    const sin = Math.abs(u.x * d.y - u.y * d.x);
    // w jednej linii – koniec w węźle
    const ext = sin < 0.2 ? 0 : d.x * m.x + d.y * m.y > 0 ? 0 : (o.thickness ?? 25) / sin;
    if (!best || sin > best.sin) best = { sin, ext };
  }
  return best ? best.ext : null;
}
