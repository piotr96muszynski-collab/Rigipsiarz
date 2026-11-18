import { useMemo } from 'react';
import {
  COMPOUNDS,
  EDGE_LABEL,
  Q1_STEPS,
  TAPES,
  boardEdge,
  compoundById,
  cornerTypeById,
  cornerTypesFor,
  resolveFinishing,
  tapeById,
  type EdgeUse,
  type FinishingSettings,
} from '../catalog/finishing';
import { boardById } from '../catalog/rigips';
import { JOINT_KIND_LABEL, defaultTypeId, edgesTotal, type Joint, type JointEdges } from '../calc/joints';
import type { ProjectCalc } from '../calc/materials';
import type { Project } from '../model/types';
import { Warnings } from './SystemSelect';
import { fmtNum } from './wallStyle';

interface Props {
  project: Project;
  calc: ProjectCalc;
  update: (fn: (d: Project) => void) => void;
}

const DEFAULT_ROWS: { key: keyof FinishingSettings; label: string; use: EdgeUse; hint?: string }[] = [
  { key: 'external', label: 'Krawędzie zewnętrzne (narożniki 90°)', use: 'external' },
  { key: 'externalOdd', label: 'Krawędzie zewnętrzne pod kątem nietypowym', use: 'external' },
  { key: 'opening', label: 'Ościeża drzwi i okien', use: 'external' },
  { key: 'internal', label: 'Kąty wewnętrzne (L, T, X)', use: 'internal' },
  { key: 'internalOdd', label: 'Kąty wewnętrzne pod kątem nietypowym', use: 'internal' },
  { key: 'masonry', label: 'Styk z istniejącą ścianą (mur)', use: 'contact' },
  { key: 'slab', label: 'Styk ściany ze stropem', use: 'contact' },
  { key: 'ceilingEdge', label: 'Obwód sufitu przy ścianach', use: 'contact' },
];

const GROUPS: { title: string; kinds: Joint['kind'][] }[] = [
  { title: 'Połączenia ścian', kinds: ['L', 'T', 'X'] },
  { title: 'Końce ścian', kinds: ['masonry', 'free'] },
  { title: 'Otwory', kinds: ['opening'] },
  { title: 'Strop i sufity', kinds: ['slab', 'ceiling'] },
];

export function FinishingPanel({ project, calc, update }: Props) {
  const f = resolveFinishing(project.settings.finishing);
  const setF = (patch: Partial<FinishingSettings>) =>
    update((d) => void (d.settings.finishing = { ...d.settings.finishing, ...patch }));

  const wallNo = useMemo(() => new Map(project.walls.map((w, i) => [w.id, i + 1])), [project.walls]);
  const ceilNo = useMemo(() => new Map(project.ceilings.map((c, i) => [c.id, i + 1])), [project.ceilings]);
  const openingOf = useMemo(() => {
    const m = new Map<string, { wall: number; label: string }>();
    project.walls.forEach((w, i) =>
      w.openings.forEach((o, k) => m.set(o.id, { wall: i + 1, label: `${o.kind === 'door' ? 'Drzwi' : 'Okno'} ${k + 1}` })),
    );
    return m;
  }, [project.walls]);

  const boards = [...new Set([...project.walls.map((w) => w.boardId), ...project.ceilings.map((c) => c.boardId)])].map(boardById);

  const title = (j: Joint) => {
    const walls = j.wallIds.map((id) => wallNo.get(id)).filter(Boolean);
    if (j.kind === 'opening') {
      const o = openingOf.get(j.id.slice(3));
      return `${o?.label ?? 'Otwór'} · ściana ${o?.wall ?? '?'}`;
    }
    if (j.kind === 'ceiling') return `Sufit ${ceilNo.get(j.ceilingId!) ?? ''} · obwód`;
    const base = JOINT_KIND_LABEL[j.kind];
    const end = j.id.startsWith('e:') ? ` (koniec ${j.id.endsWith(':a') ? 'A' : 'B'})` : '';
    const ang = j.kind === 'L' && j.angleDeg ? ` ${Math.round(j.angleDeg)}°` : '';
    return `${base}${ang} · ściana ${walls.join(' + ')}${end}`;
  };

  const setOverride = (id: string, which: 'outer' | 'inner', value: string) =>
    update((d) => {
      const all = { ...d.jointFinish };
      const cur = { ...all[id] };
      if (value) cur[which] = value;
      else delete cur[which];
      if (cur.outer || cur.inner) all[id] = cur;
      else delete all[id];
      d.jointFinish = all;
    });

  const edgeSelect = (j: Joint, which: 'outer' | 'inner', e: JointEdges) => {
    const label =
      e.use === 'external' ? 'Krawędzie zewnętrzne' : e.use === 'internal' ? 'Kąty wewnętrzne' : 'Wykończenie styku';
    const def = cornerTypeById(defaultTypeId(f, j.kind, e.use, e.odd));
    const chosen = project.jointFinish?.[j.id]?.[which] ?? '';
    return (
      <div className="field">
        <label>
          {label} · {e.lengths.length} × {fmtNum(e.lengths[0], 2)} m{e.lengths.length > 1 && new Set(e.lengths).size > 1 ? ' i in.' : ''} ={' '}
          {fmtNum(edgesTotal(e), 2)} mb
        </label>
        <select value={e.isDefault ? '' : chosen} onChange={(ev) => setOverride(j.id, which, ev.target.value)}>
          <option value="">Domyślnie: {def?.name}</option>
          {cornerTypesFor(e.use).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {e.odd && !t.anyAngle ? ' (tylko 90°)' : ''}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="elements finishing">
      <section className="card">
        <div className="card-head">
          <h3>Spoinowanie (poziom Q1)</h3>
          <small className="muted">Masa i taśma na spoinach płyt, łbach wkrętów, narożnikach i kątach. Gładź (Q2–Q4) nie jest liczona.</small>
        </div>
        <div className="field">
          <label htmlFor="fin-compound">Masa szpachlowa</label>
          <select id="fin-compound" value={f.compound} onChange={(e) => setF({ compound: e.target.value })}>
            {COMPOUNDS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} – {fmtNum(c.kgPerM2, 2)} kg/m² ({c.kind})
              </option>
            ))}
          </select>
          <small className="hint">{compoundById(f.compound).info}</small>
        </div>
        <div className="field">
          <label htmlFor="fin-tape">Taśma spoinowa</label>
          <select id="fin-tape" value={f.tape} onChange={(e) => setF({ tape: e.target.value as FinishingSettings['tape'] })}>
            {TAPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <small className="hint">{tapeById(f.tape).info}</small>
        </div>
        {boards.length > 0 && (
          <div className="field">
            <span className="label">Krawędzie płyt w projekcie</span>
            <ul className="plain-list">
              {boards.map((b) => (
                <li key={b.id}>
                  <strong>{b.short}</strong> – {EDGE_LABEL[boardEdge(b)]}
                  {b.kind === 'cement' ? ' · spoinowanie masą i taśmą Aquaroc' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        <details>
          <summary>Technologia Q1 krok po kroku</summary>
          <ol className="plain-list">
            {Q1_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Wykończenie domyślne</h3>
          <small className="muted">Dotyczy wszystkich połączeń bez własnego wyboru poniżej.</small>
        </div>
        {DEFAULT_ROWS.map((r) => (
          <div className="field" key={r.key}>
            <label htmlFor={`fin-${r.key}`}>{r.label}</label>
            <select id={`fin-${r.key}`} value={f[r.key]} onChange={(e) => setF({ [r.key]: e.target.value })}>
              {cornerTypesFor(r.use).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <small className="hint">{cornerTypeById(f[r.key])?.info}</small>
          </div>
        ))}
      </section>

      {calc.joints.length === 0 && <p className="muted">Dodaj ściany lub sufity, żeby zobaczyć ich połączenia.</p>}
      {GROUPS.map((g) => {
        const list = calc.joints.filter((j) => g.kinds.includes(j.kind));
        if (!list.length) return null;
        return (
          <section className="card" key={g.title}>
            <h3>{g.title}</h3>
            {list.map((j) => (
              <div className="opening joint" key={j.id}>
                <strong>{title(j)}</strong>
                {j.frame.length > 0 && (
                  <ul className="plain-list small muted">
                    {j.frame.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {j.outer && j.outer.lengths.length > 0 && edgeSelect(j, 'outer', j.outer)}
                {j.inner && j.inner.lengths.length > 0 && edgeSelect(j, 'inner', j.inner)}
                <Warnings items={j.warnings} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
