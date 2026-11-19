// Okna dachowe w skosach poddasza: otwór w płytach, glify (dolny pionowo, górny poziomo, boczne
// prostopadle do okna), ruszt wokół otworu i materiały obróbki. Jedno źródło dla zestawienia,
// rysunków, widoku 3D i rozkładu płyt na skosach.
//
// Źródła (sprawdzone 2026-11-19):
// - FAKRO „Przewodnik architekta – informacje ogólne, okna skośne”: glif „dolna prostopadle, a górna
//   równolegle do podłogi”; przy montażu na krokwiach odstęp między krokwiami 3–5 cm większy od szerokości
//   okna, „maksymalnie po 2,5 cm z każdej strony ościeżnicy”; wymiany 30–50 cm nad i pod oknem.
// - Poradniki (muratordom.pl, kb.pl, inzynierbudownictwa.pl): ruszt glifu z profili UD/CD, glif górny
//   poziomo, dolny pionowo, boczne prostopadle do okna; płyty H2 min. 12,5 mm wsuwane we wpust ościeżnicy;
//   narożniki aluminiowe na krawędziach glifu; paroizolacja połączona z ościeżnicą kołnierzem
//   (VELUX BBX, FAKRO XDS) i taśmą; wełna wokół ościeżnicy.
// Karty systemów Rigips / Norgips / Siniat / Knauf nie opisują rusztu wokół okna – reszta to założenia
// aplikacji, pokazane w „Założeniach wyliczeń”.
//
// Układ: jak w attic.ts – przekrój x/z (cm), „u” wzdłuż kalenicy od ściany szczytowej, „s” po licu
// płaszczyzny od jej dolnej krawędzi.

import { boardById, ceilingSystemById, type CeilingSystem } from '../catalog/rigips';
import { cornerTypeById, resolveFinishing, type FinishingSettings } from '../catalog/finishing';
import type { Attic, RoofWindow } from '../model/types';
import { atticGrid, type AtticGrid, type AtticSurfaceGrid, type AtticSurfaceId, type SecPt } from './attic';
import { addEdgeFinish } from './joints';
import { add, addBoardScrews, addJointing, addNote, addPiece, pickBoardLength, type Requirement } from './materials';

/** Rozmiary okien z oznaczeń producentów: wymiary zewnętrzne ościeżnicy, cm (sprawdź na tabliczce okna) */
export const ROOF_WINDOW_SIZES: { maker: 'VELUX' | 'FAKRO'; code: string; width: number; height: number }[] = [
  ...(
    [
      ['CK02', 55, 78],
      ['CK04', 55, 98],
      ['FK06', 66, 118],
      ['MK04', 78, 98],
      ['MK06', 78, 118],
      ['MK08', 78, 140],
      ['MK10', 78, 160],
      ['PK06', 94, 118],
      ['PK08', 94, 140],
      ['PK10', 94, 160],
      ['SK06', 114, 118],
      ['SK08', 114, 140],
      ['UK04', 134, 98],
      ['UK08', 134, 140],
    ] as const
  ).map(([code, width, height]) => ({ maker: 'VELUX' as const, code, width, height })),
  ...(
    [
      [55, 78],
      [55, 98],
      [66, 98],
      [66, 118],
      [66, 140],
      [78, 98],
      [78, 118],
      [78, 140],
      [78, 160],
      [94, 118],
      [94, 140],
      [114, 118],
      [114, 140],
      [134, 98],
    ] as const
  ).map(([width, height]) => ({ maker: 'FAKRO' as const, code: `${width}×${height}`, width, height })),
];

/** Największa szczelina między ościeżnicą a krokwią z każdej strony, cm (FAKRO) */
export const ROOF_WINDOW_GAP = 2.5;
/** Oś profilu obramowania (wymianu z CD) od krawędzi otworu w płytach, cm – założenie: półka profilu pod krawędzią płyty */
export const WINDOW_TRIM = 3;
/** Największa głębokość glifu bez usztywnienia, cm – założenie */
export const REVEAL_STIFF = 40;

export interface RoofWindowGeom {
  w: RoofWindow;
  surfaceId: AtticSurfaceId;
  /** Płaszczyzna lica płyt z oknem */
  g: AtticSurfaceGrid;
  /** Otwór w płytach (krawędzie glifów na licu): u wzdłuż kalenicy, s po licu od dolnej krawędzi, cm */
  u0: number;
  u1: number;
  s0: number;
  s1: number;
  /** Krawędzie ościeżnicy (dolna, górna) i narożniki glifów na licu płyt – w przekroju, cm */
  frameBottom: SecPt;
  frameTop: SecPt;
  faceBottom: SecPt;
  faceTop: SecPt;
  /** Odległość płaszczyzny ościeżnicy od lica płyt (prostopadle), cm */
  depth: number;
  /** Głębokość glifów dolnego (pionowego) i górnego (poziomego), cm */
  lower: number;
  upper: number;
  /** Pole jednego glifu bocznego, m² */
  sideM2: number;
  /** Pole wszystkich glifów, m² */
  revealM2: number;
  /** Osie krokwi po bokach okna (albo lico ściany szczytowej), cm */
  flank: [number, number];
  /** Krokwie przechodzące przez otwór okna */
  cutRafters: number[];
  /** Obramowanie otworu: poprzeczne (wzdłuż kalenicy) nad i pod otworem, boczne po skosie */
  cross: { s: number; u0: number; u1: number }[];
  side: { u: number; s0: number; s1: number }[];
  /** Linie rusztu przerwane otworem (s, cm) */
  interrupted: number[];
  /** Usztywnienia glifów dolnego i górnego (elementy w poprzek, wzdłuż kalenicy) */
  stiffLower: number;
  stiffUpper: number;
  warnings: string[];
}

const fmtM = (cm: number) => (cm / 100).toFixed(2).replace('.', ',');
const r1 = (v: number) => Math.round(v * 10) / 10;

export function windowLabel(w: RoofWindow, i?: number) {
  const size = `${Math.round(w.width)}×${Math.round(w.height)}`;
  return `Okno dachowe${i === undefined ? '' : ` ${i + 1}`}${w.sizeCode ? ` ${w.sizeCode}` : ''} (${size} cm)`;
}

/** Pole wielokąta w przekroju, cm² */
function polyArea(pts: SecPt[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.z - q.x * p.z;
  }
  return Math.abs(s) / 2;
}

/** Geometria wszystkich okien poddasza; okna bez skosu albo poza nim mają tylko ostrzeżenia */
export function atticWindowGeometry(a: Attic, grid: AtticGrid = atticGrid(a)): { list: RoofWindowGeom[]; warnings: string[] } {
  const list: RoofWindowGeom[] = [];
  const warnings: string[] = [];
  const between = grid.frame.mount === 'between';
  const depthFace = grid.depthMm / 10;
  (a.windows ?? []).forEach((w, i) => {
    const name = windowLabel(w, i);
    const side = a.roof === 'mono' ? 'left' : w.side;
    const st = grid.structure.surfaces.find((s) => s.id === side);
    const g = grid.surfaces.find((x) => x.surface.id === side);
    if (!st || !g) {
      warnings.push(`${name}: po tej stronie nie ma skosu – okno pominięto.`);
      return;
    }
    const f = g.surface;
    const d = { x: (st.b.x - st.a.x) / st.run, z: (st.b.z - st.a.z) / st.run };
    // normalna w stronę dachu (do krokwi)
    const n = side === 'left' ? { x: -d.z, z: d.x } : { x: d.z, z: -d.x };
    const sx = Math.sign(d.x) || 1;
    // płaszczyzna ościeżnicy: wierzch krokwi (założenie – osadzenie standardowe, wpust na wysokości łat)
    const Hr = a.rafterHeight;
    const depth = Hr + depthFace;
    const tB = (w.sill - st.a.z - n.z * Hr) / d.z;
    const frameBottom = { x: st.a.x + n.x * Hr + d.x * tB, z: w.sill };
    const frameTop = { x: frameBottom.x + d.x * w.height, z: frameBottom.z + d.z * w.height };
    // glif dolny pionowo w dół do lica płyt, górny poziomo w głąb pomieszczenia
    const lower = depth / Math.max(0.05, n.z);
    const upper = depth / Math.max(0.05, -n.x * sx);
    const faceBottom = { x: frameBottom.x, z: frameBottom.z - lower };
    const faceTop = { x: frameTop.x + sx * upper, z: frameTop.z };
    const sOf = (p: SecPt) => (p.x - f.a.x) * d.x + (p.z - f.a.z) * d.z;
    let s0 = sOf(faceBottom);
    let s1 = sOf(faceTop);
    const ww: string[] = [];
    if (s0 < 0) {
      ww.push(`${name}: dolny glif schodzi ${fmtM(-s0)} m poniżej dolnej krawędzi skosu – podnieś okno albo obniż ściankę kolankową (glif przycięty).`);
      s0 = 0;
    }
    if (s1 > f.run) {
      ww.push(
        `${name}: górny glif wychodzi ${fmtM(s1 - f.run)} m poza skos (${grid.section.hasCollar ? 'w sufit pod jętkami' : 'za kalenicę'}) – obniż okno; na rysunku glif przycięty do skosu.`,
      );
      s1 = f.run;
    }
    const u0 = w.u - w.width / 2;
    const u1 = w.u + w.width / 2;
    if (u0 < 0 || u1 > a.length) ww.push(`${name}: okno wychodzi poza długość poddasza – sprawdź położenie osi.`);

    // krokwie: przechodzące przez okno i najbliższe po bokach
    const half = a.rafterWidth / 2;
    const cutRafters = grid.rafters.filter((r) => r + half > u0 && r - half < u1);
    const left = Math.max(0, ...grid.rafters.filter((r) => r < u0 && !cutRafters.includes(r)));
    const right = Math.min(a.length, ...grid.rafters.filter((r) => r > u1 && !cutRafters.includes(r)));
    if (cutRafters.length)
      ww.push(
        `${name}: ${cutRafters.length === 1 ? `krokiew w osi ${fmtM(cutRafters[0])} m przechodzi` : `krokwie w osiach ${cutRafters.map(fmtM).join(', ')} m przechodzą`} przez otwór – trzeba je przeciąć i podeprzeć wymianami 30–50 cm nad i pod oknem (wytyczne FAKRO; praca ciesielska, poza zestawieniem) albo przesunąć okno.`,
      );
    else {
      const gap = Math.max(left > 0 ? u0 - (left + half) : 0, right < a.length ? right - half - u1 : 0);
      if (gap > ROOF_WINDOW_GAP + 0.5)
        ww.push(
          `${name}: odstęp ościeżnicy od krokwi ${fmtM(gap)} m – producenci dopuszczają do ${fmtM(ROOF_WINDOW_GAP)} m z każdej strony przy montażu na krokwiach; przy większym okno montuje się na łatach albo z krokwią / wymianem bocznym.`,
        );
    }

    // obramowanie otworu i przerwane linie rusztu
    const cross: RoofWindowGeom['cross'] = [];
    const sideT: RoofWindowGeom['side'] = [];
    const lo = s0 - WINDOW_TRIM;
    const hi = s1 + WINDOW_TRIM;
    let interrupted: number[];
    if (between) {
      // więźba widoczna: poprzeczki w polu okna nad i pod otworem, boki to krokwie
      interrupted = g.cd.filter((s) => s > lo - 5 && s < hi + 5);
      for (const s of [lo, hi]) if (s > 0 && s < f.run) cross.push({ s: r1(s), u0: r1(left + half), u1: r1(right - half) });
    } else {
      interrupted = g.cd.filter((s) => s > lo - 5 && s < hi + 5);
      for (const s of [lo, hi]) if (s > 0 && s < f.run) cross.push({ s: r1(s), u0: r1(left), u1: r1(right) });
      for (const u of [u0 - WINDOW_TRIM, u1 + WINDOW_TRIM]) sideT.push({ u: r1(u), s0: r1(Math.max(0, lo)), s1: r1(Math.min(f.run, hi)) });
    }

    const sideM2 = polyArea([frameBottom, frameTop, faceTop, faceBottom]) / 10000;
    const revealM2 = (w.width * (lower + upper)) / 10000 + 2 * sideM2;
    const stiff = (len: number) => (between ? 0 : Math.max(0, Math.ceil(len / REVEAL_STIFF - 1e-9) - 1));
    warnings.push(...ww);
    list.push({
      w,
      surfaceId: side,
      g,
      u0: r1(u0),
      u1: r1(u1),
      s0: r1(s0),
      s1: r1(s1),
      frameBottom,
      frameTop,
      faceBottom,
      faceTop,
      depth,
      lower,
      upper,
      sideM2,
      revealM2,
      flank: [left, right],
      cutRafters,
      cross,
      side: sideT,
      interrupted,
      stiffLower: stiff(lower),
      stiffUpper: stiff(upper),
      warnings: ww,
    });
  });
  return { list, warnings };
}

/** Otwory w płytach skosów (krawędzie glifów na licu) – dla rozkładu płyt */
export function atticWindowCutouts(a: Attic, grid: AtticGrid = atticGrid(a)) {
  return atticWindowGeometry(a, grid).list.map((x) => ({ windowId: x.w.id, surfaceId: x.surfaceId, u0: x.u0, u1: x.u1, s0: x.s0, s1: x.s1 }));
}

/**
 * Odcinki linii rusztu (s) wzdłuż kalenicy po przerwaniu przez okna, cm od ściany szczytowej.
 * Linia przerwana kończy się na bocznym obramowaniu otworu.
 */
export function cdLineSegments(len: number, s: number, surfaceId: AtticSurfaceId, wins: RoofWindowGeom[]): [number, number][] {
  const gaps = wins
    .filter((x) => x.surfaceId === surfaceId && x.interrupted.includes(s) && x.side.length)
    .map((x) => [x.side[0].u, x.side[1].u] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > at + 1) out.push([at, Math.max(at, g0)]);
    at = Math.max(at, g1);
  }
  if (len > at + 1) out.push([at, len]);
  return out;
}

/**
 * Dodatkowe mocowania rusztu do krokwi przy oknie (u, s na licu): obramowanie poprzeczne na krokwiach
 * po bokach okna, boczne co max rozstaw wieszaków, końce przerwanych linii na krokwiach bez mocowania.
 */
export function windowFixPoints(x: RoofWindowGeom, grid: AtticGrid, maxHanger: number): [number, number][] {
  if (grid.frame.mount === 'between') return [];
  const isRafter = (u: number) => grid.rafters.includes(u);
  const hung = new Set(x.g.hangerU);
  const out: [number, number][] = [];
  for (const c of x.cross) for (const u of x.flank) if (isRafter(u)) out.push([u, c.s]);
  for (const sd of x.side) {
    const n = Math.max(2, Math.ceil((sd.s1 - sd.s0) / maxHanger - 1e-9) + 1);
    for (let i = 0; i < n; i++) out.push([sd.u, r1(sd.s0 + ((sd.s1 - sd.s0) * i) / (n - 1))]);
  }
  for (const s of x.interrupted) for (const u of x.flank) if (isRafter(u) && !hung.has(u)) out.push([u, s]);
  return out;
}

/** Pole otworów w płytach na płaszczyźnie, m² */
export function cutoutM2(wins: RoofWindowGeom[], surfaceId?: AtticSurfaceId) {
  return wins.filter((x) => !surfaceId || x.surfaceId === surfaceId).reduce((t, x) => t + ((x.u1 - x.u0) * (x.s1 - x.s0)) / 10000, 0);
}

export interface AtticWindowsResult {
  list: RoofWindowGeom[];
  /** Pole otworów w płytach (do odjęcia od zabudowy), m² */
  cutM2: number;
  /** Pole glifów, m² */
  revealM2: number;
  warnings: string[];
  assumptions: string[];
}

/**
 * Materiały obróbki okien: obramowanie otworu, dodatkowe mocowania, płyty glifów, narożniki,
 * akryl przy ościeżnicy, kołnierz paroizolacyjny, wełna przy ościeżnicy. Profile przerwanych linii
 * rusztu (krótsze odcinki) liczy atticRequirement przez `cdLineSegments`.
 */
export function addAtticWindows(
  req: Requirement,
  a: Attic,
  grid: AtticGrid,
  opts: { vapor: boolean; fin?: FinishingSettings; sys?: CeilingSystem } = { vapor: false },
): AtticWindowsResult {
  const { list, warnings } = atticWindowGeometry(a, grid);
  const assumptions: string[] = [];
  if (!list.length) return { list, cutM2: 0, revealM2: 0, warnings, assumptions };
  const sys = opts.sys ?? ceilingSystemById(a.systemId);
  const fin = opts.fin ?? resolveFinishing();
  const fr = grid.frame;
  const between = fr.mount === 'between';
  const profile = grid.profile;
  const steel = !profile.startsWith('LATA');
  const maxHanger = sys.hangerSpacing || 100;
  const board = boardById(a.boardId);
  let revealM2 = 0;
  let hangers = 0;
  let joints = 0;

  for (const x of list) {
    // obramowanie poprzeczne nad i pod otworem: od krokwi do krokwi przy oknie
    for (const c of x.cross) {
      addPiece(req, profile, (c.u1 - c.u0) / 100);
      if (between) add(req.counts, 'WKRET_DREWNO', 2);
    }
    if (!between) {
      // obramowanie boczne po skosie, pod krokwiami przy oknie, łączone z poprzecznymi i przerwanymi liniami
      for (const sd of x.side) addPiece(req, profile, (sd.s1 - sd.s0) / 100);
      joints += x.side.length * x.cross.length + 2 * x.interrupted.length;
      hangers += windowFixPoints(x, grid, maxHanger).length;
      // usztywnienia głębokich glifów dolnego i górnego: element w poprzek na szerokość okna, mocowany do krokwi po bokach
      const st = x.stiffLower + x.stiffUpper;
      for (let i = 0; i < st; i++) addPiece(req, profile, (x.w.width + 2 * WINDOW_TRIM) / 100);
      hangers += st * 2;
    }

    // płyty glifów: jedna warstwa płyty zabudowy
    revealM2 += x.revealM2;
    const W = x.w.width / 100;
    const lowerM = x.lower / 100;
    const upperM = x.upper / 100;
    // krawędzie glifów na licu: boki 90°, góra i dół pod kątem zależnym od nachylenia dachu
    const outer = cornerTypeById(fin.opening) ?? cornerTypeById('alu-perf')!;
    const odd = outer.anyAngle ? outer : (cornerTypeById(fin.externalOdd) ?? outer);
    addEdgeFinish(req, outer, [(x.s1 - x.s0) / 100, (x.s1 - x.s0) / 100], fin);
    addEdgeFinish(req, odd, [W, W], fin);
    // narożniki wewnętrzne glifów (bok – góra, bok – dół)
    const inner = cornerTypeById(fin.internal) ?? cornerTypeById('paper-tape')!;
    addEdgeFinish(req, inner, [lowerM, lowerM, upperM, upperM], fin);
    // styk płyt glifów z ościeżnicą: akryl
    addEdgeFinish(req, cornerTypeById('acrylic')!, [2 * W + (2 * x.w.height) / 100], fin);
    // wełna wokół ościeżnicy, za płytami glifów
    add(req.area, 'WELNA50', x.revealM2);
    if (opts.vapor) {
      add(req.counts, 'KOLNIERZ_PARO', 1);
      addNote(req, 'KOLNIERZ_PARO', `${windowLabel(x.w)}`);
    }
  }

  add(req.boardArea, `${a.boardId}|${pickBoardLength(a.boardId, 200)}`, revealM2);
  addBoardScrews(req, revealM2, [a.boardId], sys.screwsOuter, sys.screwsInner);
  addJointing(req, revealM2, 1, a.boardId, 1.4, fin);
  if (!between) {
    if (fr.hanger) add(req.counts, fr.hanger, hangers);
    add(req.counts, 'WKRET_DREWNO', hangers * fr.woodScrews);
    if (fr.hanger && fr.hangerLn9) add(req.counts, 'LN9', hangers * fr.hangerLn9);
    if (profile === 'CD60') add(req.counts, 'LACZNIK_JEDNO', joints);
    else if (steel) add(req.counts, 'LN9', joints * 2);
    else add(req.counts, 'WKRET_DREWNO', joints * 2);
  }

  const cutM2 = cutoutM2(list);
  assumptions.push(
    'Okna dachowe: glif dolny pionowo, górny poziomo (FAKRO; tak zalecają też poradniki VELUX), boczne prostopadle do okna. Płaszczyzna ościeżnicy przyjęta na wierzchu krokwi (osadzenie standardowe) – sprawdź głębokość w instrukcji okna.',
    between
      ? 'Okna przy widocznej więźbie: poprzeczki nad i pod otworem w polu okna, boki glifów na krokwiach.'
      : `Otwór obramowany ${grid.frame.profileLabel}: poprzeczki ${WINDOW_TRIM} cm nad i pod otworem od krokwi do krokwi oraz boczne po skosie pod krokwiami przy oknie; przerwane linie rusztu dochodzą do bocznych (${profile === 'CD60' ? 'łącznik jednopoziomowy' : 'wkręty'}), każdy koniec przy oknie z mocowaniem do krokwi. Karty systemów nie opisują rusztu przy oknie.`,
    `Glify z jednej warstwy płyty ${board.name}${/H2|GKBI|GKFI/.test(`${board.name} ${board.type ?? ''}`) || board.kind === 'cement' ? '' : ' (poradniki zalecają płytę H2 – zmień płytę zabudowy, jeśli trzeba)'}; glif głębszy niż ${REVEAL_STIFF} cm dostaje usztywnienie w poprzek co ${REVEAL_STIFF} cm.`,
    'Krawędzie glifów: narożnik wg ustawień wykończenia; styk z ościeżnicą: akryl; wełna 50 mm wokół ościeżnicy za płytami glifów (pole jak glify).',
  );
  if (opts.vapor) assumptions.push('Paroizolacja: kołnierz paroizolacyjny okna (VELUX BBX, FAKRO XDS) łączony taśmą z folią zabudowy; folię liczono bez otworów okien.');
  return { list, cutM2, revealM2, warnings, assumptions };
}

/** Oś pola między krokwiami najbliższego `u` (okno między krokwiami bez wymianów), cm */
export function bayCenter(grid: AtticGrid, length: number, u: number): number {
  const edges = [0, ...grid.rafters, length];
  let best = u;
  let dist = Infinity;
  for (let i = 0; i + 1 < edges.length; i++) {
    const c = (edges[i] + edges[i + 1]) / 2;
    if (Math.abs(c - u) < dist) [best, dist] = [c, Math.abs(c - u)];
  }
  return r1(best);
}

/**
 * Nowe okno: VELUX MK06 (78×118) w polu między krokwiami najbliżej środka długości,
 * dolna krawędź ościeżnicy najniżej tak, żeby glif dolny nie schodził poniżej skosu (min. 90 cm nad posadzką).
 */
export function defaultRoofWindow(a: Attic, grid: AtticGrid, id: string, side: RoofWindow['side'] = 'left'): RoofWindow {
  const base: RoofWindow = { id, side: a.roof === 'mono' ? 'left' : side, width: 78, height: 118, u: bayCenter(grid, a.length, a.length / 2), sill: 90, sizeCode: 'VELUX MK06' };
  for (let sill = 90; sill <= 250; sill += 5) {
    const g = atticWindowGeometry({ ...a, windows: [{ ...base, sill }] }, grid).list[0];
    if (!g || g.s0 > 5) return { ...base, sill };
  }
  return base;
}
