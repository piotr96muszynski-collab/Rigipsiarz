import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useBack } from './back';
import { DRAG_SLOP_PX, EDGE_ZONE_PX, dragProgress, settleOpen } from './drawerGesture';

export interface DrawerItem<T extends string> {
  id: T;
  label: string;
  /** Ścieżka SVG 24×24 */
  icon: string;
}

/** Ikony sekcji projektu (ścieżki SVG 24×24, obrys) */
export const NAV_ICONS = {
  plan: 'M4 4h16v16H4zM4 12h8M12 4v16',
  list: 'M5 7h14l-1.5 11h-11zM9 7a3 3 0 016 0',
  elements: 'M4 5h16M4 12h16M4 19h10',
  joints: 'M4 20L20 4M8 20l12-12M4 16L16 4',
  '3d': 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  drawings: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  projects: 'M15 5l-7 7 7 7',
  catalog: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
} as const;

export const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Drag {
  id: number;
  x0: number;
  y0: number;
  t: number;
  x: number;
  startOpen: boolean;
  active: boolean;
  /** Prędkość ostatniego odcinka ruchu (px/ms) */
  v: number;
}

/**
 * Boczne menu sekcji projektu. Nakłada się na treść (position: fixed), więc ani otwieranie,
 * ani przeciąganie nie zmienia rozmiaru planu czy rysunku pod spodem.
 * Otwiera się przyciskiem z trzema kreskami albo gestem od lewej krawędzi w dolnej połowie ekranu.
 */
export function NavDrawer<T extends string>({
  open,
  setOpen,
  title,
  items,
  active,
  onSelect,
  footer,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  title: string;
  items: DrawerItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  footer?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  // klik po przeciągnięciu tła nie powinien dodatkowo zamykać menu
  const justDragged = useRef(false);

  useBack(open, () => setOpen(false));

  // Esc zamyka; po otwarciu fokus na bieżącą sekcję, po zamknięciu wraca na przycisk menu
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open, setOpen]);

  const setP = (p: number | null) => {
    const el = rootRef.current;
    if (!el) return;
    if (p === null) el.style.removeProperty('--p');
    else el.style.setProperty('--p', String(p));
  };

  const width = () => panelRef.current?.offsetWidth ?? 300;

  const begin = (e: RPointerEvent, startOpen: boolean) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t: e.timeStamp, x: e.clientX, startOpen, active: false, v: 0 };
  };

  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      const toward = d.startOpen ? dx < -DRAG_SLOP_PX : dx > DRAG_SLOP_PX;
      if (!toward || Math.abs(dx) < Math.abs(dy)) {
        // ruch w pionie – to przewijanie, nie gest menu
        if (Math.abs(dy) > DRAG_SLOP_PX) drag.current = null;
        return;
      }
      d.active = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    // prędkość liczona z ostatniego odcinka ruchu
    const dt = Math.max(1, e.timeStamp - d.t);
    d.v = (e.clientX - d.x) / dt;
    d.x = e.clientX;
    d.t = e.timeStamp;
    setP(dragProgress(dx, width(), d.startOpen));
  };

  const end = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    const p = dragProgress(e.clientX - d.x0, width(), d.startOpen);
    setDragging(false);
    setP(null);
    setOpen(e.type === 'pointercancel' ? d.startOpen : settleOpen(p, d.v));
  };

  const handlers = (startOpen: boolean) => ({
    onPointerDown: (e: RPointerEvent) => begin(e, startOpen),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });

  return (
    <>
      {!open && (
        <div
          className="drawer-edge"
          style={{ width: EDGE_ZONE_PX }}
          aria-hidden
          {...handlers(false)}
        />
      )}
      <div ref={rootRef} className={`drawer ${open ? 'open' : ''} ${dragging ? 'dragging' : ''}`}>
        <div className="drawer-scrim" onClick={() => !justDragged.current && setOpen(false)} {...handlers(true)} />
        <nav
          ref={panelRef}
          className="drawer-panel"
          aria-label="Sekcje projektu"
          inert={!open && !dragging}
          {...handlers(true)}
        >
          <div className="drawer-head">
            <span className="drawer-title" title={title}>
              {title || 'Projekt'}
            </span>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Zamknij menu">
              <Icon d="M6 6l12 12M18 6L6 18" />
            </button>
          </div>
          <ul className="drawer-list">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  className={`drawer-item ${active === it.id ? 'on' : ''}`}
                  aria-current={active === it.id ? 'page' : undefined}
                  onClick={() => {
                    onSelect(it.id);
                    setOpen(false);
                  }}
                >
                  <Icon d={it.icon} />
                  <span>{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {footer && <div className="drawer-foot">{footer}</div>}
        </nav>
      </div>
    </>
  );
}

/** Pozycja w stopce menu (np. powrót do projektów) */
export function DrawerLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="drawer-item" onClick={onClick}>
      <Icon d={icon} />
      <span>{label}</span>
    </button>
  );
}
