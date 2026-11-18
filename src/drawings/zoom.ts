// Matematyka podglądu powiększenia rysunku: widok to prostokąt w jednostkach rysunku (viewBox SVG),
// zawsze o proporcjach okna, więc 1 px ekranu = w / szerokość okna jednostek rysunku.

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Największe powiększenie względem widoku „cały rysunek” */
export const MAX_ZOOM = 12;

/** Widok, w którym cały rysunek mieści się w oknie (dopełniony do proporcji okna) */
export function fitView(vb: [number, number, number, number], widthPx: number, heightPx: number): View {
  let [x, y, w, h] = vb;
  const aspect = widthPx > 0 && heightPx > 0 ? widthPx / heightPx : w / h;
  if (w / h > aspect) {
    const nh = w / aspect;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    x -= (nw - w) / 2;
    w = nw;
  }
  return { x, y, w, h };
}

/** Pilnuje granic: nie mniej niż cały rysunek, nie więcej niż MAX_ZOOM, bez uciekania poza arkusz */
export function clampView(v: View, base: View): View {
  const w = Math.min(base.w, Math.max(base.w / MAX_ZOOM, v.w));
  const h = (v.h / v.w) * w;
  const cx = v.x + v.w / 2;
  const cy = v.y + v.h / 2;
  let x = cx - w / 2;
  let y = cy - h / 2;
  x = Math.min(base.x + base.w - w, Math.max(base.x, x));
  y = Math.min(base.y + base.h - h, Math.max(base.y, y));
  return { x, y, w, h };
}

/**
 * Powiększa o `factor` (>1 przybliża) wokół punktu ekranu (px, py) liczonego od lewego górnego
 * rogu okna – punkt pod palcem zostaje w miejscu.
 */
export function zoomAt(v: View, base: View, px: number, py: number, factor: number, widthPx: number): View {
  const k = v.w / widthPx;
  const sx = v.x + px * k;
  const sy = v.y + py * k;
  const w = Math.min(base.w, Math.max(base.w / MAX_ZOOM, v.w / factor));
  const s = w / v.w;
  return clampView({ x: sx - (sx - v.x) * s, y: sy - (sy - v.y) * s, w, h: v.h * s }, base);
}

/** Przesuwa widok o (dx, dy) px ekranu – rysunek jedzie za palcem */
export function panBy(v: View, base: View, dx: number, dy: number, widthPx: number): View {
  const k = v.w / widthPx;
  return clampView({ ...v, x: v.x - dx * k, y: v.y - dy * k }, base);
}

/** Bieżące powiększenie względem widoku całego rysunku */
export const zoomLevel = (v: View, base: View) => base.w / v.w;
