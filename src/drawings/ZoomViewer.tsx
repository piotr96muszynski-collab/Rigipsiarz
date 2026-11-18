import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBack } from '../ui/back';
import { PaperSvg } from './svg';
import { fitView, panBy, zoomAt, zoomLevel, type View } from './zoom';

const STEP = 1.6;
const DOUBLE_TAP_MS = 300;

/**
 * Rysunek na pełnym ekranie: dwa palce powiększają, jeden przesuwa, podwójne dotknięcie
 * przybliża lub wraca do całości. Zmieniamy viewBox SVG, więc linie i napisy zostają ostre
 * przy każdym powiększeniu. Wstecz zamyka podgląd.
 */
export function ZoomViewer({
  viewBox,
  title,
  children,
  onClose,
}: {
  viewBox: [number, number, number, number];
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const base = useRef<View>({ x: 0, y: 0, w: 1, h: 1 });
  const view = useRef<View>(base.current);
  const size = useRef({ w: 1, h: 1 });
  const closeRef = useRef<HTMLButtonElement>(null);

  useBack(true, onClose);

  const apply = useCallback((v: View) => {
    view.current = v;
    const { x, y, w, h } = v;
    svgRef.current?.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }, []);

  // dopasowanie do okna (także po obrocie telefonu)
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const prevZoom = zoomLevel(view.current, base.current);
      const c = { x: view.current.x + view.current.w / 2, y: view.current.y + view.current.h / 2 };
      const first = size.current.w === 1;
      size.current = { w: r.width, h: r.height };
      base.current = fitView(viewBox, r.width, r.height);
      if (first || prevZoom <= 1.001) apply(base.current);
      else {
        // zachowaj powiększenie i środek widoku
        const w = base.current.w / prevZoom;
        const h = base.current.h / prevZoom;
        apply(panBy({ x: c.x - w / 2, y: c.y - h / 2, w, h }, base.current, 0, 0, r.width));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [viewBox, apply]);

  // bez przewijania strony pod spodem; fokus na Zamknij (klawiatura, czytniki ekranu)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomBy(STEP);
      else if (e.key === '-') zoomBy(1 / STEP);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (factor: number, px = size.current.w / 2, py = size.current.h / 2) =>
    apply(zoomAt(view.current, base.current, px, py, factor, size.current.w));

  // kółko myszy (listener nie-pasywny, żeby zablokować przewijanie)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      apply(zoomAt(view.current, base.current, e.clientX - r.left, e.clientY - r.top, f, size.current.w));
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [apply]);

  // gesty dotykowe i mysz
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const tap = useRef({ t: 0, x: 0, y: 0, moved: false });
  const start = useRef({ x: 0, y: 0 });
  const local = (e: React.PointerEvent) => {
    const r = hostRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    hostRef.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) {
      tap.current.moved = false;
      start.current = p;
    } else tap.current.moved = true; // drugi palec = gest, nie dotknięcie
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    const others = [...pts.current.entries()].filter(([id]) => id !== e.pointerId).map(([, q]) => q);
    pts.current.set(e.pointerId, p);
    if (others.length || Math.hypot(p.x - start.current.x, p.y - start.current.y) > 8) tap.current.moved = true;
    if (!others.length) {
      apply(panBy(view.current, base.current, p.x - prev.x, p.y - prev.y, size.current.w));
      return;
    }
    // dwa palce: powiększenie wokół środka i przesunięcie razem ze środkiem
    const o = others[0];
    const d0 = Math.hypot(prev.x - o.x, prev.y - o.y);
    const d1 = Math.hypot(p.x - o.x, p.y - o.y);
    const m0 = { x: (prev.x + o.x) / 2, y: (prev.y + o.y) / 2 };
    const m1 = { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 };
    let v = panBy(view.current, base.current, m1.x - m0.x, m1.y - m0.y, size.current.w);
    if (d0 > 4) v = zoomAt(v, base.current, m1.x, m1.y, d1 / d0, size.current.w);
    apply(v);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    const p = local(e);
    pts.current.delete(e.pointerId);
    if (pts.current.size || tap.current.moved || e.type === 'pointercancel') return;
    // podwójne dotknięcie: przybliż w tym miejscu albo wróć do całego rysunku
    const now = performance.now();
    const t = tap.current;
    if (now - t.t < DOUBLE_TAP_MS && Math.hypot(p.x - t.x, p.y - t.y) < 40) {
      t.t = 0;
      if (zoomLevel(view.current, base.current) > 1.05) apply(base.current);
      else zoomBy(2.5, p.x, p.y);
    } else {
      t.t = now;
      t.x = p.x;
      t.y = p.y;
    }
  };

  return createPortal(
    <div className="zoom-viewer no-print" role="dialog" aria-modal="true" aria-label={title}>
      <header className="zoom-bar">
        <strong className="zoom-title">{title}</strong>
        <button className="icon-btn" onClick={() => zoomBy(1 / STEP)} aria-label="Pomniejsz">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12h14" />
          </svg>
        </button>
        <button className="icon-btn" onClick={() => zoomBy(STEP)} aria-label="Powiększ">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button className="icon-btn" onClick={() => apply(base.current)} aria-label="Cały rysunek">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
        <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Zamknij podgląd">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <div
        className="zoom-stage"
        ref={hostRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PaperSvg viewBox={viewBox} title={title} svgRef={svgRef}>
          {children}
        </PaperSvg>
      </div>
      <p className="zoom-help">Rozsuń dwa palce, żeby powiększyć · przesuwaj jednym · dotknij dwa razy, żeby przybliżyć</p>
    </div>,
    document.body,
  );
}
