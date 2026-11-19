// Poziomy sufitu: istniejący strop, spód płyt sufitu, ruszt i zwieszenie wieszaków.
// Model w cm (od posadzki). Jedno źródło dla widoku 3D, rysunków i ilości (długość wieszaków).

import { HAT_MM, boardById, ceilingSystemById, type CeilingSystem } from '../catalog/rigips';
import { dist, nodeMap, projectOnSegment } from '../geometry/geometry';
import type { Ceiling, Project, Wall } from '../model/types';

/**
 * Płyty kolejnych warstw jednej strony, od rusztu: `innerLayers` warstw z płyty wewnętrznej
 * (systemy z dwoma rodzajami płyt, np. PRO pod Habito), reszta z płyty wybranej w elemencie.
 */
export function layerBoards(sys: { layers: number; innerBoard?: string; innerLayers?: number }, boardId: string, innerBoardId?: string): string[] {
  const inner = sys.innerBoard ? Math.min(sys.layers - 1, sys.innerLayers ?? sys.layers - 1) : 0;
  return Array.from({ length: sys.layers }, (_, i) => (i < inner ? (innerBoardId ?? sys.innerBoard!) : boardId));
}

/** Grubość wszystkich warstw płyt sufitu, mm */
export const ceilingBoardsMm = (sys: CeilingSystem, boardId: string) =>
  layerBoards(sys, boardId).reduce((a, id) => a + (boardById(id).thickness || 12.5), 0);

/** Grubość rusztu nad płytami (bez wieszaków), mm */
export function ceilingFrameMm(sys: CeilingSystem): number {
  switch (sys.kind) {
    case 'two-level':
      return 2 * 27;
    case 'one-level':
      return 27;
    case 'direct':
      return sys.hangerType === 'hat' && !sys.atticFrame ? HAT_MM : 27;
    case 'ua-span':
      return 27 + 40;
    case 'cw-span':
      return sys.profile ?? 50;
    case 'point-fix':
      return 0;
  }
}

/**
 * Minimalna wysokość konstrukcji bez płyt (ruszt + najkrótszy wieszak), mm – gdy karta jej nie podaje.
 * Założenia przyjęte z „grubości systemu” w kartach Rigips tego samego rodzaju (1×12,5):
 * dwupoziomowy 4.05.24 – 230 mm, jednopoziomowy 4.10.x – 200 mm, uchwyty ES 4.05.23 – 42 mm,
 * uchwyty elastyczne 4.70.06 – 45 mm, wieszaki do poddaszy 4.70.04 – 40 mm.
 */
function assumedFrameMm(sys: CeilingSystem): number {
  switch (sys.kind) {
    case 'two-level':
      return 218;
    case 'one-level':
      return 188;
    case 'direct':
      return sys.hangerType === 'elastic' ? 33 : sys.hangerType === 'attic' ? 28 : sys.hangerType === 'hat' ? HAT_MM : 30;
    case 'point-fix':
      return sys.fixer?.standoff[0] ?? 14;
    default:
      // sufity przęsłowe nie wiszą na stropie – wystarczy, że ruszt się zmieści
      return ceilingFrameMm(sys);
  }
}

export interface CeilingDepth {
  /** Minimalna odległość strop – spód płyt, mm */
  minMm: number;
  /** Maksymalna odległość strop – spód płyt, mm (uchwyty bezpośrednie, łączniki punktowe) */
  maxMm?: number;
  /** true = minimum to założenie aplikacji (karta systemu nie podaje grubości zabudowy) */
  assumed: boolean;
  source: string;
}

/**
 * Najdłuższy odstęp rusztu od stropu dla uchwytów bezpośrednich, mm (założenie: ramiona uchwytu ES
 * 125 mm po zagięciu dają ok. 10 cm; uchwyty elastyczne i do poddaszy mocuje się przy samej krokwi).
 */
const DIRECT_MAX_GAP_MM: Record<string, number> = { es: 100, elastic: 20, attic: 20, hat: 0 };

/** Minimalna (i ew. maksymalna) wysokość zabudowy sufitu od stropu do spodu płyt */
export function ceilingDepth(sys: CeilingSystem, boardId: string = sys.defaultBoard): CeilingDepth {
  const boards = ceilingBoardsMm(sys, boardId);
  const withTh = sys.variants?.filter((v) => v.thickness) ?? [];
  const v = withTh.find((x) => x.board === boardId) ?? withTh.find((x) => !x.board || x.board === sys.defaultBoard) ?? withTh[0];
  let minMm: number;
  let assumed = false;
  let source: string;
  if (v?.thickness) {
    // grubość z karty dotyczy płyty odmiany – przeliczamy na wybraną płytę
    const cardBoards = ceilingBoardsMm(sys, v.board ?? sys.defaultBoard);
    minMm = v.thickness - cardBoards + boards;
    source = `grubość zabudowy z karty ${sys.code ? `systemu ${sys.code}` : 'systemu'}`;
  } else {
    minMm = assumedFrameMm(sys) + boards;
    source =
      sys.kind === 'ua-span' || sys.kind === 'cw-span'
        ? 'ruszt + płyty (sufit oparty na ścianach, bez wieszaków)'
        : sys.kind === 'point-fix'
          ? 'najmniejszy odstęp łącznika z karty ATLAS + płyta'
          : 'założenie wg kart Rigips tego rodzaju – karta systemu nie podaje grubości';
    assumed = sys.kind !== 'point-fix' && sys.kind !== 'ua-span' && sys.kind !== 'cw-span';
  }
  let maxMm: number | undefined;
  if (sys.kind === 'point-fix' && sys.fixer) maxMm = sys.fixer.standoff[1] + boards;
  else if (sys.kind === 'direct') maxMm = boards + ceilingFrameMm(sys) + (DIRECT_MAX_GAP_MM[sys.hangerType ?? 'es'] ?? 100);
  return { minMm: Math.round(minMm), maxMm: maxMm === undefined ? undefined : Math.round(maxMm), assumed, source };
}

export interface CeilingLevels {
  /** Spód istniejącego stropu, cm od posadzki */
  slab: number;
  /** Spód płyt sufitu (wysokość pomieszczenia po zabudowie), cm */
  ceiling: number;
  /** Wysokość wpisana przez użytkownika, cm (może być za blisko stropu) */
  requested: number;
  /** Grubość płyt, cm */
  boards: number;
  /** Wierzch płyt = spód rusztu i profilu obwodowego UD, cm */
  frameBottom: number;
  /** Wierzch rusztu (profili nośnych / UA / CW), cm */
  frameTop: number;
  /** Zwieszenie: odstęp wierzchu rusztu od stropu (długość wieszaka), cm */
  hangerGap: number;
  depth: CeilingDepth;
  warnings: string[];
}

const fmtM = (cm: number) => (cm / 100).toFixed(2).replace('.', ',');

/** Wysokość stropu nad sufitem; w projektach sprzed zmiany `height` oznaczało wysokość pomieszczenia */
export const ceilingSlab = (c: Ceiling) => c.slabHeight ?? c.height;

/** Największa wysokość spodu płyt, jaka mieści się pod stropem (cm, w dół do 1 cm) */
export function maxCeilingHeight(slab: number, sys: CeilingSystem, boardId: string): number {
  return Math.floor(slab - ceilingDepth(sys, boardId).minMm / 10);
}

export function ceilingLevels(c: Ceiling, sys: CeilingSystem = ceilingSystemById(c.systemId)): CeilingLevels {
  const depth = ceilingDepth(sys, c.boardId);
  const slab = ceilingSlab(c);
  const top = slab - depth.minMm / 10;
  // stare projekty: jedna wysokość = strop, sufit zawieszony najbliżej, jak pozwala system
  const requested = c.slabHeight === undefined ? Math.floor(top) : c.height;
  const ceiling = Math.min(requested, top);
  const boards = ceilingBoardsMm(sys, c.boardId) / 10;
  const frameBottom = ceiling + boards;
  const frameTop = frameBottom + ceilingFrameMm(sys) / 10;
  const warnings: string[] = [];
  if (requested > top + 0.05)
    warnings.push(
      `Sufit na ${fmtM(requested)} m jest za blisko stropu (${fmtM(slab)} m): ten system potrzebuje min. ${Math.round(depth.minMm / 10)} cm od stropu do spodu płyt (${depth.source}). Przyjęto ${fmtM(ceiling)} m.`,
    );
  if (depth.maxMm !== undefined && slab - ceiling > depth.maxMm / 10 + 0.05)
    warnings.push(
      sys.kind === 'point-fix'
        ? `Odstęp płyty od stropu ${Math.round((slab - frameBottom) * 10)} mm przekracza zakres łącznika (${sys.fixer?.standoff.join('–')} mm) – wybierz system z dłuższym łącznikiem.`
        : sys.hangerType === 'hat'
          ? `Sufit jest ${Math.round(slab - ceiling)} cm pod stropem – profile kapeluszowe leżą wprost na stropie, płyty wypadają ${Math.round(depth.minMm / 10)} cm pod nim. Żeby obniżyć sufit, wybierz sufit na uchwytach ES albo podwieszany.`
          : `Sufit jest ${Math.round(slab - ceiling)} cm pod stropem – na uchwytach bezpośrednich ruszt może odstawać od stropu najwyżej ok. ${Math.round((DIRECT_MAX_GAP_MM[sys.hangerType ?? 'es'] ?? 100) / 10)} cm (założenie). Wybierz sufit podwieszany na wieszakach noniuszowych.`,
    );
  return { slab, ceiling, requested, boards, frameBottom, frameTop, hangerGap: Math.max(0, slab - frameTop), depth, warnings };
}

/** Zwieszenie wieszaka zaokrąglone w górę do 5 cm (do zestawienia materiałów) */
export const hangerGapClass = (gapCm: number) => Math.max(5, Math.ceil(gapCm / 5 - 1e-9) * 5);

/**
 * Ściany, do których kotwimy profil obwodowy sufitu: równoległe do krawędzi obrysu sufitu, w odległości
 * do grubości ściany od krawędzi i zachodzące na nią na min. 10 cm.
 */
export function wallsAroundCeiling(p: Project, c: Ceiling): Wall[] {
  const nodes = nodeMap(p);
  const out: Wall[] = [];
  for (const w of p.walls) {
    const a = nodes.get(w.a);
    const b = nodes.get(w.b);
    if (!a || !b) continue;
    const L = dist(a, b);
    if (L < 1) continue;
    const reach = w.kind === 'existing' ? (w.thickness ?? 25) + 5 : 20;
    const hit = c.points.some((p0, i) => {
      const p1 = c.points[(i + 1) % c.points.length];
      const E = dist(p0, p1);
      if (E < 1) return false;
      const cross = Math.abs(((b.x - a.x) * (p1.y - p0.y) - (b.y - a.y) * (p1.x - p0.x)) / (L * E));
      if (cross > 0.02) return false;
      const qa = projectOnSegment(a, p0, p1);
      const qb = projectOnSegment(b, p0, p1);
      // odległość osi / lica ściany od krawędzi sufitu (prosta krawędzi)
      const off = Math.abs(((p1.x - p0.x) * (p0.y - a.y) - (p0.x - a.x) * (p1.y - p0.y)) / E);
      if (off > reach) return false;
      const overlap = (Math.max(qa.t, qb.t) - Math.min(qa.t, qb.t)) * E;
      return overlap >= 10;
    });
    if (hit) out.push(w);
  }
  return out;
}

/** Ostrzeżenia o ścianach, do których nie da się zakotwić UD na poziomie sufitu */
export function ceilingWallWarnings(p: Project, c: Ceiling, lv: CeilingLevels = ceilingLevels(c)): string[] {
  const out: string[] = [];
  const udTop = lv.frameBottom + 2.7;
  const low = wallsAroundCeiling(p, c).filter((w) => w.height < udTop - 0.05);
  if (low.length)
    out.push(
      `${low.length === 1 ? 'Ściana przy suficie kończy się' : `${low.length} ściany przy suficie kończą się`} na ${[...new Set(low.map((w) => fmtM(w.height)))].join(' / ')} m, poniżej profilu obwodowego UD (${fmtM(lv.frameBottom)}–${fmtM(udTop)} m) – UD nie ma się do czego zakotwić. Podnieś ściany do stropu (${fmtM(lv.slab)} m) albo obniż sufit.`,
    );
  return out;
}
