import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Project } from '../model/types';

/** Ułamek szerokości wiersza, po którym puszczenie palca usuwa projekt */
const DELETE_RATIO = 0.4;
/** Przesunięcie (px), po którym uznajemy ruch za gest, a nie stuknięcie */
const SLOP = 8;

interface Props {
  projects: Project[];
  onSelect: (id: string) => void;
  onDelete: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onRename: (p: Project, name: string) => void;
}

/** Lista projektów: przesunięcie wiersza w bok usuwa projekt (z opcją Cofnij), menu „⋯” – nazwa, kopia, usuwanie */
export function ProjectList({ projects, onSelect, onDelete, onDuplicate, onRename }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);

  return (
    <>
      <ul className="project-list">
        {projects.map((p) =>
          renameId === p.id ? (
            <li key={p.id}>
              <RenameRow
                project={p}
                onDone={(name) => {
                  setRenameId(null);
                  if (name !== null && name.trim() && name.trim() !== p.name) onRename(p, name.trim());
                }}
              />
            </li>
          ) : (
            <SwipeRow
              key={p.id}
              project={p}
              onSelect={() => onSelect(p.id)}
              onDelete={() => onDelete(p)}
              onMenu={() => setMenuId(p.id)}
            />
          ),
        )}
      </ul>
      {projects.length > 0 && <p className="muted small swipe-hint">Przesuń projekt w bok, żeby go usunąć.</p>}
      {menuId && (
        <ProjectMenu
          project={projects.find((p) => p.id === menuId)}
          onClose={() => setMenuId(null)}
          onRename={(p) => setRenameId(p.id)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function SwipeRow({
  project: p,
  onSelect,
  onDelete,
  onMenu,
}: {
  project: Project;
  onSelect: () => void;
  onDelete: () => void;
  onMenu: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const drag = useRef<{ id: number; x: number; y: number; swiping: boolean; width: number } | null>(null);
  /** Po geście blokujemy kliknięcie, które przeglądarka wyśle po puszczeniu palca */
  const suppressClick = useRef(false);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.row-menu')) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, swiping: false, width: e.currentTarget.offsetWidth };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.swiping) {
      if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return;
      if (Math.abs(my) >= Math.abs(mx)) {
        // ruch pionowy – to przewijanie listy
        drag.current = null;
        return;
      }
      d.swiping = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(mx);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.swiping) return;
    suppressClick.current = true;
    const mx = e.clientX - d.x;
    if (Math.abs(mx) > d.width * DELETE_RATIO) {
      setLeaving(mx < 0 ? -1 : 1);
      setTimeout(onDelete, 180);
    } else setDx(0);
  };
  const cancel = () => {
    drag.current = null;
    setDx(0);
  };

  const offset = leaving ? `${leaving * 110}%` : `${dx}px`;
  const armed = drag.current?.swiping && Math.abs(dx) > (drag.current?.width ?? Infinity) * DELETE_RATIO;

  return (
    <li className={`swipe-row ${dx < 0 || leaving < 0 ? 'to-left' : 'to-right'} ${armed || leaving ? 'armed' : ''}`}>
      <div className="swipe-bg" aria-hidden>
        <span>Usuń</span>
      </div>
      <div
        className={`swipe-fg ${dx === 0 || leaving ? 'settle' : ''}`}
        style={{ transform: `translateX(${offset})` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        <button
          className="row-main"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onSelect();
          }}
        >
          <strong>{p.name}</strong>
          <span className="muted small">
            {p.walls.length} ścian · {p.ceilings.length} sufitów · {new Date(p.updatedAt).toLocaleDateString('pl-PL')}
          </span>
        </button>
        <button className="icon-btn row-menu" aria-label={`Opcje projektu ${p.name}`} onClick={onMenu}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <circle cx="5" cy="12" r="2" fill="currentColor" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <circle cx="19" cy="12" r="2" fill="currentColor" />
          </svg>
        </button>
      </div>
    </li>
  );
}

function RenameRow({ project, onDone }: { project: Project; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(project.name);
  return (
    <form
      className="rename-row"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(name);
      }}
    >
      <input
        autoFocus
        aria-label="Nazwa projektu"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => e.key === 'Escape' && onDone(null)}
      />
      <button className="btn primary small" type="submit">
        Zapisz
      </button>
      <button className="btn ghost small" type="button" onClick={() => onDone(null)}>
        Anuluj
      </button>
    </form>
  );
}

function ProjectMenu({
  project,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project | undefined;
  onClose: () => void;
  onRename: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  if (!project) return null;
  const act = (fn: (p: Project) => void) => () => {
    onClose();
    fn(project);
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`Opcje projektu ${project.name}`} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">{project.name}</p>
        <button className="btn" onClick={act(onRename)}>
          Zmień nazwę
        </button>
        <button className="btn" onClick={act(onDuplicate)}>
          Duplikuj
        </button>
        <button className="btn danger" onClick={act(onDelete)}>
          Usuń
        </button>
        <button className="btn ghost" onClick={onClose}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

/** Komunikat po usunięciu z przyciskiem Cofnij; znika sam po kilku sekundach */
export function UndoToast({ name, onUndo, onDismiss }: { name: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div className="toast undo-toast" role="status">
      <span>Usunięto „{name}”</span>
      <button className="btn primary small" onClick={onUndo}>
        Cofnij
      </button>
      <button className="btn ghost small" aria-label="Zamknij" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
