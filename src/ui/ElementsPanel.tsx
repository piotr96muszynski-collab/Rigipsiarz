import { useEffect, useRef, useState } from 'react';
import { BOARDS, ceilingSystemById, isHungCeiling, wallSystemById } from '../catalog/rigips';
import { CeilingSystemSelect, LiningSystemSelect, Warnings, WallSystemSelect } from './SystemSelect';
import {
  CEILING_WOOL_OPTIONS,
  ceilingInsulation,
  liningKey,
  wallInsulation,
  wallWoolOptions,
  type LiningResult,
  type ProjectCalc,
} from '../calc/materials';
import { bbox, dist, interiorSide, isNewWall, wallEnds } from '../geometry/geometry';
import { createAttic, createCeiling, createLining, createOpening, fitCeilingHeight } from '../model/factory';
import { AtticEditor } from './AtticEditor';
import { freeAtticSpot } from '../calc/atticPlan';
import { ceilingLevels, ceilingSlab, maxCeilingHeight } from '../calc/ceilingLevels';
import { addWall, applyWallChoice, deleteWall, setWallLength, setWallSystem } from '../model/ops';
import { WallVariantInfo } from './VariantInfo';
import type { Attic, Ceiling, Lining, Opening, Project, Wall } from '../model/types';
import { DimInput } from './DimInput';
import { Picker, type PickOption } from './Picker';
import { VaporField, WoolField } from './WoolField';
import { ceilingVaporSpec, vaporBarrierOn, wallVaporSpec } from '../calc/vaporBarrier';
import { fmtNum } from './wallStyle';
import { InfoLine, MoreOptions } from './MoreOptions';
import { ceilingMoreSummary, openingSummary, wallMoreSummary } from './moreSummary';

interface Props {
  project: Project;
  calc: ProjectCalc;
  update: (fn: (d: Project) => void) => void;
}

const JUNCTION_LABEL: Record<string, string> = {
  free: 'wolny koniec',
  'existing-wall': 'przy murze',
  corner: 'narożnik',
  inline: 'przedłużenie',
  'tee-through': 'trójnik',
  'tee-abut': 'dochodzi do ściany',
  cross: 'skrzyżowanie',
};

export const SPACING_OPTIONS: PickOption<Wall['studSpacing']>[] = [
  { value: 60, label: '60 cm' },
  { value: 40, label: '40 cm', hint: 'pod płytki' },
  { value: 30, label: '30 cm' },
];
const END_OPTIONS: PickOption<Wall['endA']>[] = [
  { value: 'existing-wall', label: 'przy murze' },
  { value: 'free', label: 'wolny' },
];
const DIRECTION_OPTIONS: PickOption<0 | 90>[] = [
  { value: 0, label: 'wzdłuż długości' },
  { value: 90, label: 'wzdłuż szerokości' },
];
/** Płyty z katalogu – w arkuszu z opisem zastosowania */
export const BOARD_OPTIONS = (): PickOption<string>[] => BOARDS.map((b) => ({ value: b.id, label: b.name, hint: b.description }));

export function ElementsPanel({ project, calc, update }: Props) {
  const attics = project.attics ?? [];
  const count = project.walls.length + project.ceilings.length + attics.length;
  const existing = project.walls.filter((w) => !isNewWall(w));
  const fresh = project.walls.filter(isNewWall);
  const nextY = () => {
    const pts = [...project.nodes, ...project.ceilings.flatMap((c) => c.points)];
    return pts.length ? bbox(pts).maxY + 100 : 0;
  };
  return (
    <div className="elements">
      {existing.length > 0 && <h2 className="side-title">Istniejące ściany (obrys)</h2>}
      {existing.map((w, i) => (
        <ExistingWallCard key={w.id} index={i + 1} wall={w} project={project} calc={calc} update={update} startOpen={count <= 2} />
      ))}
      {existing.length > 0 && fresh.length > 0 && <h2 className="side-title">Nowa zabudowa</h2>}
      {fresh.map((w, i) => (
        <WallCard key={w.id} index={i + 1} wall={w} project={project} calc={calc} update={update} startOpen={count <= 2} />
      ))}
      {project.ceilings.map((c, i) => (
        <CeilingCard key={c.id} index={i + 1} ceiling={c} wool={project.settings.wool} calc={calc} update={update} startOpen={count <= 2} />
      ))}
      {attics.map((a, i) => (
        <AtticCard key={a.id} index={i + 1} attic={a} calc={calc} update={update} startOpen={count <= 2} />
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
        <button className="btn" onClick={() => update((d) => void (d.attics = [...(d.attics ?? []), createAttic({ plan: freeAtticSpot(d) })]))}>
          + Poddasze
        </button>
      </div>
    </div>
  );
}

function AtticCard({ attic, index, calc, update, startOpen }: { attic: Attic; index: number; calc: ProjectCalc; update: Props['update']; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const r = calc.attics.get(attic.id);
  return (
    <article className="card element">
      <header className="element-head">
        <button className="element-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron open={open} />
          <span>
            <h3>Poddasze {index}</h3>
            <span className="muted small">
              {fmtNum(attic.width / 100)} × {fmtNum(attic.length / 100)} m{r ? ` · ${fmtNum(r.areaM2, 1)} m² zabudowy · ` : ' · '}
              {ceilingSystemById(attic.systemId).name}
            </span>
          </span>
        </button>
        <button className="btn ghost small danger" onClick={() => update((d) => void (d.attics = (d.attics ?? []).filter((x) => x.id !== attic.id)))}>
          Usuń
        </button>
      </header>
      {open && (
        <AtticEditor
          attic={attic}
          result={r}
          edit={(fn) =>
            update((d) => {
              const a = d.attics?.find((x) => x.id === attic.id);
              if (a) fn(a);
            })
          }
        />
      )}
    </article>
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
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeOpeningId) return;
    root.current?.querySelector(`[data-opening="${activeOpeningId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeOpeningId]);

  const spacingLabel = sys.frame === 'point-fix' ? 'Rozstaw łączników' : sys.frame === 'cd-lining' || sys.frame === 'hat-lining' ? 'Rozstaw profili' : 'Rozstaw CW';
  const woolOptions = wallWoolOptions(sys);
  const woolMm = wallInsulation({ ...wall, insulation: true }, sys)?.thickness ?? 0;
  const vaporSpec = wallVaporSpec(sys);
  const vaporOn = vaporBarrierOn(wall.vaporBarrier, vaporSpec);
  const endLabel = (kind: string) => JUNCTION_LABEL[kind] ?? kind;
  const variant = (part: 'line' | 'options') => (
    <WallVariantInfo
      part={part}
      idBase={wall.id}
      sys={sys}
      boardId={wall.boardId}
      studSpacing={wall.studSpacing}
      doubleStuds={wall.doubleStuds}
      innerBoardId={wall.innerBoardId}
      heightCm={wall.height}
      onApply={(pick) => edit((w) => applyWallChoice(w, pick))}
      onDouble={(on) =>
        edit((w) => {
          if (on) w.doubleStuds = true;
          else delete w.doubleStuds;
        })
      }
      onInner={(id) => edit((w) => void (w.innerBoardId = id))}
    />
  );
  const summary = wallMoreSummary({
    spacing: wall.studSpacing,
    pointFix: sys.frame === 'point-fix',
    cw: sys.frame === 'single' || sys.frame === 'double' || sys.frame === 'separate',
    doubleStuds: wall.doubleStuds,
    wool: woolOptions.length ? { on: wall.insulation, mm: woolMm } : undefined,
    vapor: vaporSpec.mode === 'none' ? undefined : vaporOn,
    ends: info ? [endLabel(info.junctions.endA), endLabel(info.junctions.endB)] : undefined,
  });

  return (
    <div className="editor" ref={root}>
      <div className="grid-2">
        <DimInput label="Długość" unit="m" value={L} min={10} onChange={(v) => edit((w, d) => setWallLength(d, w, v))} />
        <DimInput label="Wysokość" unit="m" value={wall.height} min={30} max={1000} onChange={(v) => edit((w) => void (w.height = v))} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor={`sys-${wall.id}`}>System</label>
          <WallSystemSelect
            id={`sys-${wall.id}`}
            value={wall.systemId}
            heightCm={wall.height}
            onChange={(id) => edit((w) => setWallSystem(w, id))}
            onPick={(pick) => edit((w) => applyWallChoice(w, pick))}
          />
        </div>
        <div className="field">
          <label htmlFor={`bd-${wall.id}`}>Płyta</label>
          <Picker id={`bd-${wall.id}`} label="Płyta" value={wall.boardId} options={BOARD_OPTIONS()} onChange={(v) => edit((w) => void (w.boardId = v))} />
        </div>
      </div>
      <InfoLine more={sys.info}>{variant('line')}</InfoLine>

      <Warnings items={info?.warnings} />

      <OpeningsEditor wall={wall} L={L} edit={edit} activeOpeningId={activeOpeningId} />

      <MoreOptions kind="wall" summary={summary}>
        <div className="field">
          <label htmlFor={`sp-${wall.id}`}>{spacingLabel}</label>
          <Picker id={`sp-${wall.id}`} label={spacingLabel} value={wall.studSpacing} options={SPACING_OPTIONS} onChange={(v) => edit((w) => void (w.studSpacing = v))} />
        </div>
        {variant('options')}
        <WoolField
          id={`wool-${wall.id}`}
          enabled={wall.insulation}
          thickness={woolMm}
          options={woolOptions}
          layers={sys.frame === 'double' ? 2 : 1}
          areaM2={info?.netAreaM2}
          wool={project.settings.wool}
          onToggle={(on) => edit((w) => void (w.insulation = on))}
          onThickness={(mm) => edit((w) => void (w.insulationThickness = mm))}
        />
        <VaporField spec={vaporSpec} enabled={vaporOn} areaM2={info?.netAreaM2} onToggle={(on) => edit((w) => void (w.vaporBarrier = on))} />

        {info && (
          <div className="ends">
            {(['A', 'B'] as const).map((k) => {
              const kind = k === 'A' ? info.junctions.endA : info.junctions.endB;
              const editable = kind === 'free' || kind === 'existing-wall';
              return (
                <div key={k} className="end">
                  <span className="muted small">Koniec {k}</span>
                  {editable ? (
                    <Picker
                      label={`Koniec ${k}`}
                      value={kind as Wall['endA']}
                      mode="segments"
                      options={END_OPTIONS}
                      onChange={(v) =>
                        edit((w) => {
                          if (k === 'A') w.endA = v;
                          else w.endB = v;
                        })
                      }
                    />
                  ) : (
                    <span className="tag">{endLabel(kind)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MoreOptions>
    </div>
  );
}

/** Lista otworów ściany (nowej albo istniejącej) */
function OpeningsEditor({
  wall,
  L,
  edit,
  activeOpeningId,
}: {
  wall: Wall;
  L: number;
  edit: (fn: (w: Wall, d: Project) => void) => void;
  activeOpeningId?: string;
}) {
  const existing = !isNewWall(wall);
  // rozwinięty otwór: wskazany na planie albo kliknięty / dopiero dodany; reszta to jednolinijkowe wiersze
  const [openId, setOpenId] = useState<string | undefined>(activeOpeningId);
  useEffect(() => {
    if (activeOpeningId) setOpenId(activeOpeningId);
  }, [activeOpeningId]);
  const editOpening = (id: string, fn: (o: Opening) => void) =>
    edit((w) => {
      const o = w.openings.find((x) => x.id === id);
      if (o) fn(o);
    });
  const add = (o: Opening) => {
    setOpenId(o.id);
    edit((w) => void w.openings.push(o));
  };
  return (
    <section className="openings">
      <h4 className="openings-title">Otwory</h4>
      {wall.openings.map((o, i) => {
        const name = `${o.kind === 'door' ? (existing ? 'Drzwi wejściowe' : 'Drzwi') : 'Okno'} ${i + 1}`;
        const isOpen = o.id === openId;
        if (!isOpen)
          return (
            <button key={o.id} type="button" className="opening-row" data-opening={o.id} aria-expanded={false} onClick={() => setOpenId(o.id)}>
              <span>{openingSummary(o, name)}</span>
              <span aria-hidden>›</span>
            </button>
          );
        return (
          <div key={o.id} className={`opening ${o.id === activeOpeningId ? 'active' : ''}`} data-opening={o.id}>
            <div className="opening-head">
              <button type="button" className="opening-toggle" aria-expanded onClick={() => setOpenId(undefined)}>
                <strong>{name}</strong>
              </button>
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
            {!existing && (
              <label className="check">
                <input type="checkbox" checked={o.reinforced} onChange={(e) => editOpening(o.id, (x) => void (x.reinforced = e.target.checked))} />
                Ościeże z profili UA (ciężkie drzwi)
              </label>
            )}
          </div>
        );
      })}
      <div className="actions wrap">
        <button className="btn link small" onClick={() => add(createOpening('door', Math.max(0, L / 2 - 45), existing ? { reinforced: false } : {}))}>
          + Drzwi
        </button>
        <button className="btn link small" onClick={() => add(createOpening('window', Math.max(0, L / 2 - 60)))}>
          + Okno
        </button>
      </div>
    </section>
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
  const woolMm = ceilingInsulation({ ...ceiling, insulation: true })?.thickness ?? 100;
  const vaporSpec = ceilingVaporSpec(sys);
  const vaporOn = vaporBarrierOn(ceiling.vaporBarrier, vaporSpec);
  const summary = ceilingMoreSummary({
    direction: DIRECTION_OPTIONS.find((o) => o.value === ceiling.direction)?.label ?? '',
    wool: { on: ceiling.insulation, mm: woolMm },
    vapor: vaporSpec.mode === 'none' ? undefined : vaporOn,
  });

  return (
    <div className="editor">
      {rect && (
        <div className="grid-2">
          <DimInput label="Długość" unit="m" value={b.maxX - b.minX} min={20} onChange={(v) => resize(v, b.maxY - b.minY)} />
          <DimInput label="Szerokość" unit="m" value={b.maxY - b.minY} min={20} onChange={(v) => resize(b.maxX - b.minX, v)} />
        </div>
      )}
      <CeilingHeights ceiling={ceiling} edit={edit} />
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
                fitCeilingHeight(c);
              })
            }
            spanCm={Math.min(b.maxX - b.minX, b.maxY - b.minY)}
            onPick={(pick) =>
              edit((c) => {
                c.systemId = pick.system.id;
                c.boardId = pick.boardId;
                fitCeilingHeight(c);
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`cb-${ceiling.id}`}>Płyta</label>
          <Picker id={`cb-${ceiling.id}`} label="Płyta" value={ceiling.boardId} options={BOARD_OPTIONS()} onChange={(v) => edit((c) => {
            c.boardId = v;
            fitCeilingHeight(c);
          })} />
        </div>
      </div>
      <InfoLine more={sys.info}>
        <span className="muted small">Opis systemu</span>
      </InfoLine>
      <Warnings items={r?.warnings} />
      {!rect && <small className="hint">Kształt sufitu zmienisz na planie, przeciągając jego narożniki.</small>}
      <MoreOptions kind="ceiling" summary={summary}>
        <div className="field">
          <label htmlFor={`cd-${ceiling.id}`}>{sys.kind === 'cw-span' || sys.kind === 'ua-span' ? 'Profile przęsłowe biegną' : 'Profile nośne biegną'}</label>
          <Picker
            id={`cd-${ceiling.id}`}
            label="Kierunek profili"
            value={ceiling.direction}
            mode="segments"
            options={DIRECTION_OPTIONS}
            onChange={(v) => edit((c) => void (c.direction = v))}
          />
        </div>
        <WoolField
          id={`wool-${ceiling.id}`}
          enabled={ceiling.insulation}
          thickness={woolMm}
          options={CEILING_WOOL_OPTIONS}
          layers={1}
          areaM2={r?.areaM2}
          wool={wool}
          onToggle={(on) => edit((c) => void (c.insulation = on))}
          onThickness={(mm) => edit((c) => void (c.insulationThickness = mm))}
        />
        <VaporField spec={vaporSpec} enabled={vaporOn} areaM2={r?.areaM2} onToggle={(on) => edit((c) => void (c.vaporBarrier = on))} />
      </MoreOptions>
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

function ExistingWallCard({ wall, index, project, calc, update, startOpen }: { wall: Wall; index: number; startOpen: boolean } & Props) {
  const [open, setOpen] = useState(startOpen);
  const L = dist(...wallEnds(project, wall));
  const linings = wall.linings ?? [];
  return (
    <article className="card element existing">
      <header className="element-head">
        <button className="element-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron open={open} />
          <span>
            <h3>Mur {index}</h3>
            <span className="muted small">
              {fmtNum(L / 100)} × {fmtNum(wall.height / 100)} m
              {wall.openings.length ? ` · otwory: ${wall.openings.length}` : ''}
              {linings.length ? ` · okładzina: ${linings.map((l) => wallSystemById(l.systemId).name).join(', ')}` : ' · bez okładziny'}
            </span>
          </span>
        </button>
        <button className="btn ghost small danger" onClick={() => update((d) => deleteWall(d, wall.id))}>
          Usuń
        </button>
      </header>
      {open && <ExistingWallEditor wall={wall} project={project} calc={calc} update={update} />}
    </article>
  );
}

/** Edytor istniejącej ściany: wymiary, otwory i okładziny z płyt */
export function ExistingWallEditor({
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
  const interior = interiorSide(project, wall);
  const edit = (fn: (w: Wall, d: Project) => void) =>
    update((d) => {
      const w = d.walls.find((x) => x.id === wall.id);
      if (w) fn(w, d);
    });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeOpeningId) return;
    root.current?.querySelector(`[data-opening="${activeOpeningId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeOpeningId]);

  // strona pomieszczenia pierwsza; przy ścianie wewnętrznej (pomieszczenia po obu stronach) – strona 1 i 2
  const first: 1 | -1 = interior === -1 ? -1 : 1;
  const sides: { side: 1 | -1; label: string }[] =
    interior === 0
      ? [
          { side: 1, label: 'Okładzina – strona 1' },
          { side: -1, label: 'Okładzina – strona 2' },
        ]
      : [
          { side: first, label: 'Okładzina od strony pomieszczenia' },
          { side: (first * -1) as 1 | -1, label: 'Okładzina od zewnątrz' },
        ];

  return (
    <div className="editor" ref={root}>
      {wall.backing && (
        <p className="small">
          Mur dodany automatycznie, bo okładzina (ATLAS M-System, CD 60 na uchwytach ES, płyta na kleju) zawsze leży na
          istniejącej ścianie. Ustaw jego grubość, a okładzinę zmieniaj poniżej.
        </p>
      )}
      <p className="muted small">
        Istniejąca ściana nie jest liczona w materiałach. Linia na planie to lico od strony pomieszczenia – zmierz ją
        dalmierzem od narożnika do narożnika.
      </p>
      <div className="grid-3">
        <DimInput label="Długość" unit="m" value={L} min={10} onChange={(v) => edit((w, d) => setWallLength(d, w, v))} />
        <DimInput label="Wysokość" unit="m" value={wall.height} min={30} max={1000} onChange={(v) => edit((w) => void (w.height = v))} />
        <DimInput label="Grubość muru" value={wall.thickness ?? 25} min={5} max={100} onChange={(v) => edit((w) => void (w.thickness = v))} />
      </div>

      <OpeningsEditor wall={wall} L={L} edit={edit} activeOpeningId={activeOpeningId} />

      {sides.map(({ side, label }, i) => {
        const lining = (wall.linings ?? []).find((l) => l.side === side);
        if (!lining && i === 1 && interior !== 0)
          return (
            <button
              key={side}
              className="btn ghost small"
              onClick={() => edit((w) => void (w.linings = [...(w.linings ?? []), createLining(side)]))}
            >
              + Okładzina także od zewnątrz
            </button>
          );
        return (
          <LiningEditor
            key={side}
            label={label}
            lining={lining}
            result={calc.linings.get(liningKey(wall.id, side))}
            onToggle={(on) =>
              edit((w) => {
                const rest = (w.linings ?? []).filter((l) => l.side !== side);
                w.linings = on ? [...rest, createLining(side)] : rest;
              })
            }
            onEdit={(fn) =>
              edit((w) => {
                const l = (w.linings ?? []).find((x) => x.side === side);
                if (l) fn(l);
              })
            }
            idBase={`${wall.id}-${side}`}
          />
        );
      })}
    </div>
  );
}

function LiningEditor({
  label,
  lining,
  result,
  onToggle,
  onEdit,
  idBase,
}: {
  label: string;
  lining?: Lining;
  result?: LiningResult;
  onToggle: (on: boolean) => void;
  onEdit: (fn: (l: Lining) => void) => void;
  idBase: string;
}) {
  const sys = lining ? wallSystemById(lining.systemId) : undefined;
  return (
    <section className={`lining ${lining ? 'on' : ''}`}>
      <label className="check lining-toggle">
        <input type="checkbox" checked={!!lining} onChange={(e) => onToggle(e.target.checked)} />
        <strong>{label}</strong>
        {result && <span className="muted small">{fmtNum(result.info.netAreaM2, 1)} m² po odjęciu otworów</span>}
      </label>
      {lining && sys && (
        <>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`ls-${idBase}`}>System okładziny</label>
              <LiningSystemSelect
                id={`ls-${idBase}`}
                value={lining.systemId}
                onChange={(id) =>
                  onEdit((l) => {
                    const s = wallSystemById(id);
                    l.systemId = s.id;
                    l.boardId = s.defaultBoard;
                    l.studSpacing = s.studSpacing;
                    delete l.doubleStuds;
                    delete l.innerBoardId;
                  })
                }
                onPick={(pick) => onEdit((l) => applyWallChoice(l, pick))}
              />
              <small className="hint">{sys.info}</small>
            </div>
            <div className="field">
              <label htmlFor={`lb-${idBase}`}>Płyta</label>
              <Picker id={`lb-${idBase}`} label="Płyta" value={lining.boardId} options={BOARD_OPTIONS()} onChange={(v) => onEdit((l) => void (l.boardId = v))} />
            </div>
          </div>
          {sys.frame !== 'glued' && (
            <div className="grid-2">
              <div className="field">
                <label htmlFor={`lsp-${idBase}`}>Rozstaw profili</label>
                <Picker
                  id={`lsp-${idBase}`}
                  label="Rozstaw profili"
                  value={lining.studSpacing}
                  options={SPACING_OPTIONS}
                  onChange={(v) => onEdit((l) => void (l.studSpacing = v))}
                />
              </div>
              {wallWoolOptions(sys).length > 0 && (
                <label className="check">
                  <input type="checkbox" checked={lining.insulation} onChange={(e) => onEdit((l) => void (l.insulation = e.target.checked))} />
                  Wełna mineralna {wallWoolOptions(sys).at(-1)} mm
                </label>
              )}
            </div>
          )}
          <VaporField
            spec={wallVaporSpec(sys)}
            enabled={vaporBarrierOn(lining.vaporBarrier, wallVaporSpec(sys))}
            areaM2={result?.info.netAreaM2}
            onToggle={(on) => onEdit((l) => void (l.vaporBarrier = on))}
          />
          <Warnings items={result?.info.warnings} />
        </>
      )}
    </section>
  );
}

/**
 * Strop i sufit: dwie wysokości od posadzki. Sufit nie może wejść w minimalną wysokość zabudowy
 * systemu (z karty albo założenie), więc pole sufitu ma górną granicę liczoną ze stropu.
 */
function CeilingHeights({ ceiling, edit }: { ceiling: Ceiling; edit: (fn: (c: Ceiling) => void) => void }) {
  const sys = ceilingSystemById(ceiling.systemId);
  const lv = ceilingLevels(ceiling, sys);
  const slab = ceilingSlab(ceiling);
  const top = maxCeilingHeight(slab, sys, ceiling.boardId);
  const hung = isHungCeiling(sys.kind);
  return (
    <>
      <div className="grid-2">
        <DimInput
          label="Strop (istniejący)"
          unit="m"
          value={slab}
          min={100}
          max={1000}
          onChange={(v) =>
            edit((c) => {
              // pierwsza edycja starego projektu: zachowaj sufit tam, gdzie był
              if (c.slabHeight === undefined) c.height = lv.ceiling;
              c.slabHeight = v;
              fitCeilingHeight(c);
            })
          }
        />
        <DimInput
          label="Sufit (spód płyt)"
          unit="m"
          value={lv.ceiling}
          min={50}
          max={top}
          onChange={(v) =>
            edit((c) => {
              c.slabHeight ??= slab;
              c.height = Math.min(v, top);
            })
          }
        />
      </div>
      <InfoLine
        more={
          <>
            Minimalna wysokość zabudowy: {lv.depth.source}.
            {hung ? ` Zwieszenie od wierzchu rusztu do stropu ${fmtNum(Math.round(lv.hangerGap * 10) / 10)} cm.` : ''}
          </>
        }
      >
        <small className="muted">
          Min. {Math.round(lv.depth.minMm / 10)} cm od stropu · sufit najwyżej {fmtNum(top / 100)} m
        </small>
      </InfoLine>
    </>
  );
}
