// Przekroje profili stalowych do widoku 3D (CW, UW, UA, CD, UD) – czysta geometria bez three.js.
// Przekrój opisujemy w płaszczyźnie poprzecznej elementu, w osiach (a, b):
//  - profil pionowy (słupek, axis 'up'):     a = wzdłuż ściany, b = grubość ściany (normalna),
//  - profil poziomy (UW, CD, UD, axis 'along'): a = wysokość,    b = grubość/szerokość (normalna).
// Wymiary w metrach.

import type { Point } from '../model/types';

/** Strona, po której leży środnik profilu */
export type WebSide = 'a-' | 'a+' | 'b-' | 'b+';

export interface ProfileSpec {
  /** Oś długości profilu: 'up' – pionowa, 'along' – wzdłuż osi x elementu */
  axis: 'up' | 'along';
  web: WebSide;
  /** Grubość blachy, m */
  t: number;
  /** Długość zagięcia (rantu) półki, m; 0 – profil U bez zagięć */
  lip: number;
  /** Przetłoczenia wzdłużne środnika: położenie środka rowka jako ułamek wysokości środnika od jego środka (−0,5…0,5) */
  webRibs: number[];
  /** Przetłoczenie wzdłużne w połowie każdej półki */
  flangeRib: boolean;
}

/** Grubość blachy w 3D: rzeczywiste 0,6 mm (CW/UW/CD/UD) i 2 mm (UA) */
const STEEL_T = 0.0006;
const UA_T = 0.002;

/**
 * Wymiary przetłoczeń (rowków) wg typowych profili 0,6 mm: rowek trapezowy wciśnięty do wnętrza profilu.
 * Środnik: głębokość 1,5 mm, szerokość 8 mm u wejścia i 3 mm na dnie; półka: 1 mm, 6 i 2 mm.
 */
const WEB_RIB = { depth: 0.0015, outer: 0.008, inner: 0.003 };
const FLANGE_RIB = { depth: 0.001, outer: 0.006, inner: 0.002 };

/** Typ przekroju dla materiału rusztu; undefined – element rysowany jako bryła (np. wieszak) */
export function profileFor(mat: string, axis: ProfileSpec['axis'], web: WebSide): ProfileSpec | undefined {
  switch (mat) {
    case 'cw':
      // CW: dwa przetłoczenia środnika, zagięte do środka ranty 6 mm
      return { axis, web, t: STEEL_T, lip: 0.006, webRibs: [-0.3, 0.3], flangeRib: false };
    case 'cdMain':
    case 'cdSec':
      // CD 60×27: środnik 60 mm z dwoma przetłoczeniami (±12 mm), półki 27 mm z rowkiem, ranty 6 mm zagięte do środka
      return { axis, web, t: STEEL_T, lip: 0.006, webRibs: [-0.2, 0.2], flangeRib: true };
    case 'ua':
      return { axis, web, t: UA_T, lip: 0, webRibs: [], flangeRib: false };
    case 'uw':
      return { axis, web, t: STEEL_T, lip: 0, webRibs: [-0.3, 0.3], flangeRib: false };
    case 'ud':
      // UD 28×27: wąski gładki środnik, półki z rowkiem
      return { axis, web, t: STEEL_T, lip: 0, webRibs: [], flangeRib: true };
    default:
      return undefined;
  }
}

type V = [number, number];

/** Wstawia trapezowy rowek w odcinek prostej (punkt środka c, kierunek u, wnętrze profilu n) */
function groove(c: V, u: V, n: V, r: { depth: number; outer: number; inner: number }): V[] {
  const at = (s: number, e: number): V => [c[0] + u[0] * s + n[0] * e, c[1] + u[1] * s + n[1] * e];
  return [at(-r.outer / 2, 0), at(-r.inner / 2, r.depth), at(r.inner / 2, r.depth), at(r.outer / 2, 0)];
}

/** Obrys blachy o grubości t wokół otwartej linii środkowej (ścięcia ukośne w narożnikach) */
function offsetPolyline(line: V[], t: number): V[] {
  const h = t / 2;
  const nrm = (a: V, b: V): V => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return [-dy / l, dx / l];
  };
  const left: V[] = [];
  const right: V[] = [];
  line.forEach((p, i) => {
    let o: V;
    if (i === 0) o = nrm(p, line[1]);
    else if (i === line.length - 1) o = nrm(line[i - 1], p);
    else {
      const n1 = nrm(line[i - 1], p);
      const n2 = nrm(p, line[i + 1]);
      const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      o = [(n1[0] + n2[0]) / k, (n1[1] + n2[1]) / k];
    }
    left.push([p[0] + o[0] * h, p[1] + o[1] * h]);
    right.push([p[0] - o[0] * h, p[1] - o[1] * h]);
  });
  return [...left, ...right.reverse()];
}

/** Linia środkowa blachy profilu w układzie kanonicznym (środnik przy p = −w, półki wzdłuż p) */
export function profileCenterline(spec: Pick<ProfileSpec, 'web' | 't' | 'lip' | 'webRibs' | 'flangeRib'>, A: number, B: number, detail = true): V[] {
  const swap = spec.web === 'b-' || spec.web === 'b+';
  const W = swap ? B : A; // wysięg półek (od środnika do krawędzi)
  const D = swap ? A : B; // wysokość środnika
  const t = Math.min(spec.t, W / 3, D / 3);
  const h = t / 2;
  const w = W / 2;
  const d = D / 2;
  const L = spec.lip > t ? Math.min(spec.lip, D / 2 - t) : 0;
  // rowki tylko, gdy profil jest dość duży (np. wąskie profile w małej skali zostają gładkie)
  const fits = (len: number, r: typeof WEB_RIB) => detail && len > r.outer * 3 && W > r.depth * 4 + t * 2;
  const webRibs = fits(D, WEB_RIB) ? [...spec.webRibs].sort((a, b) => a - b) : [];
  const flangeRib = spec.flangeRib && fits(W, FLANGE_RIB) && D > FLANGE_RIB.depth * 6;
  const pts: V[] = [];
  const flangeEnd = L ? w - h : w; // profil U: półka do krawędzi; C: zagięcie po zewnętrznej krawędzi
  // dolne zagięcie i półka (od końca zagięcia do środnika)
  if (L) pts.push([w - h, -d + L]);
  pts.push([flangeEnd, -d + h]);
  if (flangeRib) pts.push(...groove([(flangeEnd - w + h) / 2, -d + h], [-1, 0], [0, 1], FLANGE_RIB));
  pts.push([-w + h, -d + h]);
  // środnik z przetłoczeniami (wciśniętymi do wnętrza)
  for (const f of webRibs) pts.push(...groove([-w + h, f * D], [0, 1], [1, 0], WEB_RIB));
  pts.push([-w + h, d - h]);
  // górna półka i zagięcie
  if (flangeRib) pts.push(...groove([(flangeEnd - w + h) / 2, d - h], [1, 0], [0, -1], FLANGE_RIB));
  pts.push([flangeEnd, d - h]);
  if (L) pts.push([w - h, d - L]);
  return pts;
}

/**
 * Obrys przekroju cienkościennego profilu C (z zagięciami) albo U (bez) w osiach (a, b),
 * wyśrodkowany w prostokącie A × B. Zwraca jeden zamknięty wielokąt (bez powtórzonego pierwszego punktu).
 * detail = false – bez przetłoczeń (słabsze telefony, jakość niska).
 */
export function profileOutline(spec: Pick<ProfileSpec, 'web' | 't' | 'lip' | 'webRibs' | 'flangeRib'>, A: number, B: number, detail = true): Point[] {
  const swap = spec.web === 'b-' || spec.web === 'b+';
  const t = Math.min(spec.t, (swap ? B : A) / 3, (swap ? A : B) / 3);
  const pts = offsetPolyline(profileCenterline(spec, A, B, detail), t);
  return pts.map(([p, q]) => {
    switch (spec.web) {
      case 'a-':
        return { x: p, y: q };
      case 'a+':
        return { x: -p, y: q };
      case 'b-':
        return { x: q, y: p };
      case 'b+':
        return { x: q, y: -p };
    }
  });
}

/** Długość linii łamanej, m */
export function polylineLength(pts: [number, number][]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** Pole wielokąta (wartość bezwzględna), m² */
export function polygonArea(pts: Point[]): number {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
}
