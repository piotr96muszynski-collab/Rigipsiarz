// Geometria montażowa: położenie słupków, profili, wieszaków i płyt.
// Te same funkcje zasilają wyliczenie ilości (materials.ts) i rysunki (src/drawings),
// dzięki czemu schemat zawsze pokazuje dokładnie to, co trafiło na listę zakupów.
// Jednostki: ściany w metrach (jak w wyliczeniach), sufity w centymetrach (jak ceilingGrid).

import { boardById, ceilingSystemById, wallSystemById, type WallFrame } from '../catalog/rigips';
import { bbox, isNewWall, nodeMap, projectOnSegment, wallEnds, wallLength, type WallJunctions } from '../geometry/geometry';
import type { Ceiling, Opening, Project, Wall } from '../model/types';

// ---------------------------------------------------------------------------
// Ściany
// ---------------------------------------------------------------------------

export interface WallOpening extends Opening {
  /** m od początku ściany */
  x0: number;
  x1: number;
  /** szerokość w świetle, m */
  w: number;
  /** wysokość dolnej krawędzi (0 dla drzwi), m */
  sill: number;
  /** wysokość górnej krawędzi, m */
  top: number;
  h: number;
}

/** Otwory przycięte do ściany, w metrach */
export function wallOpenings(w: Wall, L: number, H: number): WallOpening[] {
  return w.openings
    .map((o) => {
      const x0 = Math.max(0, o.offset / 100);
      const x1 = Math.min(L, (o.offset + o.width) / 100);
      const sill = o.kind === 'door' ? 0 : o.sill / 100;
      const top = Math.min(H, sill + o.height / 100);
      return { ...o, x0, x1, w: x1 - x0, sill, top, h: top - sill };
    })
    .filter((o) => o.w > 0.05 && o.h > 0.05);
}

export type StudKind = 'stud' | 'short' | 'jamb' | 'jamb-ua' | 'extra';

export interface StudElement {
  /** oś słupka, m od początku ściany */
  x: number;
  kind: StudKind;
  /** odcinki w pionie [od, do], m od posadzki */
  segments: [number, number][];
}

/** Słupki w rozstawie (pełne i skrócone nad/pod otworami) – bez ościeży i słupków z połączeń */
export function gridStuds(L: number, H: number, spacing: number, openings: WallOpening[]): StudElement[] {
  const positions: number[] = [];
  for (let x = 0; x < L - 0.1; x += spacing) positions.push(x);
  positions.push(L);
  const out: StudElement[] = [];
  for (const x of positions) {
    const op = openings.find((o) => x > o.x0 - 0.05 && x < o.x1 + 0.05);
    if (!op) out.push({ x, kind: 'stud', segments: [[0, H]] });
    else if (x > op.x0 + 0.05 && x < op.x1 - 0.05) {
      // słupek w świetle otworu → krótkie odcinki nad i pod otworem
      const segments: [number, number][] = [];
      if (op.sill > 0.01) segments.push([0, op.sill]);
      if (H - op.top > 0.01) segments.push([op.top, H]);
      out.push({ x, kind: 'short', segments });
    }
    // słupki pokrywające się z ościeżem zastępuje słupek ościeżnicowy
  }
  return out;
}

/**
 * Położenie dodatkowych słupków wynikających z połączeń ścian (narożniki, trójniki, skrzyżowania).
 * Liczba zawsze równa j.extraStuds – tak jak w wyliczeniu.
 */
export function junctionStudPositions(p: Project, w: Wall, j: WallJunctions): number[] {
  const nodes = nodeMap(p);
  const L = wallLength(p, w, nodes) / 100;
  const xs: number[] = [];
  // ściany dochodzące do środka tej ściany (trójnik „na styk”)
  const [a, b] = wallEnds(p, w, nodes);
  // istniejące ściany (obrys) nie dają słupków połączeń
  const fresh = p.walls.filter(isNewWall);
  for (const o of fresh) {
    if (o.id === w.id) continue;
    for (const nid of [o.a, o.b]) {
      if (nid === w.a || nid === w.b) continue;
      const n = nodes.get(nid);
      if (!n) continue;
      const shared = fresh.some((x) => x.id !== o.id && (x.a === nid || x.b === nid));
      if (shared) continue;
      const pr = projectOnSegment(n, a, b);
      if (pr.d < 2 && pr.t > 0.001 && pr.t < 0.999) xs.push(pr.t * L);
    }
  }
  // narożniki, trójniki i skrzyżowania w węzłach ściany – słupek dolicza się tylko jednej ze ścian
  for (const [nid, x, kind] of [
    [w.a, 0, j.endA],
    [w.b, L, j.endB],
  ] as const) {
    const others = fresh.filter((o) => o.id !== w.id && (o.a === nid || o.b === nid));
    if (kind === 'corner' && others.length === 1 && w.id < others[0].id) xs.push(x);
    const owner = [w, ...others].sort((m, n) => (m.id < n.id ? -1 : 1))[0];
    if (kind === 'tee-through' && owner.id === w.id) xs.push(x);
    if (kind === 'cross' && owner.id === w.id) xs.push(x, x);
  }
  // zabezpieczenie: liczba zawsze zgodna z analizą połączeń
  const out = xs.slice(0, j.extraStuds);
  while (out.length < j.extraStuds) out.push(L);
  return out.sort((m, n) => m - n);
}

export interface TrackElement {
  kind: 'floor' | 'ceiling' | 'header' | 'sill';
  x0: number;
  x1: number;
  /** wysokość, m */
  y: number;
  /** długość do wycięcia (nadproże i podokiennik +15 cm na stronę), m */
  cut: number;
}

export interface BoardPiece {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** element docinany (węższy lub krótszy niż arkusz) */
  cut: boolean;
}

export interface BoardFace {
  side: 0 | 1;
  layer: number;
  /** przesunięcie pierwszego styku pionowego, m */
  offset: number;
  pieces: BoardPiece[];
  /** styki pionowe wypadające w linii ościeża (do poprawy wycięciem w kształcie L) */
  jambJoints: number[];
}

export interface WallLayout {
  L: number;
  H: number;
  spacing: number;
  profile: number;
  /** rodzaj rusztu z karty systemu */
  frame: WallFrame;
  /** liczba rzędów słupków (ściany podwójne i instalacyjne: 2) */
  rows: number;
  /** nazwy profili na rysunku, np. „CW 75” / „CD 60” */
  studLabel: string;
  trackLabel: string;
  openings: WallOpening[];
  studs: StudElement[];
  tracks: TrackElement[];
  /** wymiar arkusza, m */
  sheet: { width: number; length: number };
  faces: BoardFace[];
}

/**
 * Rozkład płyt na jednej okładzinie. Styki pionowe co 1,20 m, na każdej kolejnej
 * warstwie i na przeciwnej stronie przesunięte o rozstaw słupków. Gdy ściana jest wyższa
 * od arkusza – dostawki na przemian u dołu i u góry (styki poziome mijankowo).
 */
export function boardFace(L: number, H: number, sheetLen: number, offset: number, BOARD_W = 1.2): BoardPiece[] {
  const xs: number[] = [0];
  let x = offset > 0.01 ? offset : BOARD_W;
  while (x < L - 0.01) {
    xs.push(x);
    x += BOARD_W;
  }
  xs.push(L);
  const pieces: BoardPiece[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const narrow = x1 - x0 < BOARD_W - 0.005;
    if (H <= sheetLen + 0.001) {
      pieces.push({ x0, x1, y0: 0, y1: H, cut: narrow || H < sheetLen - 0.005 });
    } else {
      // pełny arkusz + dostawka, styki poziome na przemian
      let y = 0;
      const rows: [number, number][] = [];
      if (i % 2 === 1) {
        const first = H - Math.floor(H / sheetLen) * sheetLen || sheetLen;
        rows.push([0, first]);
        y = first;
      }
      while (y < H - 0.001) {
        const y1 = Math.min(H, y + sheetLen);
        rows.push([y, y1]);
        y = y1;
      }
      for (const [y0, y1] of rows) pieces.push({ x0, x1, y0, y1, cut: narrow || y1 - y0 < sheetLen - 0.005 });
    }
  }
  return pieces;
}

export function wallLayout(p: Project, w: Wall, j: WallJunctions): WallLayout {
  const sys = wallSystemById(w.systemId);
  const L = wallLength(p, w) / 100;
  const H = w.height / 100;
  const s = w.studSpacing / 100;
  const openings = wallOpenings(w, L, H);

  const frame = sys.frame;
  // bez profili: klejenie na placki albo łączniki punktowe ATLAS
  const glued = frame === 'glued' || frame === 'point-fix';
  const isCD = frame === 'cd-lining';
  const rows = glued ? 0 : frame === 'double' || frame === 'separate' ? 2 : 1;

  // ruszt jednego rzędu (przy dwóch rzędach drugi jest taki sam)
  const studs = glued ? [] : gridStuds(L, H, s, openings);
  const tracks: TrackElement[] = [];
  if (!glued) {
    for (const o of openings) {
      const kind: StudKind = o.reinforced && !isCD ? 'jamb-ua' : 'jamb';
      studs.push({ x: o.x0, kind, segments: [[0, H]] }, { x: o.x1, kind, segments: [[0, H]] });
    }
    for (const x of junctionStudPositions(p, w, j)) studs.push({ x, kind: 'extra', segments: [[0, H]] });
    studs.sort((a, b) => a.x - b.x);

    let cursor = 0;
    for (const o of [...openings].filter((o) => o.sill <= 0.01).sort((a, b) => a.x0 - b.x0)) {
      if (o.x0 - cursor > 0.05) tracks.push({ kind: 'floor', x0: cursor, x1: o.x0, y: 0, cut: o.x0 - cursor });
      cursor = o.x1;
    }
    if (L - cursor > 0.05) tracks.push({ kind: 'floor', x0: cursor, x1: L, y: 0, cut: L - cursor });
    tracks.push({ kind: 'ceiling', x0: 0, x1: L, y: H, cut: L });
    for (const o of openings) {
      if (o.top < H - 0.05) tracks.push({ kind: 'header', x0: o.x0, x1: o.x1, y: o.top, cut: o.w + 0.3 });
      if (o.sill > 0.05) tracks.push({ kind: 'sill', x0: o.x0, x1: o.x1, y: o.sill, cut: o.w + 0.3 });
    }
  }

  const sheetLen = pickBoardLengthCm(w.boardId, w.height) / 100;
  const boardW = boardById(w.boardId).width / 100;
  const faces: BoardFace[] = [];
  for (let side = 0 as 0 | 1; side < sys.sides; side = (side + 1) as 0 | 1) {
    for (let layer = 0; layer < sys.layers; layer++) {
      const offset = glued ? 0 : round3(((side + layer) * s) % boardW);
      const pieces = boardFace(L, H, sheetLen, offset, boardW);
      const joints = [...new Set(pieces.map((b) => b.x1).filter((x) => x < L - 0.01))];
      const jambJoints = joints.filter((x) => openings.some((o) => Math.abs(x - o.x0) < 0.1 || Math.abs(x - o.x1) < 0.1));
      faces.push({ side, layer, offset, pieces, jambJoints });
    }
  }

  return {
    L,
    H,
    spacing: s,
    profile: sys.profile,
    frame,
    rows,
    studLabel: isCD ? 'CD 60' : `CW ${sys.profile}`,
    trackLabel: isCD ? 'UD 30' : `UW ${sys.profile}`,
    openings,
    studs,
    tracks,
    sheet: { width: boardW, length: sheetLen },
    faces,
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Dobór długości arkusza: najkrótszy ≥ wysokości, inaczej najdłuższy (z dostawką), cm */
export function pickBoardLengthCm(boardId: string, heightCm: number): number {
  const lens = [...boardById(boardId).lengths].sort((a, b) => a - b);
  return lens.find((l) => l >= heightCm) ?? lens[lens.length - 1];
}

// ---------------------------------------------------------------------------
// Sufity (cm)
// ---------------------------------------------------------------------------

/** Liczba i położenie wieszaków na odcinku profilu nośnego: równo, co najwyżej co `spacing` */
export function hangerPositions(s0: number, s1: number, spacing: number): number[] {
  const run = s1 - s0;
  const n = Math.max(2, Math.ceil(run / spacing - 1e-9));
  const step = run / n;
  return Array.from({ length: n }, (_, i) => s0 + step * (i + 0.5));
}

/** Łączniki wzdłużne CD: co 4 m (długość profilu) od początku odcinka */
export function splicePositions(s0: number, s1: number, stock = 400): number[] {
  const run = s1 - s0;
  const n = Math.max(0, Math.ceil(run / stock - 1e-9) - 1);
  return Array.from({ length: n }, (_, i) => s0 + stock * (i + 1));
}

export interface CeilingBoardPiece {
  /** prostokąt w cm, w układzie planu */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cut: boolean;
}

/**
 * Rozkład płyt sufitowych: dłuższą krawędzią poprzecznie do profili montażowych
 * (wzdłuż profili nośnych), styki poprzeczne na profilu, mijankowo co drugi rząd.
 * Zwraca prostokąty w obrysie prostokąta otaczającego – rysunek przycina je do kształtu sufitu.
 */
export function ceilingBoardLayout(c: Ceiling): { pieces: CeilingBoardPiece[]; sheetLen: number; stagger: number } {
  const sys = ceilingSystemById(c.systemId);
  const bb = bbox(c.points);
  // płyty poprzecznie do profili, do których się je mocuje (w suficie na CW – poprzecznie do CW)
  const mainAxis: 'x' | 'y' = c.direction === 0 ? 'x' : 'y';
  const along: 'x' | 'y' = sys.kind === 'cw-span' ? (mainAxis === 'x' ? 'y' : 'x') : mainAxis;
  const [a0, a1] = along === 'x' ? [bb.minX, bb.maxX] : [bb.minY, bb.maxY];
  const [c0, c1] = along === 'x' ? [bb.minY, bb.maxY] : [bb.minX, bb.maxX];
  const sp = sys.secondarySpacing;
  const longSide = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
  const sheet = pickBoardLengthCm(c.boardId, Math.min(longSide, 300));
  // długość użytkowa: wielokrotność rozstawu profili, żeby styk wypadał na profilu
  const eff = Math.max(sp, Math.floor(sheet / sp) * sp);
  const stagger = Math.max(Math.ceil(40 / sp) * sp, Math.round(eff / 2 / sp) * sp);
  const pieces: CeilingBoardPiece[] = [];
  let row = 0;
  for (let y = c0; y < c1 - 0.5; y += 120, row++) {
    const yEnd = Math.min(c1, y + 120);
    let x = a0;
    let first = row % 2 === 1 && stagger < eff ? stagger : eff;
    while (x < a1 - 0.5) {
      const xEnd = Math.min(a1, x + first);
      const cut = xEnd - x < sheet - 0.5 || yEnd - y < 119.5;
      pieces.push(
        along === 'x'
          ? { x0: x, x1: xEnd, y0: y, y1: yEnd, cut }
          : { x0: y, x1: yEnd, y0: x, y1: xEnd, cut },
      );
      x = xEnd;
      first = eff;
    }
  }
  return { pieces, sheetLen: sheet, stagger };
}
