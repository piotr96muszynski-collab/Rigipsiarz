import { useMemo } from 'react';
import {
  COMPOUNDS,
  DEFAULT_FINISHING,
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
import { InfoTip } from './InfoTip';
import { Picker } from './Picker';
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
      const o = openingOf.get(j.id.split(':').pop()!);
      return `${o?.label ?? 'Otwór'} · ściana ${o?.wall ?? '?'}`;
    }
    if (j.kind === 'ceiling') return `Sufit ${ceilNo.get(j.ceilingId!) ?? ''} · obwód`;
    const base = JOINT_KIND_LABEL[j.kind];
    const end = j.id.startsWith('e:')
      ? ` (koniec ${j.id.endsWith(':a') ? 'A' : 'B'})`
      : j.id.startsWith('lin:') || /^top:.+:-?1$/.test(j.id)
        ? ' (okładzina)'
        : '';
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
        <Picker
          label={label}
          value={e.isDefault ? '' : chosen}
          mode="sheet"
          options={[
            { value: '', label: `Domyślnie: ${def?.name ?? ''}`, hint: 'Jak w wykończeniu domyślnym projektu' },
            ...cornerTypesFor(e.use).map((t) => ({
              value: t.id,
              label: `${t.name}${e.odd && !t.anyAngle ? ' (tylko 90°)' : ''}`,
              hint: t.info,
            })),
          ]}
          onChange={(v) => setOverride(j.id, which, v)}
        />
      </div>
    );
  };

  /** Ile pozycji wykończenia domyślnego różni się od ustawień fabrycznych */
  const changedDefaults = DEFAULT_ROWS.filter((r) => f[r.key] !== DEFAULT_FINISHING[r.key]).length;
  const ownChoices = (list: Joint[]) =>
    list.filter((j) => [j.outer, j.inner].some((e) => e && e.lengths.length > 0 && !e.isDefault)).length;

  return (
    <div className="elements finishing">
      <section className="card">
        <div className="label-row">
          <h3>Spoinowanie (poziom Q1)</h3>
          <InfoTip label="Spoinowanie Q1">
            Masa i taśma na spoinach płyt, łbach wkrętów, narożnikach i kątach. Gładź (Q2–Q4) nie jest liczona.
          </InfoTip>
        </div>
        <div className="fin-grid">
          <div className="field">
            <div className="label-row">
              <label htmlFor="fin-compound">Masa szpachlowa</label>
              <InfoTip label="Masa szpachlowa">{compoundById(f.compound).info}</InfoTip>
            </div>
            <Picker
              id="fin-compound"
              label="Masa szpachlowa"
              value={f.compound}
              mode="sheet"
              options={COMPOUNDS.map((c) => ({ value: c.id, label: c.name, hint: `${fmtNum(c.kgPerM2, 2)} kg/m² · ${c.kind}` }))}
              onChange={(v) => setF({ compound: v })}
            />
          </div>
          <div className="field">
            <div className="label-row">
              <label htmlFor="fin-tape">Taśma spoinowa</label>
              <InfoTip label="Taśma spoinowa">{tapeById(f.tape).info}</InfoTip>
            </div>
            <Picker
              id="fin-tape"
              label="Taśma spoinowa"
              value={f.tape}
              mode="sheet"
              options={TAPES.map((t) => ({ value: t.id, label: t.name, hint: t.info }))}
              onChange={(v) => setF({ tape: v })}
            />
          </div>
        </div>
        <details className="fin-more">
          <summary>{boards.length > 0 ? 'Krawędzie płyt i technologia Q1' : 'Technologia Q1 krok po kroku'}</summary>
          {boards.length > 0 && (
            <ul className="plain-list">
              {boards.map((b) => (
                <li key={b.id}>
                  <strong>{b.short}</strong> – {EDGE_LABEL[boardEdge(b)]}
                  {b.kind === 'cement' ? ' · spoinowanie masą i taśmą Aquaroc' : ''}
                </li>
              ))}
            </ul>
          )}
          <ol className="plain-list">
            {Q1_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      </section>

      <details className="card fin-section">
        <summary>
          <span className="fin-sum-title">Wykończenie domyślne</span>
          <span className="fin-sum-meta">
            {changedDefaults ? <span className="badge">zmienione: {changedDefaults}</span> : <span className="muted">fabryczne</span>}
          </span>
        </summary>
        <p className="muted small">Dotyczy wszystkich połączeń bez własnego wyboru poniżej.</p>
        <div className="fin-grid">
          {DEFAULT_ROWS.map((r) => (
            <div className="field" key={r.key}>
              <div className="label-row">
                <label htmlFor={`fin-${r.key}`}>{r.label}</label>
                <InfoTip label={r.label}>{cornerTypeById(f[r.key])?.info}</InfoTip>
              </div>
              <Picker
                id={`fin-${r.key}`}
                label={r.label}
                value={f[r.key]}
                mode="sheet"
                options={cornerTypesFor(r.use).map((t) => ({ value: t.id, label: t.name, hint: t.info }))}
                onChange={(v) => setF({ [r.key]: v })}
              />
            </div>
          ))}
        </div>
      </details>

      {calc.joints.length === 0 && <p className="muted">Dodaj ściany lub sufity, żeby zobaczyć ich połączenia.</p>}
      {GROUPS.map((g) => {
        const list = calc.joints.filter((j) => g.kinds.includes(j.kind));
        if (!list.length) return null;
        const own = ownChoices(list);
        const warn = list.reduce((n, j) => n + j.warnings.length, 0);
        return (
          <details className="card fin-section" key={g.title} open={warn > 0 || undefined}>
            <summary>
              <span className="fin-sum-title">
                {g.title} <span className="muted">· {list.length}</span>
              </span>
              <span className="fin-sum-meta">
                {own > 0 && <span className="badge">własne: {own}</span>}
                {warn > 0 && <span className="badge warn">uwagi: {warn}</span>}
              </span>
            </summary>
            {list.map((j) => (
              <div className="opening joint" key={j.id}>
                <div className="label-row">
                  <strong>{title(j)}</strong>
                  {j.frame.length > 0 && (
                    <InfoTip label={`Konstrukcja: ${title(j)}`}>
                      <ul className="plain-list small">
                        {j.frame.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </InfoTip>
                  )}
                </div>
                {j.outer && j.outer.lengths.length > 0 && edgeSelect(j, 'outer', j.outer)}
                {j.inner && j.inner.lengths.length > 0 && edgeSelect(j, 'inner', j.inner)}
                <Warnings items={j.warnings} />
              </div>
            ))}
          </details>
        );
      })}
    </div>
  );
}
