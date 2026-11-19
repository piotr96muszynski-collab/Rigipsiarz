// Model styków i kolizji: gdzie i jak dotykają się ściany, ruszt, warstwy płyt, mur i okładziny.
//
// Dla każdego końca nowej ściany ustala, do której linii sąsiedniego elementu dochodzi ruszt
// i każda warstwa płyt (detale Rigips):
// - narożnik L: ściana ciągła (cornerThrough) przechodzi do zewnętrznego lica; od zewnątrz
//   jej płyty zachodzą na czoło płyt ściany dochodzącej, od wewnątrz dochodzą do jej płyty.
//   Przy kilku warstwach warstwy zachodzą na siebie na zmianę (na zakład), a dodatkowy słupek
//   ściany ciągłej stoi tuż za rusztem ściany dochodzącej, pod krawędziami wszystkich warstw;
// - trójnik T i skrzyżowanie X: ściana ciągła bez zmian, dochodząca kończy się na licu jej płyt
//   (słupek przykręcony przez płytę do słupka ściany ciągłej);
// - styk z murem: ściana dochodzi do lica muru albo do lica jego okładziny;
// - wolny koniec: ruszt cofnięty o grubość paska płyty zamykającego czoło.
// Z tego modelu korzystają widok 3D, rysunki (zakres płyt i położenie słupków) i połączenia
// w wyliczeniach. Na końcu sprawdzamy w rzucie, czy żadne dwa elementy się nie przenikają.
// Jednostki: metry (plan jest w centymetrach).

import { boardById, wallFrameDepth, wallSystemById, type WallFrame } from '../catalog/rigips';
import type { Id, Lining, Point, Project, Wall } from '../model/types';
import { cornerThrough, existingRooms, interiorSide, isNewWall, nodeMap, projectOnSegment, throughPair } from './geometry';

/** Szerokość półki słupka CW, m */
export const STUD_W = 0.05;
/** Kąt, od którego dwie ściany w węźle traktujemy jako przedłużenie w linii, ° */
const INLINE_DEG = 170;

/** Przekrój ściany: połowa grubości rusztu i warstwy płyt na stronach (0 = po lewej, normalna +) */
export interface WallSection {
  frame: WallFrame;
  /** połowa grubości rusztu (rdzenia), m */
  core: number;
  /** grubość jednej płyty, m */
  bt: number;
  /** liczba warstw płyt na stronie 0 i 1 */
  layers: [number, number];
  profile: number;
}

export function wallSection(w: Wall): WallSection {
  const sys = wallSystemById(w.systemId);
  return {
    frame: sys.frame,
    core: wallFrameDepth(sys) / 2000,
    bt: boardById(w.boardId).thickness / 1000,
    layers: [sys.layers, sys.sides === 2 ? sys.layers : 0],
    profile: sys.profile,
  };
}

/** Odsunięcie lica od osi ściany po stronie `side` po `k` warstwach (ze znakiem normalnej) */
export function faceOffset(sec: WallSection, side: 0 | 1, k: number): number {
  return (side === 0 ? 1 : -1) * (sec.core + sec.bt * Math.min(Math.max(k, 0), sec.layers[side]));
}

/** Jak element kończy się przy węźle */
export type Contact =
  | 'free' // wolny koniec
  | 'strip' // ruszt za paskiem płyty zamykającym czoło
  | 'masonry' // dochodzi do muru
  | 'lining' // dochodzi do okładziny muru
  | 'inline' // przedłużenie w linii – zwykła spoina
  | 'lap' // zachodzi na czoło elementu sąsiedniej ściany
  | 'covered' // jego czoło przykrywa płyta sąsiedniej ściany
  | 'butt'; // dochodzi do lica płyty / rusztu sąsiedniej ściany

export const CONTACT_LABEL: Record<Contact, string> = {
  free: 'wolna krawędź',
  strip: 'za paskiem płyty na czole',
  masonry: 'do lica muru',
  lining: 'do lica okładziny muru',
  inline: 'spoina w linii',
  lap: 'zachodzi na czoło sąsiedniej ściany',
  covered: 'czoło przykryte płytą sąsiedniej ściany',
  butt: 'dochodzi do płyty sąsiedniej ściany',
};

export interface ElementEnd {
  /** odległość końca elementu od węzła w głąb ściany, m (ujemna = wysunięty poza węzeł) */
  s: number;
  contact: Contact;
  /** ściana, z którą element się styka */
  with?: Id;
}

export type EndJoint = 'L' | 'T' | 'X' | 'masonry' | 'free' | 'inline';
export type EndRole = 'through' | 'abut' | 'end';

export interface WallEndContacts {
  wallId: Id;
  end: 'a' | 'b';
  nodeId: Id;
  joint: EndJoint;
  role: EndRole;
  partner?: Id;
  frame: ElementEnd;
  /** [strona][warstwa] – warstwa 0 przy ruszcie */
  boards: ElementEnd[][];
  /** pasek płyty zamykający czoło wolnego końca */
  strip?: { thickness: number; layers: number };
  /** położenie dodatkowego słupka ściany ciągłej w narożniku, m od węzła w głąb ściany */
  cornerStud?: number;
}

export interface NodeContacts {
  kind: 'L' | 'T' | 'X';
  through: Id[];
  abut: Id[];
  angleDeg?: number;
}

export interface ContactModel {
  sections: Map<Id, WallSection>;
  /** klucz `${wallId}:a|b` */
  ends: Map<string, WallEndContacts>;
  nodes: Map<Id, NodeContacts>;
  /** zakres okładziny istniejącej ściany wzdłuż muru, klucz `${wallId}:${side}`, m */
  linings: Map<string, [number, number]>;
}

interface Axis {
  a: Point;
  u: Point;
  n: Point;
  L: number;
}

const dot = (p: Point, q: Point) => p.x * q.x + p.y * q.y;

function axisOf(w: Wall, nodes: ReturnType<typeof nodeMap>): Axis | null {
  const A = nodes.get(w.a);
  const B = nodes.get(w.b);
  if (!A || !B) return null;
  const dx = (B.x - A.x) / 100;
  const dy = (B.y - A.y) / 100;
  const L = Math.hypot(dx, dy);
  if (L < 1e-4) return null;
  return { a: { x: A.x / 100, y: A.y / 100 }, u: { x: dx / L, y: dy / L }, n: { x: -dy / L, y: dx / L }, L };
}

/** Kierunek ściany od węzła w głąb ściany */
const outDir = (ax: Axis, end: 'a' | 'b'): Point => (end === 'a' ? ax.u : { x: -ax.u.x, y: -ax.u.y });

/** Grubość okładziny istniejącej ściany (ruszt/odstęp + płyty), m */
export function liningThickness(l: Lining): number {
  const sys = wallSystemById(l.systemId);
  return (wallFrameDepth(sys) + sys.layers * boardById(l.boardId).thickness) / 1000;
}

export function buildContacts(p: Project): ContactModel {
  const nodes = nodeMap(p);
  const axes = new Map<Id, Axis>();
  for (const w of p.walls) {
    const ax = axisOf(w, nodes);
    if (ax) axes.set(w.id, ax);
  }
  const fresh = p.walls.filter((w) => isNewWall(w) && axes.has(w.id));
  const existing = p.walls.filter((w) => !isNewWall(w) && axes.has(w.id));
  const sections = new Map(fresh.map((w) => [w.id, wallSection(w)]));
  const model: ContactModel = { sections, ends: new Map(), nodes: new Map(), linings: new Map() };

  const byNode = new Map<Id, Wall[]>();
  for (const w of fresh) for (const nid of [w.a, w.b]) byNode.set(nid, [...(byNode.get(nid) ?? []), w]);
  const endOf = (w: Wall, nid: Id): 'a' | 'b' => (w.a === nid ? 'a' : 'b');
  const farOf = (w: Wall, nid: Id) => nodes.get(w.a === nid ? w.b : w.a)!;

  /**
   * Odległość od węzła (w głąb ściany W), na której pasmo elementu W o środku `nmid`
   * przecina linię sąsiedniej ściany O leżącą w odległości `m` od jej osi (dodatnio w stronę W).
   */
  const cutAt = (W: Wall, end: 'a' | 'b', nmid: number, O: Wall, m: number) => {
    const aw = axes.get(W.id)!;
    const ao = axes.get(O.id)!;
    const dirW = outDir(aw, end);
    // normalna O zwrócona w stronę ściany W
    const NO = dot(ao.n, dirW) >= 0 ? ao.n : { x: -ao.n.x, y: -ao.n.y };
    const den = dot(dirW, NO);
    if (Math.abs(den) < 1e-6) return 0;
    return (m - nmid * dot(aw.n, NO)) / den;
  };
  /** Znak, z jakim strona 0 ściany O zwrócona jest do ściany W (+1: strona 0 bliżej W) */
  const nearSign = (W: Wall, end: 'a' | 'b', O: Wall) => (dot(axes.get(O.id)!.n, outDir(axes.get(W.id)!, end)) >= 0 ? 1 : -1);
  /** Lico ściany O po stronie bliższej (near) lub dalszej (far) od W po k warstwach, w układzie „w stronę W” */
  const faceToward = (W: Wall, end: 'a' | 'b', O: Wall, near: boolean, k: number) => {
    const sec = sections.get(O.id)!;
    const sg = nearSign(W, end, O);
    const side: 0 | 1 = (sg > 0) === near ? 0 : 1;
    return faceOffset(sec, side, k) * (side === 0 ? 1 : -1) * (near ? 1 : -1);
  };
  /** Środek pasma warstwy k na stronie side (w układzie normalnej ściany) */
  const layerMid = (sec: WallSection, side: 0 | 1, k: number) => (side === 0 ? 1 : -1) * (sec.core + sec.bt * (k + 0.5));

  const blank = (w: Wall, nid: Id, joint: EndJoint, role: EndRole, contact: Contact, partner?: Id): WallEndContacts => {
    const sec = sections.get(w.id)!;
    return {
      wallId: w.id,
      end: endOf(w, nid),
      nodeId: nid,
      joint,
      role,
      partner,
      frame: { s: 0, contact, with: partner },
      boards: [0, 1].map((side) => Array.from({ length: sec.layers[side] }, () => ({ s: 0, contact, with: partner }))),
    };
  };
  const put = (e: WallEndContacts) => model.ends.set(`${e.wallId}:${e.end}`, e);

  /** Wszystkie elementy W kończą się na licu ściany ciągłej O (trójnik, skrzyżowanie) */
  const abutFace = (W: Wall, nid: Id, O: Wall, joint: EndJoint) => {
    const e = blank(W, nid, joint, 'abut', 'butt', O.id);
    const end = e.end;
    const m = faceToward(W, end, O, true, 99);
    const sec = sections.get(W.id)!;
    e.frame.s = cutAt(W, end, 0, O, m);
    for (const side of [0, 1] as const)
      e.boards[side].forEach((b, k) => (b.s = cutAt(W, end, layerMid(sec, side, k), O, m)));
    put(e);
  };

  for (const [nid, list] of byNode) {
    const node = nodes.get(nid)!;
    const hosts = fresh.filter((o) => {
      if (o.a === nid || o.b === nid) return false;
      const A = nodes.get(o.a)!;
      const B = nodes.get(o.b)!;
      const pr = projectOnSegment(node, A, B);
      return pr.d < 2 && pr.t > 0.001 && pr.t < 0.999;
    });

    if (list.length === 1 && hosts.length === 0) {
      const w = list[0];
      const sec = sections.get(w.id)!;
      const end = endOf(w, nid);
      const ex = masonryAt(nid, node, w, end);
      if (ex) {
        const e = blank(w, nid, 'masonry', 'end', ex.lining ? 'lining' : 'masonry', ex.wall.id === w.id ? undefined : ex.wall.id);
        if (ex.wall.id === w.id) {
          put(e);
          continue;
        }
        // ściana dochodzi do lica muru lub jego okładziny
        const ae = axes.get(ex.wall.id)!;
        const dirW = outDir(axes.get(w.id)!, end);
        const den = Math.abs(dot(dirW, ae.n)) || 1;
        const sgn = dot(ae.n, dirW) >= 0 ? 1 : -1;
        const aw = axes.get(w.id)!;
        const cut = (nmid: number) => (ex.depth - nmid * dot(aw.n, ae.n) * sgn) / den;
        e.frame.s = cut(0);
        for (const side of [0, 1] as const) e.boards[side].forEach((b, k) => (b.s = cut(layerMid(sec, side, k))));
        put(e);
      } else {
        const e = blank(w, nid, 'free', 'end', 'free');
        const stack = sec.bt * Math.max(sec.layers[0], sec.layers[1]);
        if (sec.frame !== 'glued' && sec.frame !== 'point-fix' && stack > 0) {
          e.frame = { s: stack, contact: 'strip' };
          e.strip = { thickness: stack, layers: Math.max(sec.layers[0], sec.layers[1]) };
        }
        put(e);
      }
      continue;
    }

    if (hosts.length) {
      const host = hosts[0];
      model.nodes.set(nid, { kind: list.length >= 2 ? 'X' : 'T', through: [host.id], abut: list.map((w) => w.id) });
      for (const w of list) abutFace(w, nid, host, list.length >= 2 ? 'X' : 'T');
      continue;
    }

    if (list.length === 2) {
      const [w1, w2] = list;
      const ang = angleAt(node, farOf(w1, nid), farOf(w2, nid));
      if (ang >= INLINE_DEG) {
        put(blank(w1, nid, 'inline', 'end', 'inline', w2.id));
        put(blank(w2, nid, 'inline', 'end', 'inline', w1.id));
        continue;
      }
      const A = cornerThrough(w1, w2);
      const B = A === w1 ? w2 : w1;
      model.nodes.set(nid, { kind: 'L', through: [A.id], abut: [B.id], angleDeg: ang });
      const eA = blank(A, nid, 'L', 'through', 'lap', B.id);
      const eB = blank(B, nid, 'L', 'abut', 'butt', A.id);
      const secA = sections.get(A.id)!;
      const secB = sections.get(B.id)!;
      // strona ściany A zwrócona do wnętrza narożnika (w stronę ściany B) i odwrotnie
      const innerA: 0 | 1 = nearSign(B, eB.end, A) > 0 ? 0 : 1;
      const innerB: 0 | 1 = nearSign(A, eA.end, B) > 0 ? 0 : 1;
      // ruszt A do zewnętrznego lica rusztu B, ruszt B do wewnętrznego lica rusztu A
      eA.frame = { s: cutAt(A, eA.end, 0, B, faceToward(A, eA.end, B, false, 0)), contact: 'butt', with: B.id };
      eB.frame = { s: cutAt(B, eB.end, 0, A, faceToward(B, eB.end, A, true, 0)), contact: 'butt', with: A.id };
      for (const side of [0, 1] as const) {
        eA.boards[side].forEach((b, k) => {
          const inner = side === innerA;
          // zewnątrz: warstwa k zachodzi na czoło warstwy k ściany B; wewnątrz: dochodzi do warstwy k ściany B
          const m = faceToward(A, eA.end, B, inner, k + 1);
          b.s = cutAt(A, eA.end, layerMid(secA, side, k), B, m);
          b.contact = inner ? 'butt' : 'lap';
        });
        eB.boards[side].forEach((b, k) => {
          const inner = side === innerB;
          // zewnątrz: czoło warstwy k chowa się pod warstwą k ściany A; wewnątrz: dochodzi do warstwy k-1 ściany A
          const m = faceToward(B, eB.end, A, inner, k);
          b.s = cutAt(B, eB.end, layerMid(secB, side, k), A, m);
          b.contact = inner ? 'butt' : 'covered';
        });
      }
      // dodatkowy słupek A pod krawędziami płyt od strony kąta wewnętrznego: tuż za rusztem B
      const coreFace = cutAt(A, eA.end, layerMid(secA, innerA, 0), B, secB.core);
      eA.cornerStud = coreFace + STUD_W / 2;
      put(eA);
      put(eB);
      continue;
    }

    // trójnik / skrzyżowanie w węźle: para współliniowa jest ciągła
    const pair = throughPair(node, list, (w) => farOf(w, nid));
    const abut = list.filter((w) => !pair.includes(w));
    model.nodes.set(nid, { kind: abut.length >= 2 ? 'X' : 'T', through: pair.map((w) => w.id), abut: abut.map((w) => w.id) });
    for (const w of pair) put(blank(w, nid, abut.length >= 2 ? 'X' : 'T', 'through', 'inline', pair.find((x) => x !== w)!.id));
    for (const w of abut) {
      // lico ściany ciągłej po stronie ściany dochodzącej – bierzemy tę z pary, która ją „widzi”
      abutFace(w, nid, pair[0], abut.length >= 2 ? 'X' : 'T');
    }
  }

  // okładziny istniejących ścian: w narożniku obrysu jedna okładzina dochodzi do drugiej
  for (const w of existing) {
    const ax = axes.get(w.id)!;
    for (const l of w.linings ?? []) {
      let u0 = 0;
      let u1 = ax.L;
      for (const end of ['a', 'b'] as const) {
        const nid = end === 'a' ? w.a : w.b;
        const dirW = outDir(ax, end);
        for (const o of existing) {
          if (o.id === w.id || (o.a !== nid && o.b !== nid)) continue;
          const ao = axes.get(o.id)!;
          const dirO = outDir(ao, o.a === nid ? 'a' : 'b');
          // okładzina w zwrócona w stronę ściany o (kąt wewnętrzny)?
          if (dot({ x: ax.n.x * l.side, y: ax.n.y * l.side }, dirO) <= 0.1) continue;
          for (const lo of o.linings ?? []) {
            if (dot({ x: ao.n.x * lo.side, y: ao.n.y * lo.side }, dirW) <= 0.1) continue;
            // dochodzi okładzina ściany o większym id
            if (w.id < o.id) continue;
            const den = Math.abs(dot(dirW, ao.n)) || 1;
            const s = liningThickness(lo) / den;
            if (end === 'a') u0 = Math.max(u0, s);
            else u1 = Math.min(u1, ax.L - s);
          }
        }
      }
      model.linings.set(`${w.id}:${l.side}`, [u0, u1]);
    }
  }

  return model;

  /** Istniejąca ściana, do której dochodzi koniec nowej ściany, i głębokość jej okładziny po tej stronie */
  function masonryAt(nid: Id, node: Point, w: Wall, end: 'a' | 'b') {
    const dirW = outDir(axes.get(w.id)!, end);
    let best: { wall: Wall; depth: number; lining: boolean; score: number } | null = null;
    for (const o of existing) {
      const A = nodes.get(o.a)!;
      const B = nodes.get(o.b)!;
      const touches = o.a === nid || o.b === nid || projectOnSegment(node, A, B).d < 2;
      if (!touches) continue;
      const ao = axes.get(o.id)!;
      const score = Math.abs(dot(dirW, ao.n));
      if (score < 0.2) continue; // ściana biegnie wzdłuż muru – nie dochodzi do niego czołem
      const side = dot(ao.n, dirW) >= 0 ? 1 : -1;
      const lin = (o.linings ?? []).find((l) => l.side === side);
      const depth = lin ? liningThickness(lin) : 0;
      if (!best || score > best.score) best = { wall: o, depth, lining: !!lin, score };
    }
    if (best) return best;
    // koniec oznaczony przez użytkownika jako przy murze, bez narysowanego obrysu
    return (end === 'a' ? w.endA : w.endB) === 'existing-wall' ? { wall: w, depth: 0, lining: false, score: 0 } : null;
  }
}

function angleAt(center: Point, p1: Point, p2: Point) {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

// ---------------------------------------------------------------------------
// Zakresy elementów wzdłuż ściany
// ---------------------------------------------------------------------------

export type WallPart = { kind: 'frame' } | { kind: 'board'; side: 0 | 1; layer: number };

const endS = (e: WallEndContacts | undefined, part: WallPart) =>
  !e ? 0 : part.kind === 'frame' ? e.frame.s : (e.boards[part.side]?.[part.layer]?.s ?? 0);

/** Zakres elementu wzdłuż ściany [u0, u1], m od węzła a */
export function partRange(m: ContactModel, w: Wall, L: number, part: WallPart): [number, number] {
  return [endS(m.ends.get(`${w.id}:a`), part), L - endS(m.ends.get(`${w.id}:b`), part)];
}

/** Dodatkowe słupki narożne (pod krawędziami płyt od strony kąta wewnętrznego), m od węzła a */
export function cornerStudPositions(m: ContactModel, w: Wall, L: number): number[] {
  const out: number[] = [];
  const a = m.ends.get(`${w.id}:a`);
  const b = m.ends.get(`${w.id}:b`);
  if (a?.cornerStud !== undefined) out.push(a.cornerStud);
  if (b?.cornerStud !== undefined) out.push(L - b.cornerStud);
  return out;
}

// ---------------------------------------------------------------------------
// Rzut elementów i wykrywanie kolizji
// ---------------------------------------------------------------------------

export interface Footprint {
  wallId: Id;
  /** opis elementu, np. „ruszt”, „płyta strona A, warstwa 1”, „mur”, „okładzina” */
  label: string;
  kind: 'frame' | 'board' | 'strip' | 'masonry' | 'lining';
  /** wielokąt wypukły w rzucie, m */
  poly: Point[];
}

const rectPoly = (ax: Axis, u0: number, u1: number, n0: number, n1: number): Point[] =>
  [
    [u0, n0],
    [u1, n0],
    [u1, n1],
    [u0, n1],
  ].map(([u, n]) => ({ x: ax.a.x + ax.u.x * u + ax.n.x * n, y: ax.a.y + ax.u.y * u + ax.n.y * n }));

export const sideName = (side: 0 | 1, sides: number) => (sides > 1 ? `strona ${side === 0 ? 'A' : 'B'}` : 'okładzina');

/** Rzut wszystkich elementów zabudowy (ruszt, warstwy płyt, paski, mur, okładziny) */
export function footprints(p: Project, m: ContactModel = buildContacts(p)): Footprint[] {
  const nodes = nodeMap(p);
  const rooms = existingRooms(p);
  const out: Footprint[] = [];
  for (const w of p.walls) {
    const ax = axisOf(w, nodes);
    if (!ax) continue;
    if (isNewWall(w)) {
      const sec = m.sections.get(w.id)!;
      const [f0, f1] = partRange(m, w, ax.L, { kind: 'frame' });
      if (f1 - f0 > 1e-4) out.push({ wallId: w.id, label: 'ruszt', kind: 'frame', poly: rectPoly(ax, f0, f1, -sec.core, sec.core) });
      const sides = sec.layers[1] > 0 ? 2 : 1;
      for (const side of [0, 1] as const)
        for (let k = 0; k < sec.layers[side]; k++) {
          const [u0, u1] = partRange(m, w, ax.L, { kind: 'board', side, layer: k });
          const n0 = faceOffset(sec, side, k);
          const n1 = faceOffset(sec, side, k + 1);
          if (u1 - u0 > 1e-4)
            out.push({
              wallId: w.id,
              label: `płyta ${sideName(side, sides)}, warstwa ${k + 1}`,
              kind: 'board',
              poly: rectPoly(ax, u0, u1, Math.min(n0, n1), Math.max(n0, n1)),
            });
        }
      for (const end of ['a', 'b'] as const) {
        const e = m.ends.get(`${w.id}:${end}`);
        if (!e?.strip) continue;
        const [s0, s1] = end === 'a' ? [0, e.strip.thickness] : [ax.L - e.strip.thickness, ax.L];
        out.push({ wallId: w.id, label: 'pasek płyty na czole', kind: 'strip', poly: rectPoly(ax, s0, s1, -sec.core, sec.core) });
      }
    } else {
      const T = (w.thickness ?? 25) / 100;
      const inner = interiorSide(p, w, rooms);
      const center = inner ? -inner * (T / 2) : 0;
      out.push({ wallId: w.id, label: 'mur', kind: 'masonry', poly: rectPoly(ax, 0, ax.L, center - T / 2, center + T / 2) });
      for (const l of w.linings ?? []) {
        const [u0, u1] = m.linings.get(`${w.id}:${l.side}`) ?? [0, ax.L];
        const face = center + l.side * (T / 2);
        const t = liningThickness(l);
        const n0 = face;
        const n1 = face + l.side * t;
        out.push({ wallId: w.id, label: 'okładzina', kind: 'lining', poly: rectPoly(ax, u0, u1, Math.min(n0, n1), Math.max(n0, n1)) });
      }
    }
  }
  return out;
}

function polyArea(pts: Point[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Część wspólna dwóch wielokątów wypukłych (Sutherland–Hodgman) */
export function clipConvex(subject: Point[], clip: Point[]): Point[] {
  const ccw = (pts: Point[]) => (polyArea(pts) < 0 ? [...pts].reverse() : pts);
  let out = ccw(subject);
  const c = ccw(clip);
  for (let i = 0; i < c.length && out.length; i++) {
    const A = c[i];
    const B = c[(i + 1) % c.length];
    const inside = (p: Point) => (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x) >= -1e-12;
    const cross = (p: Point, q: Point): Point => {
      const a1 = B.y - A.y;
      const b1 = A.x - B.x;
      const c1 = a1 * A.x + b1 * A.y;
      const a2 = q.y - p.y;
      const b2 = p.x - q.x;
      const c2 = a2 * p.x + b2 * p.y;
      const det = a1 * b2 - a2 * b1;
      return det === 0 ? p : { x: (b2 * c1 - b1 * c2) / det, y: (a1 * c2 - a2 * c1) / det };
    };
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const P = input[k];
      const Q = input[(k + 1) % input.length];
      if (inside(Q)) {
        if (!inside(P)) out.push(cross(P, Q));
        out.push(Q);
      } else if (inside(P)) out.push(cross(P, Q));
    }
  }
  return out;
}

export const overlapArea = (p: Point[], q: Point[]) => {
  const c = clipConvex(p, q);
  return c.length >= 3 ? Math.abs(polyArea(c)) : 0;
};

export interface Collision {
  a: Footprint;
  b: Footprint;
  /** pole przenikania w rzucie, cm² */
  areaCm2: number;
  /** środek obszaru przenikania, cm (układ planu) */
  at: Point;
}

/** Najmniejsze pole przenikania w rzucie, które zgłaszamy (mniejsze to zaokrąglenia przy kątach ≠ 90°), cm² */
const MIN_COLLISION_CM2 = 1;

/**
 * Elementy różnych ścian, które w rzucie zajmują to samo miejsce (przenikanie, nałożenie).
 * Mur z murem pomijamy – to istniejąca konstrukcja.
 */
export function findCollisions(p: Project, m: ContactModel = buildContacts(p)): Collision[] {
  const fps = footprints(p, m);
  const out: Collision[] = [];
  for (let i = 0; i < fps.length; i++)
    for (let k = i + 1; k < fps.length; k++) {
      const a = fps[i];
      const b = fps[k];
      if (a.wallId === b.wallId) continue;
      if (a.kind === 'masonry' && b.kind === 'masonry') continue;
      const c = clipConvex(a.poly, b.poly);
      if (c.length < 3) continue;
      const area = Math.abs(polyArea(c)) * 1e4;
      if (area < MIN_COLLISION_CM2) continue;
      const cx = c.reduce((s, q) => s + q.x, 0) / c.length;
      const cy = c.reduce((s, q) => s + q.y, 0) / c.length;
      out.push({ a, b, areaCm2: area, at: { x: cx * 100, y: cy * 100 } });
    }
  return out;
}

/** Czy punkt (m) leży w którymś z elementów */
export function covered(fps: Footprint[], pt: Point): boolean {
  return fps.some((f) => {
    const poly = polyArea(f.poly) < 0 ? [...f.poly].reverse() : f.poly;
    return poly.every((A, i) => {
      const B = poly[(i + 1) % poly.length];
      return (B.x - A.x) * (pt.y - A.y) - (B.y - A.y) * (pt.x - A.x) >= -1e-9;
    });
  });
}

export interface Gap {
  nodeId: Id;
  /** środek szczeliny, cm (układ planu) */
  at: Point;
}

/**
 * Szczeliny w połączeniach pod kątem prostym: punkty, które leżą w obrysie połączonych ścian
 * (każda ściana przedłużona do zewnętrznego lica drugiej), a nie są przykryte żadnym elementem.
 */
export function findGaps(p: Project, m: ContactModel = buildContacts(p), step = 0.002): Gap[] {
  const nodes = nodeMap(p);
  const fps = footprints(p, m);
  const out: Gap[] = [];
  for (const [nid, nc] of m.nodes) {
    if (nc.kind === 'L' && Math.abs((nc.angleDeg ?? 90) - 90) > 1) continue;
    const ids = [...nc.through, ...nc.abut];
    const walls = ids.map((id) => p.walls.find((w) => w.id === id)!).filter(Boolean);
    const node = nodes.get(nid)!;
    const c = { x: node.x / 100, y: node.y / 100 };
    // pasmo każdej ściany w pełnej grubości, w promieniu połączenia
    const R = Math.max(...walls.map((w) => thickness(m.sections.get(w.id)!))) + 0.01;
    const bands = walls.map((w) => {
      const ax = axisOf(w, nodes)!;
      const sec = m.sections.get(w.id)!;
      return { ax, lo: faceOffset(sec, 1, 99), hi: faceOffset(sec, 0, 99) };
    });
    const inBand = (b: (typeof bands)[number], q: Point, ext: number) => {
      const d = { x: q.x - b.ax.a.x, y: q.y - b.ax.a.y };
      const u = dot(d, b.ax.u);
      const n = dot(d, b.ax.n);
      return n >= b.lo + 1e-6 && n <= b.hi - 1e-6 && u >= -ext && u <= b.ax.L + ext;
    };
    let found: Point | null = null;
    for (let x = -R; x <= R && !found; x += step)
      for (let y = -R; y <= R && !found; y += step) {
        const q = { x: c.x + x, y: c.y + y };
        // obrys połączenia: w paśmie którejś ściany (przedłużonej do lica drugiej)
        const inside = bands.some((b) => inBand(b, q, R));
        if (!inside) continue;
        // poza końcem ścian „na wylot” – tylko gdy leży też w paśmie innej ściany
        const inOwn = bands.filter((b) => inBand(b, q, 0)).length;
        if (!inOwn && bands.filter((b) => inBand(b, q, R)).length < 2) continue;
        if (!covered(fps, q)) found = { x: q.x * 100, y: q.y * 100 };
      }
    if (found) out.push({ nodeId: nid, at: found });
  }
  return out;
}

const thickness = (sec: WallSection) => sec.core * 2 + sec.bt * (sec.layers[0] + sec.layers[1]);

// ---------- Ściany narysowane na już istniejących ----------

/** Odległość od osi i różnica kierunku, przy których dwie ściany traktujemy jako leżące w jednej linii (cm) */
const OVERLAP_TOL_CM = 1;

type WallKindKey = 'new' | 'existing';
const kindOf = (w: Wall): WallKindKey => (isNewWall(w) ? 'new' : 'existing');

/**
 * Fragmenty odcinka from→to (cm), których nie zajmuje już żadna ściana tego samego rodzaju leżąca
 * w tej samej linii. Np. drugi „Pokój” narysowany po ścianach pierwszego dostaje tylko brakujące ściany.
 * Końce fragmentów, które wypadają na węzłach istniejących ścian, mają ich dokładne położenie.
 */
export function uncoveredParts(p: Project, from: Point, to: Point, kind: WallKindKey, ignore?: Id): [Point, Point][] {
  const L = Math.hypot(to.x - from.x, to.y - from.y);
  if (L < 1e-6) return [];
  const u = { x: (to.x - from.x) / L, y: (to.y - from.y) / L };
  const along = (q: Point) => (q.x - from.x) * u.x + (q.y - from.y) * u.y;
  const off = (q: Point) => Math.abs((q.x - from.x) * -u.y + (q.y - from.y) * u.x);
  const nodes = nodeMap(p);
  // zajęte przedziały wzdłuż odcinka, z punktami końców
  const cover: { s: number; e: number; ps: Point; pe: Point }[] = [];
  for (const w of p.walls) {
    if (w.id === ignore || kindOf(w) !== kind) continue;
    const A = nodes.get(w.a);
    const B = nodes.get(w.b);
    if (!A || !B) continue;
    if (off(A) > OVERLAP_TOL_CM || off(B) > OVERLAP_TOL_CM) continue;
    let [s, e, ps, pe] = [along(A), along(B), A as Point, B as Point];
    if (s > e) [s, e, ps, pe] = [e, s, pe, ps];
    if (e <= OVERLAP_TOL_CM || s >= L - OVERLAP_TOL_CM) continue;
    cover.push({ s, e, ps: { x: ps.x, y: ps.y }, pe: { x: pe.x, y: pe.y } });
  }
  if (!cover.length) return [[from, to]];
  cover.sort((x, y) => x.s - y.s);
  const out: [Point, Point][] = [];
  let cur = 0;
  let curPt: Point = from;
  for (const c of cover) {
    if (c.s > cur + OVERLAP_TOL_CM) out.push([curPt, c.s >= L ? to : c.ps]);
    if (c.e > cur) {
      cur = c.e;
      curPt = c.pe;
    }
  }
  if (cur < L - OVERLAP_TOL_CM) out.push([curPt, to]);
  return out.filter(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y) >= OVERLAP_TOL_CM);
}

export interface Overlap {
  /** ściana starsza (wcześniej w projekcie) */
  keep: Id;
  /** ściana nałożona na nią */
  over: Id;
  /** długość wspólnego odcinka, cm */
  lengthCm: number;
}

/** Pary ścian tego samego rodzaju, które leżą w jednej linii i zajmują ten sam odcinek */
export function findOverlaps(p: Project): Overlap[] {
  const nodes = nodeMap(p);
  const out: Overlap[] = [];
  p.walls.forEach((w, i) => {
    const A = nodes.get(w.a);
    const B = nodes.get(w.b);
    if (!A || !B) return;
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    if (L < 1e-6) return;
    const free = uncoveredParts({ ...p, walls: p.walls.slice(0, i) }, A, B, kindOf(w));
    const freeLen = free.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.y - a.y), 0);
    if (L - freeLen <= OVERLAP_TOL_CM) return;
    // starsza ściana, z którą jest wspólny odcinek
    for (const o of p.walls.slice(0, i)) {
      const one = uncoveredParts({ ...p, walls: [o] }, A, B, kindOf(w));
      const len = L - one.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.y - a.y), 0);
      if (len > OVERLAP_TOL_CM) out.push({ keep: o.id, over: w.id, lengthCm: len });
    }
  });
  return out;
}
