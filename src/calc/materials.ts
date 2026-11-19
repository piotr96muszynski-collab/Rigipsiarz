import {
  BOARDS,
  PRODUCTS,
  STOCK_LENGTHS,
  boardById,
  isLiningSystem,
  ceilingMaxSpan,
  ceilingSystemById,
  wallMaxHeight,
  wallSystemById,
  wallTieCount,
  wallMaxWidth,
  type Board,
  type CeilingSystem,
  type Product,
  type WallSystem,
  type Unit,
} from '../catalog/rigips';
import { pickBoardLengthCm } from './boardLength';
import { FIXERS } from '../catalog/atlas';
import {
  analyzeJunctions,
  isNewWall,
  bbox,
  nodeMap,
  pointInPolygon,
  polygonArea,
  polygonPerimeterEdges,
  scanline,
  wallLength,
  type WallJunctions,
} from '../geometry/geometry';
import { WOOL_THICKNESSES, resolveWool, woolThicknessOf, type WoolChoice } from '../catalog/insulation';
import type { Ceiling, Lining, Point, Project, Wall } from '../model/types';
import { createAttic, createCeiling, createProject, createWall } from '../model/factory';
import { compoundById, resolveFinishing, tapeById, type FinishingSettings } from '../catalog/finishing';
import { analyzeJoints, type Joint } from './joints';
import { atticRequirement, type AtticResult } from './atticMaterials';
import { ceilingLevels, ceilingWallWarnings, hangerGapClass, layerBoards, type CeilingLevels } from './ceilingLevels';
import { buildContacts, partRange, type ContactModel } from '../geometry/contacts';
import { ceilingVaporSpec, vaporBarrierLines, vaporBarrierOn, wallVaporSpec } from './vaporBarrier';
import { OFFCUT_MIN, bracketPositions, panelRows, ceilingBoardLayout, fixerColumns, liningAsWall, liningContacts, pieceArea, wallLayout, type WallLayout } from './layout';

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
  /** Część boardArea, która jest odpadem z wycięć L/U przy otworach (ten sam klucz), m² */
  boardCutWaste?: Record<string, number>;
  /** Sztuki (wkręty, kołki, wieszaki, łączniki) */
  counts: Record<string, number>;
  /** Metry bieżące (taśmy) */
  meters: Record<string, number>;
  /** kg (masa) */
  kg: Record<string, number>;
  /** m² (wełna) */
  area: Record<string, number>;
  /** Uwagi do pozycji zestawienia (id produktu → teksty), np. odstęp uchwytów ES od stropu */
  notes?: Record<string, string[]>;
  /** Wieszaki noniuszowe wg zwieszenia: długość w cm (w górę do 5 cm) → sztuki */
  hangerGaps?: Record<string, number>;
}

const fmtLen = (m: number) => m.toFixed(2).replace('.', ',');

export const emptyReq = (): Requirement => ({ pieces: {}, boardArea: {}, counts: {}, meters: {}, kg: {}, area: {} });

export const add = (rec: Record<string, number>, key: string, v: number) => {
  if (v > 0) rec[key] = (rec[key] ?? 0) + v;
};
export const addPiece = (req: Requirement, product: string, len: number) => {
  if (len <= 0.01) return;
  (req.pieces[product] ??= []).push(len);
};

/** Dobór długości arkusza wg ustawienia aplikacji / projektu, cm */
export const pickBoardLength = (boardId: string, heightCm: number) => pickBoardLengthCm(boardId, heightCm);

const TAPE_FOR_PROFILE: Record<number, string> = { 50: 'TASMA_USZ50', 75: 'TASMA_USZ70', 100: 'TASMA_USZ95' };

/** Kołki co max 100 cm (karty Rigips 3.40/3.41), minimum 2 na odcinek */
export const anchorsFor = (lenM: number, spacingM = 1.0) =>
  lenM <= 0.05 ? 0 : Math.max(2, Math.ceil(lenM / spacingM - 1e-9) + 1);

const SCREW_LENGTHS = [25, 35, 45, 55, 70];

/**
 * Wkręt do płyt dla warstwy, której spód leży na głębokości `depthMm` od profilu:
 * wkręt musi wejść min. 10 mm w profil (25 mm dla 1×12,5; 35 mm dla 2×12,5; 45 mm dla 2×15…).
 */
export function screwFor(depthMm: number, cement = false): string {
  const need = depthMm + 10;
  const len = SCREW_LENGTHS.find((l) => l >= need - 0.01) ?? 70;
  if (cement) return len <= 25 ? 'AQ25' : 'AQ35';
  return `TN${len}`;
}

/** Długości wkrętów do płyt specjalnych (kalkulator Rigips) */
const SPECIAL_SCREWS: Record<NonNullable<Board['screws']>, { prefix: string; lengths: number[]; margin?: number }> = {
  habito: { prefix: 'HABITO', lengths: [26, 41] },
  hartfix: { prefix: 'HARTFIX', lengths: [25, 35, 45] },
  rigidur: { prefix: 'RIGIDUR', lengths: [30, 40], margin: 15 },
  ridurit: { prefix: 'RIDURIT', lengths: [40, 50, 70] },
  // płyty z matą szklaną do pomieszczeń mokrych kręci się wkrętami Aquaroc (AQ35 = wkręt 3,5×41)
  aquaroc: { prefix: 'AQ', lengths: [25, 41] },
};

/** Wkręt dla warstwy z płyty `layer`, gdy poszycie kończy płyta `outer` (jej wkręty obowiązują w całym poszyciu) */
export function screwForBoard(depthMm: number, layer: Board, outer: Board = layer): string {
  const kind = outer.screws ?? layer.screws;
  if (!kind) return screwFor(depthMm, layer.kind === 'cement');
  const { prefix, lengths, margin = 10 } = SPECIAL_SCREWS[kind];
  const len = lengths.find((l) => l >= depthMm + margin - 0.01) ?? lengths[lengths.length - 1];
  return kind === 'aquaroc' ? (len <= 25 ? 'AQ25' : 'AQ35') : `${prefix}${len}`;
}

export { layerBoards };

/** Wkręty do kolejnych warstw płyt: wewnętrzne rzadziej, zewnętrzna gęsto */
export function addBoardScrews(req: Requirement, area: number, boards: string[], outerPerM2: number, innerPerM2: number) {
  const outer = boardById(boards[boards.length - 1]);
  let depth = 0;
  boards.forEach((id, i) => {
    const b = boardById(id);
    depth += b.thickness;
    add(req.counts, screwForBoard(depth, b, outer), area * (i === boards.length - 1 ? outerPerM2 : innerPerM2));
  });
}

/**
 * Spoinowanie do poziomu Q1 (karty Rigips): taśma spoinowa na warstwie zewnętrznej,
 * masa wg karty wybranej masy na każdą warstwę płyt (warstwy wewnętrzne tylko wypełnione).
 * Gładzie (Q2–Q4) nie są liczone.
 */
export function addJointing(req: Requirement, area: number, layers: number, boardId: string, tapePerM2: number, fin: FinishingSettings) {
  if (boardById(boardId).kind === 'cement') {
    add(req.meters, 'TASMA_AQ', area * tapePerM2);
    add(req.kg, 'MASA_AQ', area * (0.5 + 0.25 * (layers - 1)));
    return;
  }
  add(req.meters, tapeById(fin.tape).product, area * tapePerM2);
  const c = compoundById(fin.compound);
  add(req.kg, c.product, area * c.kgPerM2 * layers);
}

/** Wkręty na m² jednej strony ściany przy rozstawie 60 cm (karta 3.40.05: 9 + 24 szt. na 2 strony) */
const WALL_SCREWS_OUTER = 12;
const WALL_SCREWS_INNER = 4.5;
/** Klej gipsowy pod płytę klejoną (placki), kg/m² – orientacyjnie */
const GLUE_PER_M2 = 5; // kalkulator Rigips 3.10.00: 500 kg na 100 m²

export interface WallBreakdown {
  lengthM: number;
  heightM: number;
  netAreaM2: number;
  studPositions: number[]; // m od początku ściany (pełne i skrócone)
  jambPositions: number[];
  junctions: WallJunctions;
  /** Ostrzeżenia, np. przekroczona wysokość systemu */
  warnings: string[];
  /** Odpad z wycięć płyt w kształcie L/U przy otworach (doliczony do płyt), m² */
  cutWasteM2?: number;
}

// ---------------------------------------------------------------------------
// Wełna mineralna: dobór grubości
// ---------------------------------------------------------------------------

/** Grubości wełny, które mieszczą się w ruszcie ściany (mm); pusta lista = bez wełny */
export function wallWoolOptions(sys: WallSystem): number[] {
  // płyta klejona i ATLAS M-System 3G – brak miejsca na wełnę
  if (sys.frame === 'glued' || sys.frame === 'point-fix') return [];
  // obudowa z samych płyt – wełna wg karty (Siniat: 50 mm, przy 2×15 do 100 mm)
  if (sys.frame === 'panel') return sys.panel?.wool ?? [];
  // okładzina na CD 60 i uchwytach ES – przestrzeń regulowana uchwytem, typowo 50 mm
  const cavity = sys.frame === 'cd-lining' ? 50 : sys.profile;
  return WOOL_THICKNESSES.filter((t) => t <= cavity);
}

/**
 * Wełna w ścianie: grubość (domyślnie pełna głębokość profilu) i liczba warstw –
 * w ścianie na podwójnym ruszcie wełna w obu rzędach (karta 3.41.01).
 */
export function wallInsulation(w: Wall, sys: WallSystem = wallSystemById(w.systemId)): { thickness: number; layers: number } | null {
  const options = wallWoolOptions(sys);
  if (!w.insulation || !options.length) return null;
  const thickness = options.includes(w.insulationThickness ?? -1) ? w.insulationThickness! : options[options.length - 1];
  return { thickness, layers: sys.frame === 'double' ? 2 : 1 };
}

/** Grubości wełny na sufit (układana na płytach / między profilami), mm */
export const CEILING_WOOL_OPTIONS: number[] = [...WOOL_THICKNESSES];

export function ceilingInsulation(c: Ceiling): { thickness: number; layers: number } | null {
  if (!c.insulation) return null;
  const thickness = CEILING_WOOL_OPTIONS.includes(c.insulationThickness ?? -1) ? c.insulationThickness! : 100;
  return { thickness, layers: 1 };
}

export function wallRequirement(
  p: Project,
  w: Wall,
  j: WallJunctions,
  sys: WallSystem = wallSystemById(w.systemId),
  contacts?: ContactModel,
): { req: Requirement; info: WallBreakdown } {
  const req = emptyReq();
  const L = wallLength(p, w) / 100;
  const H = w.height / 100;
  const s = w.studSpacing / 100;
  const warnings: string[] = [];

  const maxH = wallMaxHeight(sys, w.studSpacing, { board: w.boardId, doubleStuds: w.doubleStuds });
  if (maxH && w.height > maxH + 0.5)
    warnings.push(
      `Wysokość ${fmtLen(H)} m przekracza ${fmtLen(maxH / 100)} m dopuszczalne dla tego systemu przy rozstawie ${w.studSpacing} cm${w.doubleStuds ? ' i słupkach podwójnych' : ''} – zagęść słupki${w.doubleStuds ? '' : ', zastosuj słupki podwójne'} lub wybierz mocniejszy system.`,
    );

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

  if (sys.frame === 'panel') return panelWall(p, req, w, j, sys, L, H, openings, warnings, contacts);
  if (sys.frame === 'point-fix') return pointFixWall(req, w, j, sys, L, H, openings, warnings, wallLayout(p, w, j, contacts ?? buildContacts(p)));

  const isCD = sys.frame === 'cd-lining';
  const rows = sys.frame === 'glued' ? 0 : sys.frame === 'double' || sys.frame === 'separate' ? 2 : 1;
  const stud = isCD
    ? 'CD60'
    : sys.studKind === 'UA'
      ? `UA${sys.profile}`
      : sys.studKind === 'UU'
        ? `UW${sys.profile}`
        : sys.akuStuds && PRODUCTS[`CW${sys.profile}AKU`]
          ? `CW${sys.profile}AKU`
          : `CW${sys.profile}`;
  // słupki podwójne: dwa CW zespolone wkrętami (kalkulator Rigips: 8 pchełek/m² przy 1,8 m pary słupków na m²)
  const doubled = !!w.doubleStuds && !isCD && rows > 0;
  const track = isCD ? 'UD30' : `UW${sys.profile}`;
  const tape = isCD ? 'TASMA_USZ30' : TAPE_FOR_PROFILE[sys.profile];
  const bracketM = (sys.bracketSpacing ?? 100) / 100;

  // rozkład płyt i rusztu (ten sam co na rysunku i w 3D) – tylko dla ściany z projektu
  const m = contacts ?? (p.walls.includes(w) ? buildContacts(p) : undefined);
  const layout = m && sys.id === w.systemId ? wallLayout(p, w, j, m) : undefined;

  /** Słupek (CW) lub pionowy CD; CD okładziny mocujemy do ściany uchwytami ES */
  const addStud = (product: string, len: number) => {
    if (len <= 0.01) return;
    addPiece(req, product, len);
    if (isCD) {
      // tyle samo uchwytów co na rysunku „miejsca wiercenia” i w 3D
      const brackets = bracketPositions(0, len, bracketM).length;
      add(req.counts, 'WIESZAK_ES', brackets);
      add(req.counts, 'LN9', brackets * 2);
      add(req.counts, 'KOLEK', brackets);
    }
  };

  /**
   * Słupek z profilu UA: kątownik UA na każdym końcu, przykręcony do UA dwiema śrubami M8
   * (karta Siniat UAR50: 0,85 kątownika i 2 śruby na m² przy 3,88 m i rozstawie 60 cm)
   */
  const addUA = (len: number) => {
    addStud(stud, len);
    add(req.counts, 'KATUA', 2);
    add(req.counts, 'SRUBA_M8', 4);
  };

  /** Słupek w polu ściany: pojedynczy albo para zespolona pchełkami (UA – śrubami M8) */
  const addFieldStud = (len: number) => {
    if (len <= 0.01) return;
    if (sys.studKind === 'UA') {
      addUA(len);
      // para UA skręcona środnikami śrubami M8 co 25 cm, kątowniki tylko pod jednym profilem pary
      // (karta Siniat UARUAR50: rysunek + 8 śrub i 1,0 kątownika na m² przy 5 m)
      if (doubled) {
        addStud(stud, len);
        add(req.counts, 'SRUBA_M8', Math.ceil(len / 0.25 - 1e-9) + 1);
      }
    } else if (sys.studKind === 'UU') {
      // dwa U skręcone w skrzynkę wkrętami samowiercącymi + para UD 30 trzymająca płytę rdzeniową
      // (karta Siniat UU75: U 4,3 mb, UD27 3,6 mb, wkręty FLAT HEAD 9 szt./m²; kalkulator Rigips 3.50.10:
      // UW 100 i UD 30 po 3,6 mb, pchełki 20 szt./m² – przyjęto 10 wkrętów na mb słupka ≈ 17 szt./m²)
      addStud(stud, len);
      addStud(stud, len);
      addPiece(req, 'UD30', len);
      addPiece(req, 'UD30', len);
      add(req.counts, 'LN9', Math.ceil(len * 10));
    } else {
      addStud(stud, len);
      if (doubled) {
        addStud(stud, len);
        add(req.counts, 'LN9', Math.ceil(len * 4.4));
      }
    }
    // kotwienie słupka do ściany (kątowniki co 250 cm, przewiązki PWA)
    if (sys.wallTie) {
      const n = wallTieCount(sys.wallTie, len);
      add(req.counts, sys.wallTie.kind === 'angle' ? 'KATUA' : 'PWA', n);
      // kątownik kotwiony do muru kilkoma kołkami (karta C100/L: 5,4 elementu kotwiącego na m² przy 0,8 kątownika)
      add(req.counts, 'KOLEK', n * (sys.wallTie.kind === 'angle' ? 6 : 2));
    }
  };

  // --- Ruszt (jeden lub dwa rzędy) ---
  const studPositions: number[] = [];
  const jambPositions: number[] = [];
  const positions: number[] = [];
  if (rows > 0) {
    for (let x = 0; x < L - 0.1; x += s) positions.push(x);
    positions.push(L);
  }
  for (let row = 0; row < rows; row++) {
    for (const x of positions) {
      const op = openings.find((o) => x > o.x0 - 0.05 && x < o.x1 + 0.05);
      if (!op) {
        addFieldStud(H);
        if (row === 0) studPositions.push(x);
      } else if (x > op.x0 + 0.05 && x < op.x1 - 0.05) {
        // słupek w świetle otworu → krótkie odcinki nad i pod otworem
        addFieldStud(H - op.top);
        addFieldStud(op.sill);
        if (row === 0) studPositions.push(x);
      }
      // słupki pokrywające się z ościeżem zastępuje słupek ościeżnicowy
    }
    for (let i = 0; i < j.extraStuds; i++) addStud(stud, H);
    // słupki dodane pod styk płyt (przy otworach styki warstw nie miały się na czym minąć)
    for (const st of layout?.studs ?? []) if (st.kind === 'joint') for (const [y0, y1] of st.segments) addStud(stud, y1 - y0);

    // --- Ościeża, nadproża, podokienniki ---
    for (const o of openings) {
      if (row === 0) jambPositions.push(o.x0, o.x1);
      // w ruszcie z UA ościeże i tak jest z UA (z kątownikami jak słupki w polu)
      if (sys.studKind === 'UA') {
        for (let k = 0; k < 2; k++) addUA(H);
        }
      const useUA = o.reinforced && !isCD && sys.studKind !== 'UA';
      if (sys.studKind !== 'UA') for (let k = 0; k < 2; k++) addStud(useUA ? `UA${sys.profile}` : stud, H);
      if (useUA) {
        add(req.counts, 'KATUA', 4);
        add(req.counts, 'KOLEK', 8);
      }
      // nadproże z UW/UD z zagiętymi końcami (+15 cm na stronę)
      if (o.top < H - 0.05) addPiece(req, track, o.w + 0.3);
      if (o.sill > 0.05) addPiece(req, track, o.w + 0.3);
      add(req.counts, 'LN9', 8 + (o.sill > 0.05 ? 4 : 0));
    }

    // --- Profile UW/UD (posadzka i strop) ---
    const floorRuns: number[] = [];
    let cursor = 0;
    for (const o of [...openings].filter((o) => o.sill <= 0.01).sort((a, b) => a.x0 - b.x0)) {
      floorRuns.push(o.x0 - cursor);
      cursor = o.x1;
    }
    floorRuns.push(L - cursor);
    // UW na długość rusztu z modelu styków (ten sam rozkład co na rysunku): w narożniku ścian
    // różnej grubości ruszt ściany ciągłej sięga do zewnętrznego lica rusztu dochodzącej,
    // a dochodzącej kończy się na wewnętrznym licu rusztu ciągłej
    const runs = layout
      ? layout.tracks.filter((t) => t.kind === 'floor' || t.kind === 'ceiling').map((t) => t.x1 - t.x0)
      : [...floorRuns.filter((r) => r > 0.05), L];
    for (const r of runs) {
      addPiece(req, track, r);
      add(req.counts, 'KOLEK', anchorsFor(r));
    }
    add(req.meters, tape, runs.reduce((a, b) => a + b, 0));

    // końce przy istniejącej ścianie: słupek kotwiony + taśma
    for (const end of [j.endA, j.endB]) {
      if (end === 'existing-wall') {
        add(req.counts, 'KOLEK', anchorsFor(H));
        add(req.meters, tape, H);
      }
    }
  }

  // --- Ściana instalacyjna: rzędy łączone paskami płyty (ok. 30 cm) co ~1/3 wysokości ---
  if (sys.frame === 'separate') {
    const perStud = Math.max(2, Math.ceil(H / 1.2) - 1);
    const strips = positions.length * perStud;
    const stripArea = 0.3 * ((sys.gap ?? 10) / 100 + (2 * sys.profile) / 1000);
    add(req.boardArea, `${w.boardId}|${pickBoardLength(w.boardId, w.height)}`, strips * stripArea);
    add(req.counts, screwFor(boardById(w.boardId).thickness), strips * 4);
  }

  // --- Płyty ---
  const openingArea = openings.reduce((a, o) => a + o.w * o.h, 0);
  const net = Math.max(0, L * H - openingArea);
  const boards = layerBoards(sys, w.boardId, w.innerBoardId);
  // okładzina z łącznikami LS: płyty tylko do wysokości Hb (min. 3/4 wysokości wg karty Siniat)
  const Hb = sys.ls ? Math.round(H * sys.ls.boarded * 1000) / 1000 : H;
  const keyOf = (layer: number) => `${boards[layer] ?? w.boardId}|${pickBoardLength(boards[layer] ?? w.boardId, Hb * 100)}`;
  const sheetKey = keyOf(sys.layers - 1);
  // każda warstwa na swoją długość z modelu styków: w narożniku płyta zachodzi na czoło sąsiedniej
  // ściany albo dochodzi do jej płyty, w trójniku i przy okładzinie muru kończy się na ich licu
  const areaByKey: Record<string, number> = {};
  let cutWaste = 0;
  if (layout) {
    // z rozkładu płyt (ten sam co na rysunku i w 3D): elementy po wycięciu otworów
    // + odpad z wycięć L/U, z którego nie da się już nic przykręcić (pas węższy niż 30 cm)
    for (const face of layout.faces)
      for (const pc of face.pieces) {
        add(areaByKey, keyOf(face.layer), pieceArea(pc));
        for (const n of pc.notches ?? []) if (Math.min(n.x1 - n.x0, n.y1 - n.y0) < OFFCUT_MIN) cutWaste += (n.x1 - n.x0) * (n.y1 - n.y0);
      }
  } else
    for (let side = 0 as 0 | 1; side < sys.sides; side = (side + 1) as 0 | 1)
      for (let layer = 0; layer < sys.layers; layer++) {
        const [x0, x1] = m ? partRange(m, w, L, { kind: 'board', side, layer }) : [0, L];
        add(areaByKey, keyOf(layer), Math.max(0, (x1 - x0) * Hb - openingArea));
      }
  for (const [k, a] of Object.entries(areaByKey)) add(req.boardArea, k, a);
  // odpad z wycięć liczymy do płyty zewnętrznej
  if (cutWaste > 0) add(req.boardArea, sheetKey, cutWaste);
  if (cutWaste > 0) add((req.boardCutWaste ??= {}), sheetKey, cutWaste);
  // powierzchnia opłytowana (przy łącznikach LS tylko dolna część ściany)
  const boardedNet = sys.ls ? Math.max(0, L * Hb - openingArea) : net;
  const faceArea = boardedNet * sys.sides;

  // --- Łączniki stabilizacyjne LS: po jednym na każdym słupku nad opłytowaniem, kołkowane do ściany ---
  if (sys.ls) {
    const n = studPositions.length;
    add(req.counts, `LS${sys.profile}`, n);
    add(req.counts, 'KOLEK', n);
  }

  // --- Wkręty lub klej ---
  if (sys.frame === 'glued') {
    add(req.kg, 'KLEJ', faceArea * GLUE_PER_M2);
  } else {
    // gęstszy ruszt i słupki podwójne = proporcjonalnie więcej wkrętów (płytę kręcimy do obu słupków pary)
    const f = (0.6 / Math.max(0.2, s)) * (doubled ? 2 : 1);
    addBoardScrews(req, faceArea, boards, WALL_SCREWS_OUTER * f, WALL_SCREWS_INNER * f);
  }

  // --- Spoinowanie ---
  addJointing(req, faceArea, sys.layers, w.boardId, 1.4, resolveFinishing(p.settings.finishing));

  // Narożniki, kąty wewnętrzne i styki liczy analyzeJoints (src/calc/joints.ts)

  // --- Wełna: powierzchnia netto ściany (po odjęciu otworów) × liczba warstw ---
  const ins = wallInsulation(w, sys);
  if (ins) add(req.area, `WELNA${ins.thickness}`, boardedNet * ins.layers);
  // paroizolacja po jednej stronie (od pomieszczenia), pod płytami
  const vapor = wallVaporSpec(sys);
  if (vaporBarrierOn(w.vaporBarrier, vapor)) vaporBarrierLines(req, net, vapor);

  return {
    req,
    info: { lengthM: L, heightM: H, netAreaM2: net, studPositions, jambPositions, junctions: j, warnings, cutWasteM2: cutWaste },
  };
}

// ---------------------------------------------------------------------------
// ATLAS M-SYSTEM 3G – płyty na łącznikach talerzykowych (bez profili)
// ---------------------------------------------------------------------------

/**
 * Liczba łączników na prostokącie L×H przy siatce sx×sy (m): rzędy i kolumny także
 * przy krawędziach płyt, minus łączniki wypadające w otworach.
 */
export function pointFixCount(L: number, H: number, sx: number, sy: number, holesArea = 0): number {
  const cols = Math.ceil(L / sx - 1e-9) + 1;
  const rows = Math.ceil(H / sy - 1e-9) + 1;
  return Math.max(0, cols * rows - Math.floor(holesArea / (sx * sy) + 1e-9));
}

/** Spoinowanie w systemie ATLAS: taśma, STONER na każdą warstwę, GTA na wierzch (zużycie orientacyjne) */
function addAtlasJointing(req: Requirement, area: number, layers: number, tapePerM2: number) {
  add(req.meters, 'TASMA_SPOIN', area * tapePerM2);
  add(req.kg, 'ATLAS_STONER', area * 0.25 * layers);
  add(req.kg, 'ATLAS_GTA', area * 0.1);
}

function pointFixWall(
  req: Requirement,
  w: Wall,
  j: WallJunctions,
  sys: WallSystem,
  L: number,
  H: number,
  openings: { x0: number; x1: number; w: number; h: number; sill: number; top: number }[],
  warnings: string[],
  layout: WallLayout,
): { req: Requirement; info: WallBreakdown } {
  const fixer = sys.fixer ?? FIXERS.L100;
  const sx = w.studSpacing / 100;
  const sy = (sys.pointSpacing ?? 50) / 100;
  const openingArea = openings.reduce((a, o) => a + o.w * o.h, 0);
  const net = Math.max(0, L * H - openingArea);

  // łączniki (zestaw zawiera talerzyk, kołek i 4 wkręty – osobnych wkrętów TN nie liczymy)
  // te same łączniki co na rysunku i w 3D (siatka z układu płyt: krawędzie, styki, otwory)
  const n = layout.fixers?.points.length ?? 0;
  add(req.counts, fixer.product, n);
  if (fixer.extension) add(req.counts, fixer.extension, n);

  const faceArea = net * sys.sides;
  add(req.boardArea, `${w.boardId}|${pickBoardLength(w.boardId, w.height)}`, faceArea * sys.layers);
  addAtlasJointing(req, faceArea, sys.layers, 1.4);

  // narożniki i krawędzie otworów liczy analyzeJoints (src/calc/joints.ts)

  if (w.insulation) warnings.push('W systemie ATLAS M-System 3G aplikacja nie liczy wełny – odstęp płyty od ściany jest za mały na typowe płyty izolacyjne.');
  if (sys.layers > 1 && sx * sy > 0.36 + 1e-9)
    warnings.push('Dwie warstwy płyt na łącznikach ATLAS: karta zaleca siatkę 60×60 cm lub gęstszą.');

  return {
    req,
    info: { lengthM: L, heightM: H, netAreaM2: net, studPositions: [], jambPositions: [], junctions: j, warnings },
  };
}

// ---------------------------------------------------------------------------
// Obudowa szachtu z samych płyt (Siniat „bez konstrukcji nośnej”, Rigips 3.50.14/19/22, 3.80.15)
// ---------------------------------------------------------------------------

/**
 * Płyty poziomo, każda w jednym kawałku od ściany do ściany (największa szerokość obudowy z karty =
 * długość arkusza), warstwy skręcone ze sobą wkrętami z karty. Profil obwodowy (kątownik 40×40×1
 * albo profil C) przykołkowany do ścian po obu stronach – w Rigips także do posadzki i stropu.
 */
function panelWall(
  p: Project,
  req: Requirement,
  w: Wall,
  j: WallJunctions,
  sys: WallSystem,
  L: number,
  H: number,
  openings: { x0: number; x1: number; w: number; h: number; sill: number; top: number }[],
  warnings: string[],
  contacts?: ContactModel,
): { req: Requirement; info: WallBreakdown } {
  const spec = sys.panel!;
  const openingArea = openings.reduce((a, o) => a + o.w * o.h, 0);
  const net = Math.max(0, L * H - openingArea);

  const maxW = wallMaxWidth(sys, w.boardId);
  if (maxW && L * 100 > maxW + 0.5)
    warnings.push(
      `Szerokość ${fmtLen(L)} m przekracza ${fmtLen(maxW / 100)} m dopuszczalne w tym systemie dla tej płyty – płyta musi sięgać w jednym kawałku od ściany do ściany. Zmniejsz obudowę albo wybierz obudowę na profilach.`,
    );
  const longest = Math.max(...boardById(w.boardId).lengths);
  if (L * 100 > longest + 0.5 && !(maxW && L * 100 > maxW + 0.5))
    warnings.push(`Szerokość ${fmtLen(L)} m jest większa niż najdłuższy arkusz tej płyty (${fmtLen(longest / 100)} m) – wybierz płytę w dłuższym formacie.`);
  if ([j.endA, j.endB].some((e) => e !== 'existing-wall'))
    warnings.push('Obudowa z samych płyt musi z obu stron opierać się o ściany (profil obwodowy kołkowany do muru) – połącz jej oba końce ze ścianą istniejącą.');
  if (openings.length)
    warnings.push('Karta obudowy z samych płyt nie opisuje otworów – w obudowie stosuje się tylko klapy rewizyjne (przy wymaganiach ogniowych – klapy z klasą EI).');

  // --- Profil obwodowy, kołki, taśma uszczelniająca ---
  const runs = [H, H, ...(spec.edgeSides === 'all' ? [L, L] : [])];
  const anchorM = spec.anchorSpacing / 100;
  for (const r of runs) {
    addPiece(req, spec.edge, r);
    // po obwodzie kołki w narożnikach są wspólne dla dwóch odcinków (zamknięty obwód)
    add(req.counts, 'KOLEK', Math.ceil(r / anchorM - 1e-9) + (spec.edgeSides === 'all' ? 0 : 1));
  }
  const tape = spec.edge.startsWith('CW') ? TAPE_FOR_PROFILE[Number(spec.edge.slice(2))] ?? 'TASMA_USZ50' : 'TASMA_USZ30';
  add(req.meters, tape, runs.reduce((a, b) => a + b, 0));

  // --- Płyty: pasy poziome od ściany do ściany (rozkład ten sam co na rysunku i w 3D). Pas węższy
  // niż arkusz docinamy wzdłuż – resztę wykorzystuje pas innej warstwy, dlatego arkusze liczymy
  // z wysokości wszystkich pasów (pakowanie pasów w szerokość arkusza). Odcięty koniec arkusza
  // dłuższego niż szerokość obudowy i niewykorzystane resztki to odpad. ---
  const boards = layerBoards(sys, w.boardId, w.innerBoardId);
  const m = contacts ?? (p.walls.includes(w) ? buildContacts(p) : undefined);
  const layout = m && sys.id === w.systemId ? wallLayout(p, w, j, m) : undefined;
  const byKey = new Map<string, { layers: number[]; len: number; width: number }>();
  boards.forEach((id, layer) => {
    const lenCm = pickBoardLengthCm(id, L * 100);
    const key = `${id}|${lenCm}`;
    const e = byKey.get(key) ?? { layers: [], len: lenCm / 100, width: boardById(id).width / 100 };
    e.layers.push(layer);
    byKey.set(key, e);
  });
  for (const [key, e] of byKey) {
    const sheets = panelSheets(L, H, e.len, e.width, e.layers);
    const used = layout
      ? layout.faces.filter((f) => e.layers.includes(f.layer)).reduce((a, f) => a + f.pieces.reduce((s2, pc) => s2 + pieceArea(pc), 0), 0)
      : net * e.layers.length;
    const total = sheets * e.len * e.width;
    add(req.boardArea, key, total);
    if (total - used > 1e-3) add((req.boardCutWaste ??= {}), key, total - used);
  }

  // --- Wkręty wg karty (szt./m² obudowy) ---
  for (const sc of spec.screws) add(req.counts, sc.product, net * sc.perM2);

  // --- Spoinowanie (taśma 1,4 mb/m² jak w kartach) ---
  addJointing(req, net, sys.layers, w.boardId, 1.4, resolveFinishing(p.settings.finishing));

  const ins = wallInsulation(w, sys);
  if (ins) add(req.area, `WELNA${ins.thickness}`, net);

  return {
    req,
    info: { lengthM: L, heightM: H, netAreaM2: net, studPositions: [], jambPositions: [], junctions: j, warnings },
  };
}

/**
 * Arkusze na obudowę z samych płyt (warstwy `layers`): każdy pas to arkusz przycięty wzdłuż do
 * wysokości pasu (pas dłuższy niż arkusz – kilka arkuszy). Pasy węższe niż arkusz pakujemy razem
 * w szerokość arkusza (najpierw najszersze), bo z jednego arkusza tnie się np. dolny pas jednej
 * warstwy i górny drugiej.
 */
export function panelSheets(L: number, H: number, sheetLen: number, sheetW: number, layers: number[]): number {
  const across = Math.max(1, Math.ceil(L / sheetLen - 1e-9));
  const strips = layers.flatMap((layer) => panelRows(H, sheetW, layer).map(([a, b]) => b - a)).sort((a, b) => b - a);
  const bins: number[] = [];
  for (const h of strips) {
    const i = bins.findIndex((free) => free >= h - 1e-6);
    if (i >= 0) bins[i] -= h;
    else bins.push(sheetW - h);
  }
  return bins.length * across;
}

/** Odsunięcie skrajnych łączników sufitu od ścian, cm (instrukcja ATLAS: 7 cm) */
const CEIL_EDGE = 7;

/** Odległość punktu od odcinka, cm */
function segDist(q: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2));
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
}

/** Obrys odsunięty do wnętrza o `d` (przecięcia przesuniętych krawędzi), cm */
function insetPolygon(pts: Point[], d: number): Point[] {
  const n = pts.length;
  const area = pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * p.y, 0);
  const k = area > 0 ? 1 : -1; // wnętrze po lewej przy obiegu dodatnim
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const nx = (-(q.y - p.y) / L) * k;
    const ny = ((q.x - p.x) / L) * k;
    return { p: { x: p.x + nx * d, y: p.y + ny * d }, u: { x: (q.x - p.x) / L, y: (q.y - p.y) / L } };
  });
  return lines.map((cur, i) => {
    const prev = lines[(i - 1 + n) % n];
    const den = prev.u.x * cur.u.y - prev.u.y * cur.u.x;
    if (Math.abs(den) < 1e-9) return cur.p;
    const t = ((cur.p.x - prev.p.x) * cur.u.y - (cur.p.y - prev.p.y) * cur.u.x) / den;
    return { x: prev.p.x + prev.u.x * t, y: prev.p.y + prev.u.y * t };
  });
}

/**
 * Siatka łączników ATLAS M-System 3G na suficie, cm (współrzędne planu). Najpierw łączniki
 * wzdłuż każdej ściany, 7 cm od niej (instrukcja ATLAS) – także przy ścianach ukośnych i we
 * wnękach obrysu – potem pośrednie w osiach siatki. Żadnego łącznika nie usuwamy; przy ścianie
 * mogą wypaść gęściej. `xs`/`ys` – osie siatki, `points` – wszystkie łączniki.
 */
export function ceilingFixerGrid(c: Ceiling, sys: CeilingSystem = ceilingSystemById(c.systemId)) {
  const bb = bbox(c.points);
  // siatka „szer. × dł.” z instrukcji: 40 cm w poprzek płyt (3 rzędy na szerokość 120 cm, styk
  // długich krawędzi na rzędzie), 50 cm wzdłuż płyt (styk krótkich krawędzi co 250 cm na rzędzie).
  // Płyty leżą wzdłuż osi `direction` (jak w ceilingBoardLayout).
  const sx = c.direction === 0 ? sys.secondarySpacing : sys.mainSpacing;
  const sy = c.direction === 0 ? sys.mainSpacing : sys.secondarySpacing;
  // osie: skrajne 7 cm od krawędzi obrysu, pośrednie co rozstaw od krawędzi sufitu (cm)
  const axis = (lo: number, hi: number, step: number) => fixerColumns(0, (hi - lo) / 100, step / 100).map((v) => Math.round((lo + v * 100) * 10) / 10);
  // styki płyt: każdy styk leży na rzędzie łączników (krótkie krawędzie wypadają w osiach
  // kolumn, długie – co 120 cm – dostają własny rząd)
  const joints = ceilingBoardLayout(c).pieces;
  const withJoints = (base: number[], cuts: number[], lo: number, hi: number) => {
    const out = [...base];
    for (const v of cuts) if (v > lo + CEIL_EDGE + 0.5 && v < hi - CEIL_EDGE - 0.5 && !out.some((o) => Math.abs(o - v) < 0.5)) out.push(v);
    return out.sort((a, b) => a - b);
  };
  const xs = withJoints(axis(bb.minX, bb.maxX, sx), joints.map((q) => q.x0), bb.minX, bb.maxX);
  const ys = withJoints(axis(bb.minY, bb.maxY, sy), joints.map((q) => q.y0), bb.minY, bb.maxY);
  const pts = c.points;
  const n = pts.length;
  const points: Point[] = [];
  const add = (q: Point) => {
    if (!points.some((o) => Math.abs(o.x - q.x) < 0.5 && Math.abs(o.y - q.y) < 0.5)) points.push({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 });
  };
  // 1) wzdłuż ścian: odcinek 7 cm od ściany, łączniki na końcach i w osiach siatki (przy ścianie
  //    równoległej do osi) albo co mniejszy rozstaw od narożnika (przy ścianie ukośnej)
  if (n >= 3) {
    const inner = insetPolygon(pts, CEIL_EDGE);
    for (let i = 0; i < n; i++) {
      const a = inner[i];
      const b = inner[(i + 1) % n];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < 0.5) {
        add(a);
        continue;
      }
      const along: number[] = [0, L];
      const ux = (b.x - a.x) / L;
      const uy = (b.y - a.y) / L;
      if (Math.abs(uy) < 1e-6) for (const x of xs) along.push((x - a.x) / ux);
      else if (Math.abs(ux) < 1e-6) for (const y of ys) along.push((y - a.y) / uy);
      else {
        const step = Math.min(sx, sy);
        for (let t = step; t < L - 0.5; t += step) along.push(t);
      }
      for (const t of along) if (t >= -1e-6 && t <= L + 1e-6) add({ x: a.x + ux * t, y: a.y + uy * t });
    }
  }
  // 2) pośrednie: węzły siatki w obrysie, nie bliżej ściany niż rząd przyścienny
  for (const x of xs)
    for (const y of ys) {
      const q = { x, y };
      if (!pointInPolygon(q, pts)) continue;
      const d = Math.min(...pts.map((p, i) => segDist(q, p, pts[(i + 1) % n])));
      if (d >= CEIL_EDGE - 0.5) add(q);
    }
  return { xs, ys, points };
}

function pointFixCeiling(c: Ceiling, sys: CeilingSystem, A: number, P: number): CeilingResult {
  const req = emptyReq();
  const warnings: string[] = [];
  const fixer = sys.fixer ?? FIXERS.L100;
  const bb = bbox(c.points);
  const n = ceilingFixerGrid(c, sys).points.length;
  add(req.counts, fixer.product, n);
  if (fixer.extension) add(req.counts, fixer.extension, n);

  const longSide = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
  add(req.boardArea, `${c.boardId}|${pickBoardLength(c.boardId, Math.min(longSide, 300))}`, A * sys.layers);
  addAtlasJointing(req, A, sys.layers, 1.2);

  if (sys.layers > 1) warnings.push('Na sufitach system ATLAS M-System 3G dopuszcza tylko jedną warstwę płyt.');
  if (c.insulation) warnings.push('W systemie ATLAS M-System 3G aplikacja nie liczy wełny na suficie.');
  return { req, areaM2: A, perimeterM: P, warnings };
}

export interface CeilingGridLine {
  /** współrzędna linii (cm) w osi poprzecznej */
  at: number;
  segments: [number, number][]; // cm
  axis: 'x' | 'y'; // wzdłuż jakiej osi biegnie profil
  level: 'main' | 'secondary';
}

/**
 * Skrzyżowania profili nośnych i montażowych (cm, w układzie planu) – tam stoją łączniki:
 * krzyżowy (sufit dwupoziomowy), dwa jednopoziomowe albo dwa UA–CD. Okładzina na uchwytach
 * bezpośrednich i sufity przęsłowe CW nie mają łączników krzyżowych.
 */
export function ceilingCrossings(
  c: Ceiling,
  sys: CeilingSystem = ceilingSystemById(c.systemId),
  grid: CeilingGridLine[] = ceilingGrid(c, sys),
): Point[] {
  if (sys.kind !== 'two-level' && sys.kind !== 'one-level' && sys.kind !== 'ua-span') return [];
  const mains = grid.filter((g) => g.level === 'main');
  const secs = grid.filter((g) => g.level === 'secondary');
  return mains.flatMap((m) =>
    secs.map((sl) => (m.axis === 'x' ? { x: sl.at, y: m.at } : { x: m.at, y: sl.at })).filter((pt) => pointInPolygon(pt, c.points)),
  );
}

/** Linie rusztu sufitowego (współrzędne w cm) – wspólne dla wyliczeń i rysunku/3D */
export function ceilingGrid(c: Ceiling, sys: CeilingSystem = ceilingSystemById(c.systemId)): CeilingGridLine[] {
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

  switch (sys.kind) {
    case 'two-level':
    case 'one-level':
    case 'ua-span':
      place(mainAxis, sys.mainSpacing, 'main', Math.min(sys.mainSpacing / 2, 40));
      place(crossAxis, sys.secondarySpacing, 'secondary', sys.secondarySpacing);
      break;
    case 'cw-span':
      // CW oparte na ścianach, biegną wzdłuż kierunku „nośnego”
      place(mainAxis, sys.secondarySpacing, 'main', sys.secondarySpacing);
      break;
    case 'point-fix':
      // brak profili – płyta na łącznikach punktowych
      break;
    default:
      place(crossAxis, sys.secondarySpacing, 'main', sys.secondarySpacing);
  }
  return lines;
}

export interface CeilingResult {
  req: Requirement;
  areaM2: number;
  perimeterM: number;
  warnings: string[];
  /** Strop, spód płyt, ruszt i zwieszenie – te same wartości co w 3D i na przekroju */
  levels?: CeilingLevels;
}

export const addNote = (req: Requirement, pid: string, text: string) => {
  const list = ((req.notes ??= {})[pid] ??= []);
  if (!list.includes(text)) list.push(text);
};

export function ceilingRequirement(
  c: Ceiling,
  sys: CeilingSystem = ceilingSystemById(c.systemId),
  fin: FinishingSettings = resolveFinishing(),
): CeilingResult {
  const req = emptyReq();
  const A = polygonArea(c.points) / 10000;
  const edges = polygonPerimeterEdges(c.points).map((e) => e / 100);
  const P = edges.reduce((a, b) => a + b, 0);
  const levels = ceilingLevels(c, sys);
  const warnings: string[] = [...levels.warnings];
  if (sys.kind === 'point-fix') {
    const r = pointFixCeiling(c, sys, A, P);
    return { ...r, warnings: [...warnings, ...r.warnings], levels };
  }
  // zwieszenie (wierzch rusztu – strop) do zestawienia: górna część noniusza / odgięcie uchwytu
  const gap = hangerGapClass(levels.hangerGap);

  // obwodowe UD 30 (w suficie na CW: UW o szerokości profilu)
  const cwSpan = sys.kind === 'cw-span';
  const profile = sys.profile ?? 50;
  const perimeterProfile = cwSpan ? `UW${profile}` : 'UD30';
  for (const e of edges) {
    addPiece(req, perimeterProfile, e);
    add(req.counts, 'KOLEK', anchorsFor(e, 0.8));
  }
  add(req.meters, cwSpan ? TAPE_FOR_PROFILE[profile] : 'TASMA_USZ30', P);

  const grid = ceilingGrid(c, sys);
  const mainProduct = sys.kind === 'ua-span' ? 'UA50' : cwSpan ? `CW${profile}` : 'CD60';

  let longestMain = 0;
  for (const g of grid) {
    for (const [s0, s1] of g.segments) {
      const run = (s1 - s0) / 100;
      const product = g.level === 'main' ? mainProduct : 'CD60';
      addPiece(req, product, run);
      if (product === 'CD60') add(req.counts, 'LACZNIK_WZDL', Math.max(0, Math.ceil(run / 4 - 1e-9) - 1));
      if (g.level !== 'main') continue;
      longestMain = Math.max(longestMain, run);
      if (sys.kind === 'ua-span') {
        // UA oparte na ścianach – kątownik specjalny na każdym końcu
        add(req.counts, 'KATOWNIK_UA', 2);
        add(req.counts, 'KOLEK', 4);
        continue;
      }
      if (cwSpan) {
        add(req.counts, 'LN9', 2);
        continue;
      }
      const hangers = Math.max(2, Math.ceil(run / (sys.hangerSpacing / 100) - 1e-9));
      if (sys.kind === 'direct') {
        const pid = sys.hangerType === 'elastic' ? 'UCHWYT_ELAST' : sys.hangerType === 'attic' ? 'WIESZAK_PODD' : 'WIESZAK_ES';
        add(req.counts, pid, hangers);
        add(req.counts, 'LN9', hangers * 4);
        addNote(req, pid, `sufit: odstęp CD od stropu ok. ${Math.round(levels.hangerGap * 10)} mm`);
      } else {
        add(req.counts, 'WIESZAK_NONIUSZ', hangers);
        add(req.counts, 'ZAWLECZKA', hangers * 2);
        add((req.hangerGaps ??= {}), String(gap), hangers);
      }
      add(req.counts, 'KOTWA', hangers);
    }
  }

  const maxSpan = ceilingMaxSpan(sys);
  if (maxSpan && longestMain * 100 > maxSpan + 0.5)
    warnings.push(
      `Rozpiętość ${fmtLen(longestMain)} m przekracza ${fmtLen(maxSpan / 100)} m dopuszczalne dla tego sufitu przęsłowego – zmień kierunek profili, zagęść rozstaw albo wybierz sufit podwieszany.`,
    );

  // skrzyżowania profili nośnych i montażowych (te same co na rysunku i w 3D)
  const crossings = ceilingCrossings(c, sys, grid).length;
  if (sys.kind === 'two-level') add(req.counts, 'LACZNIK_KRZ', crossings);
  else if (sys.kind === 'one-level') add(req.counts, 'LACZNIK_JEDNO', crossings * 2);
  else if (sys.kind === 'ua-span') add(req.counts, 'LACZNIK_UA_CD', crossings * 2);

  // płyty
  const bb = bbox(c.points);
  const longSide = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
  const sheetLen = pickBoardLength(c.boardId, Math.min(longSide, 300));
  const boards = layerBoards(sys, c.boardId);
  for (const id of boards) add(req.boardArea, `${id}|${id === c.boardId ? sheetLen : pickBoardLength(id, Math.min(longSide, 300))}`, A);
  addBoardScrews(req, A, boards, sys.screwsOuter, sys.screwsInner);
  addJointing(req, A, sys.layers, c.boardId, sys.secondarySpacing < 40 || sys.kind === 'direct' && sys.hangerType === 'elastic' ? 1.4 : 1.2, fin);
  const ins = ceilingInsulation(c);
  if (ins) add(req.area, `WELNA${ins.thickness}`, A * ins.layers);
  // paroizolacja między wełną / rusztem a płytami (w poddaszach element systemu)
  const vapor = ceilingVaporSpec(sys);
  if (vaporBarrierOn(c.vaporBarrier, vapor)) vaporBarrierLines(req, A, vapor);

  return { req, areaM2: A, perimeterM: P, warnings, levels };
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


export interface SummarizeOptions {
  /** Wybrane produkty wełny wg grubości (ustawienia projektu) */
  wool?: Record<string, WoolChoice>;
}

const fmtM2 = (v: number) => v.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');

/**
 * Wełna: m² netto × zapas, w górę do 0,1 m², potem pełne opakowania handlowe wybranego produktu.
 */
export function woolLine(pid: string, netM2: number, waste: number, choice?: WoolChoice): MaterialLine {
  const t = woolThicknessOf(pid);
  const r = resolveWool(t, choice);
  const qty = Math.ceil(netM2 * waste * 10 - 1e-9) / 10;
  const line: MaterialLine = { key: r.key, group: 'Izolacja', name: r.name, qty, unit: 'm²' };
  const notes = [`${fmtM2(netM2)} m² netto`];
  if (r.packM2 > 0) {
    const packs = Math.ceil(qty / r.packM2 - 1e-9);
    line.packs = packs;
    line.packUnit = r.packUnit;
    const pieces = r.pieces && r.sizeCm ? ` (${r.pieces} pł. ${r.sizeCm[0]}×${r.sizeCm[1]} cm)` : '';
    notes.push(`${r.packUnit === 'rolka' ? 'rolka' : 'paczka'} ${fmtM2(r.packM2)} m²${pieces}`);
  }
  line.note = notes.join(' · ');
  return line;
}

const m2 = (v: number) => v.toFixed(1).replace('.', ',');
function boardNote(area: number, cut: number): string {
  return cut >= 0.05 ? `${m2(area - cut)} m² netto + ${m2(cut)} m² odpadu z docinania (wycięcia przy otworach, pasy płyt w obudowie szachtu)` : `${m2(area)} m² netto`;
}

/** Uwaga do wieszaków noniuszowych: ile sztuk na jakie zwieszenie (wierzch rusztu – strop) */
export function hangerGapNote(gaps: Record<string, number>): string {
  const list = Object.entries(gaps)
    .map(([l, n]) => [Number(l), Math.ceil(n - 1e-9)] as const)
    .sort((a, b) => a[0] - b[0]);
  const parts = list.map(([l, n]) => (list.length > 1 ? `${n} szt. do ${l} cm` : `do ${l} cm`));
  return `zwieszenie od wierzchu rusztu do stropu: ${parts.join(', ')} – dobierz długość górnej części`;
}

export function summarize(reqs: Requirement[], wastePct: number, opts: SummarizeOptions = {}): MaterialLine[] {
  const waste = 1 + wastePct / 100;
  const lines: MaterialLine[] = [];
  const merged = emptyReq();
  for (const r of reqs) {
    for (const [k, v] of Object.entries(r.pieces)) (merged.pieces[k] ??= []).push(...v);
    for (const key of ['boardArea', 'counts', 'meters', 'kg', 'area'] as const)
      for (const [k, v] of Object.entries(r[key])) add(merged[key], k, v);
    for (const [k, v] of Object.entries(r.boardCutWaste ?? {})) add((merged.boardCutWaste ??= {}), k, v);
    for (const [k, list] of Object.entries(r.notes ?? {})) (merged.notes ??= {})[k] = [...new Set([...((merged.notes ?? {})[k] ?? []), ...list])];
    for (const [k, v] of Object.entries(r.hangerGaps ?? {})) add((merged.hangerGaps ??= {}), k, v);
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
      note: boardNote(area, merged.boardCutWaste?.[key] ?? 0),
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
    const notes = merged.notes?.[pid];
    if (notes?.length) line.note = notes.join('; ');
    if (pid === 'WIESZAK_NONIUSZ' && merged.hangerGaps) line.note = hangerGapNote(merged.hangerGaps);
    if (product.pack && product.packUnit) {
      line.packs = Math.ceil(qty / product.pack - 1e-9);
      line.packUnit = product.packUnit;
    }
    return line;
  };

  for (const [pid, v] of Object.entries(merged.counts)) lines.push(withPacks(pid, Math.ceil(v * (pid.startsWith('T') || pid.startsWith('AQ') || pid === 'LN9' ? waste : 1) - 1e-9), 'szt.'));
  for (const [pid, v] of Object.entries(merged.meters)) lines.push(withPacks(pid, Math.ceil(v * waste - 1e-9), 'mb'));
  for (const [pid, v] of Object.entries(merged.kg)) lines.push(withPacks(pid, Math.ceil(v * waste - 1e-9), 'kg'));
  for (const [pid, v] of Object.entries(merged.area)) {
    if (pid.startsWith('WELNA')) lines.push(woolLine(pid, v, waste, opts.wool?.[String(woolThicknessOf(pid))]));
    else lines.push(withPacks(pid, Math.ceil(v * waste * 10 - 1e-9) / 10, 'm²'));
  }

  return lines.sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name, 'pl'),
  );
}

export interface LiningResult {
  wallId: string;
  side: 1 | -1;
  req: Requirement;
  info: WallBreakdown;
}

/** Klucz okładziny w `ProjectCalc.linings` */
export const liningKey = (wallId: string, side: 1 | -1) => `${wallId}:${side}`;

/** Połączenia okładziny: zawsze między istniejącymi ścianami, bez dodatkowych słupków */
const LINING_JUNCTIONS: WallJunctions = { endA: 'existing-wall', endB: 'existing-wall', extraStuds: 0, externalEdges: 0 };

/**
 * Okładzina istniejącej ściany: liczona jak jednostronna ściana z systemu okładziny o długości
 * i wysokości muru, z odjęciem jego otworów (okna, drzwi wejściowe).
 */
export function liningRequirement(p: Project, w: Wall, l: Lining, m?: ContactModel): LiningResult {
  const sys = wallSystemById(l.systemId);
  const synthetic = liningAsWall(w, l);
  // ATLAS: łączniki z tej samej siatki co rysunek i 3D – na zakresie okładziny z modelu styków
  const own = sys.frame === 'point-fix' ? liningContacts(p, w, l, m ?? buildContacts(p)) : undefined;
  const { req, info } = wallRequirement(p, synthetic, LINING_JUNCTIONS, sys, own);
  if (!isLiningSystem(sys))
    info.warnings.push('Wybrany system nie jest okładziną – sprawdź, czy o to chodziło.');
  return { wallId: w.id, side: l.side, req, info };
}

export interface ProjectCalc {
  walls: Map<string, { req: Requirement; info: WallBreakdown }>;
  /** Okładziny istniejących ścian, klucz z `liningKey` */
  linings: Map<string, LiningResult>;
  ceilings: Map<string, CeilingResult>;
  /** Zabudowy poddaszy */
  attics: Map<string, AtticResult>;
  /** Połączenia ścian, styki i krawędzie otworów z materiałami */
  joints: Joint[];
  total: MaterialLine[];
  stats: { wallLengthM: number; wallAreaM2: number; ceilingAreaM2: number; openings: number; liningAreaM2: number; atticAreaM2: number };
}

export function calculateProject(p: Project): ProjectCalc {
  const junctions = analyzeJunctions(p);
  const contacts = buildContacts(p);
  const nodes = nodeMap(p);
  const walls = new Map<string, { req: Requirement; info: WallBreakdown }>();
  let wallLengthM = 0;
  let wallAreaM2 = 0;
  let openings = 0;
  const linings = new Map<string, LiningResult>();
  let liningAreaM2 = 0;
  for (const w of p.walls) {
    if (!nodes.has(w.a) || !nodes.has(w.b)) continue;
    if (!isNewWall(w)) {
      // istniejąca ściana: liczymy tylko jej okładziny
      for (const l of w.linings ?? []) {
        const r = liningRequirement(p, w, l, contacts);
        linings.set(liningKey(w.id, l.side), r);
        liningAreaM2 += r.info.netAreaM2;
      }
      continue;
    }
    const r = wallRequirement(p, w, junctions.get(w.id)!, undefined, contacts);
    walls.set(w.id, r);
    wallLengthM += r.info.lengthM;
    wallAreaM2 += r.info.netAreaM2;
    openings += w.openings.length;
  }
  const ceilings = new Map<string, CeilingResult>();
  let ceilingAreaM2 = 0;
  for (const c of p.ceilings) {
    if (c.points.length < 3) continue;
    const r = ceilingRequirement(c, undefined, resolveFinishing(p.settings.finishing));
    if (r.levels && ceilingSystemById(c.systemId).kind !== 'point-fix') r.warnings.push(...ceilingWallWarnings(p, c, r.levels));
    ceilings.set(c.id, r);
    ceilingAreaM2 += r.areaM2;
  }
  const attics = new Map<string, AtticResult>();
  let atticAreaM2 = 0;
  for (const a of p.attics ?? []) {
    const r = atticRequirement(a, undefined, resolveFinishing(p.settings.finishing));
    attics.set(a.id, r);
    atticAreaM2 += r.areaM2;
  }
  const joints = analyzeJoints(p);
  const total = summarize(
    [
      ...[...walls.values()].map((x) => x.req),
      ...[...linings.values()].map((x) => x.req),
      ...[...ceilings.values()].map((x) => x.req),
      ...[...attics.values()].map((x) => x.req),
      ...joints.map((j) => j.req),
    ],
    p.settings.wasteEnabled ? p.settings.waste : 0,
    { wool: p.settings.wool },
  );
  return { walls, linings, ceilings, attics, joints, total, stats: { wallLengthM, wallAreaM2, ceilingAreaM2, openings, liningAreaM2, atticAreaM2 } };
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

// ---------------------------------------------------------------------------
// Zużycie materiałów na 1 m² systemu (tabela w katalogu i testy z kartami Rigips)
// ---------------------------------------------------------------------------

export interface ConsumptionLine {
  /** Id produktu albo `board:<id>` dla płyt */
  key: string;
  name: string;
  qty: number;
  unit: Unit;
}

/** Element odniesienia: ściana 5,00 × 2,75 m między istniejącymi ścianami, bez otworów */
export const REF_WALL = { lengthCm: 500, heightCm: 275 };
/** Element odniesienia: sufit 10 × 8 m (obwód typowy dla kart Rigips ok. 0,4 mb UD/m²) */
export const REF_CEILING = { lengthCm: 1000, widthCm: 800 };

function perM2(req: Requirement, area: number): ConsumptionLine[] {
  const out: ConsumptionLine[] = [];
  const boards = new Map<string, number>();
  for (const [k, v] of Object.entries(req.boardArea)) {
    const id = k.split('|')[0];
    boards.set(id, (boards.get(id) ?? 0) + v);
  }
  for (const [id, v] of boards) out.push({ key: `board:${id}`, name: boardById(id).name, qty: v / area, unit: 'm²' });
  for (const [pid, pieces] of Object.entries(req.pieces))
    out.push({ key: pid, name: PRODUCTS[pid].name, qty: pieces.reduce((a, b) => a + b, 0) / area, unit: 'mb' });
  const simple: [Record<string, number>, Unit][] = [
    [req.counts, 'szt.'],
    [req.meters, 'mb'],
    [req.kg, 'kg'],
    [req.area, 'm²'],
  ];
  for (const [rec, unit] of simple)
    for (const [pid, v] of Object.entries(rec)) out.push({ key: pid, name: PRODUCTS[pid].name, qty: v / area, unit });
  return out;
}

/** Zużycie na 1 m² ściany (powierzchnia ściany, nie płyt) dla wybranego systemu */
export function wallConsumption(sys: WallSystem, studSpacing = sys.studSpacing, insulation = true): ConsumptionLine[] {
  const p = createProject();
  // obudowa z samych płyt: wzorzec o szerokości dopuszczalnej w karcie (płyta od ściany do ściany)
  const len = sys.panel ? Math.min(REF_WALL.lengthCm, sys.panel.maxWidth) : REF_WALL.lengthCm;
  p.nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: len, y: 0 },
  ];
  p.walls = [
    createWall(p, 'a', 'b', {
      systemId: sys.id,
      boardId: sys.defaultBoard,
      height: REF_WALL.heightCm,
      studSpacing,
      insulation,
    }),
  ];
  const j = analyzeJunctions(p).get(p.walls[0].id)!;
  const { req, info } = wallRequirement(p, p.walls[0], j, sys);
  return perM2(req, info.netAreaM2);
}

/** Zużycie na 1 m² sufitu dla wybranego systemu */
export function ceilingConsumption(sys: CeilingSystem, insulation = false): ConsumptionLine[] {
  // ruszty tylko do poddaszy (łaty, profile kapeluszowe…) liczymy na poddaszu wzorcowym
  if (sys.atticFrame) {
    const r = atticRequirement(createAttic({ systemId: sys.id, boardId: sys.defaultBoard, woolBetween: insulation ? 150 : 0, woolUnder: 0, vaporBarrier: false }), sys);
    return perM2(r.req, r.areaM2);
  }
  const p = createProject();
  const { lengthCm: l, widthCm: w } = REF_CEILING;
  // sufit przęsłowy liczymy na pasie o dopuszczalnej rozpiętości
  const span = ceilingMaxSpan(sys);
  const width = span ? Math.min(w, Math.floor(span / 10) * 10) : w;
  const c = createCeiling(
    p,
    [
      { x: 0, y: 0 },
      { x: l, y: 0 },
      { x: l, y: width },
      { x: 0, y: width },
    ],
    { systemId: sys.id, boardId: sys.defaultBoard, insulation, direction: span ? 90 : 0 },
  );
  const r = ceilingRequirement(c, sys);
  return perM2(r.req, r.areaM2);
}
