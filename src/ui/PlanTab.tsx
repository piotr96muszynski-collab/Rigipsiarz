import { AtticEditor } from './AtticEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from './back';
import { ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { liningKey, summarize, type ProjectCalc } from '../calc/materials';
import { dist, isNewWall, sameOutline, wallEnds } from '../geometry/geometry';
import { deleteWall, setWallLength } from '../model/ops';
import type { Project } from '../model/types';
import { CeilingEditor, ExistingWallEditor, WallEditor } from './ElementsPanel';
import { PlanCanvas, type Selection, type Tool } from './PlanCanvas';
import { MultiWallEditor, multiSummary, systemShort, WallDefaultsEditor } from './WallBatch';
import { EXIT_FULLSCREEN_ICON, FULLSCREEN_ICON } from './fullscreen';
import { LengthSheet } from './LengthSheet';
import { fmtMeters } from './useLaser';
import { fmtNum } from './wallStyle';

interface Props {
  project: Project;
  calc: ProjectCalc;
  update: (fn: (d: Project) => void, opts?: { transient?: boolean }) => void;
  commit: () => void;
  wide: boolean;
  /** Tryb pełnoekranowy (chowa nagłówek z Cofnij/Ponów – wtedy te przyciski są na planie) */
  fullscreen?: FullscreenControl;
  /** Przejście do listy zakupów (telefon) */
  onShowList: () => void;
}

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'select',
    label: 'Wybierz',
    hint: 'Dotknij ściany, otworu lub sufitu, aby go edytować. Przeciągnij punkt, aby zmienić kształt, albo zaznaczoną ścianę, aby ją przesunąć – przyciąga do osi innych ścian i kątów prostych.',
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
  {
    id: 'attic',
    label: 'Poddasze',
    hint: 'Dotknij wnętrza zamkniętego pomieszczenia albo przeciągnij prostokąt poddasza. Kalenica idzie wzdłuż dłuższego boku, przekrój ustawisz w panelu.',
    icon: <path d="M3 13l9-8 9 8M6 11v8h12v-8M9 14h6" />,
  },
];

type Layer = 'existing' | 'new';

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'existing', label: 'Istniejące ściany' },
  { id: 'new', label: 'Nowa zabudowa' },
];

const EXISTING_HINT = {
  wall: 'Obrysuj istniejące ściany po licu od strony pomieszczenia – od narożnika do narożnika. Zamknij obrys w pierwszym punkcie.',
  room: 'Przeciągnij prostokąt – powstanie obrys z 4 istniejących ścian (np. pustego pokoju). Okna i drzwi dodasz narzędziami obok.',
};

/** Podpowiedzi narzędzi raz zamknięte (albo użyte) nie wracają – pamiętane na tym urządzeniu */
const HINTS_KEY = 'rigipsiarz.hintsSeen';
function loadHints(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(HINTS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
function saveHints(h: Record<string, boolean>) {
  try {
    localStorage.setItem(HINTS_KEY, JSON.stringify(h));
  } catch {
    /* pamięć przeglądarki niedostępna – podpowiedzi wrócą po odświeżeniu */
  }
}

export interface FullscreenControl {
  on: boolean;
  toggle: () => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function PlanTab({ project, calc, update, commit, wide, onShowList, fullscreen }: Props) {
  const [tool, setTool] = useState<Tool>(project.walls.length || project.attics?.length ? 'select' : 'wall');
  // pusty projekt zaczynamy od obrysu istniejącej przestrzeni, potem wstawia się nową zabudowę
  const [layer, setLayer] = useState<Layer>(project.walls.length || project.ceilings.length || project.attics?.length ? 'new' : 'existing');
  const [selection, setSelectionRaw] = useState<Selection>(null);
  const [expanded, setExpanded] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [zoom, setZoom] = useState({ seq: 0, factor: 1 });
  const [msg, setMsg] = useState<string | null>(null);
  const [hintSeen, setHintSeenRaw] = useState<Record<string, boolean>>(loadHints);
  const setHintSeen = (fn: (h: Record<string, boolean>) => Record<string, boolean>) =>
    setHintSeenRaw((h) => {
      const next = fn(h);
      if (next !== h) saveHints(next);
      return next;
    });
  const [multi, setMulti] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  /** ściana, której długość zmienia się w oknie po dotknięciu opisu wymiaru */
  const [lengthWallId, setLengthWallId] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(0);

  // podpowiedź znika, gdy narzędzie zostało użyte
  const shape = project.walls.length + project.ceilings.length * 1000 + project.walls.reduce((n, w) => n + w.openings.length, 0) * 1e6;
  const lastShape = useRef(shape);
  useEffect(() => {
    const key = tool === 'wall' || tool === 'room' ? `${tool}-${layer}` : tool;
    if (shape !== lastShape.current) setHintSeen((h) => (h[key] ? h : { ...h, [key]: true }));
    lastShape.current = shape;
  }, [shape, tool, layer]);

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
  const multiIds = selection?.type === 'walls' ? selection.ids.filter((id) => project.walls.some((w) => w.id === id)) : [];
  const wall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;
  const lengthWall = lengthWallId ? project.walls.find((w) => w.id === lengthWallId) : undefined;
  const ceiling = selection?.type === 'ceiling' ? project.ceilings.find((c) => c.id === selection.id) : undefined;
  const opening = wall && selection?.type === 'wall' ? wall.openings.find((o) => o.id === selection.openingId) : undefined;
  const attic = selection?.type === 'attic' ? project.attics?.find((a) => a.id === selection.id) : undefined;
  const hasSel = !!(wall || ceiling || attic || multiIds.length);
  useBack(hasSel || multi, () => {
    setSelection(null);
    setMulti(false);
  });
  useEffect(() => {
    if (tool !== 'select') setMulti(false);
    if (tool !== 'wall' && tool !== 'room') setDefaultsOpen(false);
  }, [tool]);

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
    if (multiIds.length) {
      update((d) => {
        for (const id of multiIds) deleteWall(d, id);
      });
      setSelection(null);
      onMessage(`Usunięto ściany (${multiIds.length}) – możesz cofnąć`);
    } else if (opening && wall) {
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
      // razem z niewidocznymi duplikatami o tym samym obrysie (dawniej powstawały przy podwójnym dotknięciu)
      update((d) => void (d.ceilings = d.ceilings.filter((c) => c.id !== ceiling.id && !sameOutline(c.points, ceiling.points))));
      setSelection(null);
      onMessage('Usunięto sufit – możesz cofnąć');
    } else if (attic) {
      update((d) => void (d.attics = (d.attics ?? []).filter((a) => a.id !== attic.id)));
      setSelection(null);
      onMessage('Usunięto poddasze – możesz cofnąć');
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
  const layered = tool === 'wall' || tool === 'room';
  const hintKey = multi ? 'multi' : layered ? `${tool}-${layer}` : tool;
  const hintText = multi
    ? 'Dotykaj kolejnych ścian, żeby dodać je do zaznaczenia (drugie dotknięcie odznacza). Przeciągnij zaznaczoną ścianę, żeby przesunąć wszystkie.'
    : layered && layer === 'existing'
      ? EXISTING_HINT[tool as 'wall' | 'room']
      : current.hint;
  const showHint = !hintSeen[hintKey] && !msg && !(hasSel && !wide);
  const empty = project.walls.length === 0 && project.ceilings.length === 0 && !project.attics?.length;

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
      onSelect={setSelection}
      onResetHints={Object.keys(hintSeen).length ? () => setHintSeen(() => ({})) : undefined}
    />
  );
  const showDefaults = layered && layer === 'new';

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
          layer={layer}
          multi={multi}
          onMessage={onMessage}
          onEditLength={setLengthWallId}
        />

        {lengthWall && (
          <LengthSheet
            key={lengthWall.id}
            title={`${isNewWall(lengthWall) ? 'Ściana' : 'Mur'} ${project.walls.filter((w) => isNewWall(w) === isNewWall(lengthWall)).indexOf(lengthWall) + 1} – długość`}
            value={dist(...wallEnds(project, lengthWall))}
            onSave={(cm, fromLaser) => {
              update((d) => {
                const w = d.walls.find((x) => x.id === lengthWall.id);
                if (w) setWallLength(d, w, cm);
              });
              setLengthWallId(null);
              onMessage(`Długość ${fmtMeters(cm)}${fromLaser ? ' z dalmierza' : ''} – możesz cofnąć`);
            }}
            onClose={() => setLengthWallId(null)}
          />
        )}

        <div className="plan-toolbar" role="toolbar" aria-label="Narzędzia planu">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'on' : ''}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
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
          {fullscreen && (
            <button
              className={`fab ${fullscreen.on ? 'on' : ''}`}
              onClick={fullscreen.toggle}
              aria-label={fullscreen.on ? 'Zamknij pełny ekran' : 'Pełny ekran'}
              title={fullscreen.on ? 'Zamknij pełny ekran' : 'Pełny ekran'}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d={fullscreen.on ? EXIT_FULLSCREEN_ICON : FULLSCREEN_ICON} />
              </svg>
            </button>
          )}
          {fullscreen?.on && fullscreen.undo && (
            <>
              <button className="fab" onClick={fullscreen.undo} disabled={!fullscreen.canUndo} aria-label="Cofnij">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />
                </svg>
              </button>
              <button className="fab" onClick={fullscreen.redo} disabled={!fullscreen.canRedo} aria-label="Ponów">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />
                </svg>
              </button>
              <span className="fab-gap" aria-hidden />
            </>
          )}
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

        <div className="plan-top">
          <div className="plan-layer" role="radiogroup" aria-label="Co rysujesz">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={layer === l.id}
                className={`${layer === l.id ? 'on' : ''} layer-${l.id}`}
                onClick={() => {
                  setLayer(l.id);
                  if (tool !== 'wall' && tool !== 'room') setTool('wall');
                }}
              >
                <i aria-hidden />
                {l.label}
              </button>
            ))}
          </div>
          {showDefaults && (
            <button className={`plan-chip ${defaultsOpen ? 'on' : ''}`} aria-expanded={defaultsOpen} onClick={() => setDefaultsOpen((x) => !x)}>
              <span className="muted">Nowe ściany:</span> <strong>{systemShort(project.settings.defaultWallSystem, project.settings.wallDefaults?.boardId)}</strong>
              <span className="muted"> · {fmtNum(project.settings.defaultHeight / 100)} m</span>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d={defaultsOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
              </svg>
            </button>
          )}
          {showDefaults && defaultsOpen && (
            <div className="plan-popover" role="dialog" aria-label="Ustawienia nowych ścian">
              <header>
                <strong>Ustawienia nowych ścian</strong>
                <button className="icon-btn" onClick={() => setDefaultsOpen(false)} aria-label="Zamknij ustawienia">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </header>
              <WallDefaultsEditor project={project} update={update} />
            </div>
          )}
          {tool === 'select' && (
            <button
              className={`plan-chip ${multi ? 'on' : ''}`}
              aria-pressed={multi}
              onClick={() => {
                setMulti((x) => !x);
                if (multi && multiIds.length) setSelection(null);
              }}
              title="Zaznaczaj kilka ścian (na komputerze także Shift + klik)"
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
              {multi ? `Zaznaczanie kilku${multiIds.length ? ` (${multiIds.length})` : ''} · gotowe` : 'Zaznacz kilka'}
            </button>
          )}
          {(msg || showHint) && !defaultsOpen && (
            <div className={`plan-hint ${msg ? 'msg' : ''}`} role="status">
              <span>{msg ?? hintText}</span>
              {!msg && (
                <button className="hint-close" onClick={() => setHintSeen((h) => ({ ...h, [hintKey]: true }))} aria-label="Ukryj podpowiedź">
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {empty && layered && !wide && !defaultsOpen && (
          <div className="plan-empty" aria-hidden>
            <p>
              {layer === 'existing'
                ? 'Zacznij od obrysu: narysuj istniejące ściany mieszkania palcem albo prostokątem „Pokój”. Potem wybierz „Nowa zabudowa”.'
                : 'Narysuj pierwszą ścianę palcem albo wybierz „Pokój”, żeby od razu wstawić 4 ściany.'}
            </p>
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
        Ściany <strong>{fmtNum(s.wallAreaM2, 1)} m²</strong>
        {s.liningAreaM2 > 0 && (
          <>
            {' '}
            · okładziny <strong>{fmtNum(s.liningAreaM2, 1)} m²</strong>
          </>
        )}{' '}
        · sufity <strong>{fmtNum(s.ceilingAreaM2, 1)} m²</strong>
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
  onSelect,
  onResetHints,
}: {
  onSelect: (s: Selection) => void;
  onResetHints?: () => void;
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
  const attic = selection?.type === 'attic' ? project.attics?.find((a) => a.id === selection.id) : undefined;
  const openingId = selection?.type === 'wall' ? selection.openingId : undefined;
  const opening = wall?.openings.find((o) => o.id === openingId);
  const waste = project.settings.wasteEnabled ? project.settings.waste : 0;
  const multiIds = selection?.type === 'walls' ? selection.ids.filter((id) => project.walls.some((w) => w.id === id)) : [];

  const existing = wall ? !isNewWall(wall) : false;
  const reqs = useMemo(() => {
    if (multiIds.length)
      return project.walls
        .filter((w) => multiIds.includes(w.id))
        .flatMap((w) =>
          isNewWall(w) ? [calc.walls.get(w.id)?.req] : (w.linings ?? []).map((l) => calc.linings.get(liningKey(w.id, l.side))?.req),
        )
        .filter((r) => !!r);
    if (wall && existing) return (wall.linings ?? []).map((l) => calc.linings.get(liningKey(wall.id, l.side))?.req).filter((r) => !!r);
    const r = wall ? calc.walls.get(wall.id)?.req : ceiling ? calc.ceilings.get(ceiling.id)?.req : attic ? calc.attics.get(attic.id)?.req : undefined;
    return r ? [r] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall, existing, ceiling, attic, calc, multiIds.join()]);
  const lines = useMemo(() => (reqs.length ? summarize(reqs, waste) : []), [reqs, waste]);

  if (multiIds.length) {
    const kinds = new Set(project.walls.filter((w) => multiIds.includes(w.id)).map(isNewWall));
    const sameKind = project.walls.filter((w) => kinds.has(isNewWall(w)));
    return (
      <div className={`inspector ${expanded ? 'open' : 'peek'}`}>
        <header className="insp-head">
          {collapsible ? (
            <button className="insp-title" onClick={onToggle} aria-expanded={expanded}>
              <span className="grab" aria-hidden />
              <strong>Zaznaczone ściany</strong>
              <span className="muted small">{multiSummary(project, multiIds)}</span>
            </button>
          ) : (
            <div className="insp-title">
              <strong>Zaznaczone ściany</strong>
              <span className="muted small">{multiSummary(project, multiIds)}</span>
            </div>
          )}
          <button className="icon-btn danger" onClick={onDelete} aria-label="Usuń zaznaczone ściany">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Odznacz">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {expanded && (
          <div className="insp-body">
            <MultiWallEditor project={project} ids={multiIds} update={update} />
            {sameKind.length > multiIds.length && (
              <div className="actions wrap">
                <button className="btn small" onClick={() => onSelect({ type: 'walls', ids: sameKind.map((w) => w.id) })}>
                  Zaznacz wszystkie {kinds.has(true) && kinds.size === 1 ? 'nowe ściany' : kinds.size === 1 ? 'mury' : 'ściany'} ({sameKind.length})
                </button>
              </div>
            )}
            {lines.length > 0 && (
              <details className="insp-materials" open={wide}>
                <summary>Materiały na zaznaczone ściany ({lines.length})</summary>
                <ul>
                  {lines.map((l) => (
                    <li key={l.key}>
                      <span>{l.name}</span>
                      <strong>{l.packs ? `${l.packs} ${l.packUnit}` : `${fmtQty(l.qty)} ${l.unit}`}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!wall && !ceiling && !attic) {
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
            <span>Okładziny</span>
            <strong>{fmtNum(s.liningAreaM2, 1)} m²</strong>
            <small>na istniejących ścianach</small>
          </div>
        </div>
        <p className="muted small">
          Najpierw obrysuj istniejące ściany (np. puste mieszkanie) z oknami i drzwiami wejściowymi – nie są liczone w
          materiałach, ale można na nie nałożyć okładzinę z płyt. Potem wybierz „Nowa zabudowa” i wstaw ściany g-k. Dotknij
          elementu, żeby ustawić wysokość, system, płytę i otwory.
        </p>
        <details className="insp-defaults">
          <summary>Ustawienia nowych ścian · {systemShort(project.settings.defaultWallSystem, project.settings.wallDefaults?.boardId)}</summary>
          <WallDefaultsEditor project={project} update={update} />
        </details>
        <ul className="shortcuts muted small">
          <li>
            <kbd>W</kbd> ściana · <kbd>R</kbd> pokój · <kbd>D</kbd> drzwi · <kbd>O</kbd> okno · <kbd>S</kbd> sufit · <kbd>V</kbd> wybierz
          </li>
          <li>
            <kbd>Shift</kbd> + klik – kilka ścian · <kbd>Del</kbd> usuń · <kbd>Esc</kbd> przerwij · <kbd>F</kbd> cały plan · kółko myszy – powiększenie · prawy przycisk – przesuwanie
          </li>
        </ul>
        {onResetHints && (
          <button className="btn ghost small" onClick={onResetHints}>
            Pokaż znowu podpowiedzi narzędzi
          </button>
        )}
        {!wide && (
          <button className="btn" onClick={onShowList}>
            Lista zakupów
          </button>
        )}
      </div>
    );
  }

  const index = wall
    ? project.walls.filter((w) => isNewWall(w) === !existing).indexOf(wall) + 1
    : attic
      ? (project.attics ?? []).indexOf(attic) + 1
      : project.ceilings.indexOf(ceiling!) + 1;
  const wallName = existing ? `Mur ${index}` : `Ściana ${index}`;
  const title = opening
    ? (opening.kind === 'door' ? (existing ? 'Drzwi wejściowe' : 'Drzwi') : 'Okno') + ` · ${wallName.toLowerCase()}`
    : wall
      ? wallName
      : attic
        ? `Poddasze ${index}`
        : `Sufit ${index}`;
  const liningNames = (wall?.linings ?? []).map((l) => wallSystemById(l.systemId).name);
  const summary = wall
    ? `${fmtNum(dist(...wallEnds(project, wall)) / 100)} × ${fmtNum(wall.height / 100)} m · ${
        existing ? (liningNames.length ? liningNames.join(', ') : 'istniejąca, bez okładziny') : wallSystemById(wall.systemId).name
      }`
    : attic
      ? `${fmtNum(attic.width / 100)} × ${fmtNum(attic.length / 100)} m · ${fmtNum(calc.attics.get(attic.id)?.areaM2 ?? 0, 1)} m² zabudowy`
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
          {wall && existing && <ExistingWallEditor wall={wall} project={project} calc={calc} update={update} activeOpeningId={openingId} />}
          {wall && !existing && <WallEditor wall={wall} project={project} calc={calc} update={update} activeOpeningId={openingId} />}
          {ceiling && <CeilingEditor ceiling={ceiling} wool={project.settings.wool} calc={calc} update={update} />}
          {attic && (
            <AtticEditor
              attic={attic}
              result={calc.attics.get(attic.id)}
              edit={(fn) =>
                update((d) => {
                  const a = d.attics?.find((x) => x.id === attic.id);
                  if (a) fn(a);
                })
              }
            />
          )}
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
