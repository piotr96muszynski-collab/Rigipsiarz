// Rozmieszczenie etykiet wymiarów podczas rysowania (współrzędne ekranu, px).
type Point = { x: number; y: number };

export const BUBBLE_W = 86;
export const BUBBLE_H = 26;
/** Minimalna odległość etykiety od palca (px) – żeby palec nie zasłaniał liczb. */
const FINGER_CLEAR = 80;

/**
 * Pozycja etykiety wymiaru: preferowane miejsce `target`, ale nie bliżej palca niż FINGER_CLEAR.
 * Gdy za blisko, etykieta ucieka w stronę punktu początkowego (przeciwnie do ruchu palca),
 * a w ostateczności nad palec. Wynik mieści się w widocznym obszarze.
 */
export function awayFromFinger(
  finger: Point,
  target: Point,
  origin: Point,
  size: { w: number; h: number },
  insetBottom = 0,
): Point {
  let p = target;
  if (Math.hypot(p.x - finger.x, p.y - finger.y) < FINGER_CLEAR) {
    let dx = origin.x - finger.x;
    let dy = origin.y - finger.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = 0;
      dy = -1;
    } else {
      dx /= d;
      dy /= d;
    }
    p = { x: finger.x + dx * FINGER_CLEAR, y: finger.y + dy * FINGER_CLEAR };
  }
  const minX = BUBBLE_W / 2 + 8;
  const maxX = Math.max(minX, size.w - BUBBLE_W / 2 - 8);
  const minY = 120; // pasek narzędzi
  const maxY = Math.max(minY, size.h - insetBottom - BUBBLE_H);
  p = { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) };
  // po przycięciu do ekranu etykieta mogła wrócić pod palec – wtedy nad lub pod palec
  if (Math.hypot(p.x - finger.x, p.y - finger.y) < FINGER_CLEAR) {
    const up = finger.y - FINGER_CLEAR;
    p = { x: p.x, y: up >= minY ? up : Math.min(maxY, finger.y + FINGER_CLEAR) };
  }
  return p;
}

/** Opis długości ściany na planie (środek tekstu w px ekranu, kąt obrotu w stopniach) */
export interface DimLabel {
  id: string;
  x: number;
  y: number;
  ang: number;
  /** długość w cm */
  L: number;
}

/**
 * Który opis długości trafił palec. Obszar trafienia jest większy od samego tekstu (palec jest gruby),
 * liczony w układzie obróconego opisu. Przy kilku trafieniach wygrywa najbliższy.
 */
export function hitDimLabel(tap: Point, labels: DimLabel[], halfW = 38, halfH = 18): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const l of labels) {
    const r = (-l.ang * Math.PI) / 180;
    const dx = tap.x - l.x;
    const dy = tap.y - l.y;
    const u = dx * Math.cos(r) - dy * Math.sin(r);
    const v = dx * Math.sin(r) + dy * Math.cos(r);
    if (Math.abs(u) > halfW || Math.abs(v) > halfH) continue;
    const d = Math.hypot(u, v);
    if (d < bestD) {
      bestD = d;
      best = l.id;
    }
  }
  return best;
}
