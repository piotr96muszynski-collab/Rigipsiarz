// Geometria zabudowy poddasza: przekrój poprzeczny (skosy, sufit jętki), krokwie, linie profili CD
// i punkty wieszaków. Jedno źródło dla zestawienia materiałów, rysunków i widoku 3D.
//
// Układ przekroju: x w poprzek kalenicy od lica lewej ściany okapowej, z w górę od posadzki (cm).
// Oś „u” biegnie wzdłuż kalenicy od lica ściany szczytowej (cm).

import { ceilingSystemById, type AtticCarrier, type AtticFrame, type CeilingSystem } from '../catalog/rigips';
import { ceilingBoardsMm, ceilingDepth } from './ceilingLevels';
import type { Attic } from '../model/types';
import { atticRoof, faceCdLines, hasRoofCorners, type AtticRoof, type RoofCdLine, type RoofFace, type RoofLine } from './atticRoof';

export interface SecPt {
  x: number;
  z: number;
}

export type AtticSurfaceId = 'left' | 'collar' | 'right';

/** Jedna płaszczyzna zabudowy w przekroju: skos albo sufit pod jętkami */
export interface AtticSurface {
  id: AtticSurfaceId;
  kind: 'slope' | 'collar';
  label: string;
  /** Dolna krawędź skosu (dla sufitu: lewa krawędź) */
  a: SecPt;
  /** Górna krawędź skosu (dla sufitu: prawa krawędź) */
  b: SecPt;
  /** Długość w przekroju (po skosie), cm */
  run: number;
}

export interface AtticSection {
  /** Płaszczyzny odsunięte o `depthCm` od spodu konstrukcji (0 = spód krokwi i jętek) */
  surfaces: AtticSurface[];
  /** Wysokość kalenicy (spód krokwi) albo górnej krawędzi skosu jednospadowego, cm */
  ridgeHeight: number;
  /** Położenie kalenicy w poprzek, cm */
  ridgeX: number;
  /** Czy jest sufit poziomy pod jętkami */
  hasCollar: boolean;
  warnings: string[];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const fmtM = (cm: number) => (cm / 100).toFixed(2).replace('.', ',');

export const SURFACE_LABEL: Record<AtticSurfaceId, string> = {
  left: 'Skos lewy',
  collar: 'Sufit pod jętkami',
  right: 'Skos prawy',
};

/**
 * Przekrój poddasza. `depthCm` = odsunięcie lica płyt od spodu krokwi (prostopadle do płaszczyzny);
 * 0 daje spód konstrukcji, grubość zabudowy daje lico płyt.
 */
export function atticSection(a: Attic, depthCm = 0): AtticSection {
  const warnings: string[] = [];
  const pitch = Math.min(80, Math.max(5, a.pitch));
  const t = Math.tan(rad(pitch));
  const off = depthCm / Math.cos(rad(pitch));
  const W = a.width;
  const mono = a.roof === 'mono';
  const kL = a.kneeLeft - off;
  const kR = a.kneeRight - off;

  // kalenica: przecięcie skosów (dwuspadowy) albo górna ściana (jednospadowy)
  const ridgeX = mono ? W : Math.min(W, Math.max(0, (a.kneeRight - a.kneeLeft + W * t) / (2 * t)));
  const ridgeZ = kL + ridgeX * t;
  const collarZ = a.collarHeight === undefined ? undefined : a.collarHeight - depthCm;
  const hasCollar = collarZ !== undefined && collarZ < ridgeZ - 1;
  if (a.collarHeight !== undefined && !hasCollar)
    warnings.push(`Jętka na ${fmtM(a.collarHeight)} m wypada powyżej kalenicy (${fmtM(a.kneeLeft + ridgeX * t)} m) – sufit poziomy pominięto.`);

  const surfaces: AtticSurface[] = [];
  const push = (id: AtticSurfaceId, kind: AtticSurface['kind'], p: SecPt, q: SecPt) => {
    const run = Math.hypot(q.x - p.x, q.z - p.z);
    if (run > 0.5) surfaces.push({ id, kind, label: SURFACE_LABEL[id], a: p, b: q, run });
  };

  // lewy skos: od ściany kolankowej (albo od podłogi) do jętki / kalenicy
  const leftLow: SecPt = kL >= 0 ? { x: 0, z: kL } : { x: -kL / t, z: 0 };
  const leftTop: SecPt = hasCollar ? { x: (collarZ! - kL) / t, z: collarZ! } : { x: ridgeX, z: ridgeZ };
  const leftOk = leftTop.z > leftLow.z + 0.5;
  if (hasCollar && !leftOk) warnings.push('Jętka jest niżej niż ścianka kolankowa z lewej strony – po tej stronie nie ma skosu.');
  if (leftOk) push('left', 'slope', leftLow, leftTop);

  let rightTop: SecPt = { x: W, z: hasCollar ? collarZ! : ridgeZ };
  let rightOk = false;
  if (!mono) {
    const rightLow: SecPt = kR >= 0 ? { x: W, z: kR } : { x: W + kR / t, z: 0 };
    rightTop = hasCollar ? { x: W - (collarZ! - kR) / t, z: collarZ! } : { x: ridgeX, z: ridgeZ };
    rightOk = rightTop.z > rightLow.z + 0.5;
    if (hasCollar && !rightOk) {
      warnings.push('Jętka jest niżej niż ścianka kolankowa z prawej strony – po tej stronie nie ma skosu.');
      rightTop = { x: W, z: collarZ! };
    }
    if (hasCollar) push('collar', 'collar', leftOk ? leftTop : { x: 0, z: collarZ! }, rightTop);
    if (rightOk) push('right', 'slope', rightLow, rightTop);
  } else if (hasCollar) {
    push('collar', 'collar', leftOk ? leftTop : { x: 0, z: collarZ! }, rightTop);
  }

  if (a.pitch !== pitch) warnings.push('Kąt dachu poza zakresem 5–80° – przyjęto wartość graniczną.');
  return { surfaces, ridgeHeight: a.kneeLeft + ridgeX * t, ridgeX, hasCollar, warnings };
}

/** Wysokość kalenicy (spód krokwi) dla podanego kąta i odwrotnie – do pola „kąt albo wysokość w kalenicy” */
export function ridgeHeightFor(a: Pick<Attic, 'roof' | 'width' | 'kneeLeft' | 'kneeRight' | 'pitch'>): number {
  const t = Math.tan(rad(a.pitch));
  const x = a.roof === 'mono' ? a.width : (a.kneeRight - a.kneeLeft + a.width * t) / (2 * t);
  return a.kneeLeft + x * t;
}

export function pitchForRidge(a: Pick<Attic, 'roof' | 'width' | 'kneeLeft' | 'kneeRight'>, ridgeHeight: number): number {
  // dwuspadowy: h = (kL + kR + W·t) / 2; jednospadowy: h = kL + W·t
  const t = a.roof === 'mono' ? (ridgeHeight - a.kneeLeft) / a.width : (2 * ridgeHeight - a.kneeLeft - a.kneeRight) / a.width;
  return (Math.atan(Math.max(0.01, t)) * 180) / Math.PI;
}

/** Osie krokwi wzdłuż kalenicy, cm od ściany szczytowej */
export function rafterPositions(a: Pick<Attic, 'length' | 'rafterSpacing' | 'firstRafter'>): number[] {
  const sp = Math.max(20, a.rafterSpacing);
  const out: number[] = [];
  for (let u = Math.max(0, a.firstRafter); u <= a.length + 1e-6; u += sp) out.push(Math.round(u * 10) / 10);
  return out;
}

/** Odległość skrajnego profilu CD od krawędzi płaszczyzny (ściana, załamanie skos/jętka), cm – założenie (karty: ≤ 15 cm od ściany) */
export const ATTIC_CD_EDGE = 10;
/** Najdalej od ściany szczytowej może być pierwszy wieszak na profilu, cm (wytyczne montażu Rigips: 40 cm) */
export const ATTIC_FIRST_HANGER = 40;

/** Położenia linii CD na płaszczyźnie o długości `run` (cm od dolnej / lewej krawędzi) */
export function cdLinePositions(run: number, spacing: number, edge = ATTIC_CD_EDGE): number[] {
  if (run <= 2 * edge + 1) return [Math.round(run * 5) / 10];
  const out: number[] = [];
  const end = run - edge;
  for (let s = edge; s < end - 5; s += spacing) out.push(Math.round(s * 10) / 10);
  out.push(Math.round(end * 10) / 10);
  return out;
}

/**
 * Krokwie, do których mocuje się wieszaki jednego profilu CD: pierwsza i ostatnia zawsze,
 * pośrednie tak rzadko, jak pozwala największy rozstaw wieszaków z karty systemu.
 */
export function hangerRafters(rafters: number[], maxSpacing: number): number[] {
  if (rafters.length <= 2) return [...rafters];
  const out = [rafters[0]];
  let i = 0;
  while (i < rafters.length - 1) {
    let j = i + 1;
    while (j + 1 < rafters.length && rafters[j + 1] - rafters[i] <= maxSpacing + 1e-6) j++;
    out.push(rafters[j]);
    i = j;
  }
  return out;
}

/** Największa grubość wełny pod krokwiami dla rodzaju wieszaka, mm (zasięg wieszaka + profil CD) */
export const ATTIC_MAX_UNDER_MM: Record<string, { mm: number; why: string }> = {
  // uchwyt ES 125 mm: zabudowa do ok. 12 cm (wytyczne montażu Rigips)
  es: { mm: 120, why: 'uchwyt ES 125 mm' },
  // uchwyt elastyczny najdłuższy 90 mm
  elastic: { mm: 90, why: 'uchwyt elastyczny 90 mm' },
  // karta 4.70.04 podaje układ 150 mm między + 150 mm pod krokwiami
  attic: { mm: 150, why: 'wieszak do poddaszy (karta 4.70.04: do 150 mm pod krokwiami)' },
};

/**
 * Długości uchwytów Rigips z wytycznych montażu zabudowy poddaszy: ES 75 / 125 mm, elastyczne 30 / 45 / 60 / 90 mm.
 * Zasięg uchwytu ES liczony 5 mm krócej niż długość (zagięcie ramion na profilu).
 */
const RIGIPS_HANGER_SIZES: Record<string, { sizes: { name: string; reachMm: number }[]; note: string }> = {
  es: {
    sizes: [
      { name: 'ES 75 mm', reachMm: 70 },
      { name: 'ES 125 mm', reachMm: 120 },
    ],
    note: 'Długość uchwytu ES (75 lub 125 mm wg wytycznych Rigips) dobrana do zabudowy pod krokwią; zasięg liczony 5 mm krócej niż długość uchwytu.',
  },
  elastic: {
    sizes: [30, 45, 60, 90].map((mm) => ({ name: `${mm} mm`, reachMm: mm })),
    note: 'Długość uchwytu elastycznego (30, 45, 60 lub 90 mm wg wytycznych Rigips) dobrana do zabudowy pod krokwią.',
  },
};

const CD_HANGER: Record<string, { product: string; label: string; ln9: number }> = {
  es: { product: 'WIESZAK_ES', label: 'uchwyt ES', ln9: 4 },
  elastic: { product: 'UCHWYT_ELAST', label: 'uchwyt elastyczny', ln9: 4 },
  // wieszak do poddaszy zatrzaskuje się na profilu – karta 4.70.04 nie podaje „pchełek”
  attic: { product: 'WIESZAK_PODD', label: 'wieszak do poddaszy', ln9: 0 },
};

/** Ruszt poddasza danego systemu: z katalogu albo domyślny – CD 60 na wieszakach wg `hangerType` */
export function atticFrameOf(sys: CeilingSystem): AtticFrame {
  if (sys.atticFrame) return sys.atticFrame;
  const type = sys.hangerType && CD_HANGER[sys.hangerType] ? sys.hangerType : 'es';
  const h = CD_HANGER[type];
  const limit = ATTIC_MAX_UNDER_MM[type];
  const sized = !sys.maker || sys.maker === 'rigips' ? RIGIPS_HANGER_SIZES[type] : undefined;
  return {
    mount: 'hanger',
    profile: 'CD60',
    profileLabel: 'profil CD 60',
    profileMm: 27,
    edge: 'UD30',
    hanger: h.product,
    hangerLabel: h.label,
    hangerLn9: h.ln9,
    joiner: 'LACZNIK_WZDL',
    // karty Rigips 4.70: 8 szt. na 4 wieszaki; Norgips ZP: 6 szt. na 3 wieszaki
    woodScrews: 2,
    maxUnderMm: limit.mm,
    maxUnderWhy: limit.why,
    ...(sized ? { hangerSizes: sized.sizes, hangerSizesNote: sized.note } : {}),
  };
}

/** Rodzaj rusztu poddasza – filtr w wyborze systemu */
export type AtticFrameKind = 'hanger' | 'hat' | 'battens' | 'between' | 'cross';

export const ATTIC_FRAME_KIND_LABEL: Record<AtticFrameKind, string> = {
  hanger: 'Profile na wieszakach',
  hat: 'Profile kapeluszowe do krokwi',
  battens: 'Łaty drewniane do krokwi',
  between: 'Między krokwiami (więźba widoczna)',
  cross: 'Ruszt krzyżowy',
};

/** Rodzaj rusztu systemu poddasza */
export function atticFrameKind(sys: CeilingSystem): AtticFrameKind {
  const f = atticFrameOf(sys);
  if (f.carrier) return 'cross';
  if (f.mount === 'between') return 'between';
  if (f.mount === 'direct') return f.battens || f.profile.startsWith('LATA') ? 'battens' : 'hat';
  return 'hanger';
}

/** Najkrótszy wieszak z listy systemu, który sięga na potrzebny odstęp; brak listy albo żaden nie sięga = undefined */
export function atticHangerSize(frame: AtticFrame, needMm: number) {
  return frame.hangerSizes?.find((s) => s.reachMm + 0.5 >= needMm);
}

/** Widoczna część krokwi w systemach z więźbą widoczną, cm – założenie, karty jej nie podają */
export const ATTIC_REVEAL = 6;

export interface AtticSurfaceGrid {
  surface: AtticSurface;
  /** Linie elementów rusztu pod płyty (CD, kapeluszowe, łaty): odległość od dolnej / lewej krawędzi płaszczyzny, cm */
  cd: number[];
  /** Osie krokwi (jętek) z mocowaniem rusztu, cm od ściany szczytowej; puste przy ruszcie między krokwiami */
  hangerU: number[];
  /** Ruszt krzyżowy: mocowania profili nośnych (pod każdą krokwią) – odległość od dolnej / lewej krawędzi, cm; inaczej puste */
  fixS: number[];
  /** Powierzchnia płyt, m² */
  areaM2: number;
}

export interface AtticGrid {
  section: AtticSection;
  /** Przekrój po spodzie konstrukcji (krokwie, jętki) */
  structure: AtticSection;
  rafters: number[];
  surfaces: AtticSurfaceGrid[];
  /** Grubość zabudowy: spód krokwi – lico płyt, mm (ujemna, gdy płyty są między krokwiami) */
  depthMm: number;
  /** Łączna grubość płyt, mm */
  boardsMm: number;
  /** Rozstaw elementów rusztu pod płyty, cm */
  cdSpacing: number;
  /** Ruszt systemu */
  frame: AtticFrame;
  /** Profile nośne rusztu krzyżowego (pod krokwiami); brak = ruszt jednopoziomowy */
  carrier?: AtticCarrier;
  /** Odstęp, na który musi sięgnąć wieszak: spód krokwi – płyty (ruszt krzyżowy: – profil nośny), mm */
  hangerNeedMm: number;
  /** Dobrana długość wieszaka (gdy system ma kilka długości i któraś wystarcza) */
  hangerSize?: { name: string; reachMm: number };
  /** Produkt elementu rusztu (dobrany przekrój łaty) i jego wysokość, mm */
  profile: string;
  profileMm: number;
  /** Pola między krokwiami (ruszt między krokwiami): początek i szerokość w świetle, cm od ściany szczytowej */
  bays: { u: number; w: number }[];
  warnings: string[];
  /** Założenia aplikacji, których nie ma w kartach producentów */
  assumptions: string[];
  /** Dach z narożnikami lub koszami: płaszczyzny o dowolnym obrysie zamiast prostokątnych `surfaces` */
  roof?: AtticRoofGrid;
}

/** Ruszt na jednej płaszczyźnie dachu z narożnikami / koszami */
export interface AtticRoofFaceGrid {
  face: RoofFace;
  /** Odcinki profili pod płyty z mocowaniami do krokwi */
  cd: RoofCdLine[];
}

/** Profil wzdłuż krokwi narożnej albo koszowej po jednej stronie linii */
export interface AtticRoofLineProfile {
  line: RoofLine;
  /** Płaszczyzna, po której stronie leży profil */
  face: number;
  /** Mocowania do krokwi narożnej / koszowej: odległości od początku linii (po skosie), cm */
  fix: number[];
}

export interface AtticRoofGrid {
  /** Lico płyt */
  roof: AtticRoof;
  /** Spód krokwi */
  structure: AtticRoof;
  faces: AtticRoofFaceGrid[];
  lineProfiles: AtticRoofLineProfile[];
}

/** Czy ruszt systemu da się policzyć na dachu z narożnikami i koszami (jednopoziomowy, pod krokwiami) */
export function roofCornersSupported(sys: CeilingSystem): boolean {
  const f = atticFrameOf(sys);
  return f.mount !== 'between' && !f.carrier;
}

/** Mocowania profilu wzdłuż linii długości `len`: oba końce i pośrednie co max `spacing`, cm */
export function lineFixes(len: number, spacing: number): number[] {
  const end = Math.max(0, len - ATTIC_CD_EDGE);
  const n = Math.max(1, Math.ceil((end - ATTIC_CD_EDGE) / spacing - 1e-9));
  if (end <= ATTIC_CD_EDGE) return [Math.round(len * 5) / 10];
  return Array.from({ length: n + 1 }, (_, i) => Math.round((ATTIC_CD_EDGE + ((end - ATTIC_CD_EDGE) * i) / n) * 10) / 10);
}

/** Przekrój łaty dobrany do rozstawu krokwi: najmniejszy, którego rozstaw mocowania z karty wystarcza */
export function atticBatten(frame: AtticFrame, rafterSpacing: number) {
  if (!frame.battens?.length) return undefined;
  return frame.battens.find((b) => b.maxFix + 0.5 >= rafterSpacing) ?? frame.battens[frame.battens.length - 1];
}

/** Pola między krokwiami w świetle (także skrajne, do ścian szczytowych), cm */
export function atticBays(a: Pick<Attic, 'length' | 'rafterWidth'>, rafters: number[]): { u: number; w: number }[] {
  const out: { u: number; w: number }[] = [];
  const half = a.rafterWidth / 2;
  const edges = [0, ...rafters.flatMap((r) => [r - half, r + half]), a.length];
  for (let i = 0; i < edges.length; i += 2) {
    const w = edges[i + 1] - edges[i];
    if (w > 10) out.push({ u: Math.round(edges[i] * 10) / 10, w: Math.round(w * 10) / 10 });
  }
  return out;
}

/** Grubość zabudowy pod krokwiami, mm: minimum z karty systemu albo wełna pod krokwiami + płyty */
export function atticDepthMm(a: Attic, sys: CeilingSystem = ceilingSystemById(a.systemId)): number {
  const frame = atticFrameOf(sys);
  const boards = ceilingBoardsMm(sys, a.boardId);
  // więźba widoczna: płyty cofnięte między krokwie
  if (frame.mount === 'between') return -Math.round((a.reveal ?? ATTIC_REVEAL) * 10);
  // ruszt przykręcony wprost do krokwi: wysokość profilu lub łaty + płyty, bez regulacji
  if (frame.mount === 'direct') return Math.round((atticBatten(frame, a.rafterSpacing)?.mm ?? frame.profileMm) + boards);
  const min = ceilingDepth(sys, a.boardId).minMm;
  return Math.max(min, Math.round((a.woolUnder || 0) + boards));
}

export function atticGrid(a: Attic, sys: CeilingSystem = ceilingSystemById(a.systemId)): AtticGrid {
  const frame = atticFrameOf(sys);
  const batten = atticBatten(frame, a.rafterSpacing);
  const profile = batten?.product ?? frame.profile;
  const profileMm = batten?.mm ?? frame.profileMm;
  const label = frame.profileLabel;
  const depthMm = atticDepthMm(a, sys);
  const structure = atticSection(a, 0);
  const section = atticSection(a, depthMm / 10);
  const warnings = [...structure.warnings];
  const rafters = rafterPositions(a);
  const carrier = frame.carrier;
  // ruszt krzyżowy: pod płytami profile co rozstaw montażowych, nośne pod każdą krokwią
  const cdSpacing = carrier ? sys.secondarySpacing : sys.mainSpacing;
  const maxHanger = batten?.maxFix ?? (sys.hangerSpacing || 100);
  const between = frame.mount === 'between';
  const hangerU = between ? [] : frame.mount === 'direct' || carrier ? [...rafters] : hangerRafters(rafters, maxHanger);
  const bays = between ? atticBays(a, rafters) : [];
  const boardsMm = ceilingBoardsMm(sys, a.boardId);

  if (rafters.length < 2) warnings.push('Na tej długości mieści się mniej niż 2 krokwie – sprawdź rozstaw i położenie pierwszej krokwi.');
  if (carrier && a.rafterSpacing > carrier.maxSpacing + 0.5)
    warnings.push(
      `Rozstaw krokwi ${fmtM(a.rafterSpacing)} m jest większy niż dopuszczalny rozstaw profili nośnych ${fmtM(carrier.maxSpacing)} m (${carrier.label} biegnie pod każdą krokwią) – dodaj krokiew pośrednią albo wybierz inny system.`,
    );
  if (!between && !carrier && a.rafterSpacing > maxHanger + 0.5)
    warnings.push(
      frame.mount === 'direct'
        ? `Rozstaw krokwi ${fmtM(a.rafterSpacing)} m jest większy niż dopuszczalny rozstaw mocowania ${fmtM(maxHanger)} m (${label}${batten ? ` ${batten.size}` : ''}) – wybierz system na wieszakach albo dodaj podparcie między krokwiami.`
        : `Rozstaw krokwi ${fmtM(a.rafterSpacing)} m jest większy niż dopuszczalny rozstaw wieszaków ${fmtM(maxHanger)} m w tym systemie – potrzebny ruszt dwupoziomowy albo dodatkowe podparcie między krokwiami.`,
    );
  if (between && a.rafterSpacing - a.rafterWidth > maxHanger + 0.5)
    warnings.push(`Światło między krokwiami ${fmtM(a.rafterSpacing - a.rafterWidth)} m jest większe niż dopuszczalna rozpiętość elementów poprzecznych ${fmtM(maxHanger)} m w tym systemie.`);
  const firstGap = rafters[0] ?? 0;
  const lastGap = a.length - (rafters[rafters.length - 1] ?? 0);
  if (!between && Math.max(firstGap, lastGap) > ATTIC_FIRST_HANGER + 0.5)
    warnings.push(
      frame.edge
        ? `Skrajna krokiew jest ${fmtM(Math.max(firstGap, lastGap))} m od ściany szczytowej, a pierwsze mocowanie powinno być nie dalej niż ${fmtM(ATTIC_FIRST_HANGER)} m – koniec profilu oprzyj w profilu przyściennym na ścianie szczytowej i dodaj mocowanie przy ścianie.`
        : `Skrajna krokiew jest ${fmtM(Math.max(firstGap, lastGap))} m od ściany szczytowej, a pierwsze mocowanie powinno być nie dalej niż ${fmtM(ATTIC_FIRST_HANGER)} m – dodaj przy ścianie szczytowej krokiew, łatę lub inne podparcie końców rusztu.`,
    );
  const hangerNeedMm = frame.mount === 'hanger' ? Math.max(0, depthMm - boardsMm - (carrier?.mm ?? 0)) : 0;
  const hangerSize = frame.mount === 'hanger' ? atticHangerSize(frame, hangerNeedMm) : undefined;
  const longest = frame.hangerSizes?.[frame.hangerSizes.length - 1];
  if (frame.mount === 'hanger' && longest && !hangerSize)
    warnings.push(
      `Wełna ${a.woolUnder} mm pod krokwiami nie zmieści się: żaden ${frame.hangerLabel ?? 'wieszak'} tego systemu nie sięgnie na ${Math.floor(hangerNeedMm)} mm pod krokwią (najdłuższy ${longest.name}: do ${longest.reachMm} mm) – zmniejsz grubość albo wybierz system na dłuższych wieszakach.`,
    );
  else if (frame.mount === 'hanger' && frame.maxUnderMm && a.woolUnder > frame.maxUnderMm)
    warnings.push(`Wełna ${a.woolUnder} mm pod krokwiami nie zmieści się na tym wieszaku (${frame.maxUnderWhy ?? `do ${frame.maxUnderMm} mm`}) – zmniejsz grubość albo wybierz system na innych wieszakach.`);
  if (frame.mount === 'direct' && a.woolUnder > profileMm)
    warnings.push(
      `Wełna ${a.woolUnder} mm pod krokwiami nie zmieści się: ${label} leży wprost na krokwiach i daje tylko ${Math.round(profileMm)} mm – ustaw 0 albo wybierz system na wieszakach.`,
    );
  if (between && a.woolUnder > 0) warnings.push('W systemie z widoczną więźbą nie ma wełny pod krokwiami – ustaw 0.');
  const roomMm = between ? a.rafterHeight * 10 + depthMm - profileMm - boardsMm : a.rafterHeight * 10;
  if (a.woolBetween > roomMm + 0.5)
    warnings.push(
      between
        ? `Wełna ${a.woolBetween} mm nie zmieści się między krokwiami: przy widocznych ${Math.round(-depthMm / 10)} cm krokwi nad rusztem zostaje ${Math.max(0, Math.round(roomMm))} mm – nadbij krokwie albo ociepl dach od góry.`
        : `Wełna ${a.woolBetween} mm między krokwiami jest grubsza niż krokiew ${Math.round(a.rafterHeight * 10)} mm – nadmiar trzeba zmieścić pod krokwiami albo nadbić krokwie.`,
    );

  const clear = between ? bays.reduce((t, b) => t + b.w, 0) : a.length;
  const surfaces: AtticSurfaceGrid[] = section.surfaces.map((s) => ({
    surface: s,
    cd: cdLinePositions(s.run, cdSpacing),
    hangerU,
    // mocowania profilu nośnego wzdłuż krokwi: skrajne przy krawędziach płaszczyzny, pośrednie co max rozstaw wieszaków
    fixS: carrier ? cdLinePositions(s.run, maxHanger) : [],
    areaM2: (s.run * clear) / 10000,
  }));

  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  const assumptions = [
    ...(carrier
      ? [
          `Ruszt krzyżowy: ${carrier.label} pod każdą krokwią${section.hasCollar ? ' i jętką' : ''}, na całej długości płaszczyzny; ${frame.hangerLabel} skrajne ${ATTIC_CD_EDGE} cm od krawędzi, pośrednie co max ${maxHanger} cm.`,
          carrier.cross
            ? `${carrier.crossLabel ?? 'Łącznik krzyżowy'} na każdym skrzyżowaniu profilu nośnego z profilem pod płyty.`
            : `Profil pod płyty przykręcony do każdego profilu nośnego (${carrier.crossLn9 ?? 2} wkręty na skrzyżowanie) – karta podaje tylko zużycie na m².`,
        ]
      : []),
    between
      ? `${Label}: elementy poprzeczne między krokwiami, skrajne ${ATTIC_CD_EDGE} cm od ścian i od załamań skos/sufit; elementy wzdłuż krokwi po obu stronach każdego pola.`
      : `${Label}: elementy biegną w poprzek krokwi, skrajne ${ATTIC_CD_EDGE} cm od ścian i od załamań skos/sufit (karty podają tylko rozstaw; wytyczne Rigips dla sufitów: do 15 cm od ściany).`,
    ...(between ? [`Widoczna część krokwi ${Math.round(-depthMm / 10)} cm poniżej lica płyt – karty jej nie podają, ustaw w formularzu.`] : []),
    ...(!between && frame.edge ? ['Końce profili przy ścianach szczytowych wchodzą w profil przyścienny biegnący po skosie i suficie.'] : []),
    ...(frame.mount === 'direct' ? [`${Label} przykręca się do każdej krokwi, bez regulacji – spód krokwi musi być w jednej płaszczyźnie (podkładki przy nierównościach).`] : []),
    ...(batten ? [`Przekrój łat ${batten.size} mm dobrany do rozstawu krokwi (karta: mocowanie co max ${batten.maxFix} cm).`] : []),
    ...(section.hasCollar ? [`Sufit poziomy: jętka przy każdej parze krokwi, ${between ? 'ruszt między jętkami' : 'ruszt mocowany do jętek'}.`] : []),
    `Płyty i wełna liczone po licu zabudowy${a.gableLining ? '' : ', bez ścian szczytowych'}; otwory okien dachowych odjęte, glify doliczone osobno.`,
  ];
  if (hangerSize && frame.hangerSizesNote) assumptions.push(frame.hangerSizesNote);

  let roof: AtticRoofGrid | undefined;
  if (hasRoofCorners(a)) {
    if (!roofCornersSupported(sys))
      warnings.push(
        `Narożniki dachu i kosze nie są liczone dla ${between ? 'systemu z widoczną więźbą' : 'rusztu krzyżowego'} – zestawienie i rysunki pokazują poddasze prostokątne ze ścianami szczytowymi.`,
      );
    else {
      const lining = atticRoof(a, depthMm / 10);
      const struct = atticRoof(a, 0);
      warnings.push(...lining.warnings);
      const every = frame.mount === 'direct';
      const faces = lining.faces.map((face) => ({ face, cd: faceCdLines(face, cdSpacing, ATTIC_CD_EDGE, maxHanger, every) }));
      // profil wzdłuż krokwi narożnej / koszowej po obu stronach linii: podparcie końców profili i krawędzi płyt
      const lineProfiles: AtticRoofLineProfile[] = lining.lines
        .filter((l) => l.kind === 'hip' || l.kind === 'valley')
        .flatMap((line) => line.faces.map((fi) => ({ line, face: fi, fix: lineFixes(line.len, maxHanger) })));
      roof = { roof: lining, structure: struct, faces, lineProfiles };
      // przy połaci narożnej nie ma ściany szczytowej
      if (a.ends?.every((e) => e === 'hip')) for (let i = warnings.length - 1; i >= 0; i--) if (warnings[i].startsWith('Skrajna krokiew')) warnings.splice(i, 1);
      const hips = lining.lines.filter((l) => l.kind === 'hip').length;
      const valleys = lining.lines.filter((l) => l.kind === 'valley').length;
      assumptions.push(
        `Dach z ${[hips ? `narożnikami (${hips})` : '', valleys ? `koszami (${valleys})` : ''].filter(Boolean).join(' i ')}: karty producentów nie mają detali narożników ani koszy – przyjęto, że ${label} dochodzą do linii narożnika / kosza przycięte pod kątem, a wzdłuż krokwi narożnej i koszowej po obu stronach biegnie ${label} ${frame.mount === 'direct' ? 'przykręcony' : `na ${frame.hangerLabel ?? 'wieszakach'}`} co max ${maxHanger} cm; końce profili przykręcone do niego (2 wkręty).`,
        'Połać narożna ma ten sam kąt co skosy, a ścianka kolankowa pod nią tę samą wysokość co z lewej strony; krokwie kulawe co rozstaw krokwi, symetrycznie od osi kalenicy.',
        ...(valleys ? ['Dobudówka: ten sam kąt, ścianka kolankowa i jętki co po tej stronie poddasza; krokwie od końca dobudówki co rozstaw krokwi.'] : []),
        ...(valleys ? ['Kosz od środka to krawędź zewnętrzna pod kątem rozwartym – wykończenie jak „Krawędzie zewnętrzne pod kątem nietypowym” w ustawieniach wykończenia.'] : []),
        ...(hips ? ['Narożnik dachu od środka to kąt wewnętrzny rozwarty – wykończenie jak „Kąty wewnętrzne pod kątem nietypowym” w ustawieniach wykończenia.'] : []),
      );
      const i = assumptions.findIndex((x) => x.startsWith('Płyty i wełna liczone'));
      if (i >= 0) assumptions[i] = 'Płyty i wełna liczone po licu zabudowy, bez okien dachowych i ścian szczytowych; płyty przy narożnikach i koszach cięte pod kątem z całych arkuszy (bez osobnego odpadu ponad naddatek).';
    }
  }
  return { section, structure, rafters, surfaces, depthMm, boardsMm, cdSpacing, frame, carrier, hangerNeedMm, hangerSize, profile, profileMm, bays, warnings, assumptions, roof };
}
