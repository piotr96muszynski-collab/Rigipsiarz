// Rozkład płyt na płaszczyznach poddasza (skosy, sufit pod jętkami) – jedno źródło dla rysunków,
// widoku 3D i listy zakupów (tak jak `wallLayout` dla ścian i `ceilingBoardLayout` dla sufitów).
//
// Układ płaszczyzny jak w `attic.ts`: u wzdłuż kalenicy od ściany szczytowej, s po skosie od dolnej
// krawędzi (sufit: od lewej krawędzi), cm. Ruszt pod płyty (CD, kapeluszowe, łaty, poprzeczki między
// krokwiami) biegnie wzdłuż u w odległościach `cd` – płyty leżą dłuższą krawędzią w poprzek rusztu
// (wzdłuż krokwi), a styki krótkich krawędzi wypadają zawsze na elemencie rusztu.

import { boardById, ceilingSystemById, layerBoards, type CeilingSystem } from '../catalog/rigips';
import type { Attic } from '../model/types';
import { atticGrid, type AtticGrid, type AtticSurfaceId } from './attic';
import { MIN_STRIP_M, pickBoardLengthCm } from './boardLength';

/** Najwęższy / najkrótszy element płyty, cm (jak dostawki na ścianach) */
export const ATTIC_MIN_PIECE = MIN_STRIP_M * 100;
/** Najmniejsze przesunięcie styków krótkich krawędzi w sąsiednich pasach i warstwach, cm */
export const ATTIC_STAGGER = 40;

export interface AtticBoardPiece {
  /** prostokąt w układzie płaszczyzny, cm */
  u0: number;
  u1: number;
  s0: number;
  s1: number;
  /** element docinany (węższy albo krótszy niż arkusz) */
  cut: boolean;
  /** wycięcia w elemencie (okna dachowe), w tym samym układzie */
  notches?: AtticRect[];
}

export interface AtticRect {
  u0: number;
  u1: number;
  s0: number;
  s1: number;
}

/** Otwór w zabudowie (okno dachowe) na danej płaszczyźnie – płyt w nim nie ma */
export interface AtticHole extends AtticRect {
  surfaceId: AtticSurfaceId;
}

/** Powierzchnia elementu po wycięciach, cm² */
export const atticPieceArea = (p: AtticBoardPiece) =>
  (p.u1 - p.u0) * (p.s1 - p.s0) - (p.notches ?? []).reduce((t, n) => t + (n.u1 - n.u0) * (n.s1 - n.s0), 0);

export interface AtticBoardLayer {
  /** 0 = warstwa przy ruszcie, ostatnia = lico */
  layer: number;
  boardId: string;
  /** długość arkusza, cm */
  sheetLen: number;
  /** szerokość arkusza, cm */
  sheetW: number;
  pieces: AtticBoardPiece[];
}

export interface AtticSurfaceBoards {
  id: AtticSurfaceId;
  layers: AtticBoardLayer[];
}

export interface AtticSheetUse {
  boardId: string;
  sheetLen: number;
  /** arkusze potrzebne do wycięcia wszystkich elementów (z wykorzystaniem resztek ≥ 30 cm) */
  sheets: number;
  /** powierzchnia elementów, m² */
  netM2: number;
  /** resztki węższe lub krótsze niż 30 cm – do niczego się już nie nadają, m² */
  wasteM2: number;
}

export interface AtticBoards {
  surfaces: AtticSurfaceBoards[];
  sheets: AtticSheetUse[];
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Podział odcinka a..b na pasy szerokości `first`, potem `step`; ostatni pas węższy niż 30 cm
 * zastępuje się skróceniem poprzedniego (jak dostawki na ścianach), za mało na dwa – jeden pas.
 */
export function splitStrips(a: number, b: number, first: number, step: number, min = ATTIC_MIN_PIECE): number[] {
  const cuts = [a];
  let x = a;
  let len = Math.min(first, step);
  while (x < b - 0.5) {
    x = Math.min(b, x + len);
    cuts.push(r1(x));
    len = step;
  }
  cuts[cuts.length - 1] = b;
  const k = cuts.length;
  if (k >= 3) {
    const rest = cuts[k - 1] - cuts[k - 2];
    const prev = cuts[k - 2] - cuts[k - 3];
    if (rest < min - 0.5) {
      if (prev + rest < 2 * min) cuts.splice(k - 2, 1);
      else cuts[k - 2] = r1(cuts[k - 1] - min);
    }
  }
  // pierwszy pas węższy niż 30 cm (przesunięcie warstwy) – łączymy z następnym albo dzielimy po równo
  if (cuts.length >= 3 && cuts[1] - cuts[0] < min - 0.5) {
    const next = cuts[2] - cuts[0];
    if (next < 2 * min) cuts.splice(1, 1);
    else cuts[1] = r1(cuts[0] + min);
  }
  return cuts;
}

/**
 * Styki krótkich krawędzi w jednym pasie płyt: każdy na elemencie rusztu (`supports`), element
 * co najwyżej długości arkusza, żaden kawałek krótszy niż 30 cm (wtedy poprzednia płyta jest krótsza),
 * styki co najmniej 40 cm od styków w `avoid` (sąsiedni pas / warstwa) – o ile się da.
 */
export function rowJoints(run: number, sheet: number, supports: number[], avoid: number[] = [], min = ATTIC_MIN_PIECE, avoidMore: number[] = []): number[] {
  const out: number[] = [];
  let s = 0;
  let guard = 0;
  while (run - s > sheet + 0.5 && guard++ < 100) {
    const far = (list: number[], e: number) => list.every((j) => Math.abs(j - e) >= ATTIC_STAGGER - 0.5);
    const ok = (e: number, lists: number[][]) => e > s + min - 0.5 && e <= s + sheet + 0.5 && run - e >= min - 0.5 && lists.every((l) => far(l, e));
    // najpierw z dala od wszystkich styków obok, potem tylko od sąsiedniego pasa, w ostateczności byle na ruszcie
    const pick = (lists: number[][]) => supports.filter((e) => ok(e, lists)).pop();
    const e = pick([avoid, avoidMore]) ?? pick([avoid]) ?? pick([]) ?? Math.min(s + sheet, run - min);
    out.push(r1(e));
    s = e;
  }
  return out;
}

/** Pasy płyt wzdłuż kalenicy: pełna szerokość arkusza, a przy więźbie widocznej w każdym polu osobno */
function columns(L: number, grid: AtticGrid, sheetW: number, layer: number): [number, number][] {
  const out: [number, number][] = [];
  const spans = grid.frame.mount === 'between' ? grid.bays.map((b) => [b.u, b.u + b.w] as const) : [[0, L] as const];
  for (const [a, b] of spans) {
    // kolejna warstwa przesunięta o pół arkusza – styki długich krawędzi się mijają
    const first = layer % 2 === 1 && b - a > sheetW + 0.5 ? sheetW / 2 : sheetW;
    const cuts = splitStrips(a, b, first, sheetW);
    for (let i = 0; i + 1 < cuts.length; i++) out.push([cuts[i], cuts[i + 1]]);
  }
  return out;
}

/** Rozkład płyt jednej płaszczyzny, wszystkie warstwy (płaszczyzna prostokątna: długość poddasza × run) */
function surfaceBoards(a: Attic, grid: AtticGrid, gi: number, boards: string[], holes: AtticHole[]): AtticSurfaceBoards {
  const g = grid.surfaces[gi];
  const run = g.surface.run;
  // elementy rusztu, na których może wypaść styk (bez skrajnych przy samej krawędzi)
  const supports = g.cd.filter((s) => s > 0.5 && s < run - 0.5);
  const layers: AtticBoardLayer[] = [];
  // wzory styków: A w parzystych pasach, B (przesunięty względem A) w nieparzystych; kolejna warstwa
  // omija styki poprzedniej (pasy przesunięte o pół arkusza leżą nad oboma wzorami)
  let prev: number[] = [];
  boards.forEach((boardId, layer) => {
    const b = boardById(boardId);
    const sheetLen = pickBoardLengthCm(boardId, run);
    const sheetW = b.width;
    const A = rowJoints(run, sheetLen, supports, prev);
    const B = rowJoints(run, sheetLen, supports, A, ATTIC_MIN_PIECE, prev);
    const cols = columns(a.length, grid, sheetW, layer);
    const pieces: AtticBoardPiece[] = [];
    cols.forEach(([u0, u1], i) => {
      const joints = i % 2 === 0 ? A : B;
      const cuts = [0, ...joints, run];
      for (let k = 0; k + 1 < cuts.length; k++) {
        const s0 = cuts[k];
        const s1 = cuts[k + 1];
        const pc: AtticBoardPiece = { u0, u1, s0, s1, cut: u1 - u0 < sheetW - 0.5 || s1 - s0 < sheetLen - 0.5 };
        const notches = holes
          .filter((h) => h.surfaceId === g.surface.id)
          .map((h) => ({ u0: Math.max(pc.u0, h.u0), u1: Math.min(pc.u1, h.u1), s0: Math.max(pc.s0, h.s0), s1: Math.min(pc.s1, h.s1) }))
          .filter((n) => n.u1 - n.u0 > 0.5 && n.s1 - n.s0 > 0.5);
        if (notches.length) {
          // element w całości w otworze – nie ma go
          if (atticPieceArea({ ...pc, notches }) < 1) continue;
          pc.notches = notches;
          pc.cut = true;
        }
        pieces.push(pc);
      }
    });
    layers.push({ layer, boardId, sheetLen, sheetW, pieces });
    prev = [...A, ...B];
  });
  return { id: g.surface.id, layers };
}

interface Seg {
  len: number;
  /** zajęta szerokość */
  used: number;
  /** długości elementów w pasach tego odcinka */
  lanes: { w: number; l: number }[];
}

/**
 * Rozkrój elementów z arkuszy (cięcia gilotynowe): arkusz dzieli się w poprzek na odcinki, odcinek
 * wzdłuż na pasy. Najdłuższe elementy najpierw, resztka trafia do następnego elementu, jeśli się zmieści.
 * Odpad = resztki węższe albo krótsze niż 30 cm; większe zostają na budowie jako docinki.
 */
export function cutSheets(pieces: { w: number; l: number }[], sheetW: number, sheetLen: number, min = ATTIC_MIN_PIECE): { sheets: number; wasteCm2: number } {
  const sheets: Seg[][] = [];
  const sorted = [...pieces].map((p) => ({ w: Math.min(p.w, sheetW), l: Math.min(p.l, sheetLen) })).sort((x, y) => y.l - x.l || y.w - x.w);
  for (const p of sorted) {
    let placed = false;
    // 1) obok innego elementu w istniejącym odcinku
    for (const sh of sheets) {
      const seg = sh.find((g) => g.len + 0.05 >= p.l && sheetW - g.used + 0.05 >= p.w);
      if (seg) {
        seg.used += p.w;
        seg.lanes.push(p);
        placed = true;
        break;
      }
    }
    if (placed) continue;
    // 2) nowy odcinek w resztce arkusza
    for (const sh of sheets) {
      const left = sheetLen - sh.reduce((t, g) => t + g.len, 0);
      if (left + 0.05 >= p.l) {
        sh.push({ len: p.l, used: p.w, lanes: [p] });
        placed = true;
        break;
      }
    }
    if (!placed) sheets.push([{ len: p.l, used: p.w, lanes: [p] }]);
  }
  let waste = 0;
  for (const sh of sheets) {
    const tail = sheetLen - sh.reduce((t, g) => t + g.len, 0);
    if (tail > 0.05 && tail < min - 0.05) waste += tail * sheetW;
    for (const g of sh) {
      const side = sheetW - g.used;
      if (side > 0.05 && side < min - 0.05) waste += side * g.len;
      for (const ln of g.lanes) {
        const d = g.len - ln.l;
        if (d > 0.05 && d < min - 0.05) waste += d * ln.w;
      }
    }
  }
  return { sheets: sheets.length, wasteCm2: waste };
}

/** Rozkład płyt całego poddasza i rozkrój arkuszy (lista zakupów) */
export function atticBoardLayout(
  a: Attic,
  sys: CeilingSystem = ceilingSystemById(a.systemId),
  grid: AtticGrid = atticGrid(a, sys),
  holes: AtticHole[] = [],
): AtticBoards {
  const boards = layerBoards(sys, a.boardId);
  const surfaces = grid.surfaces.map((_, i) => surfaceBoards(a, grid, i, boards, holes));
  const groups = new Map<string, { boardId: string; sheetLen: number; sheetW: number; pieces: { w: number; l: number }[]; net: number }>();
  for (const s of surfaces)
    for (const l of s.layers) {
      const key = `${l.boardId}|${l.sheetLen}`;
      const gr = groups.get(key) ?? groups.set(key, { boardId: l.boardId, sheetLen: l.sheetLen, sheetW: l.sheetW, pieces: [], net: 0 }).get(key)!;
      for (const p of l.pieces) {
        gr.pieces.push({ w: p.u1 - p.u0, l: p.s1 - p.s0 });
        gr.net += atticPieceArea(p);
      }
    }
  const sheets: AtticSheetUse[] = [];
  for (const gr of groups.values()) {
    const { sheets: n, wasteCm2 } = cutSheets(gr.pieces, gr.sheetW, gr.sheetLen);
    sheets.push({ boardId: gr.boardId, sheetLen: gr.sheetLen, sheets: n, netM2: gr.net / 10000, wasteM2: wasteCm2 / 10000 });
  }
  const warnings: string[] = [];
  const unsupported = surfaces.some((s, i) => {
    const g = grid.surfaces[i];
    return s.layers.some((l) => l.pieces.some((p) => p.s0 > 0.5 && !g.cd.some((c) => Math.abs(c - p.s0) < 0.6)));
  });
  if (unsupported) warnings.push('Część styków płyt na poddaszu nie trafia na element rusztu – dodaj pod nimi profil albo zmień długość arkusza.');
  return { surfaces, sheets, warnings };
}
