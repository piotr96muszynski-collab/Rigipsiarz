import { useMemo } from 'react';
import {
  AUTO,
  COMPOUNDS,
  MAKER_FINISHING,
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
import { MAKER_LABEL, boardById, ceilingSystemById, wallSystemById, type Maker } from '../catalog/rigips';
import { JOINT_KIND_LABEL, defaultTypeId, edgesTotal, type Joint, type JointEdges } from '../calc/joints';
import type { ProjectCalc } from '../calc/materials';
import type { Project } from '../model/types';
import { Warnings } from './SystemSelect';
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

  // producenci systemów użytych w projekcie – do podpowiedzi „wg producenta systemu”
  const makers = useMemo(() => {
    const set = new Set<Maker>();
    for (const w of project.walls) if (w.systemId) set.add(wallSystemById(w.systemId).maker ?? 'rigips');
    for (const c of [...project.ceilings, ...(project.attics ?? [])]) set.add(ceilingSystemById(c.systemId).maker ?? 'rigips');
    return [...set];
  }, [project.walls, project.ceilings, project.attics]);
  const autoHint = (pick: (m: Maker) => string) =>
    (makers.length ? makers : (['rigips', 'knauf', 'norgips', 'siniat'] as Maker[])).map((m) => `${MAKER_LABEL[m]}: ${pick(m)}`).join(' · ');
  const compoundAuto = autoHint((m) => compoundById(MAKER_FINISHING[m].compound).name);
  const tapeAuto = autoHint((m) => tapeById(MAKER_FINISHING[m].tape).name);

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

  return (
    <div className="elements finishing">
      <section className="card">
        <div className="card-head">
          <h3>Spoinowanie (poziom Q1)</h3>
          <small className="muted">Masa i taśma na spoinach płyt, łbach wkrętów, narożnikach i kątach. Gładź (Q2–Q4) nie jest liczona.</small>
        </div>
        <div className="field">
          <label htmlFor="fin-compound">Masa szpachlowa</label>
          <Picker
            id="fin-compound"
            label="Masa szpachlowa"
            value={f.compound}
            mode="sheet"
            options={[
              { value: AUTO, label: 'Wg producenta systemu', hint: compoundAuto },
              ...COMPOUNDS.map((c) => ({
                value: c.id,
                label: c.name,
                hint: `${MAKER_LABEL[c.maker]} · ${fmtNum(c.kgPerM2 + (c.finish?.kgPerM2 ?? 0), 2)} kg/m² · ${c.kind}${c.noTape ? ' · bez taśmy' : ''}`,
              })),
            ]}
            onChange={(v) => setF({ compound: v })}
          />
          <small className="hint">
            {f.compound === AUTO ? `Masa producenta systemu ściany, sufitu lub poddasza – ${compoundAuto}.` : compoundById(f.compound).info}
          </small>
        </div>
        <div className="field">
          <label htmlFor="fin-tape">Taśma spoinowa</label>
          <Picker
            id="fin-tape"
            label="Taśma spoinowa"
            value={f.tape}
            mode="sheet"
            options={[
              { value: AUTO, label: 'Wg producenta systemu', hint: tapeAuto },
              ...TAPES.map((t) => ({ value: t.id, label: t.name, hint: t.info })),
            ]}
            onChange={(v) => setF({ tape: v })}
          />
          <small className="hint">
            {f.tape === AUTO ? `Taśma producenta systemu – ${tapeAuto}.` : tapeById(f.tape).info}
          </small>
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
            <Picker
              id={`fin-${r.key}`}
              label={r.label}
              value={f[r.key]}
              mode="sheet"
              options={cornerTypesFor(r.use).map((t) => ({ value: t.id, label: t.name, hint: t.info }))}
              onChange={(v) => setF({ [r.key]: v })}
            />
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
