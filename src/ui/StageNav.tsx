import type { Stage, StageId, StageView, Tab } from './stages';

/** Ikony nawigacji projektu (ścieżki SVG 24×24, obrys) */
export const STAGE_ICONS: Record<StageId, string> = {
  wymiary: 'M4 4h16v16H4zM4 12h8M12 4v16',
  materialy: 'M5 7h14l-1.5 11h-11zM9 7a3 3 0 016 0',
  montaz: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5',
};
export const SETTINGS_ICON =
  'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z';
export const BACK_ICON = 'M15 5l-7 7 7 7';

export function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Trzy etapy pracy: dolny pasek na telefonie, zakładki w górnym pasku na komputerze */
export function StageBar({
  stages,
  active,
  onSelect,
  className = '',
}: {
  stages: Stage[];
  active: StageId | undefined;
  onSelect: (id: StageId) => void;
  className?: string;
}) {
  return (
    <nav className={`stage-bar ${className}`} aria-label="Etapy pracy">
      {stages.map((s) => (
        <button
          key={s.id}
          className={`stage-btn ${active === s.id ? 'on' : ''}`}
          aria-current={active === s.id ? 'page' : undefined}
          onClick={() => onSelect(s.id)}
        >
          <NavIcon d={STAGE_ICONS[s.id]} />
          <span className="stage-label">{s.label}</span>
          <span className="stage-sub">{s.views.map((v) => shortLabel(v)).join(' · ')}</span>
        </button>
      ))}
    </nav>
  );
}

const SHORT: Partial<Record<Tab, string>> = { elements: 'lista', '3d': '3D' };
function shortLabel(v: StageView) {
  return (SHORT[v.id] ?? v.label).toLowerCase().replace('3d', '3D');
}

/** Przełącznik dwóch widoków bieżącego etapu */
export function ViewSwitch({ views, active, onSelect }: { views: StageView[]; active: Tab; onSelect: (id: Tab) => void }) {
  return (
    <div className="view-switch" role="tablist" aria-label="Widok etapu">
      {views.map((v) => (
        <button key={v.id} role="tab" aria-selected={active === v.id} className={active === v.id ? 'on' : ''} onClick={() => onSelect(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}
