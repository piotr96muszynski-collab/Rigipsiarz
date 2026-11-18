import { useEffect, useRef, useState } from 'react';
import { BOARDS, ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { CeilingSystemSelect, Warnings, WallSystemSelect } from './SystemSelect';
import { CEILING_WOOL_OPTIONS, ceilingInsulation, wallInsulation, wallWoolOptions, type ProjectCalc } from '../calc/materials';
import { bbox, dist, wallEnds } from '../geometry/geometry';
import { createCeiling, createOpening } from '../model/factory';
import { addWall, deleteWall, setWallLength } from '../model/ops';
import type { Ceiling, Opening, Project, Wall } from '../model/types';
import { DimInput } from './DimInput';
import { WoolField } from './WoolField';
import { fmtNum } from './wallStyle';

interface Props {
  project: Project;
  calc: ProjectCalc;
  update: (fn: (d: Project) => void) => void;
}

const JUNCTION_LABEL: Record<string, string> = {
  free: 'wolny koniec',
  'existing-wall': 'przy istniejącej ścianie',
  corner: 'narożnik',
  inline: 'przedłużenie',
  'tee-through': 'trójnik',
  'tee-abut': 'dochodzi do ściany',
  cross: 'skrzyżowanie',
};

export function ElementsPanel({ project, calc, update }: Props) {
  const count = project.walls.length + project.ceilings.length;
  const nextY = () => {
    const pts = [...project.nodes, ...project.ceilings.flatMap((c) => c.points)];
    return pts.length ? bbox(pts).maxY + 100 : 0;
  };
  return (
    <div className="elements">
      {project.walls.map((w, i) => (
        <WallCard key={w.id} index={i + 1} wall={w} project={project} calc={calc} update={update} startOpen={count <= 2} />
      ))}
      {project.ceilings.map((c, i) => (
        <CeilingCard key={c.id} index={i + 1} ceiling={c} wool={project.settings.wool} calc={calc} update={update} startOpen={count <= 2} />
      ))}
      <div className="actions wrap">
        <button
          className="btn"
          onClick={() =>
            update((d) => {
              const y = nextY();
              addWall(d, { x: 0, y }, { x: 300, y });
            })
          }
        >
          + Ściana
        </button>
        <button
          className="btn"
          onClick={() =>
            update((d) => {
              const y = nextY();
              d.ceilings.push(
                createCeiling(d, [
                  { x: 0, y },
                  { x: 400, y },
                  { x: 400, y: y + 300 },
                  { x: 0, y: y + 300 },
                ]),
              );
            })
          }
        >
          + Sufit
        </button>
      </div>
    </div>
  );
}

function WallCard({ wall, index, project, calc, update, startOpen }: { wall: Wall; index: number; startOpen: boolean } & Props) {
  const [open, setOpen] = useState(startOpen);
  const L = dist(...wallEnds(project, wall));
  const sys = wallSystemById(wall.systemId);

  return (
    <article className="card element">
      <header className="element-head">
        <button className="element-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron open={open} />
          <span>
            <h3>Ściana {index}</h3>
            <span className="muted small">
              {fmtNum(L / 100)} × {fmtNum(wall.height / 100)} m · {sys.name}
              {wall.openings.length ? ` · otwory: ${wall.openings.length}` : ''}
            </span>
          </span>
        </button>
        <button className="btn ghost small danger" onClick={() => update((d) => deleteWall(d, wall.id))}>
          Usuń
        </button>
      </header>
      {open && <WallEditor wall={wall} project={project} calc={calc} update={update} />}
    </article>
  );
}

/** Edytor ściany – używany w karcie elementu i w inspektorze planu */
export function WallEditor({
  wall,
  project,
  calc,
  update,
  activeOpeningId,
}: {
  wall: Wall;
  activeOpeningId?: string;
} & Props) {
  const L = dist(...wallEnds(project, wall));
  const sys = wallSystemById(wall.systemId);
  const info = calc.walls.get(wall.id)?.info;
  const edit = (fn: (w: Wall, d: Project) => void) =>
    update((d) => {
      const w = d.walls.find((x) => x.id === wall.id);
      if (w) fn(w, d);
    });
  const editOpening = (id: string, fn: (o: Opening) => void) =>
    edit((w) => {
      const o = w.openings.find((x) => x.id === id);
      if (o) fn(o);
    });

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeOpeningId) return;
    root.current?.querySelector(`[data-opening="${activeOpeningId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeOpeningId]);

  return (
    <div className="editor" ref={root}>
      <div className="grid-3">
        <DimInput label="Długość" unit="m" value={L} min={10} onChange={(v) => edit((w, d) => setWallLength(d, w, v))} />
        <DimInput label="Wysokość" unit="m" value={wall.height} min={30} max={1000} onChange={(v) => edit((w) => void (w.height = v))} />
        <div className="field">
          <label htmlFor={`sp-${wall.id}`}>{sys.frame === 'point-fix' ? 'Rozstaw łączników' : 'Rozstaw CW'}</label>
          <select
            id={`sp-${wall.id}`}
            value={wall.studSpacing}
            onChange={(e) => edit((w) => void (w.studSpacing = Number(e.target.value) as Wall['studSpacing']))}
          >
            <option value={60}>60 cm</option>
            <option value={40}>40 cm (płytki)</option>
            <option value={30}>30 cm</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor={`sys-${wall.id}`}>System</label>
          <WallSystemSelect
            id={`sys-${wall.id}`}
            value={wall.systemId}
            onChange={(id) =>
              edit((w) => {
                const s = wallSystemById(id);
                w.systemId = s.id;
                w.boardId = s.defaultBoard;
                w.studSpacing = s.studSpacing;
                w.insulation = s.insulationDefault;
              })
            }
          />
          <small className="hint">{sys.info}</small>
        </div>
        <div className="field">
          <label htmlFor={`bd-${wall.id}`}>Płyta</label>
          <select id={`bd-${wall.id}`} value={wall.boardId} onChange={(e) => edit((w) => void (w.boardId = e.target.value))}>
            {BOARDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Warnings items={info?.warnings} />

      <WoolField
        id={`wool-${wall.id}`}
        enabled={wall.insulation}
        thickness={wallInsulation({ ...wall, insulation: true }, sys)?.thickness ?? 0}
        options={wallWoolOptions(sys)}
        layers={sys.frame === 'double' ? 2 : 1}
        areaM2={info?.netAreaM2}
        wool={project.settings.wool}
        onToggle={(on) => edit((w) => void (w.insulation = on))}
        onThickness={(mm) => edit((w) => void (w.insulationThickness = mm))}
      />

      {info && (
        <div className="ends">
          {(['A', 'B'] as const).map((k) => {
            const kind = k === 'A' ? info.junctions.endA : info.junctions.endB;
            const editable = kind === 'free' || kind === 'existing-wall';
            return (
              <div key={k} className="end">
                <span className="muted small">Koniec {k}</span>
                {editable ? (
                  <select
                    value={kind}
                    onChange={(e) =>
                      edit((w) => {
                        const v = e.target.value as Wall['endA'];
                        if (k === 'A') w.endA = v;
                        else w.endB = v;
                      })
                    }
                    aria-label={`Koniec ${k}`}
                  >
                    <option value="existing-wall">przy istniejącej ścianie</option>
                    <option value="free">wolny koniec</option>
                  </select>
                ) : (
                  <span className="tag">{JUNCTION_LABEL[kind]}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="openings">
        {wall.openings.map((o, i) => (
          <div key={o.id} className={`opening ${o.id === activeOpeningId ? 'active' : ''}`} data-opening={o.id}>
            <div className="opening-head">
              <strong>
                {o.kind === 'door' ? 'Drzwi' : 'Okno'} {i + 1}
              </strong>
              <button className="btn ghost small danger" onClick={() => edit((w) => void (w.openings = w.openings.filter((x) => x.id !== o.id)))}>
                Usuń
              </button>
            </div>
            <div className="grid-4">
              <DimInput label="Szerokość" value={o.width} min={20} max={L} onChange={(v) => editOpening(o.id, (x) => void (x.width = v))} />
              <DimInput label="Wysokość" value={o.height} min={20} max={wall.height} onChange={(v) => editOpening(o.id, (x) => void (x.height = v))} />
              {o.kind === 'window' && (
                <DimInput label="Parapet" value={o.sill} min={0} max={wall.height} onChange={(v) => editOpening(o.id, (x) => void (x.sill = v))} />
              )}
              <DimInput label="Od początku" value={o.offset} min={0} max={L} onChange={(v) => editOpening(o.id, (x) => void (x.offset = v))} />
            </div>
            <label className="check">
              <input type="checkbox" checked={o.reinforced} onChange={(e) => editOpening(o.id, (x) => void (x.reinforced = e.target.checked))} />
              Ościeże z profili UA (ciężkie drzwi)
            </label>
          </div>
        ))}
        <div className="actions wrap">
          <button className="btn small" onClick={() => edit((w) => void w.openings.push(createOpening('door', Math.max(0, L / 2 - 45))))}>
            + Drzwi
          </button>
          <button className="btn small" onClick={() => edit((w) => void w.openings.push(createOpening('window', Math.max(0, L / 2 - 60))))}>
            + Okno
          </button>
        </div>
      </div>
    </div>
  );
}

function isAxisRect(c: Ceiling) {
  if (c.points.length !== 4) return false;
  const b = bbox(c.points);
  return c.points.every((p) => (p.x === b.minX || p.x === b.maxX) && (p.y === b.minY || p.y === b.maxY));
}

function CeilingCard({
  ceiling,
  index,
  wool,
  calc,
  update,
  startOpen,
}: {
  ceiling: Ceiling;
  index: number;
  wool: Project['settings']['wool'];
  calc: ProjectCalc;
  update: Props['update'];
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const sys = ceilingSystemById(ceiling.systemId);
  const r = calc.ceilings.get(ceiling.id);

  return (
    <article className="card element">
      <header className="element-head">
        <button className="element-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron open={open} />
          <span>
            <h3>Sufit {index}</h3>
            <span className="muted small">
              {r ? `${fmtNum(r.areaM2)} m² · obwód ${fmtNum(r.perimeterM)} m · ` : ''}
              {sys.name}
            </span>
          </span>
        </button>
        <button className="btn ghost small danger" onClick={() => update((d) => void (d.ceilings = d.ceilings.filter((x) => x.id !== ceiling.id)))}>
          Usuń
        </button>
      </header>
      {open && <CeilingEditor ceiling={ceiling} wool={wool} calc={calc} update={update} />}
    </article>
  );
}

/** Edytor sufitu – używany w karcie elementu i w inspektorze planu */
export function CeilingEditor({
  ceiling,
  wool,
  calc,
  update,
}: {
  ceiling: Ceiling;
  wool?: Project['settings']['wool'];
  calc: ProjectCalc;
  update: Props['update'];
}) {
  const sys = ceilingSystemById(ceiling.systemId);
  const r = calc.ceilings.get(ceiling.id);
  const rect = isAxisRect(ceiling);
  const b = bbox(ceiling.points);
  const edit = (fn: (c: Ceiling) => void) =>
    update((d) => {
      const c = d.ceilings.find((x) => x.id === ceiling.id);
      if (c) fn(c);
    });
  const resize = (w: number, h: number) =>
    edit((c) => {
      c.points = [
        { x: b.minX, y: b.minY },
        { x: b.minX + w, y: b.minY },
        { x: b.minX + w, y: b.minY + h },
        { x: b.minX, y: b.minY + h },
      ];
    });

  return (
    <div className="editor">
      {rect && (
        <div className="grid-3">
          <DimInput label="Długość" unit="m" value={b.maxX - b.minX} min={20} onChange={(v) => resize(v, b.maxY - b.minY)} />
          <DimInput label="Szerokość" unit="m" value={b.maxY - b.minY} min={20} onChange={(v) => resize(b.maxX - b.minX, v)} />
          <DimInput label="Wysokość" unit="m" value={ceiling.height} min={50} max={1000} onChange={(v) => edit((c) => void (c.height = v))} />
        </div>
      )}
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`cs-${ceiling.id}`}>System</label>
          <CeilingSystemSelect
            id={`cs-${ceiling.id}`}
            value={ceiling.systemId}
            onChange={(id) =>
              edit((c) => {
                const s = ceilingSystemById(id);
                c.systemId = s.id;
                c.boardId = s.defaultBoard;
              })
            }
          />
          <small className="hint">{sys.info}</small>
        </div>
        <div className="field">
          <label htmlFor={`cb-${ceiling.id}`}>Płyta</label>
          <select id={`cb-${ceiling.id}`} value={ceiling.boardId} onChange={(e) => edit((c) => void (c.boardId = e.target.value))}>
            {BOARDS.map((bd) => (
              <option key={bd.id} value={bd.id}>
                {bd.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Warnings items={r?.warnings} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`cd-${ceiling.id}`}>{sys.kind === 'cw-span' || sys.kind === 'ua-span' ? 'Profile przęsłowe biegną' : 'Profile nośne biegną'}</label>
          <select id={`cd-${ceiling.id}`} value={ceiling.direction} onChange={(e) => edit((c) => void (c.direction = Number(e.target.value) as 0 | 90))}>
            <option value={0}>wzdłuż długości</option>
            <option value={90}>wzdłuż szerokości</option>
          </select>
        </div>
      </div>
      <WoolField
        id={`wool-${ceiling.id}`}
        enabled={ceiling.insulation}
        thickness={ceilingInsulation({ ...ceiling, insulation: true })?.thickness ?? 100}
        options={CEILING_WOOL_OPTIONS}
        layers={1}
        areaM2={r?.areaM2}
        wool={wool}
        onToggle={(on) => edit((c) => void (c.insulation = on))}
        onThickness={(mm) => edit((c) => void (c.insulationThickness = mm))}
      />
      {!rect && <small className="hint">Kształt sufitu zmienisz na planie, przeciągając jego narożniki.</small>}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`chevron ${open ? 'open' : ''}`} aria-hidden>
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
