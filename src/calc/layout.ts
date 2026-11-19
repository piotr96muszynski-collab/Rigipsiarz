// Geometria montażowa: położenie słupków, profili, wieszaków i płyt.
// Te same funkcje zasilają wyliczenie ilości (materials.ts) i rysunki (src/drawings),
// dzięki czemu schemat zawsze pokazuje dokładnie to, co trafiło na listę zakupów.
// Jednostki: ściany w metrach (jak w wyliczeniach), sufity w centymetrach (jak ceilingGrid).

import { boardById, ceilingSystemById, wallSystemById, type WallFrame } from '../catalog/rigips';
import { buildContacts, cornerStudPositions, partRange, type ContactModel, type WallEndContacts } from '../geometry/contacts';
import { bbox, isNewWall, nodeMap, projectOnSegment, throughPair, wallEnds, wallLength, type WallJunctions } from '../geometry/geometry';
import type { Ceiling, Lining, Opening, Project, Wall } from '../model/types';

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

/** joint – słupek dodany pod styk płyt, gdy styki warstw przy otworze nie miały się na czym minąć */
export type StudKind = 'stud' | 'short' | 'jamb' | 'jamb-ua' | 'extra' | 'joint';

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
export function junctionStudPositions(p: Project, w: Wall, j: WallJunctions, m: ContactModel = buildContacts(p)): number[] {
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
    if (kind === 'tee-through' || kind === 'cross') {
      // słupki dostaje ściana ciągła (para współliniowa, mniejsze id) – jak w analizie połączeń
      const node = nodes.get(nid)!;
      const far = (o: Wall) => nodes.get(o.a === nid ? o.b : o.a)!;
      const owner = throughPair(node, [w, ...others], far).sort((m, n) => (m.id < n.id ? -1 : 1))[0];
      if (owner.id === w.id) xs.push(...(kind === 'cross' ? [x, x] : [x]));
    }
  }
  // narożnik L: słupek tuż za rusztem ściany dochodzącej, pod krawędziami płyt od wewnątrz (model styków)
  if (j.endA === 'corner' || j.endB === 'corner') xs.push(...cornerStudPositions(m, w, L));
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

export interface CutRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Kształt elementu po wycięciu otworu */
export type PieceShape = 'rect' | 'L' | 'U' | 'frame';

export interface BoardPiece {
  /** prostokąt arkusza, z którego wycina się element (przed wycięciem otworu), m */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** element docinany (węższy lub krótszy niż arkusz) */
  cut: boolean;
  /** wycięcia pod otwór w obrębie elementu (narożnik → L, bok → U, środek → ramka) */
  notches?: CutRect[];
  shape?: PieceShape;
}

export interface BoardFace {
  side: 0 | 1;
  layer: number;
  /** zakres płyt wzdłuż ściany z modelu styków (w narożniku płyta wychodzi poza oś lub kończy się przed nią), m */
  x0: number;
  x1: number;
  /** przesunięcie pierwszego styku pionowego, m */
  offset: number;
  /** styki pionowe okładziny (po przesunięciu przy otworach), m */
  joints: number[];
  pieces: BoardPiece[];
  /** styki pionowe, które mimo przesunięcia zostały w linii ościeża (brak słupka w dobrym miejscu) */
  jambJoints: number[];
  /** styki pionowe pokrywające się ze stykiem niższej warstwy (brak słupka, żeby je rozsunąć) */
  layerJoints: number[];
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
  /** ATLAS M-System 3G: siatka łączników talerzykowych (zamiast rusztu) */
  fixers?: FixerGrid;
  /** Okładzina na CD 60: uchwyty ES na profilach – miejsca wiercenia w murze */
  brackets?: BracketGrid;
}

/** Uchwyty ES okładziny na CD 60, m (x – oś profilu od węzła a, y od posadzki) */
export interface BracketGrid {
  /** jeden uchwyt = jeden kołek w murze */
  points: { x: number; y: number }[];
  /** największy rozstaw uchwytów wzdłuż profilu z karty systemu, m */
  spacing: number;
}

/**
 * Uchwyty ES na odcinku profilu CD od `y0` do `y1` (m): tyle, żeby odstęp nie przekroczył
 * `spacing` z karty systemu, rozłożone równo – skrajne pół odstępu od końców odcinka (tak jak
 * wieszaki w suficie; karty podają tylko największy rozstaw, położenie skrajnych jest przyjęte).
 * Krótki odcinek (nad/pod otworem) ma co najmniej jeden uchwyt.
 */
export function bracketPositions(y0: number, y1: number, spacing: number): number[] {
  const run = y1 - y0;
  if (run <= 0.01) return [];
  const n = Math.max(1, Math.ceil(run / spacing - 1e-9));
  const step = run / n;
  return Array.from({ length: n }, (_, i) => round3(y0 + step * (i + 0.5)));
}

/** Siatka łączników talerzykowych na ścianie, m (x od węzła a, y od posadzki) */
export interface FixerGrid {
  /** osie kolumn łączników */
  xs: number[];
  /** wysokości rzędów łączników */
  ys: number[];
  /** łączniki do osadzenia (bez tych, które wypadają w otworach) */
  points: { x: number; y: number }[];
  /** rozstaw w poziomie i w pionie, m */
  sx: number;
  sy: number;
}

/**
 * Odległość skrajnego rzędu łączników od każdej krawędzi okładziny, m. Instrukcja ATLAS
 * M-SYSTEM 3G „krok po kroku – ściany i sufity”: „zaznaczyć dookoła ściany skrajny rząd
 * łączników 7 cm od każdego brzegu”; 7 cm mieści się w wybranym rozstawie.
 */
export const FIXER_EDGE = 0.07;

/** Osie bliższe niż 1 mm to ten sam rząd łączników, m */
const FIXER_SAME = 0.001;

/**
 * Kolumny łączników na odcinku `lo`..`hi`. Najpierw skrajne – 7 cm od obu brzegów, potem
 * pośrednie w osiach co `step` liczonych od początku ściany (0 – tam wypadają styki płyt
 * 120 cm). Żadnej osi nie usuwamy: gdy pośrednia wypada blisko skrajnej, oba rzędy zostają
 * (łączniki są wtedy gęściej).
 */
export function fixerColumns(lo: number, hi: number, step: number, edge = FIXER_EDGE): number[] {
  const a = round3(lo + edge);
  const b = round3(hi - edge);
  if (b - a < FIXER_SAME) return [round3((lo + hi) / 2)];
  const mid: number[] = [];
  for (let k = Math.floor(a / step + 1e-9) + 1; k * step < b - FIXER_SAME; k++) {
    const v = round3(k * step);
    if (v - a >= FIXER_SAME) mid.push(v);
  }
  return [a, ...mid, b];
}

/**
 * Rzędy łączników na wysokości `H`. Najpierw skrajne – 7 cm od posadzki i od stropu, potem
 * pośrednie co `step` od dolnego skrajnego rzędu. Ostatni odstęp pod górnym rzędem może
 * wyjść mniejszy – wtedy łączniki są gęściej, żadnego nie usuwamy.
 */
export function fixerRows(H: number, step: number, edge = FIXER_EDGE): number[] {
  const a = round3(edge);
  const b = round3(H - edge);
  if (b - a < FIXER_SAME) return [round3(H / 2)];
  const out = [a];
  for (let v = a + step; v < b - FIXER_SAME; v += step) out.push(round3(v));
  out.push(b);
  return out;
}

/**
 * Siatka łączników ATLAS M-System 3G na okładzinie od `x0` do `x1` i wysokości `H`: najpierw
 * łączniki wzdłuż krawędzi, 7 cm od brzegu (instrukcja ATLAS), potem pośrednie – kolumny co `sx`
 * w osiach styków płyt, rzędy co `sy` od dolnego rzędu. Na każdym styku płyt (pionowym
 * i poziomym) leży rząd łączników. Łączniki w świetle otworów pomijamy.
 */
export function pointFixGrid(
  x0: number,
  x1: number,
  H: number,
  sx: number,
  sy: number,
  openings: { x0: number; x1: number; sill: number; top: number }[] = [],
  /** styki płyt: pionowe (x) i poziome (y), m – każdy styk dostaje swój rząd łączników */
  joints: { xs?: number[]; ys?: number[] } = {},
): FixerGrid {
  const merge = (base: number[], extra: number[] | undefined, lo: number, hi: number) => {
    const out = [...base];
    for (const v of extra ?? []) {
      const r = round3(v);
      if (r > lo + FIXER_SAME && r < hi - FIXER_SAME && !out.some((o) => Math.abs(o - r) < FIXER_SAME)) out.push(r);
    }
    return out.sort((a, b) => a - b);
  };
  const xs = merge(fixerColumns(x0, x1, sx), joints.xs, x0 + FIXER_EDGE, x1 - FIXER_EDGE);
  const ys = merge(fixerRows(H, sy), joints.ys, FIXER_EDGE, H - FIXER_EDGE);
  const tol = 0.02;
  const inHole = (x: number, y: number) =>
    openings.some((o) => x > o.x0 + tol && x < o.x1 - tol && y > o.sill + tol && y < o.top - tol);
  const points = xs.flatMap((x) => ys.filter((y) => !inHole(x, y)).map((y) => ({ x, y })));
  return { xs, ys, points, sx, sy };
}

/**
 * Rozkład płyt na jednej okładzinie. Styki pionowe co 1,20 m, na każdej kolejnej
 * warstwie i na przeciwnej stronie przesunięte o rozstaw słupków. Gdy ściana jest wyższa
 * od arkusza – dostawki na przemian u dołu i u góry (styki poziome mijankowo).
 */
export function boardFace(
  L: number,
  H: number,
  sheetLen: number,
  offset: number,
  BOARD_W = 1.2,
  joints?: number[],
  /** dla kolumny i: true = dostawka u dołu (domyślnie co druga kolumna) */
  bottomFirst?: (i: number, x0: number, x1: number) => boolean,
): BoardPiece[] {
  const xs: number[] = [0];
  if (joints) xs.push(...joints.filter((x) => x > 0.01 && x < L - 0.01));
  else {
    let x = offset > 0.01 ? offset : BOARD_W;
    while (x < L - 0.01) {
      xs.push(x);
      x += BOARD_W;
    }
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
      if (bottomFirst ? bottomFirst(i, x0, x1) : i % 2 === 1) {
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

export function wallLayout(p: Project, w: Wall, j: WallJunctions, m: ContactModel = buildContacts(p)): WallLayout {
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

  const [f0, f1] = partRange(m, w, L, { kind: 'frame' });
  // ruszt jednego rzędu (przy dwóch rzędach drugi jest taki sam)
  const studs = glued ? [] : gridStuds(L, H, s, openings);
  const tracks: TrackElement[] = [];
  if (!glued) {
    for (const o of openings) {
      const kind: StudKind = o.reinforced && !isCD ? 'jamb-ua' : 'jamb';
      studs.push({ x: o.x0, kind, segments: [[0, H]] }, { x: o.x1, kind, segments: [[0, H]] });
    }
    for (const x of junctionStudPositions(p, w, j, m)) studs.push({ x, kind: 'extra', segments: [[0, H]] });
    // słupki końcowe w miejscu, gdzie kończy się ruszt (model styków: narożnik, trójnik, pasek na czole)
    for (const st of studs) {
      if (st.kind === 'extra') continue;
      if (Math.abs(st.x) < 1e-9) st.x = f0;
      else if (Math.abs(st.x - L) < 1e-9) st.x = f1;
    }
    studs.sort((a, b) => a.x - b.x);

    let cursor = 0;
    for (const o of [...openings].filter((o) => o.sill <= 0.01).sort((a, b) => a.x0 - b.x0)) {
      if (o.x0 - cursor > 0.05) tracks.push({ kind: 'floor', x0: cursor, x1: o.x0, y: 0, cut: o.x0 - cursor });
      cursor = o.x1;
    }
    if (L - cursor > 0.05) tracks.push({ kind: 'floor', x0: cursor, x1: L, y: 0, cut: L - cursor });
    tracks.push({ kind: 'ceiling', x0: 0, x1: L, y: H, cut: L });
    // UW na długość rusztu z modelu styków
    for (const t of tracks) {
      if (t.x0 < 1e-9) t.x0 = f0;
      if (t.x1 > L - 1e-9) t.x1 = f1;
    }
    for (const o of openings) {
      if (o.top < H - 0.05) tracks.push({ kind: 'header', x0: o.x0, x1: o.x1, y: o.top, cut: o.w + 0.3 });
      if (o.sill > 0.05) tracks.push({ kind: 'sill', x0: o.x0, x1: o.x1, y: o.sill, cut: o.w + 0.3 });
    }
  }

  const sheetLen = pickBoardLengthCm(w.boardId, w.height) / 100;
  const boardW = boardById(w.boardId).width / 100;
  const faces: BoardFace[] = [];
  // miejsca, w których może wypaść styk pionowy: słupki (bez ościeży – te i tak są zabronione)
  const baseXs = glued ? undefined : studs.filter((st) => st.segments.length).map((st) => st.x);
  // możliwe dodatkowe słupki pod styk: w połowie między sąsiednimi słupkami (przesunięcie 30 cm przy rozstawie 60)
  const sorted = [...new Set(baseXs ?? [])].sort((a, b) => a - b);
  const extraCands = sorted.slice(1).flatMap((x, i) => (x - sorted[i] >= 0.3 - 1e-9 ? [round3((x + sorted[i]) / 2)] : []));
  const added = new Set<number>();
  const onBase = (x: number) => (baseXs ?? []).some((b) => Math.abs(b - x) < 0.005);
  const studXs = () => (baseXs ? [...baseXs, ...added] : undefined);
  const extraXs = () => (baseXs ? extraCands.filter((x) => !added.has(x)) : undefined);
  const bottomFirst = (i: number, c0: number, c1: number) => rowPattern(i, c0, c1, H, sheetLen, openings);
  const inside = (x: number, r: [number, number]) => x > r[0] + 0.01 && x < r[1] - 0.01;
  for (let side = 0 as 0 | 1; side < sys.sides; side = (side + 1) as 0 | 1) {
    const layers = Array.from({ length: sys.layers }, (_, layer) => ({
      layer,
      offset: glued ? 0 : round3(((side + layer) * s) % boardW),
      range: partRange(m, w, L, { kind: 'board', side, layer }),
      joints: [] as number[],
      bad: [] as number[],
    }));
    // styki drugiej strony (ta sama warstwa) – lepiej się z nimi nie pokrywać
    const soft = (layer: number) => faces.filter((f) => f.side !== side && f.layer === layer).flatMap(faceJoints);
    // sąsiednie warstwy (przy trzech i czterech warstwach styk 3. warstwy może wypaść nad stykiem 1. –
    // przy słupkach co 60 cm są tylko dwa możliwe położenia styku płyty 120 cm)
    const others = (layer: number) =>
      layers.filter((q) => Math.abs(q.layer - layer) === 1 && q.joints.length).flatMap((q) => q.joints.filter((x) => inside(x, q.range)));
    // sąsiednie warstwy tej strony nie mogą mieć wspólnych styków: kilka przebiegów, każda warstwa
    // dopasowuje się do pozostałych (przy otworach pierwsza warstwa też może ustąpić drugiej)
    // najpierw tylko na istniejących słupkach; dodatkowy słupek dopiero, gdy styki dalej się pokrywają
    // albo styk zostaje w linii ościeża
    const rounds = sys.layers > 1 ? 3 : 1;
    const conflict = () =>
      layers.some((q) => q.bad.length || q.joints.some((x) => inside(x, q.range) && others(q.layer).some((y) => Math.abs(y - x) < 0.05)));
    for (let round = 0; round <= rounds; round++) {
      const withExtra = round === rounds;
      if (withExtra && !conflict()) break;
      for (const q of layers) {
        const [x0, x1] = q.range;
        const r = placeJoints({
          L,
          x0,
          x1,
          offset: q.offset,
          boardW,
          step: s,
          openings,
          studXs: studXs(),
          extraXs: withExtra ? extraXs() : undefined,
          hard: others(q.layer),
          soft: soft(q.layer),
        });
        q.joints = r.joints;
        for (const x of r.joints) if (!onBase(x)) added.add(x);
        q.bad = r.bad;
      }
    }
    for (const q of layers) {
      const [x0, x1] = q.range;
      // styki liczone od węzła a (jak ruszt), płyta przycięta do zakresu z modelu styków
      const pieces = cutOpenings(clipPieces(boardFace(L, H, sheetLen, q.offset, boardW, q.joints, bottomFirst), x0, x1), openings);
      const inRange = q.joints.filter((x) => inside(x, q.range));
      const lower = layers.filter((o) => o.layer === q.layer - 1).flatMap((o) => o.joints.filter((x) => inside(x, o.range)));
      const layerJoints = inRange.filter((x) => lower.some((y) => Math.abs(y - x) < 0.05));
      faces.push({ side, layer: q.layer, x0, x1, offset: q.offset, joints: inRange, pieces, jambJoints: q.bad, layerJoints });
    }
  }

  // dodatkowe słupki zostają tylko tam, gdzie ostatecznie wypadł styk
  const used = baseXs ? [...new Set(faces.flatMap((f) => f.joints).filter((x) => !onBase(x)).map(round3))] : [];
  for (const x of used) {
    const op = openings.find((o) => x > o.x0 && x < o.x1);
    const segments: [number, number][] = !op
      ? [[0, H]]
      : ([
          [0, op.sill],
          [op.top, H],
        ].filter(([a, b]) => b - a > 0.01) as [number, number][]);
    if (segments.length) studs.push({ x, kind: 'joint', segments });
  }
  studs.sort((a, b) => a.x - b.x);

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
    fixers:
      frame === 'point-fix'
        ? pointFixGrid(f0, f1, H, s, (sys.pointSpacing ?? 50) / 100, openings, {
            xs: faces.flatMap((f) => f.joints),
            // styki poziome (ściana wyższa niż arkusz)
            ys: faces.flatMap((f) => f.pieces.flatMap((pc) => [pc.y0, pc.y1])).filter((y) => y > 0.01 && y < H - 0.01),
          })
        : undefined,
    brackets: isCD ? bracketGrid(studs, f0, f1, (sys.bracketSpacing ?? 100) / 100) : undefined,
  };
}

/** Uchwyty ES na wszystkich odcinkach profili CD (te same profile co na rysunku i w 3D) */
function bracketGrid(studs: StudElement[], f0: number, f1: number, spacing: number): BracketGrid {
  // profil przy końcu okładziny stoi całą półką na okładzinie – oś 3 cm od jej krawędzi
  const half = 0.03;
  const points = studs.flatMap((st) => {
    const x = round3(Math.min(f1 - half, Math.max(f0 + half, st.x)));
    return st.segments.flatMap(([y0, y1]) => bracketPositions(y0, y1, spacing).map((y) => ({ x, y })));
  });
  return { points, spacing };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Okładzina istniejącej ściany jako jednostronna ściana z systemu okładziny (te same wyliczenia
 * i rysunki co nowa ściana): długość i wysokość muru, otwory muru bez ościeżnic UA.
 */
export function liningAsWall(w: Wall, l: Lining): Wall {
  const sys = wallSystemById(l.systemId);
  return {
    ...w,
    kind: 'new',
    systemId: sys.id,
    boardId: l.boardId,
    studSpacing: l.studSpacing,
    doubleStuds: l.doubleStuds,
    innerBoardId: l.innerBoardId,
    insulation: l.insulation,
    endA: 'existing-wall',
    endB: 'existing-wall',
    linings: undefined,
    openings: w.openings.map((o) => ({ ...o, reinforced: false })),
  };
}

/** Wyłącznie połączenia z murem – okładzina nie ma narożników z rusztu */
const LINING_JUNCTIONS: WallJunctions = { endA: 'existing-wall', endB: 'existing-wall', extraStuds: 0, externalEdges: 0 };

/**
 * Układ rusztu / łączników i płyt okładziny istniejącej ściany, na zakresie z modelu styków
 * (w narożniku obrysu okładzina dochodzi do lica sąsiedniej okładziny).
 */
export function liningLayout(p: Project, w: Wall, l: Lining, m: ContactModel = buildContacts(p)): WallLayout {
  return wallLayout(p, liningAsWall(w, l), LINING_JUNCTIONS, liningContacts(p, w, l, m));
}

/** Model styków okładziny muru: tylko jej zakres wzdłuż muru (narożniki obrysu) */
export function liningContacts(p: Project, w: Wall, l: Lining, m: ContactModel = buildContacts(p)): ContactModel {
  const L = wallLength(p, w) / 100;
  const [u0, u1] = m.linings.get(`${w.id}:${l.side}`) ?? [0, L];
  const layers = wallSystemById(l.systemId).layers;
  const end = (e: 'a' | 'b', s: number): WallEndContacts => ({
    wallId: w.id,
    end: e,
    nodeId: e === 'a' ? w.a : w.b,
    joint: 'masonry',
    role: 'end',
    frame: { s, contact: 'lining' },
    boards: [Array.from({ length: layers }, () => ({ s, contact: 'lining' as const }))],
  });
  const own: ContactModel = {
    sections: new Map(),
    nodes: new Map(),
    linings: new Map(),
    ends: new Map([
      [`${w.id}:a`, end('a', u0)],
      [`${w.id}:b`, end('b', L - u1)],
    ]),
  };
  return own;
}

// ---------------------------------------------------------------------------
// Płyty przy otworach: wycięcie w kształt litery L
// ---------------------------------------------------------------------------

/**
 * Najmniejsza odległość styku płyt od linii ościeża (pionowo) i nadproża/parapetu (poziomo), m.
 * Styk nie może wypadać w linii krawędzi otworu – płytę przy otworze wycina się w kształt
 * litery L, a styk nad otworem przesuwa się o co najmniej 15 cm od ościeży.
 */
export const OPENING_JOINT_MIN = 0.15;

/** Odcinek płyty węższy niż ten (m) to odpad – nie da się go przykręcić do dwóch słupków */
export const OFFCUT_MIN = 0.3;

const EPS = 1e-6;

/** Czy styk pionowy w x wypada za blisko pionowej krawędzi otworu */
export function nearJamb(x: number, openings: WallOpening[], min = OPENING_JOINT_MIN): boolean {
  return openings.some((o) => Math.abs(x - o.x0) < min - EPS || Math.abs(x - o.x1) < min - EPS);
}

const faceJoints = (f: BoardFace) => f.joints;

/**
 * Styki pionowe jednej okładziny. Szuka najlepszego ułożenia po słupkach (programowanie
 * dynamiczne), tak żeby żaden pas nie był szerszy od arkusza, a kolejno najbardziej unikać:
 * styku w linii ościeża (bliżej niż OPENING_JOINT_MIN – płyta przy otworze jest wtedy wycinana
 * w kształt L, a styk wypada nad/pod otworem), styku na styku niższej warstwy tej samej strony,
 * styku na styku drugiej strony, dodatkowych elementów i odejścia od zwykłego rozkładu co arkusz.
 */
export function placeJoints(o: {
  L: number;
  x0: number;
  x1: number;
  offset: number;
  boardW: number;
  step: number;
  openings: WallOpening[];
  /** położenie słupków (brak = okładzina klejona, styk w dowolnym miejscu siatki) */
  studXs?: number[];
  /** miejsca, w których można dostawić słupek pod styk (drożej niż styk na istniejącym słupku) */
  extraXs?: number[];
  /** styki, z którymi nie wolno się pokryć (niższe warstwy tej samej strony) */
  hard?: number[];
  /** styki, z którymi lepiej się nie pokrywać (druga strona ściany) */
  soft?: number[];
}): { joints: number[]; bad: number[] } {
  const { L, boardW, openings } = o;
  const step = Math.max(0.1, o.step);
  const end = Math.min(L, o.x1);
  const lo = Math.max(0, o.x0) + 0.1;
  const MIN_W = 0.1;
  const hits = (x: number, list?: number[]) => (list ?? []).some((y) => Math.abs(y - x) < 0.05);
  // zwykły rozkład: co szerokość arkusza od przesunięcia
  const plain: number[] = [];
  for (let x = o.offset > 0.01 ? o.offset : boardW; x < end - 0.01; x = round3(x + boardW)) plain.push(x);
  const grid: number[] = [];
  if (o.studXs) grid.push(...o.studXs, ...(o.extraXs ?? []));
  else for (let x = step; x < end; x = round3(x + step)) grid.push(x);
  const cands = [...new Set([...grid, ...plain].map(round3))].filter((x) => x > lo - 0.05 && x < end - MIN_W).sort((a, b) => a - b);
  if (o.studXs) {
    // bez słupka styk możliwy tylko tam, gdzie był w zwykłym rozkładzie (np. siatka inna niż arkusz)
    for (let i = cands.length - 1; i >= 0; i--)
      if (![...o.studXs, ...(o.extraXs ?? [])].some((x) => Math.abs(x - cands[i]) < 0.005) && !plain.some((x) => Math.abs(x - cands[i]) < 0.005)) cands.splice(i, 1);
  }
  const cost = (x: number) =>
    (nearJamb(x, openings) ? 100 : 0) +
    (hits(x, o.hard) ? 10 : 0) +
    (hits(x, o.soft) ? 1 : 0) +
    // dodatkowy słupek: lepszy niż wspólny styk warstw lub styk w linii ościeża, ale nie za darmo
    (o.studXs && !o.studXs.some((sx) => Math.abs(sx - x) < 0.005) && (o.extraXs ?? []).some((e) => Math.abs(e - x) < 0.005) ? 5 : 0) +
    0.5 +
    (plain.some((p) => Math.abs(p - x) < 0.005) ? 0 : 0.2);
  // dp[i]: najmniejszy koszt z ostatnim stykiem w cands[i]; start w 0
  const best: number[] = cands.map(() => Infinity);
  const prev: number[] = cands.map(() => -1);
  const fits = (a: number, b: number) => b - a >= MIN_W - 1e-9 && b - a <= boardW + 0.001;
  // wąskie paski (< 30 cm) trudno przykręcić – tylko gdy nie ma innego wyjścia
  const narrow = (a: number, b: number) => (b - a < 0.3 - 1e-9 ? 2 : 0);
  for (let i = 0; i < cands.length; i++) {
    const c = cost(cands[i]);
    if (fits(0, cands[i])) best[i] = c + narrow(0, cands[i]);
    for (let k = 0; k < i; k++) {
      const v = best[k] + c + narrow(cands[k], cands[i]);
      if (v < best[i] - 1e-9 && fits(cands[k], cands[i])) {
        best[i] = v;
        prev[i] = k;
      }
    }
  }
  let last = -1;
  let total = end <= boardW + 0.001 ? 0 : Infinity;
  for (let i = 0; i < cands.length; i++)
    if (end - cands[i] <= boardW + 0.001 && best[i] + narrow(cands[i], end) < total - 1e-9) {
      total = best[i] + narrow(cands[i], end);
      last = i;
    }
  if (!Number.isFinite(total)) return { joints: plain, bad: plain.filter((x) => x > o.x0 + 0.01 && nearJamb(x, openings)) };
  const joints: number[] = [];
  for (let i = last; i >= 0; i = prev[i]) joints.unshift(cands[i]);
  return { joints, bad: joints.filter((x) => x > o.x0 + 0.01 && nearJamb(x, openings)) };
}

/**
 * Wybór, czy dostawka idzie u dołu (true) czy u góry kolumny: domyślnie na przemian,
 * a w kolumnie przy ościeżu tak, by styk poziomy nie wypadł w linii nadproża ani parapetu.
 */
function rowPattern(i: number, c0: number, c1: number, H: number, sheetLen: number, openings: WallOpening[]): boolean {
  const def = i % 2 === 1;
  const edges = openings
    .filter((o) => (o.x0 > c0 + EPS && o.x0 < c1 - EPS) || (o.x1 > c0 + EPS && o.x1 < c1 - EPS))
    .flatMap((o) => [o.sill, o.top].filter((y) => y > 0.01 && y < H - 0.01));
  if (!edges.length) return def;
  const seams = (bottom: boolean) => {
    const out: number[] = [];
    let y = bottom ? H - Math.floor(H / sheetLen) * sheetLen || sheetLen : sheetLen;
    for (; y < H - 0.001; y += sheetLen) out.push(y);
    return out;
  };
  const ok = (bottom: boolean) => seams(bottom).every((y) => edges.every((e) => Math.abs(y - e) >= OPENING_JOINT_MIN - EPS));
  if (ok(def)) return def;
  if (ok(!def)) return !def;
  return def;
}

/**
 * Wycina otwory z elementów: element w całości w otworze znika, przecięty w poprzek – dzieli się
 * na dwa, przycięty z trzech stron – skraca się, a zachodzący na narożnik lub bok otworu dostaje
 * wycięcie (kształt L albo U).
 */
export function cutOpenings(pieces: BoardPiece[], openings: WallOpening[]): BoardPiece[] {
  let list = pieces.map((p) => ({ ...p }));
  for (const o of openings) {
    const next: BoardPiece[] = [];
    for (const p of list) {
      const n = { x0: Math.max(p.x0, o.x0), x1: Math.min(p.x1, o.x1), y0: Math.max(p.y0, o.sill), y1: Math.min(p.y1, o.top) };
      if (n.x1 - n.x0 < 0.005 || n.y1 - n.y0 < 0.005) {
        next.push(p);
        continue;
      }
      const left = n.x0 <= p.x0 + 0.005;
      const right = n.x1 >= p.x1 - 0.005;
      const bottom = n.y0 <= p.y0 + 0.005;
      const top = n.y1 >= p.y1 - 0.005;
      const touch = [left, right, bottom, top].filter(Boolean).length;
      const sub = (q: Partial<BoardPiece>) => ({ ...p, ...q, cut: true });
      if (touch === 4) continue;
      if (left && right && !(bottom && top)) {
        if (!bottom) next.push(sub({ y1: n.y0 }));
        if (!top) next.push(sub({ y0: n.y1 }));
        continue;
      }
      if (bottom && top) {
        if (!left) next.push(sub({ x1: n.x0 }));
        if (!right) next.push(sub({ x0: n.x1 }));
        continue;
      }
      if (touch === 3) {
        // pozostaje pas z jednej strony
        next.push(sub(!left ? { x1: n.x0 } : !right ? { x0: n.x1 } : !bottom ? { y1: n.y0 } : { y0: n.y1 }));
        continue;
      }
      const notches = [...(p.notches ?? []), n];
      next.push({ ...p, cut: true, notches, shape: notchShape(p, notches) });
    }
    list = next;
  }
  return list.map((p) => (p.shape ? p : { ...p, shape: 'rect' as const }));
}

function notchShape(p: CutRect, notches: CutRect[]): PieceShape {
  let edges = 0;
  for (const n of notches)
    edges = Math.max(
      edges,
      [n.x0 <= p.x0 + 0.005, n.x1 >= p.x1 - 0.005, n.y0 <= p.y0 + 0.005, n.y1 >= p.y1 - 0.005].filter(Boolean).length,
    );
  return edges >= 2 ? 'L' : edges === 1 ? 'U' : 'frame';
}

/** Pole elementu po wycięciu otworów, m² */
export function pieceArea(p: BoardPiece): number {
  return (p.x1 - p.x0) * (p.y1 - p.y0) - (p.notches ?? []).reduce((a, n) => a + (n.x1 - n.x0) * (n.y1 - n.y0), 0);
}

/**
 * Obrys elementu z wycięciami jako wielokąty (pierwszy – zewnętrzny, pozostałe – otwory w środku).
 * Wspólne dla rysunku (SVG) i widoku 3D.
 */
export function pieceOutline(p: BoardPiece): { x: number; y: number }[][] {
  const notches = p.notches ?? [];
  if (!notches.length)
    return [[{ x: p.x0, y: p.y0 }, { x: p.x1, y: p.y0 }, { x: p.x1, y: p.y1 }, { x: p.x0, y: p.y1 }]];
  const xs = [...new Set([p.x0, p.x1, ...notches.flatMap((n) => [n.x0, n.x1])])].sort((a, b) => a - b);
  const ys = [...new Set([p.y0, p.y1, ...notches.flatMap((n) => [n.y0, n.y1])])].sort((a, b) => a - b);
  const filled = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return !notches.some((n) => cx > n.x0 && cx < n.x1 && cy > n.y0 && cy < n.y1);
  };
  // krawędzie brzegowe skierowane przeciwnie do ruchu wskazówek zegara (wnętrze po lewej)
  const next = new Map<string, [number, number]>();
  const key = (i: number, j: number) => `${i},${j}`;
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      if (!filled(i, j)) continue;
      if (!filled(i, j - 1)) next.set(key(i, j), [i + 1, j]);
      if (!filled(i + 1, j)) next.set(key(i + 1, j), [i + 1, j + 1]);
      if (!filled(i, j + 1)) next.set(key(i + 1, j + 1), [i, j + 1]);
      if (!filled(i - 1, j)) next.set(key(i, j + 1), [i, j]);
    }
  const loops: { x: number; y: number }[][] = [];
  while (next.size) {
    const [startKey] = next.keys();
    let [ci, cj] = startKey.split(',').map(Number);
    const pts: [number, number][] = [];
    for (;;) {
      const k = key(ci, cj);
      const n = next.get(k);
      if (!n) break;
      next.delete(k);
      pts.push([ci, cj]);
      [ci, cj] = n;
    }
    // usuwa wierzchołki współliniowe
    const simple = pts.filter((q, idx) => {
      const a = pts[(idx - 1 + pts.length) % pts.length];
      const b = pts[(idx + 1) % pts.length];
      return !((a[0] === q[0] && q[0] === b[0]) || (a[1] === q[1] && q[1] === b[1]));
    });
    loops.push(simple.map(([i, j]) => ({ x: xs[i], y: ys[j] })));
  }
  const area = (l: { x: number; y: number }[]) =>
    Math.abs(l.reduce((a, q, i) => a + q.x * l[(i + 1) % l.length].y - l[(i + 1) % l.length].x * q.y, 0)) / 2;
  return loops.sort((a, b) => area(b) - area(a));
}

/** Przycina rozkład płyt do zakresu [x0, x1]: skrajne pasy wydłużone (narożnik zewnętrzny) albo skrócone */
function clipPieces(pieces: BoardPiece[], x0: number, x1: number): BoardPiece[] {
  if (!pieces.length) return pieces;
  const first = Math.min(...pieces.map((b) => b.x0));
  const last = Math.max(...pieces.map((b) => b.x1));
  return pieces
    .map((b) => ({
      ...b,
      x0: Math.abs(b.x0 - first) < 1e-9 ? x0 : Math.max(b.x0, x0),
      x1: Math.abs(b.x1 - last) < 1e-9 ? x1 : Math.min(b.x1, x1),
    }))
    .map((b, i) => ({ ...b, cut: b.cut || b.x1 - b.x0 < pieces[i].x1 - pieces[i].x0 - 0.005 }))
    .filter((b) => b.x1 - b.x0 > 0.001);
}

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
  // styk krótkich krawędzi na profilu (ATLAS: na rzędzie łączników co `secondarySpacing` wzdłuż płyty)
  const sp = sys.secondarySpacing;
  const longSide = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
  const sheet = pickBoardLengthCm(c.boardId, Math.min(longSide, 300));
  // długość użytkowa: wielokrotność rozstawu profili, żeby styk wypadał na profilu
  const eff = Math.max(sp, Math.floor(sheet / sp) * sp);
  const stagger = Math.max(Math.ceil(40 / sp) * sp, Math.round(eff / 2 / sp) * sp);
  const MIN = OFFCUT_MIN * 100;
  /**
   * Podział odcinka a..b na kawałki o długościach `first`, potem `step`. Gdy na końcu zostałby
   * docinek węższy niż 30 cm, poprzednia płyta jest skracana (o wielokrotność `unit`, żeby styk
   * dalej wypadał na profilu / rzędzie łączników) – zamiast wąskiego paska.
   */
  const split = (a: number, b: number, first: number, step: number, unit: number): number[] => {
    const cuts = [a];
    let x = a;
    let len = first;
    while (x < b - 0.5) {
      x = Math.min(b, x + len);
      cuts.push(x);
      len = step;
    }
    const k = cuts.length;
    const rest = cuts[k - 1] - cuts[k - 2];
    if (k >= 3 && rest < MIN - 0.5) {
      const prev = cuts[k - 2] - cuts[k - 3];
      let shorten = Math.ceil((MIN - rest) / unit - 1e-9) * unit;
      if (prev - shorten < MIN - 0.5) shorten = Math.max(0, prev - (prev + rest) / 2);
      if (prev + rest < 2 * MIN) cuts.splice(k - 2, 1); // za mało na dwie płyty – jedna dłuższa
      else cuts[k - 2] -= shorten;
    }
    return cuts;
  };
  const pieces: CeilingBoardPiece[] = [];
  const rows = split(c0, c1, 120, 120, 1);
  for (let row = 0; row + 1 < rows.length; row++) {
    const y = rows[row];
    const yEnd = rows[row + 1];
    const first = row % 2 === 1 && stagger < eff ? stagger : eff;
    const cols = split(a0, a1, first, eff, sp);
    for (let i = 0; i + 1 < cols.length; i++) {
      const x = cols[i];
      const xEnd = cols[i + 1];
      const cut = xEnd - x < sheet - 0.5 || yEnd - y < 119.5;
      pieces.push(
        along === 'x'
          ? { x0: x, x1: xEnd, y0: y, y1: yEnd, cut }
          : { x0: y, x1: yEnd, y0: x, y1: xEnd, cut },
      );
    }
  }
  return { pieces, sheetLen: sheet, stagger };
}
