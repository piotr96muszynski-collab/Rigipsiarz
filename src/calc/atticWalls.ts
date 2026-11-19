// Okładziny ścian poddasza: ścianki kolankowe (i wysoka ściana dachu jednospadowego) oraz ściany
// szczytowe. Każda ściana to wielokąt w swoim widoku (x wzdłuż ściany od lewej, z w górę, cm):
// ścianka kolankowa – prostokąt długość poddasza × wysokość do dolnej krawędzi skosu,
// ściana szczytowa – obrys przekroju po licu zabudowy skosów i sufitu (pięciokąt, sześciokąt…).
// Ruszt, płyty i ilości liczone jak dla okładziny ściany murowanej (systemy okładzin z katalogu),
// ale z profilami docinanymi do skosu. Jedno źródło dla rysunków, 3D i listy zakupów.

import { boardById, layerBoards, wallMaxHeight, wallSystemById, type WallSystem } from '../catalog/rigips';
import type { FinishingSettings } from '../catalog/finishing';
import type { Attic, Lining } from '../model/types';
import type { AtticGrid, SecPt } from './attic';
import { cutSheets } from './atticBoards';
import { pickBoardLengthCm, rowSegments } from './boardLength';
import { bracketPositions, fixerColumns, fixerRows, hatFixPositions } from './layout';
import {
  GLUE_PER_M2,
  WALL_SCREWS_INNER,
  WALL_SCREWS_OUTER,
  add,
  addAtlasJointing,
  addBoardScrews,
  addJointing,
  addPiece,
  anchorsFor,
  wallWoolOptions,
  type Requirement,
} from './materials';
import { vaporBarrierLines, vaporBarrierOn, wallVaporSpec } from './vaporBarrier';

export type AtticWallId = 'knee-left' | 'knee-right' | 'gable';

export interface AtticWallFace {
  id: AtticWallId;
  label: string;
  /** Ile takich samych ścian (ściany szczytowe: 2) */
  count: number;
  /** Obrys okładziny w widoku ściany, cm: x od lewej, z od posadzki; przeciwnie do ruchu wskazówek */
  poly: SecPt[];
  /** Długość ściany, cm */
  width: number;
  /** Największa wysokość, cm */
  height: number;
  lining: Lining;
}

export interface AtticWallPiece {
  /** prostokąt arkusza, z którego wycina się element, cm */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** obrys elementu po docięciu do skosu (w cm) */
  outline: SecPt[];
  /** pole po docięciu, cm² */
  area: number;
  cut: boolean;
}

export interface AtticWallLayout {
  face: AtticWallFace;
  sys: WallSystem;
  /** Profile pionowe (CD / kapeluszowe): oś x i długość od posadzki do skosu, cm */
  studs: { x: number; len: number }[];
  /** Profil przyścienny UD po obwodzie (posadzka i skos / sufit), odcinki w cm */
  tracks: [SecPt, SecPt][];
  /** Uchwyty ES / kołki profili kapeluszowych / łączniki ATLAS: punkty mocowania do muru, cm */
  fixings: SecPt[];
  layers: { layer: number; boardId: string; sheetLen: number; sheetW: number; pieces: AtticWallPiece[] }[];
  /** Powierzchnia okładziny jednej ściany, m² */
  areaM2: number;
  warnings: string[];
}

export const ATTIC_WALL_LABEL: Record<AtticWallId, string> = {
  'knee-left': 'Ścianka kolankowa lewa',
  'knee-right': 'Ścianka kolankowa prawa',
  gable: 'Ściany szczytowe',
};

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Górna krawędź ściany szczytowej: lico zabudowy od lewej do prawej ściany okapowej */
export function atticTopChain(grid: AtticGrid): SecPt[] {
  const s = grid.section.surfaces;
  const pts: SecPt[] = [];
  const push = (p: SecPt) => {
    const last = pts[pts.length - 1];
    if (!last || !near(last.x, p.x) || !near(last.z, p.z)) pts.push({ x: p.x, z: Math.max(0, p.z) });
  };
  for (const f of s) {
    if (f.id === 'right') {
      push(f.b);
      push(f.a);
    } else {
      push(f.a);
      push(f.b);
    }
  }
  return pts;
}

/** Ściany do okładzin wg ustawień poddasza */
export function atticWallFaces(a: Attic, grid: AtticGrid): AtticWallFace[] {
  const chain = atticTopChain(grid);
  if (chain.length < 2) return [];
  const W = a.width;
  const out: AtticWallFace[] = [];
  const zLeft = near(chain[0].x, 0) ? chain[0].z : 0;
  const last = chain[chain.length - 1];
  const zRight = near(last.x, W) ? last.z : 0;
  const rect = (w: number, h: number): SecPt[] => [
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: h },
    { x: 0, z: h },
  ];
  if (a.kneeLining) {
    if (a.kneeLeft > 0 && zLeft > 5)
      out.push({ id: 'knee-left', label: ATTIC_WALL_LABEL['knee-left'], count: 1, poly: rect(a.length, zLeft), width: a.length, height: zLeft, lining: a.kneeLining });
    const rightWall = a.roof === 'mono' || a.kneeRight > 0;
    if (rightWall && zRight > 5)
      out.push({
        id: 'knee-right',
        label: a.roof === 'mono' ? 'Ściana wysoka (dach jednospadowy)' : ATTIC_WALL_LABEL['knee-right'],
        count: 1,
        poly: rect(a.length, zRight),
        width: a.length,
        height: zRight,
        lining: a.kneeLining,
      });
  }
  if (a.gableLining) {
    const poly: SecPt[] = [{ x: 0, z: 0 }, { x: W, z: 0 }];
    // obrys przeciwnie do ruchu wskazówek: posadzka w prawo, potem lico zabudowy od prawej do lewej
    for (const p of [...chain].reverse()) if (!(p.z < 0.5 && (near(p.x, 0) || near(p.x, W)))) poly.push(p);
    const dedup = poly.filter((p, i) => i === 0 || !near(p.x, poly[i - 1].x) || !near(p.z, poly[i - 1].z));
    out.push({ id: 'gable', label: ATTIC_WALL_LABEL.gable, count: 2, poly: dedup, width: W, height: Math.max(...chain.map((p) => p.z)), lining: a.gableLining });
  }
  return out;
}

/** Wysokość górnej krawędzi wielokąta nad punktem x (największa z), cm */
export function topAt(poly: SecPt[], x: number): number {
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const lo = Math.min(p.x, q.x);
    const hi = Math.max(p.x, q.x);
    if (x < lo - 1e-6 || x > hi + 1e-6) continue;
    const z = hi - lo < 1e-6 ? Math.max(p.z, q.z) : p.z + ((q.z - p.z) * (x - p.x)) / (q.x - p.x);
    best = Math.max(best, z);
  }
  return best;
}

/** Pole wielokąta (bez znaku), jednostki² */
export function polyArea(poly: SecPt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.z - q.x * p.z;
  }
  return Math.abs(s) / 2;
}

/** Część prostokąta wewnątrz wypukłego wielokąta (Sutherland–Hodgman) */
export function clipRect(x0: number, x1: number, y0: number, y1: number, clip: SecPt[]): SecPt[] {
  let out: SecPt[] = [
    { x: x0, z: y0 },
    { x: x1, z: y0 },
    { x: x1, z: y1 },
    { x: x0, z: y1 },
  ];
  // orientacja wielokąta: dodatnia = przeciwnie do ruchu wskazówek
  let sgn = 0;
  for (let i = 0; i < clip.length; i++) sgn += clip[i].x * clip[(i + 1) % clip.length].z - clip[(i + 1) % clip.length].x * clip[i].z;
  const dir = sgn >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: SecPt) => dir * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= -1e-9) out.push(p);
      if ((sp >= -1e-9) !== (sq >= -1e-9)) {
        const t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
      }
    }
  }
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Ruszt i płyty jednej okładziny */
export function atticWallLayout(face: AtticWallFace): AtticWallLayout {
  const l = face.lining;
  const sys = wallSystemById(l.systemId);
  const warnings: string[] = [];
  const W = face.width;
  const studs: { x: number; len: number }[] = [];
  const fixings: SecPt[] = [];
  const tracks: [SecPt, SecPt][] = [];
  const s = l.studSpacing;
  const framed = sys.frame === 'cd-lining' || sys.frame === 'hat-lining';

  if (framed) {
    // profile pionowe co rozstaw od lewej krawędzi i przy prawej (jak w okładzinie muru)
    const xs: number[] = [];
    for (let x = 0; x < W - 10; x += s) xs.push(x);
    xs.push(W);
    for (const x0 of xs) {
      // profil przy krawędzi leży 3 cm w głąb (oś), długość do niższego punktu skosu nad szerokością profilu
      const x = Math.min(W - 3, Math.max(3, x0));
      const len = Math.min(topAt(face.poly, x - 3), topAt(face.poly, x + 3));
      if (len < 10) continue;
      studs.push({ x: r1(x), len: r1(len) });
      const step = (sys.bracketSpacing ?? 100) / 100;
      const pts = sys.frame === 'hat-lining' ? hatFixPositions(0, len / 100, step).map((p) => p.at) : bracketPositions(0, len / 100, step);
      for (const z of pts) fixings.push({ x: r1(x), z: r1(z * 100) });
    }
    if (sys.frame === 'cd-lining') {
      // UD 30 po obwodzie: posadzka, skos / sufit u góry i pionowe krawędzie przy sąsiednich ścianach
      for (let i = 0; i < face.poly.length; i++) {
        const p = face.poly[i];
        const q = face.poly[(i + 1) % face.poly.length];
        if (Math.hypot(q.x - p.x, q.z - p.z) > 5) tracks.push([p, q]);
      }
    }
  } else if (sys.frame === 'point-fix') {
    // ATLAS: łączniki w siatce, 7 cm od krawędzi, tylko pod okładziną
    const cols = fixerColumns(0, W / 100, s / 100).map((v) => v * 100);
    for (const x of cols) {
      const h = topAt(face.poly, x);
      if (h < 14) continue;
      for (const z of fixerRows(h / 100, (sys.pointSpacing ?? 50) / 100)) fixings.push({ x: r1(x), z: r1(z * 100) });
    }
  }

  // płyty pionowo, pasy 120 cm od lewej, dostawki na zmianę u dołu i u góry; kolejna warstwa przesunięta o pół płyty
  const boards = layerBoards(sys, l.boardId, l.innerBoardId);
  const layers = boards.map((boardId, layer) => {
    const b = boardById(boardId);
    const sheetW = b.width;
    const sheetLen = pickBoardLengthCm(boardId, face.height);
    const pieces: AtticWallPiece[] = [];
    const cuts: number[] = [0];
    let x = 0;
    let wdt = layer % 2 === 1 && W > sheetW ? sheetW / 2 : sheetW;
    while (x < W - 0.5) {
      x = Math.min(W, x + wdt);
      cuts.push(x);
      wdt = sheetW;
    }
    // ostatni pas węższy niż 30 cm – poprzedni krótszy
    const k = cuts.length;
    if (k >= 3 && cuts[k - 1] - cuts[k - 2] < 29.5) {
      if (cuts[k - 1] - cuts[k - 3] < 60) cuts.splice(k - 2, 1);
      else cuts[k - 2] = cuts[k - 1] - 30;
    }
    for (let i = 0; i + 1 < cuts.length; i++) {
      const x0 = cuts[i];
      const x1 = cuts[i + 1];
      const hCol = Math.max(topAt(face.poly, x0), topAt(face.poly, x1), ...face.poly.filter((p) => p.x > x0 && p.x < x1).map((p) => p.z));
      if (hCol < 1) continue;
      for (const [y0m, y1m] of rowSegments(hCol / 100, sheetLen / 100, (i + layer) % 2 === 1)) {
        const y0 = y0m * 100;
        const y1 = y1m * 100;
        const outline = clipRect(x0, x1, y0, y1, face.poly);
        const area = polyArea(outline);
        if (area < 25) continue;
        const rectA = (x1 - x0) * (y1 - y0);
        pieces.push({ x0, x1, y0, y1, outline, area, cut: area < rectA - 1 || x1 - x0 < sheetW - 0.5 || y1 - y0 < sheetLen - 0.5 });
      }
    }
    return { layer, boardId, sheetLen, sheetW, pieces };
  });

  const maxH = wallMaxHeight(sys, l.studSpacing, { board: l.boardId, doubleStuds: l.doubleStuds });
  if (maxH && face.height > maxH + 0.5)
    warnings.push(`${face.label}: wysokość ${(face.height / 100).toFixed(2).replace('.', ',')} m przekracza ${(maxH / 100).toFixed(2).replace('.', ',')} m dopuszczalne dla tego systemu okładziny.`);
  return { face, sys, studs, tracks, fixings, layers, areaM2: polyArea(face.poly) / 10000, warnings };
}

/** Ilości okładzin ścian poddasza – dopisywane do zestawienia poddasza */
export function addAtticWalls(req: Requirement, layouts: AtticWallLayout[], fin: FinishingSettings): number {
  let total = 0;
  const groups = new Map<string, { sheetW: number; sheetLen: number; boardId: string; pieces: { w: number; l: number }[]; net: number }>();
  for (const lay of layouts) {
    const { sys, face } = lay;
    const n = face.count;
    const A = lay.areaM2 * n;
    total += A;
    const stud = sys.frame === 'hat-lining' ? 'KAPELUSZ' : 'CD60';
    for (let k = 0; k < n; k++) {
      for (const st of lay.studs) addPiece(req, stud, st.len / 100);
      for (const [p, q] of lay.tracks) {
        const len = Math.hypot(q.x - p.x, q.z - p.z) / 100;
        addPiece(req, 'UD30', len);
        add(req.counts, 'KOLEK', anchorsFor(len));
        add(req.meters, 'TASMA_USZ30', len);
      }
    }
    const fixN = lay.fixings.length * n;
    if (sys.frame === 'cd-lining') {
      add(req.counts, 'WIESZAK_ES', fixN);
      add(req.counts, 'LN9', fixN * 2);
      add(req.counts, 'KOLEK', fixN);
    } else if (sys.frame === 'hat-lining') add(req.counts, sys.anchor ?? 'KOLEK', fixN);
    else if (sys.frame === 'point-fix' && sys.fixer) {
      add(req.counts, sys.fixer.product, fixN);
      if (sys.fixer.extension) add(req.counts, sys.fixer.extension, fixN);
    }

    const boards = lay.layers.map((l) => l.boardId);
    if (sys.frame === 'glued') add(req.kg, 'KLEJ', A * GLUE_PER_M2);
    else if (sys.frame !== 'point-fix') {
      const f = 0.6 / Math.max(0.2, face.lining.studSpacing / 100);
      addBoardScrews(req, A, boards, WALL_SCREWS_OUTER * f, WALL_SCREWS_INNER * f);
    }
    if (sys.frame === 'point-fix') addAtlasJointing(req, A, boards.length, 1.2);
    else addJointing(req, A, boards.length, boards[boards.length - 1], 1.4, fin);
    const wool = wallWoolOptions(sys);
    if (face.lining.insulation && wool.length) add(req.area, `WELNA${wool[wool.length - 1]}`, A);
    const vapor = wallVaporSpec(sys);
    if (vaporBarrierOn(face.lining.vaporBarrier, vapor)) vaporBarrierLines(req, A, vapor);

    for (const l of lay.layers) {
      const key = `${l.boardId}|${l.sheetLen}`;
      const g = groups.get(key) ?? groups.set(key, { sheetW: l.sheetW, sheetLen: l.sheetLen, boardId: l.boardId, pieces: [], net: 0 }).get(key)!;
      for (let k = 0; k < n; k++)
        for (const p of l.pieces) {
          g.pieces.push({ w: p.x1 - p.x0, l: p.y1 - p.y0 });
          g.net += p.area;
        }
    }
  }
  // płyty: elementy po docięciu do skosu + resztki < 30 cm z rozkroju arkuszy
  for (const [key, g] of groups) {
    const { wasteCm2 } = cutSheets(g.pieces, g.sheetW, g.sheetLen);
    add(req.boardArea, key, (g.net + wasteCm2) / 10000);
    if (wasteCm2 > 0) add((req.boardCutWaste ??= {}), key, wasteCm2 / 10000);
  }
  return total;
}
