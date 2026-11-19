// Poddasze z narożnikami dachu (połacie narożne dachu kopertowego) i koszami (dobudówka – dach L / T).
//
// Dach opisany jest bryłami: część główna i dobudówki. Wnętrze każdej bryły leży pod najniższą z jej
// płaszczyzn (skosy, połacie narożne, sufit pod jętkami), a wnętrze poddasza to suma brył – w każdym
// punkcie rzutu zabudowa biegnie po najwyższej z brył. Z tego wynikają:
//  - narożnik dachu (krokiew narożna): dwie płaszczyzny tej samej bryły – od środka kąt wewnętrzny,
//  - kosz (krokiew koszowa): płaszczyzny dwóch brył – od środka krawędź zewnętrzna (wystający kąt).
//
// Układ rzutu: u wzdłuż kalenicy głównej od pierwszej ściany szczytowej, v w poprzek od lewej ściany
// okapowej (jak `atticToPlan`), z w górę od posadzki – cm. Każda płaszczyzna jest zbiorem wypukłych
// wielokątów w rzucie; ruszt liczony jest na licu płyt (płaszczyzny odsunięte o grubość zabudowy).

import type { Attic, AtticWing } from '../model/types';

export interface P2 {
  u: number;
  v: number;
}

/** Płaszczyzna z = a·u + b·v + c */
interface Plane {
  a: number;
  b: number;
  c: number;
}

export type RoofFaceKind = 'slope' | 'collar';
/** Rodzaj krawędzi płaszczyzny: ściana (szczytowa, kolankowa), posadzka, narożnik dachu, kosz, załamanie skos/sufit */
export type RoofEdgeKind = 'wall' | 'floor' | 'hip' | 'valley' | 'fold' | 'ridge' | 'seam';

interface PlaneDef {
  key: string;
  label: string;
  kind: RoofFaceKind;
  plane: Plane;
  /** Kierunek profili rusztu (wzdłuż okapu), jednostkowy w rzucie */
  e: P2;
  /** Kierunek spadku w górę połaci (dla sufitu: w poprzek profili), jednostkowy w rzucie */
  d: P2;
  /** Położenia krokwi (jętek) wzdłuż `e`, cm w układzie rzutu (rzut punktu na `e`) */
  rafters: number[];
}

interface Volume {
  key: string;
  /** Prostokąt rzutu: [u0, u1, v0, v1] */
  rect: [number, number, number, number];
  planes: PlaneDef[];
}

/** Odcinek profilu rusztu na płaszczyźnie: s od dolnej krawędzi, t0–t1 wzdłuż `e`, cm */
export interface RoofCdLine {
  s: number;
  t0: number;
  t1: number;
  /** Rodzaj krawędzi na końcach odcinka */
  end0: RoofEdgeKind;
  end1: RoofEdgeKind;
  /** Mocowania (wieszaki, wkręty) wzdłuż `e`, cm */
  fix: number[];
}

export interface RoofEdge {
  p: P2;
  q: P2;
  kind: RoofEdgeKind;
  /** Indeks sąsiedniej płaszczyzny (narożnik, kosz, załamanie) */
  other?: number;
  /** Długość w przestrzeni, cm */
  len: number;
}

export interface RoofFace {
  key: string;
  label: string;
  kind: RoofFaceKind;
  plane: Plane;
  e: P2;
  d: P2;
  /** cos kąta nachylenia (1 dla sufitu) */
  cos: number;
  /** Wypukłe części obrysu w rzucie */
  pieces: P2[][];
  edges: RoofEdge[];
  /** Najniższa wartość p·d na płaszczyźnie (dolna krawędź), cm */
  d0: number;
  /** Wysokość płaszczyzny po skosie, cm */
  run: number;
  /** Zakres wzdłuż `e`, cm */
  t0: number;
  t1: number;
  /** Osie krokwi wzdłuż `e` w zakresie płaszczyzny */
  rafters: number[];
  /** Pole w przestrzeni, m² */
  areaM2: number;
}

export interface RoofLine {
  kind: 'hip' | 'valley' | 'fold' | 'ridge';
  /** Indeksy płaszczyzn po obu stronach */
  faces: [number, number];
  p: P2;
  q: P2;
  /** Długość w przestrzeni, cm */
  len: number;
}

export interface AtticRoof {
  faces: RoofFace[];
  /** Narożniki dachu, kosze i załamania skos/sufit (każda linia raz) */
  lines: RoofLine[];
  /** Obrys rzutu: prostokąty brył */
  rects: [number, number, number, number][];
  warnings: string[];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const EPS = 1e-6;
const dot = (p: P2, q: P2) => p.u * q.u + p.v * q.v;
export const zAt = (pl: Plane, p: P2) => pl.a * p.u + pl.b * p.v + pl.c;

/** Półpłaszczyzna n·p + k ≤ 0 (strict: przy zerowym n tylko k < 0) */
interface Half {
  nu: number;
  nv: number;
  k: number;
  strict?: boolean;
}

function clip(poly: P2[], h: Half): P2[] {
  if (Math.abs(h.nu) < EPS && Math.abs(h.nv) < EPS) return (h.strict ? h.k < -EPS : h.k <= EPS) ? poly : [];
  const f = (p: P2) => h.nu * p.u + h.nv * p.v + h.k;
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp <= 1e-9) out.push(p);
    if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
      const t = fp / (fp - fq);
      out.push({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t });
    }
  }
  return out.length >= 3 ? out : [];
}

const flip = (h: Half): Half => ({ nu: -h.nu, nv: -h.nv, k: -h.k, strict: !h.strict });

export function polyArea(poly: P2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.u * q.v - q.u * p.v;
  }
  return s / 2;
}

/** Wielokąt wypukły minus część wspólna półpłaszczyzn `hs` – rozkład na rozłączne wypukłe kawałki */
function subtract(poly: P2[], hs: Half[]): P2[][] {
  const out: P2[][] = [];
  let rest = poly;
  for (const h of hs) {
    const outside = clip(rest, flip(h));
    if (outside.length && Math.abs(polyArea(outside)) > 1) out.push(outside);
    rest = clip(rest, h);
    if (!rest.length) break;
  }
  return out;
}

const rectHalves = ([u0, u1, v0, v1]: Volume['rect']): Half[] => [
  { nu: -1, nv: 0, k: u0 },
  { nu: 1, nv: 0, k: -u1 },
  { nu: 0, nv: -1, k: v0 },
  { nu: 0, nv: 1, k: -v1 },
];
const rectPoly = ([u0, u1, v0, v1]: Volume['rect']): P2[] => [
  { u: u0, v: v0 },
  { u: u1, v: v0 },
  { u: u1, v: v1 },
  { u: u0, v: v1 },
];
/** pi ≤ pj */
const below = (pi: Plane, pj: Plane, strict = false): Half => ({ nu: pi.a - pj.a, nv: pi.b - pj.b, k: pi.c - pj.c, strict });

/** Czy poddasze ma narożniki dachu albo kosze (inaczej liczone jest zwykłym przekrojem) */
export function hasRoofCorners(a: Pick<Attic, 'roof' | 'ends' | 'wings'>): boolean {
  return a.roof === 'gable' && (!!a.ends?.some((e) => e === 'hip') || !!a.wings?.length);
}

/** Osie krokwi od `start` co `sp` w stronę `dir` do `stop` */
function series(start: number, sp: number, stop: number, dir: 1 | -1): number[] {
  const out: number[] = [];
  for (let x = start; dir > 0 ? x <= stop + EPS : x >= stop - EPS; x += dir * sp) out.push(Math.round(x * 10) / 10);
  return out;
}
/** Osie krokwi symetrycznie od środka (krokiew środkowa w osi kalenicy) */
function centered(mid: number, sp: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let x = mid; x >= lo; x -= sp) out.unshift(Math.round(x * 10) / 10);
  for (let x = mid + sp; x <= hi; x += sp) out.push(Math.round(x * 10) / 10);
  return out;
}

const fmtM = (cm: number) => (cm / 100).toFixed(2).replace('.', ',');

/** Dobudówka przycięta do długości poddasza i do wysokości kalenicy głównej */
export function wingFit(a: Attic, w: AtticWing): { u0: number; u1: number; width: number; warning?: string } {
  const t = Math.tan(rad(Math.min(80, Math.max(5, a.pitch))));
  const knee = w.side === 'left' ? a.kneeLeft : a.kneeRight;
  const mainRidge = (a.kneeLeft + a.kneeRight + a.width * t) / 2;
  // kalenica dobudówki nie może być wyżej niż główna
  const maxW = Math.max(40, 2 * ((mainRidge - knee) / t));
  let width = Math.max(40, w.width);
  let warning: string | undefined;
  if (width > maxW + 0.5) {
    warning = `Dobudówka ${fmtM(width)} m jest szersza niż ${fmtM(maxW)} m – jej kalenica byłaby wyżej niż główna. Przyjęto ${fmtM(maxW)} m.`;
    width = maxW;
  }
  width = Math.min(width, a.length);
  let u0 = w.at - width / 2;
  if (u0 < 0) u0 = 0;
  if (u0 + width > a.length) u0 = a.length - width;
  if (Math.abs(u0 - (w.at - width / 2)) > 0.5 && !warning) warning = `Dobudówka wychodzi poza długość poddasza – przesunięto ją do ściany szczytowej.`;
  return { u0, u1: u0 + width, width, warning };
}

/**
 * Bryły dachu (część główna + dobudówki) z płaszczyznami odsuniętymi o `depthCm` od spodu krokwi
 * (0 = konstrukcja, grubość zabudowy = lico płyt).
 */
function volumes(a: Attic, depthCm: number, warnings: string[]): Volume[] {
  const pitch = Math.min(80, Math.max(5, a.pitch));
  const t = Math.tan(rad(pitch));
  const off = depthCm / Math.cos(rad(pitch));
  const W = a.width;
  const L = a.length;
  const sp = Math.max(20, a.rafterSpacing);
  const kL = a.kneeLeft - off;
  const kR = a.kneeRight - off;
  const C = a.collarHeight === undefined ? undefined : a.collarHeight - depthCm;
  const ridgeX = Math.min(W, Math.max(0, (a.kneeRight - a.kneeLeft + W * t) / (2 * t)));
  const ends = a.ends ?? ['gable', 'gable'];
  const X: P2 = { u: 1, v: 0 };
  const Y: P2 = { u: 0, v: 1 };
  const neg = (p: P2): P2 => ({ u: -p.u, v: -p.v });
  // krokwie główne: od pierwszej krokwi co rozstaw (krokwie kulawe przy narożnikach i koszach w tych samych osiach)
  const mainRafters = series(Math.max(0, a.firstRafter), sp, L, 1);

  const main: Volume = {
    key: 'main',
    rect: [0, L, 0, W],
    planes: [
      { key: 'left', label: 'Skos lewy', kind: 'slope', plane: { a: 0, b: t, c: kL }, e: X, d: Y, rafters: mainRafters },
      { key: 'right', label: 'Skos prawy', kind: 'slope', plane: { a: 0, b: -t, c: kR + t * W }, e: X, d: neg(Y), rafters: mainRafters },
    ],
  };
  // połać narożna: ścianka kolankowa pod nią jak po lewej stronie, krokwie kulawe symetrycznie od osi kalenicy
  const kE = kL;
  const endRafters = centered(ridgeX, sp, 0, W);
  if (ends[0] === 'hip')
    main.planes.push({ key: 'hip0', label: 'Połać narożna przy 1. szczycie', kind: 'slope', plane: { a: t, b: 0, c: kE }, e: Y, d: X, rafters: endRafters });
  if (ends[1] === 'hip')
    main.planes.push({ key: 'hip1', label: 'Połać narożna przy 2. szczycie', kind: 'slope', plane: { a: -t, b: 0, c: kE + t * L }, e: Y, d: neg(X), rafters: endRafters });
  if (C !== undefined) main.planes.push({ key: 'collar', label: 'Sufit pod jętkami', kind: 'collar', plane: { a: 0, b: 0, c: C }, e: X, d: Y, rafters: mainRafters });

  const out = [main];
  (a.wings ?? []).forEach((w, i) => {
    const fit = wingFit(a, w);
    if (fit.warning) warnings.push(fit.warning);
    const left = w.side === 'left';
    const k = (left ? a.kneeLeft : a.kneeRight) - off;
    const len = Math.max(0, w.length);
    const n = (a.wings ?? []).length > 1 ? ` ${i + 1}` : '';
    // krokwie dobudówki od jej końca w stronę poddasza
    const vEnd = left ? -len : W + len;
    const wingRafters = left ? series(vEnd + Math.max(0, a.firstRafter), sp, W, 1) : series(vEnd - Math.max(0, a.firstRafter), sp, 0, -1).reverse();
    const vol: Volume = {
      key: `wing${i}`,
      // dobudówka sięga do kalenicy głównej – dalej jest już połać po drugiej stronie
      rect: left ? [fit.u0, fit.u1, -len, ridgeX] : [fit.u0, fit.u1, ridgeX, W + len],
      planes: [
        { key: `w${i}a`, label: `Dobudówka${n} – skos przy 1. szczycie`, kind: 'slope', plane: { a: t, b: 0, c: k - t * fit.u0 }, e: Y, d: X, rafters: wingRafters },
        { key: `w${i}b`, label: `Dobudówka${n} – skos przy 2. szczycie`, kind: 'slope', plane: { a: -t, b: 0, c: k + t * fit.u1 }, e: Y, d: neg(X), rafters: wingRafters },
      ],
    };
    if (w.end === 'hip' && len > 0) {
      const mid = (fit.u0 + fit.u1) / 2;
      const r = centered(mid, sp, fit.u0, fit.u1);
      vol.planes.push(
        left
          ? { key: `w${i}e`, label: `Dobudówka${n} – połać narożna`, kind: 'slope', plane: { a: 0, b: t, c: k + t * len }, e: X, d: Y, rafters: r }
          : { key: `w${i}e`, label: `Dobudówka${n} – połać narożna`, kind: 'slope', plane: { a: 0, b: -t, c: k + t * (W + len) }, e: X, d: neg(Y), rafters: r },
      );
    }
    if (C !== undefined) vol.planes.push({ key: `w${i}c`, label: `Dobudówka${n} – sufit pod jętkami`, kind: 'collar', plane: { a: 0, b: 0, c: C }, e: Y, d: X, rafters: wingRafters });
    out.push(vol);
  });
  return out;
}

/** Wysokość zabudowy w punkcie rzutu i płaszczyzna, która ją wyznacza; poza rzutem undefined */
function heightAt(vols: Volume[], flat: { vi: number; pi: number }[], p: P2): { z: number; idx: number } | undefined {
  let best: { z: number; idx: number } | undefined;
  vols.forEach((vol, vi) => {
    const [u0, u1, v0, v1] = vol.rect;
    if (p.u < u0 - EPS || p.u > u1 + EPS || p.v < v0 - EPS || p.v > v1 + EPS) return;
    let m: { z: number; pi: number } | undefined;
    vol.planes.forEach((pl, pi) => {
      const z = zAt(pl.plane, p);
      if (!m || z < m.z - EPS) m = { z, pi };
    });
    if (m && (!best || m.z > best.z + EPS)) best = { z: m.z, idx: flat.findIndex((f) => f.vi === vi && f.pi === m!.pi) };
  });
  return best;
}

const inPoly = (poly: P2[], p: P2) => {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((b.u - a.u) * (p.v - a.v) - (b.v - a.v) * (p.u - a.u) < -1e-7) return false;
  }
  return true;
};

const len3 = (pl: Plane, p: P2, q: P2) => Math.hypot(q.u - p.u, q.v - p.v, zAt(pl, q) - zAt(pl, p));

/** Rozstaw ≥ min, odległość skrajnych linii od krawędzi `edge` – jak `cdLinePositions` */
function linePositions(run: number, spacing: number, edge: number): number[] {
  if (run <= 2 * edge + 1) return [Math.round(run * 5) / 10];
  const out: number[] = [];
  const end = run - edge;
  for (let s = edge; s < end - 5; s += spacing) out.push(Math.round(s * 10) / 10);
  out.push(Math.round(end * 10) / 10);
  return out;
}

/**
 * Płaszczyzny zabudowy poddasza z narożnikami i koszami. `depthCm` jak w `atticSection`.
 */
export function atticRoof(a: Attic, depthCm = 0): AtticRoof {
  const warnings: string[] = [];
  const vols = volumes(a, depthCm, warnings);
  const flat = vols.flatMap((vol, vi) => vol.planes.map((_, pi) => ({ vi, pi })));
  const faces: RoofFace[] = [];
  const faceOf = new Map<number, number>();

  flat.forEach(({ vi, pi }, fi) => {
    const vol = vols[vi];
    const def = vol.planes[pi];
    let poly = rectPoly(vol.rect);
    for (let j = 0; j < vol.planes.length && poly.length; j++) if (j !== pi) poly = clip(poly, below(def.plane, vol.planes[j].plane, j > pi));
    // nad posadzką
    if (poly.length) poly = clip(poly, { nu: -def.plane.a, nv: -def.plane.b, k: -def.plane.c });
    let pieces = poly.length ? [poly] : [];
    // tam, gdzie inna bryła jest wyżej, zabudowa biegnie po niej (przy równej wysokości wygrywa wcześniejsza)
    vols.forEach((other, mi) => {
      if (mi === vi || !pieces.length) return;
      const hs = [...rectHalves(other.rect), ...other.planes.map((pj) => below(def.plane, pj.plane, mi > vi))];
      pieces = pieces.flatMap((pc) => subtract(pc, hs));
    });
    pieces = pieces.filter((pc) => Math.abs(polyArea(pc)) > 10);
    if (!pieces.length) return;
    const cos = def.kind === 'collar' ? 1 : 1 / Math.hypot(1, Math.hypot(def.plane.a, def.plane.b));
    const pts = pieces.flat();
    const ds = pts.map((p) => dot(p, def.d));
    const ts = pts.map((p) => dot(p, def.e));
    const d0 = Math.min(...ds);
    const run = (Math.max(...ds) - d0) / cos;
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const areaM2 = pieces.reduce((s, pc) => s + Math.abs(polyArea(pc)), 0) / cos / 10000;
    faceOf.set(fi, faces.length);
    faces.push({ key: def.key, label: def.label, kind: def.kind, plane: def.plane, e: def.e, d: def.d, cos, pieces, edges: [], d0, run, t0, t1, rafters: def.rafters.filter((r) => r > t0 + 1 && r < t1 - 1), areaM2 });
  });

  // rodzaj krawędzi: co jest tuż za nią
  const classify = (fi: number, m: P2, n: P2): { kind: RoofEdgeKind; other?: number } => {
    const f = faces[fi];
    const probe = { u: m.u + n.u * 0.05, v: m.v + n.v * 0.05 };
    if (f.pieces.some((pc) => inPoly(pc, probe))) return { kind: 'seam' };
    const h = heightAt(vols, flat, probe);
    if (!h) return { kind: 'wall' };
    if (zAt(f.plane, m) < 0.5 && h.z < 0.6) return { kind: 'floor' };
    const other = faceOf.get(h.idx);
    if (other === undefined || other === fi) return { kind: 'seam' };
    const o = faces[other];
    const diff = h.z - zAt(f.plane, probe);
    if (Math.abs(diff) < 0.01) return { kind: 'seam', other };
    if (diff > 0) return { kind: 'valley', other };
    if (f.kind === 'collar' || o.kind === 'collar') return { kind: 'fold', other };
    // kalenica: dwie połacie o przeciwnym spadku spotykają się w poziomej linii
    return { kind: dot(f.d, o.d) < -0.99 ? 'ridge' : 'hip', other };
  };

  faces.forEach((f, fi) => {
    for (const pc of f.pieces) {
      const ccw = polyArea(pc) > 0 ? 1 : -1;
      for (let i = 0; i < pc.length; i++) {
        const p = pc[i];
        const q = pc[(i + 1) % pc.length];
        const L = Math.hypot(q.u - p.u, q.v - p.v);
        if (L < 0.5) continue;
        // normalna na zewnątrz kawałka
        const n = { u: (ccw * (q.v - p.v)) / L, v: (-ccw * (q.u - p.u)) / L };
        // krawędź kawałka może przechodzić z kosza w styk dwóch kawałków – klasyfikacja co ok. 5 cm,
        // miejsce zmiany doprecyzowane połowieniem
        const N = Math.max(1, Math.ceil(L / 5));
        const at = (k: number): P2 => ({ u: p.u + ((q.u - p.u) * k) / N, v: p.v + ((q.v - p.v) * k) / N });
        const same = (x: { kind: RoofEdgeKind; other?: number }, y: { kind: RoofEdgeKind; other?: number }) => x.kind === y.kind && x.other === y.other;
        let run: { k0: number; kind: RoofEdgeKind; other?: number } | undefined;
        const flush = (k1: number) => {
          if (!run || (run.kind === 'seam' && run.other === undefined)) return;
          const a0 = at(run.k0);
          const a1 = at(k1);
          if (Math.hypot(a1.u - a0.u, a1.v - a0.v) > 0.5) f.edges.push({ p: a0, q: a1, kind: run.kind, other: run.other, len: len3(f.plane, a0, a1) });
        };
        for (let k = 0; k < N; k++) {
          const c = classify(fi, at(k + 0.5), n);
          if (run && same(run, c)) continue;
          let split = k;
          if (run) {
            let lo = k - 0.5;
            let hi = k + 0.5;
            for (let it = 0; it < 20; it++) {
              const mid = (lo + hi) / 2;
              if (same(classify(fi, at(mid), n), run)) lo = mid;
              else hi = mid;
            }
            split = (lo + hi) / 2;
          }
          flush(split);
          run = { k0: split, ...c };
        }
        flush(N);
      }
    }
  });

  // linie narożników, koszy i załamań – raz dla pary płaszczyzn
  const lines: RoofLine[] = [];
  faces.forEach((f, fi) => {
    const byOther = new Map<number, RoofEdge[]>();
    for (const e of f.edges) if ((e.kind === 'hip' || e.kind === 'valley' || e.kind === 'fold' || e.kind === 'ridge') && e.other !== undefined && e.other > fi) byOther.set(e.other, [...(byOther.get(e.other) ?? []), e]);
    for (const [other, list] of byOther) {
      // odcinki na jednej prostej: skrajne punkty
      const dir = { u: list[0].q.u - list[0].p.u, v: list[0].q.v - list[0].p.v };
      const pts = list.flatMap((e) => [e.p, e.q]).sort((x, y) => dot(x, dir) - dot(y, dir));
      const p = pts[0];
      const q = pts[pts.length - 1];
      lines.push({ kind: list[0].kind as RoofLine['kind'], faces: [fi, other], p, q, len: len3(f.plane, p, q) });
    }
  });

  return { faces, lines, rects: vols.map((v) => v.rect), warnings };
}

/** Punkt płaszczyzny w układzie (t wzdłuż profili, s po skosie od dolnej krawędzi) → rzut */
export function faceToPlan(f: RoofFace, t: number, s: number): P2 {
  const dd = f.d0 + s * f.cos;
  return { u: f.e.u * t + f.d.u * dd, v: f.e.v * t + f.d.v * dd };
}
/** Rzut → (t, s) płaszczyzny */
export function planToFace(f: RoofFace, p: P2): { t: number; s: number } {
  return { t: dot(p, f.e), s: (dot(p, f.d) - f.d0) / f.cos };
}

/** Część wspólna prostej p·d = const (s na płaszczyźnie) z płaszczyzną: przedziały wzdłuż `e` */
export function faceSpans(f: RoofFace, s: number): [number, number][] {
  const dd = f.d0 + s * f.cos;
  const iv: [number, number][] = [];
  for (const pc of f.pieces) {
    // pas wokół prostej: przecięcie krawędzi kawałka z prostą
    const xs: number[] = [];
    for (let i = 0; i < pc.length; i++) {
      const p = pc[i];
      const q = pc[(i + 1) % pc.length];
      const dp = dot(p, f.d) - dd;
      const dq = dot(q, f.d) - dd;
      if (Math.abs(dp) < 1e-7) xs.push(dot(p, f.e));
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const k = dp / (dp - dq);
        xs.push(dot(p, f.e) + (dot(q, f.e) - dot(p, f.e)) * k);
      }
    }
    if (xs.length >= 2) iv.push([Math.min(...xs), Math.max(...xs)]);
  }
  iv.sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const x of iv) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1] + 0.5) last[1] = Math.max(last[1], x[1]);
    else out.push([...x]);
  }
  return out.filter(([x, y]) => y - x > 1);
}

/** Rodzaj krawędzi, na której leży punkt rzutu (najbliższa krawędź płaszczyzny) */
function edgeKindAt(f: RoofFace, p: P2): RoofEdgeKind {
  let best: { d: number; kind: RoofEdgeKind } = { d: Infinity, kind: 'wall' };
  for (const e of f.edges) {
    const dx = e.q.u - e.p.u;
    const dy = e.q.v - e.p.v;
    const L2 = dx * dx + dy * dy;
    const k = Math.max(0, Math.min(1, ((p.u - e.p.u) * dx + (p.v - e.p.v) * dy) / L2));
    const d = Math.hypot(p.u - e.p.u - dx * k, p.v - e.p.v - dy * k);
    if (d < best.d) best = { d, kind: e.kind };
  }
  return best.kind;
}

/**
 * Mocowania odcinka profilu do krokwi w jego zakresie: skrajne zawsze, pośrednie tak rzadko, jak pozwala
 * największy rozstaw (`every` = przy każdej krokwi). Końce przy narożniku i koszu opierają się na profilu
 * wzdłuż krokwi narożnej / koszowej – liczone osobno.
 */
export function segmentFixes(rafters: number[], t0: number, t1: number, maxSpacing: number, every: boolean): number[] {
  const sup = rafters.filter((r) => r > t0 + 1 && r < t1 - 1);
  if (every || sup.length <= 2) return sup;
  const out = [sup[0]];
  let i = 0;
  while (i < sup.length - 1) {
    let j = i + 1;
    while (j + 1 < sup.length && sup[j + 1] - sup[i] <= maxSpacing + 1e-6) j++;
    out.push(sup[j]);
    i = j;
  }
  return out;
}

/** Linie rusztu na płaszczyźnie: rozstaw `spacing`, skrajne `edge` od dolnej i górnej krawędzi */
export function faceCdLines(f: RoofFace, spacing: number, edge: number, maxFix: number, every: boolean): RoofCdLine[] {
  const out: RoofCdLine[] = [];
  for (const s of linePositions(f.run, spacing, edge)) {
    for (const [t0, t1] of faceSpans(f, s)) {
      const end0 = edgeKindAt(f, faceToPlan(f, t0, s));
      const end1 = edgeKindAt(f, faceToPlan(f, t1, s));
      out.push({ s, t0, t1, end0, end1, fix: segmentFixes(f.rafters, t0, t1, maxFix, every) });
    }
  }
  return out;
}

/** Odcinki krokwi (kulawych) na płaszczyźnie w układzie (t, s0–s1) */
export function faceRafterSpans(f: RoofFace): { t: number; s0: number; s1: number }[] {
  const out: { t: number; s0: number; s1: number }[] = [];
  for (const t of f.rafters) {
    const ss: number[] = [];
    for (const pc of f.pieces)
      for (let i = 0; i < pc.length; i++) {
        const p = pc[i];
        const q = pc[(i + 1) % pc.length];
        const tp = dot(p, f.e) - t;
        const tq = dot(q, f.e) - t;
        if ((tp <= 0 && tq > 0) || (tp > 0 && tq <= 0)) {
          const k = tp / (tp - tq);
          ss.push(planToFace(f, { u: p.u + (q.u - p.u) * k, v: p.v + (q.v - p.v) * k }).s);
        }
      }
    if (ss.length >= 2) out.push({ t, s0: Math.min(...ss), s1: Math.max(...ss) });
  }
  return out;
}

const key2 = (p: P2) => `${Math.round(p.u * 100)}:${Math.round(p.v * 100)}`;

/**
 * Obrys płaszczyzny jako suma jej wypukłych kawałków: pętle brzegu (zewnętrzne przeciwnie do ruchu
 * wskazówek zegara, otwory zgodnie). Wewnętrzne styki kawałków znikają – w 3D i na rysunkach nie
 * udają załamań połaci.
 */
export function faceOutlines(f: Pick<RoofFace, 'pieces'>): P2[][] {
  const polys = f.pieces.filter((pc) => Math.abs(polyArea(pc)) > 1e-6).map((pc) => (polyArea(pc) > 0 ? pc : [...pc].reverse()));
  const verts = polys.flat();
  // krawędzie podzielone w wierzchołkach innych kawałków (styk typu T)
  const segs: [P2, P2][] = [];
  for (const pc of polys)
    for (let i = 0; i < pc.length; i++) {
      const a = pc[i];
      const b = pc[(i + 1) % pc.length];
      const dx = b.u - a.u;
      const dy = b.v - a.v;
      const L2 = dx * dx + dy * dy;
      if (L2 < 1e-6) continue;
      const ks = [0, 1];
      for (const p of verts) {
        const k = ((p.u - a.u) * dx + (p.v - a.v) * dy) / L2;
        if (k <= 1e-6 || k >= 1 - 1e-6) continue;
        if (Math.abs((p.u - a.u) * dy - (p.v - a.v) * dx) / Math.sqrt(L2) < 0.01) ks.push(k);
      }
      ks.sort((x, y) => x - y);
      for (let j = 0; j + 1 < ks.length; j++) {
        if (ks[j + 1] - ks[j] < 1e-9) continue;
        segs.push([
          { u: a.u + dx * ks[j], v: a.v + dy * ks[j] },
          { u: a.u + dx * ks[j + 1], v: a.v + dy * ks[j + 1] },
        ]);
      }
    }
  // odcinki wspólne dwóch kawałków (przeciwne kierunki) znoszą się
  const open = new Map<string, [P2, P2][]>();
  const id = (a: P2, b: P2) => `${key2(a)}>${key2(b)}`;
  for (const [a, b] of segs) {
    const back = open.get(id(b, a));
    if (back?.length) back.pop();
    else open.set(id(a, b), [...(open.get(id(a, b)) ?? []), [a, b]]);
  }
  const left = [...open.values()].flat();
  // pętle brzegu
  const from = new Map<string, [P2, P2][]>();
  for (const s of left) from.set(key2(s[0]), [...(from.get(key2(s[0])) ?? []), s]);
  const used = new Set<[P2, P2]>();
  const loops: P2[][] = [];
  for (const s of left) {
    if (used.has(s)) continue;
    const loop: P2[] = [];
    let cur: [P2, P2] | undefined = s;
    while (cur && !used.has(cur)) {
      used.add(cur);
      loop.push(cur[0]);
      const next: [P2, P2][] = (from.get(key2(cur[1])) ?? []).filter((x) => !used.has(x));
      if (next.length <= 1) cur = next[0];
      else {
        // kilka wyjść z jednego wierzchołka (kawałki stykające się narożnikiem): najostrzejszy skręt w lewo
        const din = Math.atan2(cur[1].v - cur[0].v, cur[1].u - cur[0].u);
        const turn = (x: [P2, P2]) => {
          let d = Math.atan2(x[1].v - x[0].v, x[1].u - x[0].u) - din;
          while (d <= -Math.PI) d += 2 * Math.PI;
          while (d > Math.PI) d -= 2 * Math.PI;
          return d;
        };
        cur = next.reduce((m, x) => (turn(x) > turn(m) ? x : m));
      }
    }
    // punkty współliniowe usunięte
    const clean = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return Math.abs((p.u - a.u) * (b.v - a.v) - (p.v - a.v) * (b.u - a.u)) / (Math.hypot(b.u - a.u, b.v - a.v) || 1) > 0.01;
    });
    if (clean.length >= 3 && Math.abs(polyArea(clean)) > 1) loops.push(clean);
  }
  return loops;
}

/** Czy punkt rzutu leży na płaszczyźnie (w którymś z jej kawałków) */
export function faceContains(f: Pick<RoofFace, 'pieces'>, p: P2): boolean {
  return f.pieces.some((pc) => inPoly(polyArea(pc) > 0 ? pc : [...pc].reverse(), p));
}

/**
 * Kierunek w rzucie prostopadły do linii (narożnik, kosz), w stronę płaszczyzny `f` – sprawdzany
 * punktem tuż obok środka linii (środek ciężkości obrysu wklęsłej płaszczyzny może leżeć po złej stronie).
 */
export function sideTowardFace(f: Pick<RoofFace, 'pieces'>, p: P2, q: P2): P2 {
  const L = Math.hypot(q.u - p.u, q.v - p.v) || 1;
  const side = { u: -(q.v - p.v) / L, v: (q.u - p.u) / L };
  const hits = (s: P2) =>
    [0.25, 0.5, 0.75].filter((k) => faceContains(f, { u: p.u + (q.u - p.u) * k + s.u * 2, v: p.v + (q.v - p.v) * k + s.v * 2 })).length;
  const neg = { u: -side.u, v: -side.v };
  return hits(side) >= hits(neg) ? side : neg;
}
