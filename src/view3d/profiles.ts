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
}

/** Grubość blachy w 3D: 0,6 mm (CW/UW/CD/UD) i 2 mm (UA); minimalnie pogrubiona, żeby nie migotała z daleka */
const STEEL_T = 0.0008;
const UA_T = 0.002;

/** Typ przekroju dla materiału rusztu; undefined – element rysowany jako bryła (np. wieszak) */
export function profileFor(mat: string, axis: ProfileSpec['axis'], web: WebSide): ProfileSpec | undefined {
  switch (mat) {
    case 'cw':
      return { axis, web, t: STEEL_T, lip: 0.006 };
    case 'cdMain':
    case 'cdSec':
      return { axis, web, t: STEEL_T, lip: 0.005 };
    case 'ua':
      return { axis, web, t: UA_T, lip: 0 };
    case 'uw':
    case 'ud':
      return { axis, web, t: STEEL_T, lip: 0 };
    default:
      return undefined;
  }
}

/**
 * Obrys przekroju cienkościennego profilu C (z zagięciami) albo U (bez) w osiach (a, b),
 * wyśrodkowany w prostokącie A × B. Zwraca jeden zamknięty wielokąt (bez powtórzonego pierwszego punktu).
 */
export function profileOutline(spec: Pick<ProfileSpec, 'web' | 't' | 'lip'>, A: number, B: number): Point[] {
  // w układzie kanonicznym środnik leży przy a = -A'/2, półki biegną wzdłuż a
  const swap = spec.web === 'b-' || spec.web === 'b+';
  const W = swap ? B : A; // wysięg półek (od środnika do krawędzi)
  const D = swap ? A : B; // wysokość środnika
  const t = Math.min(spec.t, W / 3, D / 3);
  const L = Math.min(Math.max(spec.lip, t), D / 2 - t);
  const w = W / 2;
  const d = D / 2;
  const raw: [number, number][] = [
    [-w, -d],
    [w, -d],
    [w, -d + L],
    [w - t, -d + L],
    [w - t, -d + t],
    [-w + t, -d + t],
    [-w + t, d - t],
    [w - t, d - t],
    [w - t, d - L],
    [w, d - L],
    [w, d],
    [-w, d],
  ];
  // usuwamy zdegenerowane punkty (profil U: zagięcie o długości t)
  const pts: [number, number][] = [];
  for (const q of raw) {
    const prev = pts[pts.length - 1];
    if (prev && Math.abs(prev[0] - q[0]) < 1e-9 && Math.abs(prev[1] - q[1]) < 1e-9) continue;
    pts.push(q);
  }
  const cleaned = pts.filter((q, i) => {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[(i + 1) % pts.length];
    // punkt współliniowy z sąsiadami – zbędny
    const cross = (q[0] - p0[0]) * (p1[1] - q[1]) - (q[1] - p0[1]) * (p1[0] - q[0]);
    return Math.abs(cross) > 1e-12;
  });
  return cleaned.map(([p, q]) => {
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

/** Pole wielokąta (wartość bezwzględna), m² */
export function polygonArea(pts: Point[]): number {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
}
