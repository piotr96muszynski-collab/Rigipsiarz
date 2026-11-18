// Budowa modelu 3D zabudowy z danych projektu – czysta geometria bez three.js,
// dzięki czemu da się ją testować w Node. Wszystko w metrach.
// Układ osi (jak w three.js): x = x planu, z = y planu, y = wysokość od posadzki.

import { boardById, ceilingSystemById, wallFrameDepth, wallSystemById } from '../catalog/rigips';
import { ceilingGrid, liningKey, pickBoardLength, type ProjectCalc } from '../calc/materials';
import { existingRooms, interiorSide, isNewWall, nodeMap, polygonPerimeterEdges, wallEnds } from '../geometry/geometry';
import type { Ceiling, Point, Project, Wall } from '../model/types';

/** Warstwy, które można przełączać w widoku */
export type Layer3D = 'existing' | 'wallBoards' | 'wallFrame' | 'ceilingBoards' | 'ceilingFrame';

/** Materiały elementów rusztu; płyty mają klucz `board:<id>` */
export type FrameMat = 'cw' | 'uw' | 'ua' | 'cdMain' | 'cdSec' | 'ud' | 'hanger' | 'masonry';
export type MatKey = FrameMat | `board:${string}`;

export interface BoxPart {
  type: 'box';
  layer: Layer3D;
  mat: MatKey;
  /** Środek prostopadłościanu */
  c: [number, number, number];
  /** Wymiary w układzie lokalnym: [wzdłuż, wysokość, grubość] */
  s: [number, number, number];
  /** Obrót wokół osi pionowej, rad */
  rotY: number;
  /** Ścianka/sufit, z którego pochodzi element */
  owner: string;
}

export interface SlabPart {
  type: 'slab';
  layer: Layer3D;
  mat: MatKey;
  /** Obrys w rzucie (x, z), m */
  points: Point[];
  /** Spód płyty od posadzki, m */
  y: number;
  thickness: number;
  owner: string;
}

export type Part3D = BoxPart | SlabPart;

export interface Model3D {
  parts: Part3D[];
  /** Zakres sceny (do ustawienia kamery) */
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const EPS = 0.002;

/** Odejmuje prostokąty `holes` od `r`. Zwraca rozłączne prostokąty. */
export function subtractRects(r: Rect, holes: Rect[]): Rect[] {
  let pieces: Rect[] = [r];
  for (const h of holes) {
    const next: Rect[] = [];
    for (const p of pieces) {
      if (h.x1 <= p.x0 + EPS || h.x0 >= p.x1 - EPS || h.y1 <= p.y0 + EPS || h.y0 >= p.y1 - EPS) {
        next.push(p);
        continue;
      }
      const ix0 = Math.max(p.x0, h.x0);
      const ix1 = Math.min(p.x1, h.x1);
      if (ix0 - p.x0 > EPS) next.push({ x0: p.x0, x1: ix0, y0: p.y0, y1: p.y1 });
      if (p.x1 - ix1 > EPS) next.push({ x0: ix1, x1: p.x1, y0: p.y0, y1: p.y1 });
      if (h.y0 - p.y0 > EPS) next.push({ x0: ix0, x1: ix1, y0: p.y0, y1: h.y0 });
      if (p.y1 - h.y1 > EPS) next.push({ x0: ix0, x1: ix1, y0: h.y1, y1: p.y1 });
    }
    pieces = next;
  }
  return pieces;
}

/** Otwory przycięte do ściany, m (te same reguły co w wyliczeniach) */
export function wallOpenings(w: Wall, L: number, H: number) {
  return w.openings
    .map((o) => {
      const x0 = Math.max(0, o.offset / 100);
      const x1 = Math.min(L, (o.offset + o.width) / 100);
      const sill = o.kind === 'door' ? 0 : o.sill / 100;
      const top = Math.min(H, sill + o.height / 100);
      return { id: o.id, kind: o.kind, reinforced: o.reinforced, x0, x1, sill, top };
    })
    .filter((o) => o.x1 - o.x0 > 0.05 && o.top - o.sill > 0.05);
}

/**
 * Rozkład arkuszy na jednej stronie ściany (współrzędne lokalne: x wzdłuż ściany, y w górę).
 * Arkusze pionowo, szerokość wg katalogu; druga strona i druga warstwa przesunięte o pół
 * arkusza (mijanie spoin). Przy ścianie wyższej niż arkusz – dostawka u góry.
 */
export function boardSheets(L: number, H: number, widthM: number, sheetLenM: number, shift: number, holes: Rect[]): Rect[] {
  const out: Rect[] = [];
  const cols: [number, number][] = [];
  let x = 0;
  if (shift > EPS && shift < L) {
    cols.push([0, shift]);
    x = shift;
  }
  for (; x < L - EPS; x += widthM) cols.push([x, Math.min(L, x + widthM)]);
  cols.forEach(([x0, x1], i) => {
    // dostawki na zmianę u góry i u dołu, by spoiny poziome się mijały
    const rows: [number, number][] = [];
    if (H <= sheetLenM + EPS) rows.push([0, H]);
    else if (i % 2 === 0) {
      for (let y = 0; y < H - EPS; y += sheetLenM) rows.push([y, Math.min(H, y + sheetLenM)]);
    } else {
      const rest = H - Math.floor(H / sheetLenM) * sheetLenM;
      let y = 0;
      if (rest > EPS) {
        rows.push([0, rest]);
        y = rest;
      }
      for (; y < H - EPS; y += sheetLenM) rows.push([y, Math.min(H, y + sheetLenM)]);
    }
    for (const [y0, y1] of rows) out.push(...subtractRects({ x0, x1, y0, y1 }, holes));
  });
  return out;
}

const STUD_W = 0.05; // szerokość półki CW/UW
const TRACK_H = 0.04; // wysokość ścianki UW widoczna w 3D
const CD_H = 0.027;
const CD_W = 0.06;
const UD_W = 0.028;

function buildWall(p: Project, w: Wall, calc: ProjectCalc | undefined, nodes: ReturnType<typeof nodeMap>, parts: Part3D[]) {
  const [a, b] = wallEnds(p, w, nodes);
  const ax = a.x / 100;
  const az = a.y / 100;
  const dx = (b.x - a.x) / 100;
  const dz = (b.y - a.y) / 100;
  const L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  const H = w.height / 100;
  const ux = dx / L;
  const uz = dz / L;
  // normalna ściany w rzucie
  const nx = -uz;
  const nz = ux;
  const rotY = -Math.atan2(dz, dx);
  const sys = wallSystemById(w.systemId);
  const board = boardById(w.boardId);
  const depth = sys.profile / 1000;
  const bt = board.thickness / 1000;

  /** Dodaje prostopadłościan w układzie ściany: u wzdłuż, v wysokość, n odsunięcie od osi */
  const box = (layer: Layer3D, mat: MatKey, u0: number, u1: number, v0: number, v1: number, n: number, thick: number) => {
    const uc = (u0 + u1) / 2;
    parts.push({
      type: 'box',
      layer,
      mat,
      c: [ax + ux * uc + nx * n, (v0 + v1) / 2, az + uz * uc + nz * n],
      s: [Math.max(0.001, u1 - u0), Math.max(0.001, v1 - v0), thick],
      rotY,
      owner: w.id,
    });
  };

  const openings = wallOpenings(w, L, H);
  const studs = calc?.walls.get(w.id)?.info.studPositions ?? [];
  const clampU = (x: number) => Math.min(L - STUD_W / 2, Math.max(STUD_W / 2, x));

  // --- Ruszt: słupki CW ---
  for (const x of studs) {
    const u = clampU(x);
    const op = openings.find((o) => x > o.x0 && x < o.x1);
    if (!op) box('wallFrame', 'cw', u - STUD_W / 2, u + STUD_W / 2, TRACK_H, H - TRACK_H, 0, depth * 0.96);
    else {
      if (op.sill > TRACK_H) box('wallFrame', 'cw', u - STUD_W / 2, u + STUD_W / 2, TRACK_H, op.sill, 0, depth * 0.96);
      if (op.top < H - TRACK_H) box('wallFrame', 'cw', u - STUD_W / 2, u + STUD_W / 2, op.top, H - TRACK_H, 0, depth * 0.96);
    }
  }
  // --- Ościeża, nadproża, podokienniki ---
  for (const o of openings) {
    const mat: FrameMat = o.reinforced ? 'ua' : 'cw';
    const jl = Math.max(STUD_W / 2, o.x0 - STUD_W / 2);
    const jr = Math.min(L - STUD_W / 2, o.x1 + STUD_W / 2);
    box('wallFrame', mat, jl - STUD_W / 2, jl + STUD_W / 2, TRACK_H, H - TRACK_H, 0, depth * 0.96);
    box('wallFrame', mat, jr - STUD_W / 2, jr + STUD_W / 2, TRACK_H, H - TRACK_H, 0, depth * 0.96);
    if (o.top < H - 0.05) box('wallFrame', 'uw', o.x0, o.x1, o.top, o.top + TRACK_H, 0, depth);
    if (o.sill > 0.05) box('wallFrame', 'uw', o.x0, o.x1, o.sill - TRACK_H, o.sill, 0, depth);
  }
  // --- UW: strop i posadzka (posadzkowy przerwany w drzwiach) ---
  box('wallFrame', 'uw', 0, L, H - TRACK_H, H, 0, depth);
  let cursor = 0;
  for (const o of openings.filter((o) => o.sill <= 0.01).sort((m, n) => m.x0 - n.x0)) {
    if (o.x0 - cursor > 0.05) box('wallFrame', 'uw', cursor, o.x0, 0, TRACK_H, 0, depth);
    cursor = Math.max(cursor, o.x1);
  }
  if (L - cursor > 0.05) box('wallFrame', 'uw', cursor, L, 0, TRACK_H, 0, depth);

  // --- Płyty ---
  const holes: Rect[] = openings.map((o) => ({ x0: o.x0, x1: o.x1, y0: o.sill, y1: o.top }));
  const sheetLen = pickBoardLength(w.boardId, w.height) / 100;
  const widthM = board.width / 100;
  for (let side = 0; side < sys.sides; side++) {
    const dir = side === 0 ? 1 : -1;
    for (let layer = 0; layer < sys.layers; layer++) {
      const n = dir * (depth / 2 + bt * layer + bt / 2);
      const shift = ((side + layer) % 2) * (widthM / 2);
      for (const r of boardSheets(L, H, widthM, sheetLen, shift, holes)) {
        box('wallBoards', `board:${board.id}`, r.x0, r.x1, r.y0, r.y1, n, bt);
      }
    }
  }
}

/**
 * Istniejąca ściana (mur) z otworami oraz jej okładziny. Linia ściany w rzucie to lico od strony
 * pomieszczenia, więc mur leży po stronie zewnętrznej, a okładzina – na licu.
 */
function buildExistingWall(
  p: Project,
  w: Wall,
  inner: 1 | -1 | 0,
  calc: ProjectCalc | undefined,
  nodes: ReturnType<typeof nodeMap>,
  parts: Part3D[],
) {
  const [a, b] = wallEnds(p, w, nodes);
  const ax = a.x / 100;
  const az = a.y / 100;
  const dx = (b.x - a.x) / 100;
  const dz = (b.y - a.y) / 100;
  const L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  const H = w.height / 100;
  const ux = dx / L;
  const uz = dz / L;
  const nx = -uz;
  const nz = ux;
  const rotY = -Math.atan2(dz, dx);
  const T = (w.thickness ?? 25) / 100;
  const box = (layer: Layer3D, mat: MatKey, u0: number, u1: number, v0: number, v1: number, n: number, thick: number) => {
    const uc = (u0 + u1) / 2;
    parts.push({
      type: 'box',
      layer,
      mat,
      c: [ax + ux * uc + nx * n, (v0 + v1) / 2, az + uz * uc + nz * n],
      s: [Math.max(0.001, u1 - u0), Math.max(0.001, v1 - v0), thick],
      rotY,
      owner: w.id,
    });
  };
  const openings = wallOpenings(w, L, H);
  const holes: Rect[] = openings.map((o) => ({ x0: o.x0, x1: o.x1, y0: o.sill, y1: o.top }));
  const center = inner ? -inner * (T / 2) : 0;
  // narożnik obrysu: mur przedłużony o grubość, żeby domknąć zewnętrzny róg
  const shared = (nid: string) => p.walls.some((o) => o.id !== w.id && !isNewWall(o) && (o.a === nid || o.b === nid));
  const e0 = inner && shared(w.a) ? T : 0;
  const e1 = inner && shared(w.b) ? T : 0;
  for (const r of subtractRects({ x0: -e0, x1: L + e1, y0: 0, y1: H }, holes)) box('existing', 'masonry', r.x0, r.x1, r.y0, r.y1, center, T);

  for (const l of w.linings ?? []) {
    const sys = wallSystemById(l.systemId);
    const board = boardById(l.boardId);
    const bt = board.thickness / 1000;
    const depth = wallFrameDepth(sys) / 1000;
    const face = center + l.side * (T / 2);
    // ruszt CD okładziny: pionowe profile w miejscach z wyliczeń
    if (sys.frame === 'cd-lining') {
      const studs = calc?.linings.get(liningKey(w.id, l.side))?.info.studPositions ?? [];
      for (const x of studs) {
        const u = Math.min(L - CD_W / 2, Math.max(CD_W / 2, x));
        const op = openings.find((o) => x > o.x0 && x < o.x1);
        const n = face + l.side * (depth - CD_H / 2);
        if (!op) box('wallFrame', 'cdMain', u - CD_W / 2, u + CD_W / 2, TRACK_H, H - TRACK_H, n, CD_H);
        else {
          if (op.sill > TRACK_H) box('wallFrame', 'cdMain', u - CD_W / 2, u + CD_W / 2, TRACK_H, op.sill, n, CD_H);
          if (op.top < H - TRACK_H) box('wallFrame', 'cdMain', u - CD_W / 2, u + CD_W / 2, op.top, H - TRACK_H, n, CD_H);
        }
      }
    }
    const sheetLen = pickBoardLength(l.boardId, w.height) / 100;
    const widthM = board.width / 100;
    for (let layer = 0; layer < sys.layers; layer++) {
      const n = face + l.side * (depth + bt * layer + bt / 2);
      const shift = (layer % 2) * (widthM / 2);
      for (const r of boardSheets(L, H, widthM, sheetLen, shift, holes)) box('wallBoards', `board:${board.id}`, r.x0, r.x1, r.y0, r.y1, n, bt);
    }
  }
}

function buildCeiling(c: Ceiling, parts: Part3D[]) {
  if (c.points.length < 3) return;
  const sys = ceilingSystemById(c.systemId);
  const board = boardById(c.boardId);
  const bt = board.thickness / 1000;
  const yb = c.height / 100;
  const pts = c.points.map((q) => ({ x: q.x / 100, y: q.y / 100 }));

  for (let layer = 0; layer < sys.layers; layer++) {
    parts.push({
      type: 'slab',
      layer: 'ceilingBoards',
      mat: `board:${board.id}`,
      points: pts,
      y: yb + bt * layer,
      thickness: bt,
      owner: c.id,
    });
  }

  const yFrame = yb + bt * sys.layers;
  const twoLevel = sys.kind === 'two-level';
  const lineBox = (axis: 'x' | 'y', at: number, s0: number, s1: number, y0: number, mat: FrameMat, w = CD_W, h = CD_H) => {
    const a = at / 100;
    const m0 = s0 / 100;
    const m1 = s1 / 100;
    const mid = (m0 + m1) / 2;
    parts.push({
      type: 'box',
      layer: 'ceilingFrame',
      mat,
      c: axis === 'x' ? [mid, y0 + h / 2, a] : [a, y0 + h / 2, mid],
      s: [Math.max(0.001, m1 - m0), h, w],
      rotY: axis === 'x' ? 0 : -Math.PI / 2,
      owner: c.id,
    });
  };

  // profile CD: dolne (montażowe) przy płycie, nośne nad nimi w suficie dwupoziomowym
  for (const g of ceilingGrid(c)) {
    const isMain = g.level === 'main';
    const y0 = twoLevel && isMain ? yFrame + CD_H : yFrame;
    const mat: FrameMat = isMain ? 'cdMain' : 'cdSec';
    for (const [s0, s1] of g.segments) {
      lineBox(g.axis, g.at, s0, s1, y0, mat);
      if (!isMain) continue;
      // wieszaki na profilach nośnych
      const top = y0 + CD_H;
      const rod = sys.kind === 'direct' ? 0.08 : 0.35;
      const run = s1 - s0;
      const count = Math.max(2, Math.ceil(run / sys.hangerSpacing));
      const step = run / count;
      for (let k = 0; k < count; k++) {
        const along = s0 + step * (k + 0.5);
        lineBox(g.axis, g.at, along - 0.4, along + 0.4, top, 'hanger', 0.008, rod);
      }
    }
  }

  // UD przyścienny po obwodzie
  const edges = polygonPerimeterEdges(pts);
  pts.forEach((p0, i) => {
    const p1 = pts[(i + 1) % pts.length];
    const len = edges[i];
    if (len < 0.02) return;
    parts.push({
      type: 'box',
      layer: 'ceilingFrame',
      mat: 'ud',
      c: [(p0.x + p1.x) / 2, yFrame + CD_H / 2, (p0.y + p1.y) / 2],
      s: [len, CD_H, UD_W],
      rotY: -Math.atan2(p1.y - p0.y, p1.x - p0.x),
      owner: c.id,
    });
  });
}

export function buildModel3D(p: Project, calc?: ProjectCalc): Model3D {
  const parts: Part3D[] = [];
  const nodes = nodeMap(p);
  const rooms = existingRooms(p);
  for (const w of p.walls) {
    if (!nodes.has(w.a) || !nodes.has(w.b)) continue;
    if (isNewWall(w)) buildWall(p, w, calc, nodes, parts);
    else buildExistingWall(p, w, interiorSide(p, w, rooms), calc, nodes, parts);
  }
  for (const c of p.ceilings) buildCeiling(c, parts);

  const min: [number, number, number] = [Infinity, 0, Infinity];
  const max: [number, number, number] = [-Infinity, 0, -Infinity];
  const grow = (x: number, y: number, z: number) => {
    min[0] = Math.min(min[0], x);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  };
  for (const pt of parts) {
    if (pt.type === 'box') grow(pt.c[0], pt.c[1] + pt.s[1] / 2, pt.c[2]);
    else for (const q of pt.points) grow(q.x, pt.y + pt.thickness, q.y);
  }
  if (!parts.length) {
    min[0] = min[2] = -2;
    max[0] = max[2] = 2;
    max[1] = 2.6;
  }
  return { parts, bounds: { min, max } };
}
