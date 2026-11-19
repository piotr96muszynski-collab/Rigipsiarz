// Geometria zabudowy poddasza: przekrój poprzeczny (skosy, sufit jętki), krokwie, linie profili CD
// i punkty wieszaków. Jedno źródło dla zestawienia materiałów, rysunków i widoku 3D.
//
// Układ przekroju: x w poprzek kalenicy od lica lewej ściany okapowej, z w górę od posadzki (cm).
// Oś „u” biegnie wzdłuż kalenicy od lica ściany szczytowej (cm).

import { ceilingSystemById, type CeilingSystem } from '../catalog/rigips';
import { ceilingBoardsMm, ceilingDepth } from './ceilingLevels';
import type { Attic } from '../model/types';

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

export interface AtticSurfaceGrid {
  surface: AtticSurface;
  /** Linie profili CD: odległość od dolnej / lewej krawędzi płaszczyzny, cm */
  cd: number[];
  /** Osie krokwi (jętek) z wieszakami, cm od ściany szczytowej */
  hangerU: number[];
  /** Powierzchnia płyt, m² */
  areaM2: number;
}

export interface AtticGrid {
  section: AtticSection;
  /** Przekrój po spodzie konstrukcji (krokwie, jętki) */
  structure: AtticSection;
  rafters: number[];
  surfaces: AtticSurfaceGrid[];
  /** Grubość zabudowy: spód krokwi – lico płyt, mm */
  depthMm: number;
  /** Rozstaw profili CD, cm */
  cdSpacing: number;
  warnings: string[];
  /** Założenia aplikacji, których nie ma w kartach producentów */
  assumptions: string[];
}

/** Grubość zabudowy pod krokwiami, mm: minimum z karty systemu albo wełna pod krokwiami + płyty */
export function atticDepthMm(a: Attic, sys: CeilingSystem = ceilingSystemById(a.systemId)): number {
  const min = ceilingDepth(sys, a.boardId).minMm;
  return Math.max(min, Math.round((a.woolUnder || 0) + ceilingBoardsMm(sys, a.boardId)));
}

export function atticGrid(a: Attic, sys: CeilingSystem = ceilingSystemById(a.systemId)): AtticGrid {
  const depthMm = atticDepthMm(a, sys);
  const structure = atticSection(a, 0);
  const section = atticSection(a, depthMm / 10);
  const warnings = [...structure.warnings];
  const rafters = rafterPositions(a);
  const cdSpacing = sys.mainSpacing;
  const maxHanger = sys.hangerSpacing || 100;
  const hangerU = hangerRafters(rafters, maxHanger);

  if (rafters.length < 2) warnings.push('Na tej długości mieści się mniej niż 2 krokwie – sprawdź rozstaw i położenie pierwszej krokwi.');
  if (a.rafterSpacing > maxHanger + 0.5)
    warnings.push(
      `Rozstaw krokwi ${fmtM(a.rafterSpacing)} m jest większy niż dopuszczalny rozstaw wieszaków ${fmtM(maxHanger)} m w tym systemie – potrzebny ruszt dwupoziomowy albo dodatkowe podparcie między krokwiami.`,
    );
  const firstGap = rafters[0] ?? 0;
  const lastGap = a.length - (rafters[rafters.length - 1] ?? 0);
  if (Math.max(firstGap, lastGap) > ATTIC_FIRST_HANGER + 0.5)
    warnings.push(
      `Skrajna krokiew jest ${fmtM(Math.max(firstGap, lastGap))} m od ściany szczytowej, a pierwszy wieszak powinien być nie dalej niż ${fmtM(ATTIC_FIRST_HANGER)} m – koniec profilu CD oprzyj w UD 30 na ścianie szczytowej i dodaj mocowanie przy ścianie.`,
    );
  const limit = ATTIC_MAX_UNDER_MM[sys.hangerType ?? 'es'];
  if (limit && a.woolUnder > limit.mm)
    warnings.push(`Wełna ${a.woolUnder} mm pod krokwiami nie zmieści się na tym wieszaku (${limit.why}) – zmniejsz grubość albo wybierz system na innych wieszakach.`);
  if (a.woolBetween > a.rafterHeight * 10 + 0.5)
    warnings.push(`Wełna ${a.woolBetween} mm między krokwiami jest grubsza niż krokiew ${Math.round(a.rafterHeight * 10)} mm – nadmiar trzeba zmieścić pod krokwiami albo nadbić krokwie.`);

  const surfaces: AtticSurfaceGrid[] = section.surfaces.map((s) => ({
    surface: s,
    cd: cdLinePositions(s.run, cdSpacing),
    hangerU,
    areaM2: (s.run * a.length) / 10000,
  }));

  const assumptions = [
    `Profile CD 60 biegną w poprzek krokwi, skrajne ${ATTIC_CD_EDGE} cm od ścian i od załamań skos/sufit (karty podają tylko rozstaw; wytyczne Rigips dla sufitów: do 15 cm od ściany).`,
    'Końce profili CD przy ścianach szczytowych wchodzą w UD 30 biegnący po skosie i suficie.',
    ...(section.hasCollar ? ['Sufit poziomy: jętka przy każdej parze krokwi, wieszaki mocowane do jętek.'] : []),
    'Płyty i wełna liczone po licu zabudowy, bez okien dachowych i ścian szczytowych.',
  ];
  return { section, structure, rafters, surfaces, depthMm, cdSpacing, warnings, assumptions };
}
