// Dobór systemu po wymaganiach: zamiast przeglądać katalog, użytkownik odpowiada na kilka
// pytań (pomieszczenie, ogień, akustyka, wysokość), a aplikacja wybiera konstrukcję i jej
// odmianę z karty producenta (płyta, rozstaw słupków). Bierzemy pod uwagę wyłącznie wartości
// z kart – system bez potwierdzonej klasy EI nie spełnia wymagania ogniowego.

import {
  allCeilingSystems,
  allWallSystems,
  boardById,
  ceilingMaxSpan,
  isLiningSystem,
  wallFrameDepth,
  boardStackMm,
  type CeilingKind,
  type CeilingSystem,
  type Maker,
  type StudSpacing,
  type SystemVariant,
  type WallSystem,
} from '../catalog/rigips';
import { atticFrameKind, type AtticFrameKind } from './attic';

/** Pomieszczenie: suche, wilgotne (łazienka, kuchnia), strefa mokra (prysznic, pralnia) */
export type Room = 'dry' | 'humid' | 'wet';
export type FireNeed = 0 | 30 | 60 | 90 | 120;
/** Akustyka: bez wymagań, lepsza (między pokojami), między mieszkaniami */
export type AcousticNeed = 'any' | 'better' | 'flat';
/** Do czego ma służyć ściana */
export type WallPurpose = 'partition' | 'installation' | 'lining' | 'shaft';

/** Minimalna izolacyjność RA1 [dB] dla poziomów akustyki (ściana między mieszkaniami: wymagane R'A1 ≥ 50 dB) */
export const ACOUSTIC_MIN_RA1: Record<AcousticNeed, number> = { any: 0, better: 45, flat: 53 };

export const ROOM_LABEL: Record<Room, string> = { dry: 'Suche', humid: 'Łazienka, kuchnia', wet: 'Strefa mokra' };
export const ACOUSTIC_LABEL: Record<AcousticNeed, string> = { any: 'Zwykła', better: 'Lepsza', flat: 'Między mieszkaniami' };
export const PURPOSE_LABEL: Record<WallPurpose, string> = {
  partition: 'Ściana działowa',
  installation: 'Ściana instalacyjna',
  lining: 'Okładzina ściany',
  shaft: 'Obudowa szachtu',
};

export interface WallNeeds {
  purpose: WallPurpose;
  /** Wysokość ściany, cm */
  heightCm: number;
  room: Room;
  fire: FireNeed;
  acoustic: AcousticNeed;
  /** Ciężkie szafki bez kołków (płyta o podwyższonej twardości) */
  hang?: boolean;
  /** Największa dopuszczalna grubość ściany, mm */
  maxThickness?: number;
  /** Tylko okładziny mocowane do istniejącej ściany (klej, CD na ES, łączniki) */
  liningOnly?: boolean;
  /** Tylko systemy tego producenta */
  maker?: Maker;
  /** Szerokość profilu CW/UW, mm (brak = dowolna); systemy bez rusztu z CW (klej, CD 60, łączniki) wtedy odpadają */
  profile?: number;
  /** Płytowanie: liczba warstw płyt z jednej strony (brak = dowolne) */
  layers?: 1 | 2;
}

/** Cechy do zaznaczenia w doborze ściany (wielokrotny wybór) */
export type WallFeature = 'fire' | 'acoustic' | 'humid' | 'wet' | 'hang';
export const WALL_FEATURES: { id: WallFeature; label: string; hint: string }[] = [
  { id: 'fire', label: 'Odporność ogniowa', hint: 'klasa EI 30 lub wyższa w karcie systemu' },
  { id: 'acoustic', label: 'Podwyższona akustyka', hint: 'RA1 co najmniej 45 dB w karcie systemu' },
  { id: 'humid', label: 'Łazienka, kuchnia', hint: 'płyta impregnowana' },
  { id: 'wet', label: 'Strefa mokra', hint: 'płyta do stref mokrych (prysznic, pralnia)' },
  { id: 'hang', label: 'Twarda płyta', hint: 'płyta o podwyższonej twardości, szafki można wieszać bez kołków' },
];

/** Zamienia zaznaczone cechy na wymagania doboru */
export function featureNeeds(features: Iterable<WallFeature>): Pick<WallNeeds, 'room' | 'fire' | 'acoustic' | 'hang'> {
  const f = new Set(features);
  return { room: f.has('wet') ? 'wet' : f.has('humid') ? 'humid' : 'dry', fire: f.has('fire') ? 30 : 0, acoustic: f.has('acoustic') ? 'better' : 'any', hang: f.has('hang') };
}

/** Czy system ma ruszt z profili CW (szerokość profilu ma znaczenie) */
export const hasStudProfile = (s: WallSystem): boolean => s.frame !== 'glued' && s.frame !== 'cd-lining' && s.frame !== 'point-fix' && s.frame !== 'hat-lining' && s.frame !== 'panel';

/** Szerokości profili CW dostępne w systemach o danym przeznaczeniu, rosnąco */
export function profileWidths(purpose: WallPurpose, systems: WallSystem[] = allWallSystems()): number[] {
  return [...new Set(systems.filter((s) => wallPurposeOf(s) === purpose && hasStudProfile(s)).map((s) => s.profile as number))].sort((a, b) => a - b);
}

/** Producent systemu (systemy bez pola `maker` to Rigips, kategoria „atlas” to ATLAS) */
export const makerOf = (s: { maker?: Maker; category?: string; kind?: string }): Maker =>
  s.maker ?? (s.category === 'atlas' || s.kind === 'point-fix' ? 'atlas' : 'rigips');

export interface WallPick {
  system: WallSystem;
  /** Odmiana z karty, z której pochodzą parametry (brak = dane samego systemu) */
  variant?: SystemVariant;
  boardId: string;
  /** Płyta warstw wewnętrznych (systemy z dwoma rodzajami płyt) */
  innerBoardId?: string;
  studSpacing: StudSpacing;
  doubleStuds: boolean;
  /** Maksymalna wysokość tej odmiany, cm (brak = bez ograniczeń / nie podano) */
  maxHeight?: number;
  fire?: number;
  ra1?: number;
  /** Grubość ściany, mm */
  thickness: number;
  /** Cena katalogowa producenta, zł/m² (orientacyjna – kalkulator liczy ją dla przykładowej płyty) */
  price?: number;
  /** true = parametry orientacyjne (system bez karty) */
  approx: boolean;
  /** Krótkie uzasadnienie do pokazania przy wyniku */
  reasons: string[];
}

const PURPOSE_OF: Record<WallSystem['category'], WallPurpose> = {
  działowa: 'partition',
  podwójna: 'partition',
  instalacyjna: 'installation',
  okładzina: 'lining',
  szacht: 'shaft',
  atlas: 'lining',
};

export const wallPurposeOf = (s: WallSystem): WallPurpose => PURPOSE_OF[s.category] ?? 'partition';

function roomOk(boardId: string, room: Room): boolean {
  if (room === 'dry') return true;
  const m = boardById(boardId).moisture;
  return room === 'humid' ? m === 'humid' || m === 'wet' : m === 'wet';
}

/** Grubość ściany w danej odmianie, mm */
function wallThickness(sys: WallSystem, boardId: string, v?: SystemVariant): number {
  if (v?.thickness) return v.thickness;
  return wallFrameDepth(sys) + boardStackMm(sys, boardId) * sys.sides;
}

/** Odmiany systemu do sprawdzenia: z karty albo – gdy ich brak – po jednej na znany rozstaw słupków */
function candidates(sys: WallSystem): { v?: SystemVariant; boardId: string; spacing: StudSpacing; double: boolean; maxHeight?: number }[] {
  if (sys.variants?.length)
    return sys.variants.map((v) => ({
      v,
      boardId: v.board ?? sys.defaultBoard,
      spacing: v.studSpacing ?? sys.studSpacing,
      double: !!v.doubleStuds,
      maxHeight: v.maxHeight,
    }));
  const spacings = sys.maxHeight ? (Object.keys(sys.maxHeight).map(Number) as StudSpacing[]) : [sys.studSpacing];
  return spacings.map((spacing) => ({ boardId: sys.defaultBoard, spacing, double: false, maxHeight: sys.maxHeight?.[spacing] }));
}

const fmtM = (cm: number) => (cm / 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '');

/**
 * Systemy ścian spełniające wymagania, od najprostszej konstrukcji (patrz `costKey`).
 * Dla każdej konstrukcji zwracana jest jedna, najlepsza odmiana.
 */
export function recommendWalls(needs: WallNeeds, systems: WallSystem[] = allWallSystems()): WallPick[] {
  const minRa1 = ACOUSTIC_MIN_RA1[needs.acoustic];
  const picks: WallPick[] = [];
  for (const sys of systems) {
    if (wallPurposeOf(sys) !== needs.purpose) continue;
    if (needs.liningOnly && !isLiningSystem(sys)) continue;
    if (needs.maker && makerOf(sys) !== needs.maker) continue;
    if (needs.profile && !(hasStudProfile(sys) && sys.profile === needs.profile)) continue;
    if (needs.layers && sys.layers !== needs.layers) continue;
    let best: WallPick | undefined;
    for (const c of candidates(sys)) {
      if (c.maxHeight && needs.heightCm > c.maxHeight + 0.5) continue;
      if (!roomOk(c.boardId, needs.room)) continue;
      const fire = c.v?.fire;
      if (needs.fire > 0 && !(fire && fire >= needs.fire)) continue;
      const ra1 = c.v?.ra1;
      if (minRa1 > 0 && !(ra1 && ra1 >= minRa1)) continue;
      if (needs.hang && !boardById(c.boardId).hard) continue;
      const thickness = wallThickness(sys, c.boardId, c.v);
      if (needs.maxThickness && thickness > needs.maxThickness + 0.5) continue;
      const reasons: string[] = [];
      if (sys.frame === 'panel') {
        reasons.push(`bez słupków – płyty od ściany do ściany, szerokość do ${fmtM(c.v?.maxWidth ?? sys.panel?.maxWidth ?? 0)} m`);
        if (c.maxHeight) reasons.push(`wysokość do ${fmtM(c.maxHeight)} m`);
      } else if (c.maxHeight) reasons.push(`do ${fmtM(c.maxHeight)} m przy słupkach${c.double ? ' podwójnych' : ''} co ${c.spacing} cm`);
      if (fire) reasons.push(`EI ${fire}`);
      if (ra1) reasons.push(`RA1 ${ra1} dB`);
      reasons.push(`grubość ${Math.round(thickness)} mm`);
      const pick: WallPick = {
        system: sys,
        variant: c.v,
        boardId: c.boardId,
        innerBoardId: innerFor(sys, c.v, needs.room),
        studSpacing: c.spacing,
        doubleStuds: c.double,
        maxHeight: c.maxHeight,
        fire,
        ra1,
        thickness,
        price: c.v?.price,
        approx: !!sys.source.approx || !c.v,
        reasons,
      };
      if (!best || better(pick, best)) best = pick;
    }
    if (best) picks.push(best);
  }
  return picks.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
}

/** Płyta warstw wewnętrznych: pierwsza dopuszczona w odmianie, w pomieszczeniu wilgotnym – impregnowana, jeśli jest */
function innerFor(sys: WallSystem, v: SystemVariant | undefined, room: Room): string | undefined {
  if (!sys.innerBoard) return undefined;
  const options = v?.innerBoards?.length ? v.innerBoards : [sys.innerBoard];
  return (room !== 'dry' && options.find((id) => boardById(id).moisture)) || options[0];
}

/**
 * Rząd kosztu płyty, niezależnie od producenta: zwykła < impregnowana < ogniochronna < ogniochronna
 * impregnowana; grubsza nieco droższa; płyty specjalne (Habito, Duraline, Aquaroc, X Ocean, Rigidur…) najdroższe.
 */
function boardCost(boardId: string): number {
  const b = boardById(boardId);
  if (b.hard || b.screws || b.kind === 'cement' || b.moisture === 'wet') return 10;
  const fire = /F/.test(b.type.replace(/\(.*\)/, '')) ? (/DF/.test(b.type) ? 2.5 : 2) : 0;
  return fire + (b.moisture ? 1 : 0) + (b.thickness > 12.5 ? 0.5 : 0);
}

/**
 * Kolejność „od najprostszej i najtańszej konstrukcji”: mniej warstw płyt → tańsza płyta →
 * mniej profili (rzadszy rozstaw, pojedyncze słupki, węższy profil) → system podstawowy → cieńsza.
 * Ceny katalogowej nie używamy do kolejności: kalkulator producenta liczy ją dla przykładowej płyty.
 */
const MAKERS: Maker[] = ['rigips', 'norgips', 'knauf', 'siniat', 'atlas'];
function costKey(p: WallPick): number[] {
  const s = p.system;
  // słupki z UA (blacha 2 mm, kątowniki, śruby M8) i UU (para U + para UD) są droższe od CW przy tej samej wysokości
  // profile kapeluszowe są tańsze od CD na ES, ale wymagają równej ściany (bez regulacji) – za CD
  const frameCost =
    s.frame === 'glued' ? 0 : s.frame === 'point-fix' ? 1 : s.frame === 'panel' ? 1.5 : s.frame === 'cd-lining' ? 2 : s.frame === 'hat-lining' ? 2.5 : s.frame === 'single' ? (s.studKind ? 3.5 : 3) : 4;
  return [
    s.layers * s.sides,
    boardCost(p.boardId),
    frameCost,
    (p.doubleStuds ? 2 : 1) / p.studSpacing,
    hasStudProfile(s) ? s.profile : 0,
    s.basic ? 0 : 1,
    MAKERS.indexOf(makerOf(s)),
    p.thickness,
  ];
}
function better(a: WallPick, b: WallPick): boolean {
  const ka = costKey(a);
  const kb = costKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i];
  return false;
}

/**
 * Odmiana systemu dla ściany o danej wysokości i płycie: najrzadszy rozstaw słupków,
 * który wystarcza (np. 3,4 m na CW 50 → co 40 cm, system 3.40.011). undefined, gdy
 * żadna odmiana nie sięga tej wysokości.
 */
export function variantForHeight(sys: WallSystem, heightCm: number, boardId = sys.defaultBoard): WallPick | undefined {
  const all = candidates(sys).filter((c) => !c.maxHeight || heightCm <= c.maxHeight + 0.5);
  const same = all.filter((c) => c.boardId === boardId);
  const pool = same.length ? same : all;
  if (!pool.length) return undefined;
  const c = pool.sort((a, b) => (a.double ? 2 : 1) / a.spacing - (b.double ? 2 : 1) / b.spacing || (b.v?.fire ?? 0) - (a.v?.fire ?? 0))[0];
  const thickness = wallThickness(sys, c.boardId, c.v);
  return {
    system: sys,
    variant: c.v,
    boardId: c.boardId,
    innerBoardId: innerFor(sys, c.v, 'dry'),
    studSpacing: c.spacing,
    doubleStuds: c.double,
    maxHeight: c.maxHeight,
    fire: c.v?.fire,
    ra1: c.v?.ra1,
    thickness,
    price: c.v?.price,
    approx: !!sys.source.approx || !c.v,
    reasons: [],
  };
}

// ---------------------------------------------------------------------------
// Sufity
// ---------------------------------------------------------------------------

/** Sposób zawieszenia sufitu */
export type CeilingMount = 'suspended' | 'direct' | 'span' | 'attic';

export const MOUNT_LABEL: Record<CeilingMount, string> = {
  suspended: 'Podwieszany (obniżony)',
  direct: 'Tuż pod stropem',
  span: 'Bez wieszaków (od ściany do ściany)',
  attic: 'Poddasze, skosy',
};

const MOUNT_KINDS: Record<CeilingMount, CeilingKind[]> = {
  suspended: ['two-level', 'one-level', 'parallel'],
  direct: ['direct', 'point-fix'],
  span: ['ua-span', 'cw-span'],
  attic: ['direct'],
};

export interface CeilingNeeds {
  mount: CeilingMount;
  room: Room;
  fire: FireNeed;
  maker?: Maker;
  /** Rozpiętość pomieszczenia (krótszy bok), cm – dla sufitów bez wieszaków */
  spanCm?: number;
}

export interface CeilingPick {
  system: CeilingSystem;
  variant?: SystemVariant;
  boardId: string;
  fire?: number;
  price?: number;
  approx: boolean;
  reasons: string[];
}

export const isAtticSystem = (s: CeilingSystem): boolean => s.kind === 'direct' && (s.attic ?? s.hangerType === 'elastic');

export function recommendCeilings(needs: CeilingNeeds, systems: CeilingSystem[] = allCeilingSystems()): CeilingPick[] {
  const picks: CeilingPick[] = [];
  for (const sys of systems) {
    if (!MOUNT_KINDS[needs.mount].includes(sys.kind)) continue;
    // ruszty tylko do poddaszy (mocowane do krokwi) nie są sufitami
    if (sys.atticFrame) continue;
    if (needs.maker && makerOf(sys) !== needs.maker) continue;
    if (needs.mount === 'attic' ? !isAtticSystem(sys) : needs.mount === 'direct' && isAtticSystem(sys)) continue;
    const span = ceilingMaxSpan(sys);
    if (needs.mount === 'span' && needs.spanCm && span && needs.spanCm > span + 0.5) continue;
    const list: (SystemVariant | undefined)[] = sys.variants?.length ? sys.variants : [undefined];
    let best: CeilingPick | undefined;
    for (const v of list) {
      const boardId = v?.board ?? sys.defaultBoard;
      if (!roomOk(boardId, needs.room)) continue;
      if (needs.fire > 0 && !(v?.fire && v.fire >= needs.fire)) continue;
      const reasons: string[] = [];
      if (v?.fire) reasons.push(`EI ${v.fire}`);
      if (span) reasons.push(`rozpiętość do ${fmtM(span)} m`);
      if (v?.thickness) reasons.push(`zabudowa ${Math.round(v.thickness)} mm`);
      const pick: CeilingPick = { system: sys, variant: v, boardId, fire: v?.fire, price: v?.price, approx: !!sys.source.approx || !v, reasons };
      if (!best || (pick.price ?? Infinity) < (best.price ?? Infinity)) best = pick;
    }
    if (best) picks.push(best);
  }
  return picks.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || Number(!!b.system.basic) - Number(!!a.system.basic));
}

// ---------------------------------------------------------------------------
// Poddasza
// ---------------------------------------------------------------------------

export interface AtticNeeds {
  /** Rodzaj rusztu (brak = dowolny) */
  frame?: AtticFrameKind;
  /** Liczba warstw płyt (brak = dowolna) */
  layers?: 1 | 2 | 3;
  room: Room;
  fire: FireNeed;
  maker?: Maker;
}

/** Kolejność rusztów od najprostszego w montażu */
const ATTIC_FRAME_RANK: Record<AtticFrameKind, number> = { battens: 0, hat: 1, hanger: 2, between: 3, cross: 4 };

/**
 * Dobór systemu zabudowy poddasza: wszystkie systemy poddaszy (także ruszty tylko do poddaszy – łaty,
 * profile kapeluszowe, więźba widoczna, ruszt krzyżowy). Z każdej konstrukcji najtańsza odmiana z karty,
 * która spełnia wymagania; kolejność: mniej warstw płyt, prostszy ruszt, systemy podstawowe.
 */
export function recommendAttics(needs: AtticNeeds, systems: CeilingSystem[] = allCeilingSystems()): CeilingPick[] {
  const picks: (CeilingPick & { rank: number })[] = [];
  for (const sys of systems) {
    if (!isAtticSystem(sys)) continue;
    if (needs.maker && makerOf(sys) !== needs.maker) continue;
    const kind = atticFrameKind(sys);
    if (needs.frame && kind !== needs.frame) continue;
    if (needs.layers && sys.layers !== needs.layers) continue;
    const list: (SystemVariant | undefined)[] = sys.variants?.length ? sys.variants : [undefined];
    let best: CeilingPick | undefined;
    for (const v of list) {
      const boardId = v?.board ?? sys.defaultBoard;
      if (!roomOk(boardId, needs.room)) continue;
      if (needs.fire > 0 && !(v?.fire && v.fire >= needs.fire)) continue;
      const reasons: string[] = [];
      if (v?.fire) reasons.push(`EI ${v.fire}`);
      const pick: CeilingPick = { system: sys, variant: v, boardId, fire: v?.fire, price: v?.price, approx: !!sys.source.approx || !v, reasons };
      // przy wymaganiu ogniowym najniższa wystarczająca klasa, potem najtańsza odmiana; przy remisie pierwsza z karty
      const better = !best || (needs.fire > 0 && (pick.fire ?? 0) !== (best.fire ?? 0) ? (pick.fire ?? 0) < (best.fire ?? 0) : (pick.price ?? Infinity) < (best.price ?? Infinity));
      if (better) best = pick;
    }
    if (best) picks.push({ ...best, rank: ATTIC_FRAME_RANK[kind] });
  }
  return picks
    .sort(
      (a, b) =>
        a.system.layers - b.system.layers ||
        a.rank - b.rank ||
        Number(!!b.system.basic) - Number(!!a.system.basic) ||
        (a.price ?? Infinity) - (b.price ?? Infinity),
    )
    .map(({ rank: _rank, ...p }) => p);
}
