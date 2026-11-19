// Budowa modelu 3D zabudowy z danych projektu – czysta geometria bez three.js,
// dzięki czemu da się ją testować w Node. Wszystko w metrach.
// Układ osi (jak w three.js): x = x planu, z = y planu, y = wysokość od posadzki.

import { boardById, ceilingSystemById, wallFrameDepth, wallSystemById } from '../catalog/rigips';
import { ceilingCrossings, ceilingFixerGrid, ceilingGrid, pickBoardLength, type ProjectCalc } from '../calc/materials';
import { hangerPositions, liningLayout, pieceArea, pieceOutline, pointFixGrid, splicePositions, wallLayout } from '../calc/layout';
import { STUD_W, buildContacts, partRange, wallSection, type ContactModel } from '../geometry/contacts';
import { analyzeJunctions, existingRooms, isNewWall, masonrySide, nodeMap, polygonPerimeterEdges, wallEnds } from '../geometry/geometry';
import type { Ceiling, Point, Project, Wall } from '../model/types';
import { profileFor, type ProfileSpec, type WebSide } from './profiles';

/** Warstwy, które można przełączać w widoku */
export type Layer3D = 'existing' | 'wallBoards' | 'wallFrame' | 'ceilingBoards' | 'ceilingFrame';

/** Materiały elementów rusztu; płyty mają klucz `board:<id>` */
export type FrameMat = 'cw' | 'uw' | 'ua' | 'cdMain' | 'cdSec' | 'ud' | 'hanger' | 'connector' | 'masonry' | 'disc' | 'anchor';
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
  /** Profil stalowy: w 3D rysowany przekrojem C/U zamiast pełnej bryły */
  profile?: ProfileSpec;
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

/** Płyta o dowolnym obrysie (np. wycięta w kształt L przy otworze) w płaszczyźnie ściany */
export interface PanelPart {
  type: 'panel';
  layer: Layer3D;
  mat: MatKey;
  /** Początek układu ściany (węzeł a) na posadzce */
  origin: [number, number, number];
  rotY: number;
  /** Środek grubości płyty od osi ściany, m */
  n: number;
  thickness: number;
  /** Obrys w układzie ściany (x wzdłuż, y wysokość); pierwszy zewnętrzny, kolejne – otwory */
  loops: Point[][];
  /** Pole płyty, m² */
  area: number;
  owner: string;
}

/** Walec wzdłuż dowolnej osi – talerzyk i trzpień łącznika ATLAS M-System 3G */
export interface CylPart {
  type: 'cyl';
  layer: Layer3D;
  mat: MatKey;
  /** Środek walca */
  c: [number, number, number];
  /** Kierunek osi walca (wektor jednostkowy) */
  axis: [number, number, number];
  r: number;
  len: number;
  owner: string;
}

export type Part3D = BoxPart | SlabPart | PanelPart | CylPart;

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

const TRACK_H = 0.04; // wysokość ścianki UW widoczna w 3D
const CD_H = 0.027;
const CD_W = 0.06;
const UD_W = 0.028;
// uchwyt ES w 3D: szerokość blachy na murze i wysokość ramion, m
const ES_W = 0.07;
const ES_H = 0.03;
/** Talerzyk KT 3G 120 PP: średnica 120 mm */
export const DISC_R = 0.06;
const DISC_T = 0.006;
/** Trzpień łącznika 3GL z tuleją */
const ANCHOR_R = 0.008;

/**
 * Łącznik ATLAS M-System 3G: talerzyk tuż pod płytą i trzpień do podłoża. `base` – punkt na
 * licu podłoża (muru albo stropu), `dir` – kierunek od podłoża do płyty, `standoff` – odstęp płyty, m.
 */
export function fixerParts(
  layer: Layer3D,
  base: [number, number, number],
  dir: [number, number, number],
  standoff: number,
  owner: string,
): CylPart[] {
  const at = (k: number): [number, number, number] => [base[0] + dir[0] * k, base[1] + dir[1] * k, base[2] + dir[2] * k];
  const stem = Math.max(0.005, standoff - DISC_T);
  return [
    { type: 'cyl', layer, mat: 'anchor', c: at(stem / 2), axis: dir, r: ANCHOR_R, len: stem, owner },
    { type: 'cyl', layer, mat: 'disc', c: at(standoff - DISC_T / 2), axis: dir, r: DISC_R, len: DISC_T, owner },
  ];
}

function buildWall(
  p: Project,
  w: Wall,
  nodes: ReturnType<typeof nodeMap>,
  contacts: ContactModel,
  junctions: ReturnType<typeof analyzeJunctions>,
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
  // normalna ściany w rzucie
  const nx = -uz;
  const nz = ux;
  const rotY = -Math.atan2(dz, dx);
  const sys = wallSystemById(w.systemId);
  const board = boardById(w.boardId);
  const sec = contacts.sections.get(w.id) ?? wallSection(w);
  const pointFix = sys.frame === 'point-fix';
  const glued = sys.frame === 'glued';
  const bt = sec.bt;

  /** Dodaje prostopadłościan w układzie ściany: u wzdłuż, v wysokość, n odsunięcie od osi */
  const box = (
    layer: Layer3D,
    mat: MatKey,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    n: number,
    thick: number,
    profile?: ProfileSpec,
  ) => {
    const uc = (u0 + u1) / 2;
    parts.push({
      type: 'box',
      layer,
      mat,
      c: [ax + ux * uc + nx * n, (v0 + v1) / 2, az + uz * uc + nz * n],
      s: [Math.max(0.001, u1 - u0), Math.max(0.001, v1 - v0), thick],
      rotY,
      owner: w.id,
      ...(profile ? { profile } : {}),
    });
  };

  // ten sam układ rusztu i płyt co na rysunkach, z zakresami z modelu styków
  const j = junctions.get(w.id);
  const lay = j ? wallLayout(p, w, j, contacts) : undefined;
  const [f0, f1] = partRange(contacts, w, L, { kind: 'frame' });

  // --- Ruszt: słupki (pełne, skrócone, ościeżnicowe, dodatkowe z połączeń) ---
  if (lay && !pointFix && !glued) {
    const isCD = sys.frame === 'cd-lining';
    // rzędy słupków: pojedynczy w osi, podwójny i instalacyjny – po jednym przy każdej okładzinie
    const rowDepth = isCD ? CD_H : sec.profile / 1000;
    const rowsN = lay.rows === 2 ? [-(sec.core - rowDepth / 2), sec.core - rowDepth / 2] : [0];
    const thick = lay.rows === 2 ? rowDepth : sec.core * 2;
    const lo = f0 + STUD_W / 2;
    const hi = f1 - STUD_W / 2;
    const used: number[] = [];
    const boardsOnSide0 = lay.faces.some((f) => f.side === 0);
    for (const st of lay.studs) {
      let u = Math.min(hi, Math.max(lo, st.x));
      // dwa słupki w tym samym miejscu (np. skrzyżowanie) stawiamy obok siebie
      while (used.some((x) => Math.abs(x - u) < STUD_W - 1e-6)) u += u > (f0 + f1) / 2 ? -STUD_W : STUD_W;
      used.push(u);
      const mat: FrameMat = st.kind === 'jamb-ua' ? 'ua' : isCD ? 'cdMain' : 'cw';
      for (const n of rowsN)
        for (const [y0, y1] of st.segments) {
          const v0 = Math.max(y0, TRACK_H);
          const v1 = Math.min(y1, H - TRACK_H);
          // CD w przedściance: środnik od strony płyt; CW/UA: środnik w poprzek ściany
          const web: WebSide = isCD ? (n < 0 || (n === 0 && !boardsOnSide0) ? 'b-' : 'b+') : 'a-';
          if (v1 - v0 > 0.005) box('wallFrame', mat, u - STUD_W / 2, u + STUD_W / 2, v0, v1, n, thick * 0.96, profileFor(mat, 'up', web));
        }
    }
    // --- UW: strop, posadzka (przerwana w drzwiach), nadproża i podokienniki ---
    for (const t of lay.tracks) {
      const y0 = t.kind === 'floor' ? 0 : t.kind === 'ceiling' ? H - TRACK_H : t.kind === 'header' ? t.y : t.y - TRACK_H;
      // środnik od strony stropu/posadzki; nad otworem od dołu, pod podokiennikiem od góry
      const web: WebSide = t.kind === 'floor' || t.kind === 'header' ? 'a-' : 'a+';
      const tm: FrameMat = isCD ? 'ud' : 'uw';
      for (const n of rowsN) box('wallFrame', tm, t.x0, t.x1, y0, y0 + TRACK_H, n, thick, profileFor(tm, 'along', web));
    }
  }

  // --- ATLAS M-System 3G: łączniki talerzykowe za płytą (strona 0), podłoże po stronie przeciwnej ---
  if (lay?.fixers) {
    const depth = sec.core * 2;
    for (const q of lay.fixers.points) {
      const base: [number, number, number] = [ax + ux * q.x - nx * sec.core, q.y, az + uz * q.x - nz * sec.core];
      parts.push(...fixerParts('wallFrame', base, [nx, 0, nz], depth, w.id));
    }
  }

  // --- Płyty: każda warstwa na swój zakres (narożnik: zachodzi albo dochodzi), otwory wycięte ---
  const openings = wallOpenings(w, L, H);
  const holes: Rect[] = openings.map((o) => ({ x0: o.x0, x1: o.x1, y0: o.sill, y1: o.top }));
  for (const face of lay?.faces ?? []) {
    const n = (face.side === 0 ? 1 : -1) * (sec.core + bt * face.layer + bt / 2);
    for (const pc of face.pieces) {
      if (pc.notches?.length) {
        // wycięcie L/U – jedna płyta z obrysem, bez sztucznych spoin w 3D
        parts.push({
          type: 'panel',
          layer: 'wallBoards',
          mat: `board:${board.id}`,
          origin: [ax, 0, az],
          rotY,
          n,
          thickness: bt,
          loops: pieceOutline(pc),
          area: pieceArea(pc),
          owner: w.id,
        });
        continue;
      }
      for (const r of subtractRects({ x0: pc.x0, x1: pc.x1, y0: pc.y0, y1: pc.y1 }, holes))
        box('wallBoards', `board:${board.id}`, r.x0, r.x1, r.y0, r.y1, n, bt);
    }
  }

  // --- Pasek płyty zamykający czoło wolnego końca ---
  for (const end of ['a', 'b'] as const) {
    const e = contacts.ends.get(`${w.id}:${end}`);
    if (!e?.strip) continue;
    const [s0, s1] = end === 'a' ? [0, e.strip.thickness] : [L - e.strip.thickness, L];
    box('wallBoards', `board:${board.id}`, s0, s1, 0, H, 0, sec.core * 2);
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
  nodes: ReturnType<typeof nodeMap>,
  contacts: ContactModel,
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
  const box = (
    layer: Layer3D,
    mat: MatKey,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    n: number,
    thick: number,
    profile?: ProfileSpec,
  ) => {
    const uc = (u0 + u1) / 2;
    parts.push({
      type: 'box',
      layer,
      mat,
      c: [ax + ux * uc + nx * n, (v0 + v1) / 2, az + uz * uc + nz * n],
      s: [Math.max(0.001, u1 - u0), Math.max(0.001, v1 - v0), thick],
      rotY,
      owner: w.id,
      ...(profile ? { profile } : {}),
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
    // ruszt CD okładziny: pionowe profile i uchwyty ES z tego samego układu co na rysunkach
    if (sys.frame === 'cd-lining') {
      const lay = liningLayout(p, w, l, contacts);
      const [l0, l1] = contacts.linings.get(`${w.id}:${l.side}`) ?? [0, L];
      const n = face + l.side * (depth - CD_H / 2);
      // środnik CD od strony płyt, półki w stronę muru
      const prof = profileFor('cdMain', 'up', l.side > 0 ? 'b+' : 'b-');
      const at = (x: number) => Math.min(l1 - CD_W / 2, Math.max(l0 + CD_W / 2, x));
      for (const st of lay.studs)
        for (const [y0, y1] of st.segments) {
          const v0 = Math.max(y0, TRACK_H);
          const v1 = Math.min(y1, H - TRACK_H);
          if (v1 - v0 > 0.005) box('wallFrame', 'cdMain', at(st.x) - CD_W / 2, at(st.x) + CD_W / 2, v0, v1, n, CD_H, prof);
        }
      // uchwyt ES: blacha na murze (tu wiercimy pod kołek) i dwa ramiona przykręcone do półek CD
      for (const q of lay.brackets?.points ?? []) {
        const u = at(q.x);
        box('wallFrame', 'hanger', u - ES_W / 2, u + ES_W / 2, q.y - ES_H / 2, q.y + ES_H / 2, face + l.side * 0.001, 0.002);
        for (const sgn of [-1, 1]) {
          const x = u + sgn * (CD_W / 2 + 0.001);
          box('wallFrame', 'hanger', x - 0.001, x + 0.001, q.y - ES_H / 2, q.y + ES_H / 2, face + (l.side * depth) / 2, depth);
        }
        // kołek w murze
        parts.push({
          type: 'cyl',
          layer: 'wallFrame',
          mat: 'anchor',
          c: [ax + ux * u + nx * (face - l.side * 0.02), q.y, az + uz * u + nz * (face - l.side * 0.02)],
          axis: [nx * l.side, 0, nz * l.side],
          r: ANCHOR_R,
          len: 0.045,
          owner: w.id,
        });
      }
    }
    // ATLAS M-System 3G: łączniki w siatce z rysunków, talerzyk pod płytą, trzpień w murze
    if (sys.frame === 'point-fix') {
      const [l0, l1] = contacts.linings.get(`${w.id}:${l.side}`) ?? [0, L];
      const grid = pointFixGrid(l0, l1, H, l.studSpacing / 100, (sys.pointSpacing ?? 50) / 100, openings);
      const dn: [number, number, number] = [nx * l.side, 0, nz * l.side];
      for (const q of grid.points) {
        const base: [number, number, number] = [ax + ux * q.x + nx * face, q.y, az + uz * q.x + nz * face];
        parts.push(...fixerParts('wallFrame', base, dn, depth, w.id));
      }
    }
    const sheetLen = pickBoardLength(l.boardId, w.height) / 100;
    const widthM = board.width / 100;
    // w narożniku obrysu okładzina dochodzi do lica sąsiedniej okładziny (model styków)
    const [l0, l1] = contacts.linings.get(`${w.id}:${l.side}`) ?? [0, L];
    for (let layer = 0; layer < sys.layers; layer++) {
      const n = face + l.side * (depth + bt * layer + bt / 2);
      const shift = (layer % 2) * (widthM / 2);
      for (const r of boardSheets(L, H, widthM, sheetLen, shift, holes)) {
        const x0 = Math.max(r.x0, l0);
        const x1 = Math.min(r.x1, l1);
        if (x1 - x0 > 0.001) box('wallBoards', `board:${board.id}`, x0, x1, r.y0, r.y1, n, bt);
      }
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
      // CD: środnik od spodu (do niego mocujemy płyty), półki do góry
      ...(mat === 'hanger' || mat === 'connector' ? {} : { profile: profileFor(mat, 'along', 'a-') }),
    });
  };

  // profile CD: dolne (montażowe) przy płycie, nośne nad nimi w suficie dwupoziomowym
  const grid = ceilingGrid(c, sys);
  const onCD = (g: (typeof grid)[number]) => g.level === 'secondary' || twoLevel || sys.kind === 'one-level' || sys.kind === 'direct';
  const hung = twoLevel || sys.kind === 'one-level' || sys.kind === 'direct';
  for (const g of grid) {
    const isMain = g.level === 'main';
    const y0 = twoLevel && isMain ? yFrame + CD_H : yFrame;
    const mat: FrameMat = isMain ? 'cdMain' : 'cdSec';
    for (const [s0, s1] of g.segments) {
      lineBox(g.axis, g.at, s0, s1, y0, mat);
      // łącznik wzdłużny CD: tuleja 10 cm na styku profili (co 4 m, jak na rysunku)
      if (onCD(g)) for (const sp of splicePositions(s0, s1)) lineBox(g.axis, g.at, sp - 5, sp + 5, y0 - 0.001, 'connector', CD_W + 0.004, CD_H + 0.002);
      if (!isMain || !hung) continue;
      // wieszaki na profilach nośnych – te same miejsca co na rysunku (tu wiercimy w stropie)
      const top = y0 + CD_H;
      const rod = sys.kind === 'direct' ? 0.08 : 0.35;
      for (const along of hangerPositions(s0, s1, sys.hangerSpacing)) lineBox(g.axis, g.at, along - 0.4, along + 0.4, top, 'hanger', 0.008, rod);
    }
  }

  // łączniki na skrzyżowaniach nośnych i montażowych (krzyżowe, jednopoziomowe, UA–CD)
  const mainAxis = grid.find((g) => g.level === 'main')?.axis ?? 'x';
  const secAxis: 'x' | 'y' = mainAxis === 'x' ? 'y' : 'x';
  for (const q of ceilingCrossings(c, sys, grid)) {
    const along = mainAxis === 'x' ? q.x : q.y;
    const at = mainAxis === 'x' ? q.y : q.x;
    if (twoLevel) {
      // łącznik krzyżowy: strzemię nad nośnym, ramiona po bokach do montażowego
      const yTop = yFrame + 2 * CD_H;
      lineBox(mainAxis, at, along - 1.5, along + 1.5, yTop, 'connector', CD_W + 0.006, 0.002);
      for (const sgn of [-1, 1]) lineBox(mainAxis, at + sgn * (CD_W * 50 + 0.2), along - 1.5, along + 1.5, yFrame, 'connector', 0.002, 2 * CD_H);
    } else {
      // jednopoziomowy / UA–CD: dwa łączniki po obu stronach nośnego, na montażowym
      const across = mainAxis === 'x' ? q.y : q.x;
      const atSec = mainAxis === 'x' ? q.x : q.y;
      for (const sgn of [-1, 1]) lineBox(secAxis, atSec, across + sgn * 4.5 - 1.5, across + sgn * 4.5 + 1.5, yFrame + CD_H, 'connector', CD_W + 0.006, 0.002);
    }
  }

  // ATLAS M-System 3G: zamiast profili łączniki – talerzyk nad płytą, trzpień do stropu
  if (sys.kind === 'point-fix') {
    const standoff = sys.fixer ? (sys.fixer.standoff[0] + sys.fixer.standoff[1]) / 2000 : 0.03;
    for (const q of ceilingFixerGrid(c, sys).points) {
      // podłoże = strop nad płytą; walec rysujemy od płyty w górę, więc baza to strop, kierunek w dół
      parts.push(...fixerParts('ceilingFrame', [q.x / 100, yFrame + standoff, q.y / 100], [0, -1, 0], standoff, c.id));
    }
    return;
  }

  // UD przyścienny po obwodzie
  const edges = polygonPerimeterEdges(pts);
  // UD: środnik przy ścianie (na zewnątrz obrysu), półki do wnętrza
  let signed = 0;
  pts.forEach((p0, i) => {
    const p1 = pts[(i + 1) % pts.length];
    signed += p0.x * p1.y - p1.x * p0.y;
  });
  const udWeb: WebSide = signed > 0 ? 'b-' : 'b+';
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
      profile: profileFor('ud', 'along', udWeb),
    });
  });
}

/** Model 3D projektu; `_calc` zostaje dla zgodności wywołań – układ rusztu liczy się z tych samych funkcji co rysunki */
export function buildModel3D(p: Project, _calc?: ProjectCalc): Model3D {
  const parts: Part3D[] = [];
  const nodes = nodeMap(p);
  const rooms = existingRooms(p);
  const contacts = buildContacts(p);
  const junctions = analyzeJunctions(p);
  for (const w of p.walls) {
    if (!nodes.has(w.a) || !nodes.has(w.b)) continue;
    if (isNewWall(w)) buildWall(p, w, nodes, contacts, junctions, parts);
    else buildExistingWall(p, w, masonrySide(p, w, rooms), nodes, contacts, parts);
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
    else if (pt.type === 'cyl') grow(pt.c[0], pt.c[1], pt.c[2]);
    else if (pt.type === 'panel') {
      const c = Math.cos(pt.rotY);
      const sn = Math.sin(pt.rotY);
      for (const q of pt.loops[0] ?? []) grow(pt.origin[0] + q.x * c, q.y, pt.origin[2] - q.x * sn);
    } else for (const q of pt.points) grow(q.x, pt.y + pt.thickness, q.y);
  }
  if (!parts.length) {
    min[0] = min[2] = -2;
    max[0] = max[2] = 2;
    max[1] = 2.6;
  }
  return { parts, bounds: { min, max } };
}
