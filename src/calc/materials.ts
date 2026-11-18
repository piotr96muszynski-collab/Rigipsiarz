import {
  BOARDS,
  PRODUCTS,
  STOCK_LENGTHS,
  boardById,
  ceilingSystemById,
  wallSystemById,
  type Product,
  type Unit,
} from '../catalog/rigips';
import {
  analyzeJunctions,
  bbox,
  nodeMap,
  pointInPolygon,
  polygonArea,
  polygonPerimeterEdges,
  scanline,
  wallLength,
  type WallJunctions,
} from '../geometry/geometry';
import type { Ceiling, Project, Wall } from '../model/types';

// ---------------------------------------------------------------------------
// Zapotrzebowanie „surowe” jednego elementu (ściany lub sufitu), w metrach.
// Zaokrąglanie do sztuk handlowych odbywa się dopiero przy sumowaniu, dzięki
// czemu ścinki z jednej ściany mogą być wykorzystane na innej.
// ---------------------------------------------------------------------------

export interface Requirement {
  /** Odcinki profili do wycięcia: id produktu → długości elementów, m */
  pieces: Record<string, number[]>;
  /** Powierzchnia płyt: `${boardId}|${długośćArkusza cm}` → m² */
  boardArea: Record<string, number>;
  /** Sztuki (wkręty, kołki, wieszaki, łączniki) */
  counts: Record<string, number>;
  /** Metry bieżące (taśmy) */
  meters: Record<string, number>;
  /** kg (masa) */
  kg: Record<string, number>;
  /** m² (wełna) */
  area: Record<string, number>;
}

const emptyReq = (): Requirement => ({ pieces: {}, boardArea: {}, counts: {}, meters: {}, kg: {}, area: {} });

const add = (rec: Record<string, number>, key: string, v: number) => {
  if (v > 0) rec[key] = (rec[key] ?? 0) + v;
};
const addPiece = (req: Requirement, product: string, len: number) => {
  if (len <= 0.01) return;
  (req.pieces[product] ??= []).push(len);
};

/** Dobór długości arkusza: najkrótszy ≥ wysokości, inaczej najdłuższy (z dostawką) */
export function pickBoardLength(boardId: string, heightCm: number): number {
  const lens = [...boardById(boardId).lengths].sort((a, b) => a - b);
  return lens.find((l) => l >= heightCm) ?? lens[lens.length - 1];
}

const TAPE_FOR_PROFILE: Record<number, string> = { 50: 'TASMA_USZ50', 75: 'TASMA_USZ70', 100: 'TASMA_USZ95' };

/** Kołki co max 80 cm, minimum 3 na odcinek */
export const anchorsFor = (lenM: number) => (lenM <= 0.05 ? 0 : Math.max(3, Math.ceil(lenM / 0.8) + 1));

export interface WallBreakdown {
  lengthM: number;
  heightM: number;
  netAreaM2: number;
  studPositions: number[]; // m od początku ściany (pełne i skrócone)
  jambPositions: number[];
  junctions: WallJunctions;
}

export function wallRequirement(p: Project, w: Wall, j: WallJunctions): { req: Requirement; info: WallBreakdown } {
  const req = emptyReq();
  const sys = wallSystemById(w.systemId);
  const L = wallLength(p, w) / 100;
  const H = w.height / 100;
  const s = w.studSpacing / 100;
  const cw = `CW${sys.profile}`;
  const uw = `UW${sys.profile}`;
  const ua = `UA${sys.profile}`;

  // Otwory przycięte do ściany, w metrach
  const openings = w.openings
    .map((o) => {
      const x0 = Math.max(0, o.offset / 100);
      const x1 = Math.min(L, (o.offset + o.width) / 100);
      const sill = o.kind === 'door' ? 0 : o.sill / 100;
      const top = Math.min(H, sill + o.height / 100);
      return { ...o, x0, x1, w: x1 - x0, sill, top, h: top - sill };
    })
    .filter((o) => o.w > 0.05 && o.h > 0.05);

  // --- Słupki ---
  const positions: number[] = [];
  for (let x = 0; x < L - 0.1; x += s) positions.push(x);
  positions.push(L);
  const studPositions: number[] = [];
  for (const x of positions) {
    const op = openings.find((o) => x > o.x0 - 0.05 && x < o.x1 + 0.05);
    if (!op) {
      addPiece(req, cw, H);
      studPositions.push(x);
    } else if (x > op.x0 + 0.05 && x < op.x1 - 0.05) {
      // słupek w świetle otworu → krótkie odcinki nad i pod otworem
      addPiece(req, cw, H - op.top);
      addPiece(req, cw, op.sill);
      studPositions.push(x);
    }
    // słupki pokrywające się z ościeżem zastępuje słupek ościeżnicowy
  }
  for (let i = 0; i < j.extraStuds; i++) addPiece(req, cw, H);

  // --- Ościeża, nadproża, podokienniki ---
  const jambPositions: number[] = [];
  for (const o of openings) {
    jambPositions.push(o.x0, o.x1);
    const useUA = o.reinforced;
    for (let k = 0; k < 2; k++) addPiece(req, useUA ? ua : cw, H);
    if (useUA) {
      add(req.counts, 'KATUA', 4);
      add(req.counts, 'KOLEK', 8);
    }
    // nadproże z UW z zagiętymi końcami (+15 cm na stronę)
    if (o.top < H - 0.05) addPiece(req, uw, o.w + 0.3);
    if (o.sill > 0.05) addPiece(req, uw, o.w + 0.3);
    add(req.counts, 'LN9', 8 + (o.sill > 0.05 ? 4 : 0));
  }

  // --- Profile UW (posadzka i strop) ---
  const floorRuns: number[] = [];
  let cursor = 0;
  for (const o of [...openings].filter((o) => o.sill <= 0.01).sort((a, b) => a.x0 - b.x0)) {
    floorRuns.push(o.x0 - cursor);
    cursor = o.x1;
  }
  floorRuns.push(L - cursor);
  const runs = [...floorRuns.filter((r) => r > 0.05), L];
  for (const r of runs) {
    addPiece(req, uw, r);
    add(req.counts, 'KOLEK', anchorsFor(r));
  }
  const tape = TAPE_FOR_PROFILE[sys.profile];
  add(req.meters, tape, runs.reduce((a, b) => a + b, 0));

  // końce przy istniejącej ścianie: słupek kotwiony + taśma
  for (const end of [j.endA, j.endB]) {
    if (end === 'existing-wall') {
      add(req.counts, 'KOLEK', anchorsFor(H));
      add(req.meters, tape, H);
    }
  }

  // --- Płyty ---
  const openingArea = openings.reduce((a, o) => a + o.w * o.h, 0);
  const net = Math.max(0, L * H - openingArea);
  const sheetLen = pickBoardLength(w.boardId, w.height);
  const sheetKey = `${w.boardId}|${sheetLen}`;
  const faceArea = net * sys.sides;
  add(req.boardArea, sheetKey, faceArea * sys.layers);

  // --- Wkręty ---
  if (sys.layers === 1) {
    add(req.counts, 'TN25', faceArea * 17);
  } else {
    add(req.counts, 'TN25', faceArea * 7);
    add(req.counts, 'TN35', faceArea * 17);
  }

  // --- Spoinowanie ---
  add(req.meters, 'TASMA_SPOIN', faceArea * 1.0);
  add(req.kg, 'MASA', faceArea * 0.35 + faceArea * (sys.layers - 1) * 0.2);

  // --- Narożniki ochronne: krawędzie zewnętrzne + ościeża otworów ---
  for (let i = 0; i < j.externalEdges; i++) addPiece(req, 'NAROZNIK', H);
  for (const o of openings) {
    for (let side = 0; side < sys.sides; side++) {
      addPiece(req, 'NAROZNIK', o.h);
      addPiece(req, 'NAROZNIK', o.h);
      if (o.top < H - 0.01) addPiece(req, 'NAROZNIK', o.w);
      if (o.sill > 0.01) addPiece(req, 'NAROZNIK', o.w);
    }
  }

  // --- Wełna ---
  if (w.insulation) add(req.area, `WELNA${sys.profile}`, net);

  return {
    req,
    info: { lengthM: L, heightM: H, netAreaM2: net, studPositions, jambPositions, junctions: j },
  };
}

export interface CeilingGridLine {
  /** współrzędna linii (cm) w osi poprzecznej */
  at: number;
  segments: [number, number][]; // cm
  axis: 'x' | 'y'; // wzdłuż jakiej osi biegnie profil
  level: 'main' | 'secondary';
}

/** Linie rusztu sufitowego (współrzędne w cm) – wspólne dla wyliczeń i rysunku/3D */
export function ceilingGrid(c: Ceiling): CeilingGridLine[] {
  const sys = ceilingSystemById(c.systemId);
  const bb = bbox(c.points);
  const lines: CeilingGridLine[] = [];
  // profile nośne biegną wzdłuż osi „mainAxis”, rozstawione w osi poprzecznej
  const mainAxis: 'x' | 'y' = c.direction === 0 ? 'x' : 'y';
  const crossAxis: 'x' | 'y' = mainAxis === 'x' ? 'y' : 'x';
  const range = (axis: 'x' | 'y') => (axis === 'x' ? [bb.minX, bb.maxX] : [bb.minY, bb.maxY]);

  const place = (axis: 'x' | 'y', spacing: number, level: 'main' | 'secondary', firstOffset: number) => {
    // linie biegną wzdłuż `axis`, więc rozmieszczamy je w osi poprzecznej
    const across = axis === 'x' ? 'y' : 'x';
    const [lo, hi] = range(across);
    for (let at = lo + firstOffset; at < hi - 5; at += spacing) {
      // scanline('x', c) = przecięcie z linią y = c (zakresy x)
      const segments = scanline(c.points, at, axis === 'x' ? 'x' : 'y');
      if (segments.length) lines.push({ at, segments, axis, level });
    }
  };

  if (sys.kind === 'two-level') {
    place(mainAxis, sys.mainSpacing, 'main', Math.min(sys.mainSpacing / 2, 40));
    place(crossAxis, sys.secondarySpacing, 'secondary', sys.secondarySpacing);
  } else if (sys.kind === 'one-level') {
    place(mainAxis, sys.mainSpacing, 'main', Math.min(sys.mainSpacing / 2, 40));
    place(crossAxis, sys.secondarySpacing, 'secondary', sys.secondarySpacing);
  } else {
    place(crossAxis, sys.secondarySpacing, 'main', sys.secondarySpacing);
  }
  return lines;
}

export function ceilingRequirement(c: Ceiling): { req: Requirement; areaM2: number; perimeterM: number } {
  const req = emptyReq();
  const sys = ceilingSystemById(c.systemId);
  const A = polygonArea(c.points) / 10000;
  const edges = polygonPerimeterEdges(c.points).map((e) => e / 100);
  const P = edges.reduce((a, b) => a + b, 0);

  // obwodowe UD
  for (const e of edges) {
    addPiece(req, 'UD27', e);
    add(req.counts, 'KOLEK', Math.max(3, Math.ceil(e / 0.6) + 1));
  }
  add(req.meters, 'TASMA_USZ30', P);

  const grid = ceilingGrid(c);
  const mains = grid.filter((g) => g.level === 'main');
  const secs = grid.filter((g) => g.level === 'secondary');

  for (const g of grid) {
    for (const [s0, s1] of g.segments) {
      const run = (s1 - s0) / 100;
      addPiece(req, 'CD60', run);
      add(req.counts, 'LACZNIK_WZDL', Math.max(0, Math.ceil(run / 4) - 1));
      if (g.level === 'main') {
        const hangers = Math.max(2, Math.ceil(run / (sys.hangerSpacing / 100)));
        if (sys.kind === 'direct') {
          add(req.counts, 'WIESZAK_ES', hangers);
          add(req.counts, 'LN9', hangers * 2);
        } else {
          add(req.counts, 'WIESZAK_NONIUSZ', hangers);
          add(req.counts, 'ZAWLECZKA', hangers * 2);
        }
        add(req.counts, 'KOTWA', hangers);
      }
    }
  }

  // skrzyżowania profili nośnych i montażowych
  if (sys.kind !== 'direct') {
    let crossings = 0;
    for (const m of mains) {
      for (const sl of secs) {
        const pt = m.axis === 'x' ? { x: sl.at, y: m.at } : { x: m.at, y: sl.at };
        if (pointInPolygon(pt, c.points)) crossings++;
      }
    }
    if (sys.kind === 'two-level') add(req.counts, 'LACZNIK_KRZ', crossings);
    else add(req.counts, 'LACZNIK_JEDNO', crossings * 2);
  }

  // płyty
  const longSide = Math.max(bbox(c.points).maxX - bbox(c.points).minX, bbox(c.points).maxY - bbox(c.points).minY);
  const sheetLen = pickBoardLength(c.boardId, Math.min(longSide, 300));
  add(req.boardArea, `${c.boardId}|${sheetLen}`, A * sys.layers);
  if (sys.layers === 1) add(req.counts, 'TN25', A * 20);
  else {
    add(req.counts, 'TN25', A * 10);
    add(req.counts, 'TN35', A * 20);
  }
  add(req.meters, 'TASMA_SPOIN', A * 1.2);
  add(req.kg, 'MASA', A * 0.4 + A * (sys.layers - 1) * 0.2);
  if (c.insulation) add(req.area, 'WELNA100', A);

  return { req, areaM2: A, perimeterM: P };
}

// ---------------------------------------------------------------------------
// Rozkrój profili: first-fit decreasing na długościach handlowych
// ---------------------------------------------------------------------------

const KERF = 0.005;

export interface CutResult {
  bars: { stock: number; pieces: number[] }[];
}

export function cutPieces(pieces: number[], stocks: number[]): CutResult {
  const sortedStocks = [...stocks].sort((a, b) => a - b);
  const max = sortedStocks[sortedStocks.length - 1];
  const defaultStock = stocks[0];
  const list: number[] = [];
  const bars: { stock: number; pieces: number[]; free: number }[] = [];
  for (const p of pieces) {
    let rest = p;
    // elementy dłuższe niż najdłuższy profil – pełne sztuki + dostawka
    while (rest > max + 1e-9) {
      bars.push({ stock: max, pieces: [max], free: 0 });
      rest -= max;
    }
    if (rest > 0.01) list.push(rest);
  }
  list.sort((a, b) => b - a);
  for (const p of list) {
    const bin = bars
      .filter((b) => b.free >= p + KERF - 1e-9)
      .sort((a, b) => a.free - b.free)[0];
    if (bin) {
      bin.pieces.push(p);
      bin.free -= p + KERF;
    } else {
      // długie elementy: najkrótsza pasująca sztuka; krótkie: standardowa długość
      const stock = p > defaultStock ? (sortedStocks.find((s) => s >= p - 1e-9) ?? max) : defaultStock;
      const fit = p >= stock * 0.7 ? (sortedStocks.find((s) => s >= p - 1e-9) ?? stock) : stock;
      bars.push({ stock: fit, pieces: [p], free: fit - p - KERF });
    }
  }
  return { bars: bars.map(({ stock, pieces }) => ({ stock, pieces })) };
}

const stockFamily = (productId: string) =>
  productId.startsWith('CW')
    ? 'CW'
    : productId.startsWith('UW')
      ? 'UW'
      : productId.startsWith('UA')
        ? 'UA'
        : productId.startsWith('CD')
          ? 'CD'
          : productId.startsWith('UD')
            ? 'UD'
            : productId;

// ---------------------------------------------------------------------------
// Zestawienie materiałów
// ---------------------------------------------------------------------------

export interface MaterialLine {
  key: string;
  group: Product['group'];
  name: string;
  /** Ilość do zamówienia w jednostce bazowej (już z naddatkiem i zaokrągleniem) */
  qty: number;
  unit: Unit;
  /** Ilość opakowań handlowych, jeśli dotyczy */
  packs?: number;
  packUnit?: Unit;
  note?: string;
}

const GROUP_ORDER: Product['group'][] = ['Płyty', 'Profile', 'Akcesoria do sufitów', 'Mocowanie', 'Izolacja', 'Wykończenie'];

const fmtLen = (m: number) => m.toFixed(2).replace('.', ',');

export function summarize(reqs: Requirement[], wastePct: number): MaterialLine[] {
  const waste = 1 + wastePct / 100;
  const lines: MaterialLine[] = [];
  const merged = emptyReq();
  for (const r of reqs) {
    for (const [k, v] of Object.entries(r.pieces)) (merged.pieces[k] ??= []).push(...v);
    for (const key of ['boardArea', 'counts', 'meters', 'kg', 'area'] as const)
      for (const [k, v] of Object.entries(r[key])) add(merged[key], k, v);
  }

  // płyty
  for (const [key, area] of Object.entries(merged.boardArea)) {
    const [boardId, lenStr] = key.split('|');
    const board = BOARDS.find((b) => b.id === boardId) ?? boardById(boardId);
    const len = Number(lenStr);
    const sheetArea = (board.width / 100) * (len / 100);
    const sheets = Math.ceil((area * waste) / sheetArea - 1e-9);
    lines.push({
      key: `board-${key}`,
      group: 'Płyty',
      name: `${board.name}, ${board.width}×${len} cm`,
      qty: sheets,
      unit: 'szt.',
      note: `${area.toFixed(1).replace('.', ',')} m² netto`,
    });
  }

  // profile i narożniki – rozkrój
  for (const [pid, pieces] of Object.entries(merged.pieces)) {
    const product = PRODUCTS[pid];
    const stocks = STOCK_LENGTHS[stockFamily(pid)] ?? [product.length ?? 3];
    const { bars } = cutPieces(pieces, stocks);
    const byStock = new Map<number, number>();
    for (const b of bars) byStock.set(b.stock, (byStock.get(b.stock) ?? 0) + 1);
    const totalM = pieces.reduce((a, b) => a + b, 0);
    for (const [stock, count] of [...byStock.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push({
        key: `bar-${pid}-${stock}`,
        group: product.group === 'Wykończenie' ? 'Wykończenie' : 'Profile',
        name: `${product.name}, dł. ${fmtLen(stock)} m`,
        qty: count,
        unit: 'szt.',
        note: byStock.size === 1 ? `${fmtLen(totalM)} mb w elementach` : undefined,
      });
    }
  }

  const withPacks = (pid: string, qty: number, unit: Unit): MaterialLine => {
    const product = PRODUCTS[pid];
    const line: MaterialLine = { key: pid, group: product.group, name: product.name, qty, unit };
    if (product.pack && product.packUnit) {
      line.packs = Math.ceil(qty / product.pack - 1e-9);
      line.packUnit = product.packUnit;
    }
    return line;
  };

  for (const [pid, v] of Object.entries(merged.counts)) lines.push(withPacks(pid, Math.ceil(v * (pid.startsWith('T') || pid === 'LN9' ? waste : 1) - 1e-9), 'szt.'));
  for (const [pid, v] of Object.entries(merged.meters)) lines.push(withPacks(pid, Math.ceil(v * waste - 1e-9), 'mb'));
  for (const [pid, v] of Object.entries(merged.kg)) lines.push(withPacks(pid, Math.ceil(v * waste - 1e-9), 'kg'));
  for (const [pid, v] of Object.entries(merged.area)) lines.push(withPacks(pid, Math.ceil(v * waste * 10 - 1e-9) / 10, 'm²'));

  return lines.sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name, 'pl'),
  );
}

export interface ProjectCalc {
  walls: Map<string, { req: Requirement; info: WallBreakdown }>;
  ceilings: Map<string, { req: Requirement; areaM2: number; perimeterM: number }>;
  total: MaterialLine[];
  stats: { wallLengthM: number; wallAreaM2: number; ceilingAreaM2: number; openings: number };
}

export function calculateProject(p: Project): ProjectCalc {
  const junctions = analyzeJunctions(p);
  const nodes = nodeMap(p);
  const walls = new Map<string, { req: Requirement; info: WallBreakdown }>();
  let wallLengthM = 0;
  let wallAreaM2 = 0;
  let openings = 0;
  for (const w of p.walls) {
    if (!nodes.has(w.a) || !nodes.has(w.b)) continue;
    const r = wallRequirement(p, w, junctions.get(w.id)!);
    walls.set(w.id, r);
    wallLengthM += r.info.lengthM;
    wallAreaM2 += r.info.netAreaM2;
    openings += w.openings.length;
  }
  const ceilings = new Map<string, { req: Requirement; areaM2: number; perimeterM: number }>();
  let ceilingAreaM2 = 0;
  for (const c of p.ceilings) {
    if (c.points.length < 3) continue;
    const r = ceilingRequirement(c);
    ceilings.set(c.id, r);
    ceilingAreaM2 += r.areaM2;
  }
  const total = summarize(
    [...[...walls.values()].map((x) => x.req), ...[...ceilings.values()].map((x) => x.req)],
    p.settings.wasteEnabled ? p.settings.waste : 0,
  );
  return { walls, ceilings, total, stats: { wallLengthM, wallAreaM2, ceilingAreaM2, openings } };
}

export function materialsToCsv(lines: MaterialLine[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['Grupa', 'Materiał', 'Ilość', 'Jednostka', 'Opakowania', 'Uwagi']];
  for (const l of lines)
    rows.push([
      l.group,
      l.name,
      String(l.qty).replace('.', ','),
      l.unit,
      l.packs ? `${l.packs} ${l.packUnit}` : '',
      l.note ?? '',
    ]);
  return rows.map((r) => r.map(esc).join(';')).join('\n');
}
