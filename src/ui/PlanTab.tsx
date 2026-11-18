import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from './back';
import { ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { summarize, type ProjectCalc } from '../calc/materials';
import { dist, wallEnds } from '../geometry/geometry';
import { deleteWall } from '../model/ops';
import type { Project } from '../model/types';
import { CeilingEditor, WallEditor } from './ElementsPanel';
import { PlanCanvas, type Selection, type Tool } from './PlanCanvas';
import { fmtNum } from './wallStyle';

interface Props {
  project: Project;
  calc: ProjectCalc;
  update: (fn: (d: Project) => void, opts?: { transient?: boolean }) => void;
  commit: () => void;
  wide: boolean;
  /** Przejście do listy zakupów (telefon) */
  onShowList: () => void;
}

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'select',
    label: 'Wybierz',
    hint: 'Dotknij ściany, otworu lub sufitu, aby go edytować. Przeciągnij punkt, aby zmienić kształt.',
    icon: <path d="M6 3l12 9-5.5 1L15 20l-2.5 1-2.5-7L6 18z" />,
  },
  {
    id: 'wall',
    label: 'Ściana',
    hint: 'Przeciągnij, aby narysować ścianę, albo dotykaj kolejnych punktów. Przyciąga do węzłów, ścian i kątów co 45°.',
    icon: <path d="M3 17L17 3l4 4L7 21H3z" />,
  },
  {
    id: 'room',
    label: 'Pokój',
    hint: 'Przeciągnij prostokąt – powstaną 4 połączone ściany z narożnikami.',
    icon: <rect x="4" y="4" width="16" height="16" rx="1" />,
  },
  {
    id: 'door',
    label: 'Drzwi',
    hint: 'Dotknij ściany w miejscu, gdzie mają być drzwi. Wymiary zmienisz w panelu.',
    icon: <path d="M5 20h14M7 20V4h10v16M14 12h.01" />,
  },
  {
    id: 'window',
    label: 'Okno',
    hint: 'Dotknij ściany w miejscu, gdzie ma być okno. Wymiary i parapet zmienisz w panelu.',
    icon: <path d="M4 4h16v16H4zM12 4v16M4 12h16" />,
  },
  {
    id: 'ceiling',
    label: 'Sufit',
    hint: 'Dotknij wnętrza zamkniętego pomieszczenia albo przeciągnij prostokąt sufitu.',
    icon: <path d="M3 8h18M6 8v3M12 8v3M18 8v3M3 4h18" />,
  },
];

export function PlanTab({ project, calc, update, commit, wide, onShowList }: Props) {
  const [tool, setTool] = useState<Tool>(project.walls.length ? 'select' : 'wall');
  const [selection, setSelectionRaw] = useState<Selection>(null);
  const [expanded, setExpanded] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [zoom, setZoom] = useState({ seq: 0, factor: 1 });
  const [msg, setMsg] = useState<string | null>(null);
  const [hintSeen, setHintSeen] = useState<Record<string, boolean>>({});
  const msgTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(0);

  // podpowiedź znika, gdy narzędzie zostało użyte
  const shape = project.walls.length + project.ceilings.length * 1000 + project.walls.reduce((n, w) => n + w.openings.length, 0) * 1e6;
  const lastShape = useRef(shape);
  useEffect(() => {
    if (shape !== lastShape.current) setHintSeen((h) => (h[tool] ? h : { ...h, [tool]: true }));
    lastShape.current = shape;
  }, [shape, tool]);

  const setSelection = (s: Selection) => {
    setSelectionRaw(s);
    // przy rysowaniu panel zostaje zwinięty, żeby nie zasłaniał planu
    if (s && (tool === 'select' || tool === 'door' || tool === 'window')) setExpanded(true);
    if (!s) setExpanded(false);
  };

  const onMessage = (m: string) => {
    setMsg(m);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3200);
  };
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  // zaznaczenie mogło zniknąć (cofnij, usunięcie)
  const wall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;
  const ceiling = selection?.type === 'ceiling' ? project.ceilings.find((c) => c.id === selection.id) : undefined;
  const opening = wall && selection?.type === 'wall' ? wall.openings.find((o) => o.id === selection.openingId) : undefined;
  const hasSel = !!(wall || ceiling);
  useBack(hasSel, () => setSelection(null));

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || wide) {
      setSheetH(wide ? 0 : 64);
      return;
    }
    const ro = new ResizeObserver(() => setSheetH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasSel, wide]);

  const removeSelected = () => {
    if (opening && wall) {
      update((d) => {
        const w = d.walls.find((x) => x.id === wall.id);
        if (w) w.openings = w.openings.filter((o) => o.id !== opening.id);
      });
      setSelectionRaw({ type: 'wall', id: wall.id });
      onMessage(`Usunięto ${opening.kind === 'door' ? 'drzwi' : 'okno'}`);
    } else if (wall) {
      update((d) => deleteWall(d, wall.id));
      setSelection(null);
      onMessage('Usunięto ścianę – możesz cofnąć');
    } else if (ceiling) {
      update((d) => void (d.ceilings = d.ceilings.filter((c) => c.id !== ceiling.id)));
      setSelection(null);
      onMessage('Usunięto sufit – możesz cofnąć');
    }
  };

  // skróty klawiaturowe (komputer)
  const removeRef = useRef(removeSelected);
  removeRef.current = removeSelected;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeRef.current();
        return;
      }
      const map: Record<string, Tool> = { v: 'select', '1': 'select', w: 'wall', '2': 'wall', r: 'room', '3': 'room', d: 'door', '4': 'door', o: 'window', '5': 'window', s: 'ceiling', '6': 'ceiling' };
      const next = map[e.key.toLowerCase()];
      if (next) setTool(next);
      if (e.key === 'f') setFitSignal((x) => x + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = TOOLS.find((t) => t.id === tool)!;
  const showHint = !hintSeen[tool] && !msg && !(hasSel && !wide);
  const empty = project.walls.length === 0 && project.ceilings.length === 0;

  const inspector = (
    <Inspector
      project={project}
      calc={calc}
      update={update}
      selection={selection}
      expanded={wide || expanded}
      collapsible={!wide}
      onToggle={() => setExpanded((x) => !x)}
      onClose={() => setSelection(null)}
      onDelete={removeSelected}
      onShowList={onShowList}
      wide={wide}
    />
  );

  return (
    <div className={`plan-layout ${wide ? 'wide' : ''}`}>
      <div className="plan-stage">
        <PlanCanvas
          project={project}
          update={update}
          commit={commit}
          tool={tool}
          setTool={setTool}
          selection={selection}
          setSelection={setSelection}
          fitSignal={fitSignal}
          zoom={zoom}
          insetBottom={sheetH}
          onMessage={onMessage}
        />

        <div className="plan-toolbar" role="toolbar" aria-label="Narzędzia planu">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'on' : ''}
              aria-pressed={tool === t.id}
              onClick={() => {
                if (tool === t.id) setHintSeen((h) => ({ ...h, [t.id]: false }));
                setTool(t.id);
              }}
              title={t.label}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="plan-view-btns">
          <button className="fab" onClick={() => setZoom((z) => ({ seq: z.seq + 1, factor: 1.4 }))} aria-label="Powiększ">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button className="fab" onClick={() => setZoom((z) => ({ seq: z.seq + 1, factor: 1 / 1.4 }))} aria-label="Pomniejsz">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M5 12h14" />
            </svg>
          </button>
          <button className="fab" onClick={() => setFitSignal((x) => x + 1)} aria-label="Pokaż cały plan">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>

        {(msg || showHint) && (
          <div className={`plan-hint ${msg ? 'msg' : ''}`} role="status">
            <span>{msg ?? current.hint}</span>
            {!msg && (
              <button className="hint-close" onClick={() => setHintSeen((h) => ({ ...h, [tool]: true }))} aria-label="Ukryj podpowiedź">
                ×
              </button>
            )}
          </div>
        )}

        {empty && tool === 'wall' && !wide && (
          <div className="plan-empty" aria-hidden>
            <p>Narysuj pierwszą ścianę palcem albo wybierz „Pokój”, żeby od razu wstawić 4 ściany.</p>
          </div>
        )}

        {!wide && (hasSel ? <div className="plan-sheet" ref={sheetRef}>{inspector}</div> : <SummaryBar calc={calc} onShowList={onShowList} />)}
      </div>
      {wide && <aside className="plan-side">{inspector}</aside>}
    </div>
  );
}

function SummaryBar({ calc, onShowList }: { calc: ProjectCalc; onShowList: () => void }) {
  const s = calc.stats;
  return (
    <button className="plan-summary" onClick={onShowList}>
      <span>
        Ściany <strong>{fmtNum(s.wallAreaM2, 1)} m²</strong> · sufity <strong>{fmtNum(s.ceilingAreaM2, 1)} m²</strong>
      </span>
      <span className="plan-summary-cta">
        Zakupy ({calc.total.length})
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

const fmtQty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

function Inspector({
  project,
  calc,
  update,
  selection,
  expanded,
  collapsible,
  onToggle,
  onClose,
  onDelete,
  onShowList,
  wide,
}: {
  project: Project;
  calc: ProjectCalc;
  update: Props['update'];
  selection: Selection;
  expanded: boolean;
  collapsible: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete: () => void;
  onShowList: () => void;
  wide: boolean;
}) {
  const wall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;
  const ceiling = selection?.type === 'ceiling' ? project.ceilings.find((c) => c.id === selection.id) : undefined;
  const openingId = selection?.type === 'wall' ? selection.openingId : undefined;
  const opening = wall?.openings.find((o) => o.id === openingId);
  const waste = project.settings.wasteEnabled ? project.settings.waste : 0;

  const req = wall ? calc.walls.get(wall.id)?.req : ceiling ? calc.ceilings.get(ceiling.id)?.req : undefined;
  const lines = useMemo(() => (req ? summarize([req], waste) : []), [req, waste]);

  if (!wall && !ceiling) {
    const s = calc.stats;
    return (
      <div className="inspector">
        <h2 className="side-title">Projekt</h2>
        <div className="insp-stats">
          <div>
            <span>Ściany</span>
            <strong>{fmtNum(s.wallAreaM2, 1)} m²</strong>
            <small>
              {project.walls.length} szt. · {fmtNum(s.wallLengthM)} mb
            </small>
          </div>
          <div>
            <span>Sufity</span>
            <strong>{fmtNum(s.ceilingAreaM2, 1)} m²</strong>
            <small>{project.ceilings.length} szt.</small>
          </div>
          <div>
            <span>Otwory</span>
            <strong>{s.openings}</strong>
            <small>drzwi i okna</small>
          </div>
        </div>
        <p className="muted small">
          Wybierz element na planie, żeby ustawić wysokość, system Rigips, płytę i otwory. Materiały liczą się na bieżąco, razem z
          narożnikami i połączeniami ścian.
        </p>
        <ul className="shortcuts muted small">
          <li>
            <kbd>W</kbd> ściana · <kbd>R</kbd> pokój · <kbd>D</kbd> drzwi · <kbd>O</kbd> okno · <kbd>S</kbd> sufit · <kbd>V</kbd> wybierz
          </li>
          <li>
            <kbd>Del</kbd> usuń · <kbd>Esc</kbd> przerwij · <kbd>F</kbd> cały plan · kółko myszy – powiększenie · prawy przycisk – przesuwanie
          </li>
        </ul>
        {!wide && (
          <button className="btn" onClick={onShowList}>
            Lista zakupów
          </button>
        )}
      </div>
    );
  }

  const index = wall ? project.walls.indexOf(wall) + 1 : project.ceilings.indexOf(ceiling!) + 1;
  const title = opening ? (opening.kind === 'door' ? 'Drzwi' : 'Okno') + ` · ściana ${index}` : wall ? `Ściana ${index}` : `Sufit ${index}`;
  const summary = wall
    ? `${fmtNum(dist(...wallEnds(project, wall)) / 100)} × ${fmtNum(wall.height / 100)} m · ${wallSystemById(wall.systemId).name}`
    : `${fmtNum(calc.ceilings.get(ceiling!.id)?.areaM2 ?? 0)} m² · ${ceilingSystemById(ceiling!.systemId).name}`;
  const subtitle = opening ? `${opening.width} × ${opening.height} cm${opening.kind === 'window' ? `, parapet ${opening.sill} cm` : ''}` : summary;

  return (
    <div className={`inspector ${expanded ? 'open' : 'peek'}`}>
      <header className="insp-head">
        {collapsible ? (
          <button className="insp-title" onClick={onToggle} aria-expanded={expanded}>
            <span className="grab" aria-hidden />
            <strong>{title}</strong>
            <span className="muted small">{subtitle}</span>
          </button>
        ) : (
          <div className="insp-title">
            <strong>{title}</strong>
            <span className="muted small">{subtitle}</span>
          </div>
        )}
        <button className="icon-btn danger" onClick={onDelete} aria-label={opening ? 'Usuń otwór' : 'Usuń element'}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Zamknij panel">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {expanded && (
        <div className="insp-body">
          {wall && <WallEditor wall={wall} project={project} calc={calc} update={update} activeOpeningId={openingId} />}
          {ceiling && <CeilingEditor ceiling={ceiling} calc={calc} update={update} />}
          {lines.length > 0 && (
            <details className="insp-materials" open={wide}>
              <summary>Materiały na ten element ({lines.length})</summary>
              <ul>
                {lines.map((l) => (
                  <li key={l.key}>
                    <span>{l.name}</span>
                    <strong>
                      {l.packs ? `${l.packs} ${l.packUnit}` : `${fmtQty(l.qty)} ${l.unit}`}
                    </strong>
                  </li>
                ))}
              </ul>
              <small className="hint">Suma dla całego projektu jest w liście zakupów – ścinki profili rozkładają się tam na wszystkie elementy.</small>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
