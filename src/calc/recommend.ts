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
  type CeilingKind,
  type CeilingSystem,
  type StudSpacing,
  type SystemVariant,
  type WallSystem,
} from '../catalog/rigips';

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
}

export interface WallPick {
  system: WallSystem;
  /** Odmiana z karty, z której pochodzą parametry (brak = dane samego systemu) */
  variant?: SystemVariant;
  boardId: string;
  studSpacing: StudSpacing;
  doubleStuds: boolean;
  /** Maksymalna wysokość tej odmiany, cm (brak = bez ograniczeń / nie podano) */
  maxHeight?: number;
  fire?: number;
  ra1?: number;
  /** Grubość ściany, mm */
  thickness: number;
  /** Cena katalogowa producenta, zł/m² */
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
  return wallFrameDepth(sys) + boardById(boardId).thickness * sys.layers * sys.sides;
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
 * Systemy ścian spełniające wymagania, od najtańszego (wg ceny katalogowej producenta;
 * systemy bez ceny na końcu, cieńsze najpierw). Dla każdej konstrukcji zwracana jest
 * jedna, najlepsza odmiana.
 */
export function recommendWalls(needs: WallNeeds, systems: WallSystem[] = allWallSystems()): WallPick[] {
  const minRa1 = ACOUSTIC_MIN_RA1[needs.acoustic];
  const picks: WallPick[] = [];
  for (const sys of systems) {
    if (wallPurposeOf(sys) !== needs.purpose) continue;
    if (needs.liningOnly && !isLiningSystem(sys)) continue;
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
      if (c.maxHeight) reasons.push(`do ${fmtM(c.maxHeight)} m przy słupkach${c.double ? ' podwójnych' : ''} co ${c.spacing} cm`);
      if (fire) reasons.push(`EI ${fire}`);
      if (ra1) reasons.push(`RA1 ${ra1} dB`);
      reasons.push(`grubość ${Math.round(thickness)} mm`);
      const pick: WallPick = {
        system: sys,
        variant: c.v,
        boardId: c.boardId,
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

/** Kolejność: tańszy → mniej profili (rzadszy rozstaw, pojedyncze słupki) → cieńszy → podstawowy */
function better(a: WallPick, b: WallPick): boolean {
  const pa = a.price ?? Infinity;
  const pb = b.price ?? Infinity;
  if (pa !== pb) return pa < pb;
  const da = (a.doubleStuds ? 2 : 1) / a.studSpacing;
  const db = (b.doubleStuds ? 2 : 1) / b.studSpacing;
  if (da !== db) return da < db;
  if (a.thickness !== b.thickness) return a.thickness < b.thickness;
  return !!a.system.basic && !b.system.basic;
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
  suspended: ['two-level', 'one-level'],
  direct: ['direct', 'point-fix'],
  span: ['ua-span', 'cw-span'],
  attic: ['direct'],
};

export interface CeilingNeeds {
  mount: CeilingMount;
  room: Room;
  fire: FireNeed;
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

export const isAtticSystem = (s: CeilingSystem): boolean => s.kind === 'direct' && (s.attic === true || s.hangerType === 'elastic');

export function recommendCeilings(needs: CeilingNeeds, systems: CeilingSystem[] = allCeilingSystems()): CeilingPick[] {
  const picks: CeilingPick[] = [];
  for (const sys of systems) {
    if (!MOUNT_KINDS[needs.mount].includes(sys.kind)) continue;
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
