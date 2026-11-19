// Budowa modelu 3D zabudowy z danych projektu – czysta geometria bez three.js,
// dzięki czemu da się ją testować w Node. Wszystko w metrach.
// Układ osi (jak w three.js): x = x planu, z = y planu, y = wysokość od posadzki.

import { HAT_MM, HAT_W, boardById, ceilingSystemById, isHatCeiling, isHungCeiling, wallFrameDepth, wallSystemById } from '../catalog/rigips';
import { ceilingCrossings, ceilingFixerGrid, ceilingGrid, pickBoardLength, type ProjectCalc } from '../calc/materials';
import { ceilingLevels } from '../calc/ceilingLevels';
import { ceilingVaporSpec, vaporBarrierOn, wallVaporSpec } from '../calc/vaporBarrier';
import { HAT_FLANGE, hangerPositions, hatFixPositions, liningLayout, pieceArea, pieceOutline, splicePositions, wallLayout } from '../calc/layout';
import { STUD_W, buildContacts, partRange, wallSection, type ContactModel } from '../geometry/contacts';
import { analyzeJunctions, existingRooms, isNewWall, masonryEndExtension, masonrySide, nodeMap, polygonPerimeterEdges, wallEnds } from '../geometry/geometry';
import type { Attic, Ceiling, Point, Project, Wall } from '../model/types';
import { atticGrid } from '../calc/attic';
import { atticPlacements } from '../calc/atticPlan';
import { layerBoards } from '../calc/ceilingLevels';
import { profileFor, type ProfileSpec, type WebSide } from './profiles';
import { rowSegments } from '../calc/boardLength';

/** Warstwy, które można przełączać w widoku */
export type Layer3D = 'existing' | 'wallBoards' | 'wallFrame' | 'ceilingBoards' | 'ceilingFrame';

/** Materiały elementów rusztu; płyty mają klucz `board:<id>` */
export type FrameMat = 'cw' | 'uw' | 'ua' | 'cdMain' | 'cdSec' | 'ud' | 'hanger' | 'connector' | 'masonry' | 'disc' | 'anchor' | 'vapor' | 'timber';
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
  /** Pochylenie wokół osi długości elementu (skosy poddasza), rad; stosowane przed obrotem `rotY` */
  rotX?: number;
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
    const rows = rowSegments(H, sheetLenM, i % 2 === 1);
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
    const isCD = sys.frame === 'cd-lining' || sys.frame === 'hat-lining';
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

  // --- Obudowa z samych płyt: profil obwodowy (kątownik 40 mm) przy ścianach, w Rigips też przy posadzce i stropie ---
  if (lay && sys.frame === 'panel') {
    const a = 0.04;
    // za płytami (strona szachtu), półka przy murze
    const n = -sec.core - a / 2;
    box('wallFrame', 'uw', f0, f0 + 0.002, 0, H, n, a);
    box('wallFrame', 'uw', f1 - 0.002, f1, 0, H, n, a);
    if (sys.panel?.edgeSides === 'all') for (const y of [0, H - 0.002]) box('wallFrame', 'uw', f0, f1, y, y + 0.002, n, a);
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
    // grubość warstwy po swojej stronie (ściany z innym poszyciem stron), płyta tej warstwy
    const bt = sec.bt[face.side];
    const fb = face.board ?? board.id;
    const n = (face.side === 0 ? 1 : -1) * (sec.core + bt * face.layer + bt / 2);
    for (const pc of face.pieces) {
      if (pc.notches?.length) {
        // wycięcie L/U – jedna płyta z obrysem, bez sztucznych spoin w 3D
        parts.push({
          type: 'panel',
          layer: 'wallBoards',
          mat: `board:${fb}`,
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
        box('wallBoards', `board:${fb}`, r.x0, r.x1, r.y0, r.y1, n, bt);
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
  // narożnik obrysu: w wypukłym mur przedłużony do zewnętrznego lica drugiej ściany, w wklęsłym kończy się w węźle
  const e0 = (masonryEndExtension(p, w, 'a', inner, nodes) ?? 0) / 100;
  const e1 = (masonryEndExtension(p, w, 'b', inner, nodes) ?? 0) / 100;
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
      // ruszt tylko na murze (w narożniku wklęsłym okładzina wychodzi za węzeł samymi płytami)
      const at = (x: number) => Math.min(Math.min(l1, L) - CD_W / 2, Math.max(Math.max(l0, 0) + CD_W / 2, x));
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
    // profile kapeluszowe: pionowe profile i odcinki nad / pod otworami wprost na murze, kołki przez półki
    if (sys.frame === 'hat-lining') {
      const lay = liningLayout(p, w, l, contacts);
      const [l0, l1] = contacts.linings.get(`${w.id}:${l.side}`) ?? [0, L];
      const hatH = HAT_MM / 1000;
      const n = face + l.side * (hatH / 2);
      const at = (x: number) => Math.min(Math.min(l1, L) - HAT_W / 2, Math.max(Math.max(l0, 0) + HAT_W / 2, x));
      for (const st of lay.studs)
        for (const [y0, y1] of st.segments) if (y1 - y0 > 0.005) box('wallFrame', 'cdMain', at(st.x) - HAT_W / 2, at(st.x) + HAT_W / 2, y0, y1, n, hatH);
      for (const t of lay.tracks) {
        const y0 = t.kind === 'header' ? t.y : t.y - HAT_W;
        box('wallFrame', 'cdMain', t.x0, t.x1, y0, y0 + HAT_W, n, hatH);
      }
      for (const q of lay.brackets?.points ?? []) {
        const u = Math.min(Math.min(l1, L) - 0.01, Math.max(Math.max(l0, 0) + 0.01, q.x));
        parts.push({
          type: 'cyl',
          layer: 'wallFrame',
          mat: 'anchor',
          c: [ax + ux * u + nx * (face - l.side * 0.015), q.y, az + uz * u + nz * (face - l.side * 0.015)],
          axis: [nx * l.side, 0, nz * l.side],
          r: ANCHOR_R,
          len: 0.045,
          owner: w.id,
        });
      }
    }
    // ATLAS M-System 3G: łączniki w siatce z rysunków, talerzyk pod płytą, trzpień w murze
    if (sys.frame === 'point-fix') {
      const grid = liningLayout(p, w, l, contacts).fixers ?? { points: [] };
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
    // paroizolacja między rusztem a płytami (warstwa rusztu – widoczna po ukryciu płyt)
    if (vaporBarrierOn(l.vaporBarrier, wallVaporSpec(sys))) {
      const [v0, v1] = contacts.linings.get(`${w.id}:${l.side}`) ?? [0, L];
      for (const r of subtractRects({ x0: v0, x1: v1, y0: 0, y1: H }, holes)) box('wallFrame', 'vapor', r.x0, r.x1, r.y0, r.y1, face + l.side * (depth - VAPOR_T / 2), VAPOR_T);
    }
    for (let layer = 0; layer < sys.layers; layer++) {
      const n = face + l.side * (depth + bt * layer + bt / 2);
      const shift = (layer % 2) * (widthM / 2);
      for (const r of boardSheets(L, H, widthM, sheetLen, shift, holes)) {
        // płyta skrajna wychodzi za węzeł, gdy okładzina zakrywa czoło okładziny sąsiedniej
        const x0 = r.x0 <= 1e-6 ? l0 : Math.max(r.x0, l0);
        const x1 = r.x1 >= L - 1e-6 ? l1 : Math.min(r.x1, l1);
        if (x1 - x0 > 0.001) box('wallBoards', `board:${board.id}`, x0, x1, r.y0, r.y1, n, bt);
      }
    }
  }
}

/** Grubość folii w 3D, m (rysunkowa – żeby była widoczna) */
const VAPOR_T = 0.002;

function buildCeiling(c: Ceiling, parts: Part3D[]) {
  if (c.points.length < 3) return;
  const sys = ceilingSystemById(c.systemId);
  const board = boardById(c.boardId);
  const bt = board.thickness / 1000;
  // te same poziomy co w ilościach i na przekroju: spód płyt, ruszt, zwieszenie do stropu
  const lv = ceilingLevels(c, sys);
  const yb = lv.ceiling / 100;
  const gap = lv.hangerGap / 100;
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

  // paroizolacja na płytach, pod rusztem (warstwa rusztu – widoczna po ukryciu płyt)
  if (vaporBarrierOn(c.vaporBarrier, ceilingVaporSpec(sys)))
    parts.push({ type: 'slab', layer: 'ceilingFrame', mat: 'vapor', points: pts, y: yb + bt * sys.layers, thickness: VAPOR_T, owner: c.id });

  const yFrame = lv.frameBottom / 100;
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

  // profile kapeluszowe wprost na stropie: profil 15 mm nad płytą, dyble przez obie półki na przemian, bez UD
  if (isHatCeiling(sys)) {
    const hatH = HAT_MM / 1000;
    for (const g of ceilingGrid(c, sys))
      for (const [s0, s1] of g.segments) {
        const a = g.at / 100;
        const mid = (s0 + s1) / 200;
        parts.push({
          type: 'box',
          layer: 'ceilingFrame',
          mat: 'cdMain',
          c: g.axis === 'x' ? [mid, yFrame + hatH / 2, a] : [a, yFrame + hatH / 2, mid],
          s: [Math.max(0.001, (s1 - s0) / 100), hatH, HAT_W],
          rotY: g.axis === 'x' ? 0 : -Math.PI / 2,
          owner: c.id,
        });
        for (const q of hatFixPositions(s0 / 100, s1 / 100, sys.hangerSpacing / 100)) {
          const across = a + q.side * HAT_FLANGE;
          const pos: [number, number, number] = g.axis === 'x' ? [q.at, yFrame + hatH, across] : [across, yFrame + hatH, q.at];
          parts.push({ type: 'cyl', layer: 'ceilingFrame', mat: 'anchor', c: [pos[0], pos[1] + 0.015, pos[2]], axis: [0, 1, 0], r: ANCHOR_R, len: 0.04, owner: c.id });
        }
      }
    return;
  }

  // profile CD: dolne (montażowe) przy płycie, nośne nad nimi w suficie dwupoziomowym
  const grid = ceilingGrid(c, sys);
  const onCD = (g: (typeof grid)[number]) => !sys.profiles && (g.level === 'secondary' || isHungCeiling(sys.kind));
  const hung = isHungCeiling(sys.kind);
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
      // wieszak sięga stropu (tam kotwa); uchwyt bezpośredni min. 1 cm, żeby był widoczny
      const rod = Math.max(sys.kind === 'direct' ? 0.01 : 0.03, gap);
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
    const standoff = Math.max(0.005, lv.slab / 100 - yFrame);
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

const JETKA_H = 0.14;

/**
 * Poddasze w 3D: kalenica wzdłuż osi x, przekrój w płaszczyźnie (z, y). Krokwie i jętki, wieszaki,
 * profile CD w poprzek krokwi, UD na ścianach szczytowych, folia i płyty na skosach oraz suficie –
 * z tej samej siatki co rysunki i zestawienie. `origin` = narożnik na planie, cm.
 */
export function buildAttic(a: Attic, parts: Part3D[], origin: Point = { x: 0, y: 0 }) {
  const first = parts.length;
  const z0 = 0;
  const sys = ceilingSystemById(a.systemId);
  const grid = atticGrid(a, sys);
  const L = a.length / 100;
  const rw = a.rafterWidth / 100;
  const rh = a.rafterHeight / 100;
  const depth = grid.depthMm / 1000;
  const boards = layerBoards(sys, a.boardId).map((id) => ({ id, t: boardById(id).thickness / 1000 }));
  const tb = boards.reduce((t, b) => t + b.t, 0);
  const vapor = vaporBarrierOn(a.vaporBarrier, ceilingVaporSpec(sys));

  /** Układ płaszczyzny: p0 → p1 w stronę rosnącego z, normalna na zewnątrz (ku krokwiom) */
  const frame = (p: { x: number; z: number }, q: { x: number; z: number }) => {
    const [lo, hi] = p.x <= q.x ? [p, q] : [q, p];
    const dz = (hi.x - lo.x) / 100;
    const dy = (hi.z - lo.z) / 100;
    const run = Math.hypot(dz, dy);
    const rotX = Math.atan2(-dy, dz);
    // punkt w odległości k od p0 wzdłuż płaszczyzny i h na zewnątrz
    const at = (k: number, h: number): [number, number] => [lo.z / 100 + (dy / run) * k + (dz / run) * h, z0 + lo.x / 100 + (dz / run) * k - (dy / run) * h];
    return { run, rotX, at, flipped: lo !== p };
  };
  const tilted = (layer: Layer3D, mat: MatKey, f: ReturnType<typeof frame>, x: number, k: number, h: number, s: [number, number, number]) => {
    const [y, z] = f.at(k, h);
    parts.push({ type: 'box', layer, mat, c: [x, y, z], s, rotY: 0, rotX: f.rotX, owner: a.id });
  };

  // ruszt: CD 60, profil kapeluszowy, C RIGISTIL albo łata – wysokość z katalogu, szerokość wg produktu
  const fr = grid.frame;
  const between = fr.mount === 'between';
  const timber = grid.profile.startsWith('LATA');
  const pH = grid.profileMm / 1000;
  const pW = timber ? (grid.profile === 'LATA5030' ? 0.05 : 0.06) : grid.profile === 'KAPELUSZ' ? 0.08 : CD_W;
  const carrier = grid.carrier;
  // ruszt krzyżowy: profile pod płyty to „montażowe”, nośne biegną pod krokwiami
  const pMat: MatKey = timber ? 'timber' : carrier ? 'cdSec' : 'cdMain';
  const cH = (carrier?.mm ?? 0) / 1000;
  const cW = carrier?.product === 'MFCP44' ? 0.03 : CD_W;
  const cdShape = !timber && grid.profile !== 'KAPELUSZ' ? { profile: profileFor(pMat, 'along', 'a-') } : {};
  // więźba widoczna: płyty i ruszt osobno w każdym polu między krokwiami
  const spans = between ? grid.bays.map((bay) => ({ x: (bay.u + bay.w / 2) / 100, w: bay.w / 100 })) : [{ x: L / 2, w: L }];

  for (const g of grid.surfaces) {
    const f = frame(g.surface.a, g.surface.b);
    // płyty: kolejne warstwy od lica w stronę rusztu
    let h = 0;
    for (const b of [...boards].reverse()) {
      for (const sp of spans) tilted('ceilingBoards', `board:${b.id}`, f, sp.x, f.run / 2, h + b.t / 2, [sp.w, b.t, f.run]);
      h += b.t;
    }
    if (vapor) for (const sp of spans) tilted('ceilingFrame', 'vapor', f, sp.x, f.run / 2, tb + VAPOR_T / 2, [sp.w, VAPOR_T, f.run]);
    for (const s of g.cd) {
      const k = (f.flipped ? g.surface.run - s : s) / 100;
      const [y, z] = f.at(k, tb + pH / 2);
      for (const sp of spans)
        parts.push({ type: 'box', layer: 'ceilingFrame', mat: pMat, c: [sp.x, y, z], s: [sp.w, pH, pW], rotY: 0, rotX: f.rotX, owner: a.id, ...cdShape });
      // wieszak przy boku krokwi: od profilu do krokwi
      if (fr.hanger && !carrier) {
        const hh = Math.max(0.03, depth - tb + 0.04);
        for (const u of g.hangerU) tilted('ceilingFrame', 'hanger', f, u / 100 + rw / 2 + 0.002, k, tb + hh / 2, [0.004, hh, ES_W]);
      }
    }
    if (carrier) {
      // profile nośne pod każdą krokwią, nad profilami pod płyty; wieszaki na nośnych przy boku krokwi
      const hh = Math.max(0.03, depth - tb - pH + 0.04);
      for (const u of g.hangerU) {
        tilted('ceilingFrame', 'cdMain', f, u / 100, f.run / 2, tb + pH + cH / 2, [cW, cH, f.run]);
        for (const s of g.fixS) {
          const k = (f.flipped ? g.surface.run - s : s) / 100;
          tilted('ceilingFrame', 'hanger', f, u / 100 + rw / 2 + 0.002, k, tb + pH + hh / 2, [0.004, hh, ES_W]);
        }
      }
    }
    if (between) {
      // elementy wzdłuż krokwi po obu stronach pola
      const sW = fr.edge ? UD_W : pW;
      for (const sp of spans)
        for (const x of [sp.x - sp.w / 2 + sW / 2, sp.x + sp.w / 2 - sW / 2]) tilted('ceilingFrame', fr.edge ? 'ud' : pMat, f, x, f.run / 2, tb + pH / 2, [sW, pH, f.run]);
    } else if (fr.edge) {
      // profil przyścienny na ścianach szczytowych
      for (const x of [UD_W / 2, L - UD_W / 2]) tilted('ceilingFrame', 'ud', f, x, f.run / 2, tb + pH / 2, [UD_W, pH, f.run]);
    }
  }

  // konstrukcja dachu: krokwie od ścianki kolankowej do kalenicy, jętki nad sufitem
  const st = grid.structure;
  const ridge = { x: st.ridgeX, z: st.ridgeHeight };
  const slopes: ReturnType<typeof frame>[] = [];
  if (st.ridgeX > 1) slopes.push(frame({ x: 0, z: a.kneeLeft }, ridge));
  if (a.roof !== 'mono' && st.ridgeX < a.width - 1) slopes.push(frame({ x: a.width, z: a.kneeRight }, ridge));
  const collar = st.surfaces.find((s) => s.kind === 'collar');
  for (const u of grid.rafters) {
    for (const f of slopes) tilted('existing', 'timber', f, u / 100, f.run / 2, rh / 2, [rw, rh, f.run]);
    if (collar)
      parts.push({ type: 'box', layer: 'existing', mat: 'timber', c: [u / 100 + rw, (collar.a.z / 100) + JETKA_H / 2, z0 + (collar.a.x + collar.b.x) / 200], s: [rw * 0.6, JETKA_H, collar.run / 100], rotY: 0, owner: a.id });
  }
  // ścianki kolankowe i wyższa ściana dachu jednospadowego (mur)
  const wallT = 0.25;
  const masonry = (zc: number, hgt: number) => {
    if (hgt > 0.01) parts.push({ type: 'box', layer: 'existing', mat: 'masonry', c: [L / 2, hgt / 2, z0 + zc], s: [L, hgt, wallT], rotY: 0, owner: a.id });
  };
  masonry(-wallT / 2, a.kneeLeft / 100);
  masonry(a.width / 100 + wallT / 2, (a.roof === 'mono' ? st.ridgeHeight : a.kneeRight) / 100);
  // położenie na planie: obrót kalenicy o 90° (x' = szerokość − z, z' = x) i przesunięcie do narożnika
  const W = a.width / 100;
  for (let i = first; i < parts.length; i++) {
    const b = parts[i] as BoxPart;
    if (a.planRot === 90) {
      b.c = [W - b.c[2], b.c[1], b.c[0]];
      b.rotY -= Math.PI / 2;
    }
    b.c[0] += origin.x / 100;
    b.c[2] += origin.y / 100;
  }
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
  // poddasza w tym samym miejscu co na planie
  const spots = atticPlacements(p);
  for (const a of p.attics ?? []) {
    buildAttic(a, parts, spots.get(a.id));
  }

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
    if (pt.type === 'box' && pt.rotX) {
      // element pochylony: zakres po osi długości i po rzucie pochylonej szerokości
      const hy = (Math.abs(Math.sin(pt.rotX)) * pt.s[2]) / 2;
      const hz = (Math.abs(Math.cos(pt.rotX)) * pt.s[2]) / 2;
      // po obrocie w planie o 90° oś długości leży wzdłuż z
      const turned = Math.abs(Math.sin(pt.rotY)) > 0.5;
      const hx = turned ? hz : pt.s[0] / 2;
      const hzz = turned ? pt.s[0] / 2 : hz;
      grow(pt.c[0] - hx, pt.c[1] + hy, pt.c[2] - hzz);
      grow(pt.c[0] + hx, pt.c[1] + hy, pt.c[2] + hzz);
    } else if (pt.type === 'box') grow(pt.c[0], pt.c[1] + pt.s[1] / 2, pt.c[2]);
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
