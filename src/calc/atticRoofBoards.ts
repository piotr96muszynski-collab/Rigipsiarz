// Rozkład płyt na połaciach poddasza z narożnikami dachu i koszami – płaszczyzny o dowolnym obrysie
// (trapezy, trójkąty, połacie z wyciętym koszem). Te same zasady co `atticBoards.ts` dla skosów
// prostokątnych: płyty dłuższą krawędzią wzdłuż krokwi (w poprzek rusztu), pasy szerokości arkusza
// wzdłuż profili, styki krótkich krawędzi na profilu rusztu i przesunięte o min. 40 cm, kolejna
// warstwa przesunięta o pół arkusza. Każdy element to prostokąt pasa przycięty do obrysu połaci –
// przy narożniku i koszu płyta docięta pod kątem.
//
// Układ połaci jak w `atticRoof.ts`: t wzdłuż profili rusztu (`e`), s po skosie od dolnej krawędzi, cm.
// Jedno źródło dla rysunków, widoku 3D i listy zakupów.

import { boardById, ceilingSystemById, layerBoards, type CeilingSystem } from '../catalog/rigips';
import type { Attic } from '../model/types';
import type { AtticGrid, AtticRoofFaceGrid, AtticRoofGrid } from './attic';
import { ATTIC_MIN_PIECE, cutSheets, rowJoints, splitStrips, type AtticSheetUse } from './atticBoards';
import { planToFace, type P2, type RoofFace } from './atticRoof';
import { pickBoardLengthCm } from './boardLength';

/** Punkt na połaci: t wzdłuż profili, s po skosie od dolnej krawędzi, cm */
export interface TS {
  t: number;
  s: number;
}

export interface RoofRect {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
}

export interface RoofBoardPiece extends RoofRect {
  /** Obrys elementu po docięciu do połaci i wycięciu otworów: wypukłe części */
  polys: TS[][];
  /** Powierzchnia elementu, cm² */
  areaCm2: number;
  /** element docinany (węższy, krótszy niż arkusz albo cięty pod kątem) */
  cut: boolean;
  /** cięty pod kątem (przy narożniku dachu, koszu, kalenicy) */
  angled: boolean;
  /** Otwory okien dachowych w elemencie */
  notches?: RoofRect[];
}

export interface RoofBoardLayer {
  layer: number;
  boardId: string;
  sheetLen: number;
  sheetW: number;
  pieces: RoofBoardPiece[];
}

export interface RoofFaceBoards {
  /** Klucz połaci (`RoofFace.key`) i jej indeks w `grid.roof.faces` */
  key: string;
  face: number;
  layers: RoofBoardLayer[];
}

/** Otwór w płytach połaci (okno dachowe) */
export interface RoofHole extends RoofRect {
  face: string;
}

export interface RoofBoards {
  faces: RoofFaceBoards[];
  sheets: AtticSheetUse[];
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Półpłaszczyzna nu·t + ns·s + k ≤ 0 */
type Half = [number, number, number];

function clipTS(poly: TS[], [a, b, k]: Half): TS[] {
  const f = (p: TS) => a * p.t + b * p.s + k;
  const out: TS[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp <= 1e-9) out.push(p);
    if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
      const x = fp / (fp - fq);
      out.push({ t: p.t + (q.t - p.t) * x, s: p.s + (q.s - p.s) * x });
    }
  }
  return out.length >= 3 ? out : [];
}

const rectHalves = (r: RoofRect): Half[] => [
  [-1, 0, r.t0],
  [1, 0, -r.t1],
  [0, -1, r.s0],
  [0, 1, -r.s1],
];

/** Wielokąt wypukły ∩ prostokąt */
export function clipToRect(poly: TS[], r: RoofRect): TS[] {
  let out = poly;
  for (const h of rectHalves(r)) {
    out = clipTS(out, h);
    if (!out.length) break;
  }
  return out;
}

/** Wielokąt wypukły minus prostokąt: rozłączne wypukłe części */
export function minusRect(poly: TS[], r: RoofRect): TS[][] {
  const out: TS[][] = [];
  let rest = poly;
  for (const [a, b, k] of rectHalves(r)) {
    const outside = clipTS(rest, [-a, -b, -k]);
    if (outside.length && tsArea(outside) > 0.01) out.push(outside);
    rest = clipTS(rest, [a, b, k]);
    if (!rest.length) break;
  }
  return out;
}

export function tsArea(poly: TS[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.t * q.s - q.t * p.s;
  }
  return Math.abs(s) / 2;
}

/** Obrys płaszczyzny w układzie połaci (wypukłe części, przeciwnie do ruchu wskazówek – nieistotne) */
export function faceOutline(face: RoofFace, pieces: P2[][] = face.pieces): TS[][] {
  return pieces.map((pc) => pc.map((p) => planToFace(face, p)));
}

/** Części obrysu pod płyty: przy widocznej więźbie tylko pola między krokwiami (wątek rusztu dodaje `boardPieces`) */
export function boardOutline(g: AtticRoofFaceGrid): TS[][] {
  const pieces = (g as AtticRoofFaceGrid & { boardPieces?: P2[][] }).boardPieces;
  return faceOutline(g.face, pieces ?? g.face.pieces);
}

/** Połączone przedziały [a, b] (z tolerancją 0,5 cm) */
function mergeIv(iv: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const x of [...iv].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1] + 0.5) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

const tRange = (pc: TS[]): [number, number] => [Math.min(...pc.map((p) => p.t)), Math.max(...pc.map((p) => p.t))];
const sRange = (pc: TS[]): [number, number] => [Math.min(...pc.map((p) => p.s)), Math.max(...pc.map((p) => p.s))];

/** Czy element jest prostokątem (brak cięcia pod kątem): pole równe polu prostokąta opisanego */
function isRect(polys: TS[][], r: RoofRect) {
  const a = polys.reduce((t, pc) => t + tsArea(pc), 0);
  return Math.abs(a - (r.t1 - r.t0) * (r.s1 - r.s0)) < 2;
}

/** Rozkład płyt jednej połaci, wszystkie warstwy */
function faceBoards(g: AtticRoofFaceGrid, fi: number, boards: string[], holes: RoofHole[]): RoofFaceBoards {
  const face = g.face;
  const outline = boardOutline(g).filter((pc) => tsArea(pc) > 1);
  const supports = [...new Set(g.cd.map((l) => l.s))].sort((x, y) => x - y);
  const myHoles = holes.filter((h) => h.face === face.key);
  // pasy wzdłuż profili w obrębie ciągłych części połaci (przy widocznej więźbie – w każdym polu)
  const spans = mergeIv(outline.map(tRange));
  const layers: RoofBoardLayer[] = [];
  let prevLayer: number[] = [];
  boards.forEach((boardId, layer) => {
    const b = boardById(boardId);
    const sheetLen = pickBoardLengthCm(boardId, face.run);
    const sheetW = b.width;
    const pieces: RoofBoardPiece[] = [];
    const used: number[] = [];
    for (const [a0, a1] of spans) {
      const first = layer % 2 === 1 && a1 - a0 > sheetW + 0.5 ? sheetW / 2 : sheetW;
      const cuts = splitStrips(a0, a1, first, sheetW);
      let prevCol: number[] = [];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const c0 = cuts[i];
        const c1 = cuts[i + 1];
        // zakres połaci po skosie w pasie (połać z wyciętym koszem może mieć kilka zakresów)
        const strip: RoofRect = { t0: c0, t1: c1, s0: -1e6, s1: 1e6 };
        const ranges = mergeIv(outline.map((pc) => clipToRect(pc, strip)).filter((pc) => pc.length).map(sRange));
        const colJoints: number[] = [];
        for (const [sa, sb] of ranges) {
          if (sb - sa < 0.5) continue;
          const rel = (xs: number[]) => xs.map((x) => x - sa);
          const joints = rowJoints(sb - sa, sheetLen, rel(supports.filter((x) => x > sa + 0.5 && x < sb - 0.5)), rel(prevCol), ATTIC_MIN_PIECE, rel(prevLayer)).map((x) => r1(x + sa));
          colJoints.push(...joints);
          const ss = [sa, ...joints, sb];
          for (let k = 0; k + 1 < ss.length; k++) {
            const r: RoofRect = { t0: c0, t1: c1, s0: r1(ss[k]), s1: r1(ss[k + 1]) };
            let polys = outline.map((pc) => clipToRect(pc, r)).filter((pc) => pc.length && tsArea(pc) > 0.5);
            if (!polys.length) continue;
            const angled = !isRect(polys, r);
            const notches: RoofRect[] = [];
            for (const h of myHoles) {
              const n = { t0: Math.max(r.t0, h.t0), t1: Math.min(r.t1, h.t1), s0: Math.max(r.s0, h.s0), s1: Math.min(r.s1, h.s1) };
              if (n.t1 - n.t0 <= 0.5 || n.s1 - n.s0 <= 0.5) continue;
              notches.push(n);
              polys = polys.flatMap((pc) => minusRect(pc, h));
            }
            const areaCm2 = polys.reduce((t, pc) => t + tsArea(pc), 0);
            // element w całości w otworze albo okruch przy narożniku – nie ma go
            if (areaCm2 < 1) continue;
            const cut = angled || notches.length > 0 || r.t1 - r.t0 < sheetW - 0.5 || r.s1 - r.s0 < sheetLen - 0.5;
            pieces.push({ ...r, polys, areaCm2, cut, angled, ...(notches.length ? { notches } : {}) });
          }
        }
        prevCol = colJoints;
        used.push(...colJoints);
      }
    }
    layers.push({ layer, boardId, sheetLen, sheetW, pieces });
    prevLayer = used;
  });
  return { key: face.key, face: fi, layers };
}

/**
 * Długość elementu do rozkroju: element cięty pod kątem z jednej strony mieści się z sąsiednim
 * elementem tej samej krawędzi (obróconym) w jednym pasie arkusza – liczy się średnia długość.
 */
function cutLength(p: RoofBoardPiece): number {
  const w = p.t1 - p.t0;
  const l = p.s1 - p.s0;
  if (!p.angled || p.notches?.length || w < 1) return l;
  return Math.min(l, p.areaCm2 / w);
}

/** Rozkład płyt na wszystkich połaciach i rozkrój arkuszy (lista zakupów) */
export function roofBoardLayout(
  a: Attic,
  sys: CeilingSystem = ceilingSystemById(a.systemId),
  grid: AtticGrid & { roof: AtticRoofGrid },
  holes: RoofHole[] = [],
): RoofBoards {
  const boards = layerBoards(sys, a.boardId);
  const faces = grid.roof.faces.map((g, i) => faceBoards(g, i, boards, holes));
  const groups = new Map<string, { boardId: string; sheetLen: number; sheetW: number; pieces: { w: number; l: number }[]; net: number }>();
  for (const f of faces)
    for (const l of f.layers) {
      const key = `${l.boardId}|${l.sheetLen}`;
      const gr = groups.get(key) ?? groups.set(key, { boardId: l.boardId, sheetLen: l.sheetLen, sheetW: l.sheetW, pieces: [], net: 0 }).get(key)!;
      for (const p of l.pieces) {
        gr.pieces.push({ w: p.t1 - p.t0, l: cutLength(p) });
        gr.net += p.areaCm2;
      }
    }
  const sheets: AtticSheetUse[] = [];
  for (const gr of groups.values()) {
    const { sheets: n, wasteCm2 } = cutSheets(gr.pieces, gr.sheetW, gr.sheetLen);
    sheets.push({ boardId: gr.boardId, sheetLen: gr.sheetLen, sheets: n, netM2: gr.net / 10000, wasteM2: wasteCm2 / 10000 });
  }
  const warnings: string[] = [];
  const unsupported = faces.some((f) => {
    const sup = grid.roof.faces[f.face].cd.map((l) => l.s);
    return f.layers.some((l) => l.pieces.some((p, _i, all) => all.some((q) => q !== p && Math.abs(q.t0 - p.t0) < 0.1 && Math.abs(q.s1 - p.s0) < 0.1) && !sup.some((s) => Math.abs(s - p.s0) < 0.6)));
  });
  if (unsupported) warnings.push('Część styków płyt na połaciach nie trafia na profil rusztu – dodaj pod nimi profil albo zmień długość arkusza.');
  return { faces, sheets, warnings };
}
