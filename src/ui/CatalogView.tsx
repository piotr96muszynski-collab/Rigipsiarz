import { useMemo, useState } from 'react';
import { useBack } from './back';
import {
  BOARDS,
  CEILING_KIND_LABEL,
  WALL_CATEGORY_LABEL,
  WALL_FRAME_LABEL,
  allCeilingSystems,
  allWallSystems,
  boardById,
  ceilingMaxSpan,
  PRODUCTS,
  customSystems,
  type CeilingKind,
  type CeilingSystem,
  type CustomCatalog,
  type HangerType,
  type RefLine,
  type StudSpacing,
  type WallCategory,
  type WallFrame,
  type WallSystem,
} from '../catalog/rigips';
import type { PointFixer } from '../catalog/atlas';
import { REF_CEILING, REF_WALL, ceilingConsumption, wallConsumption, type ConsumptionLine } from '../calc/materials';
import { uid } from '../model/factory';
import { Picker, type PickOption } from './Picker';
import { fmtNum } from './wallStyle';

interface Props {
  onClose: () => void;
  /** Zapisuje listę systemów własnych (IndexedDB) */
  onSave: (c: CustomCatalog) => void;
}

type Tab = 'walls' | 'ceilings' | 'boards';
type Draft = { type: 'wall'; sys: WallSystem } | { type: 'ceiling'; sys: CeilingSystem };

export function CatalogView({ onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>('ceilings');
  const [draft, setDraft] = useState<Draft | null>(null);
  useBack(!!draft, () => setDraft(null));

  const saveWall = (s: WallSystem) => {
    const c = customSystems();
    const walls = c.walls.some((x) => x.id === s.id) ? c.walls.map((x) => (x.id === s.id ? s : x)) : [...c.walls, s];
    onSave({ ...c, walls });
    setDraft(null);
  };
  const saveCeiling = (s: CeilingSystem) => {
    const c = customSystems();
    const ceilings = c.ceilings.some((x) => x.id === s.id)
      ? c.ceilings.map((x) => (x.id === s.id ? s : x))
      : [...c.ceilings, s];
    onSave({ ...c, ceilings });
    setDraft(null);
  };
  const remove = (id: string) => {
    if (!confirm('Usunąć system własny? Elementy, które go używają, przełączą się na system domyślny.')) return;
    const c = customSystems();
    onSave({ walls: c.walls.filter((x) => x.id !== id), ceilings: c.ceilings.filter((x) => x.id !== id) });
  };

  const fromWall = (s: WallSystem, edit = false) =>
    setDraft({
      type: 'wall',
      sys: { ...s, id: edit ? s.id : `U-W-${uid()}`, code: undefined, name: edit ? s.name : `${s.name} – własny`, custom: true, reference: undefined, source: { label: 'System własny użytkownika' } },
    });
  const fromCeiling = (s: CeilingSystem, edit = false) =>
    setDraft({
      type: 'ceiling',
      sys: { ...s, id: edit ? s.id : `U-S-${uid()}`, code: undefined, name: edit ? s.name : `${s.name} – własny`, custom: true, reference: undefined, source: { label: 'System własny użytkownika' } },
    });

  return (
    <div className="catalog">
      <header className="topbar">
        <button className="icon-btn" onClick={draft ? () => setDraft(null) : onClose} aria-label="Wróć">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="topbar-title">{draft ? 'System własny' : 'Katalog systemów Rigips i ATLAS'}</h1>
      </header>

      {draft ? (
        draft.type === 'wall' ? (
          <WallEditor initial={draft.sys} onSave={saveWall} onCancel={() => setDraft(null)} />
        ) : (
          <CeilingEditor initial={draft.sys} onSave={saveCeiling} onCancel={() => setDraft(null)} />
        )
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {(
              [
                ['ceilings', 'Sufity'],
                ['walls', 'Ściany i okładziny'],
                ['boards', 'Płyty'],
              ] as [Tab, string][]
            ).map(([id, l]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {l}
              </button>
            ))}
          </nav>
          <div className="tab-body catalog-body">
            <p className="muted small">
              Zużycie na 1 m² liczy silnik aplikacji na elemencie wzorcowym (ściana {REF_WALL.lengthCm / 100}×{fmtNum(REF_WALL.heightCm / 100)} m,
              sufit {REF_CEILING.lengthCm / 100}×{REF_CEILING.widthCm / 100} m) bez zapasu. Obok podajemy wartości z karty producenta (Rigips, ATLAS), jeśli była dostępna.
              Własny system utworzysz przyciskiem „Na podstawie tego” przy dowolnym systemie.
            </p>
            {tab === 'walls' && <WallList onCopy={fromWall} onEdit={(s) => fromWall(s, true)} onRemove={remove} />}
            {tab === 'ceilings' && <CeilingList onCopy={fromCeiling} onEdit={(s) => fromCeiling(s, true)} onRemove={remove} />}
            {tab === 'boards' && <BoardList />}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listy
// ---------------------------------------------------------------------------

function WallList({ onCopy, onEdit, onRemove }: { onCopy: (s: WallSystem) => void; onEdit: (s: WallSystem) => void; onRemove: (id: string) => void }) {
  const all = allWallSystems();
  const cats = Object.keys(WALL_CATEGORY_LABEL) as WallCategory[];
  const groups: [string, WallSystem[]][] = [
    ...cats.map((c) => [WALL_CATEGORY_LABEL[c], all.filter((s) => s.category === c && !s.custom)] as [string, WallSystem[]]),
    ['Systemy własne', all.filter((s) => s.custom)],
  ];
  return (
    <>
      {groups
        .filter(([, l]) => l.length)
        .map(([g, list]) => (
          <section key={g} className="catalog-group">
            <h2>{g}</h2>
            {list.map((s) => (
              <SystemCard
                key={s.id}
                name={s.name}
                code={s.code}
                custom={s.custom}
                info={s.info}
                params={[
                  ['Ruszt', WALL_FRAME_LABEL[s.frame]],
                  ...(s.frame === 'glued' || s.frame === 'point-fix' ? [] : ([['Profil', s.frame === 'cd-lining' ? 'CD 60 / UD 30' : `CW ${s.profile} / UW ${s.profile}`]] as [string, string][])),
                  ['Płyty', `${s.layers}× ${boardById(s.defaultBoard).name}${s.sides === 2 ? ', obustronnie' : ', jednostronnie'}`],
                  ...(s.frame === 'glued' || s.frame === 'point-fix' ? [] : ([['Rozstaw profili', `${s.studSpacing} cm`]] as [string, string][])),
                  ...(s.frame === 'point-fix'
                    ? ([
                        ['Łącznik', fixerLabel(s.fixer)],
                        ['Siatka łączników', `${s.studSpacing}×${s.pointSpacing ?? 50} cm`],
                      ] as [string, string][])
                    : []),
                  ...(s.bracketSpacing ? ([['Uchwyty ES', `co ${s.bracketSpacing} cm`]] as [string, string][]) : []),
                  ...(s.maxHeight
                    ? ([
                        [
                          'Maks. wysokość',
                          Object.entries(s.maxHeight)
                            .map(([sp, h]) => `${fmtNum(h / 100)} m przy ${sp} cm`)
                            .join(', '),
                        ],
                      ] as [string, string][])
                    : []),
                  ...(s.fire ? ([['Ogień', s.fire]] as [string, string][]) : []),
                  ...(s.acoustic ? ([['Akustyka', s.acoustic]] as [string, string][]) : []),
                ]}
                consumption={() => wallConsumption(s)}
                reference={s.reference}
                source={s.source}
                onCopy={() => onCopy(s)}
                onEdit={s.custom ? () => onEdit(s) : undefined}
                onRemove={s.custom ? () => onRemove(s.id) : undefined}
              />
            ))}
          </section>
        ))}
    </>
  );
}

/** Opis łącznika ATLAS: zestaw, przedłużka i zakres odstępu płyty od podłoża */
function fixerLabel(f: PointFixer | undefined): string {
  if (!f) return 'ATLAS M-SYSTEM 3G L100';
  const ext = f.extension ? ` + ${PRODUCTS[f.extension]?.name.split(' – ')[0] ?? f.extension}` : '';
  return `${PRODUCTS[f.product]?.name.split(' – ')[0] ?? f.product}${ext}, odstęp ${f.standoff[0]}–${f.standoff[1]} mm, zestaw 21 szt. (z kołkami i wkrętami)`;
}

const HANGER_LABEL: Record<HangerType, string> = {
  noniusz: 'wieszaki noniuszowe',
  es: 'uchwyty bezpośrednie ES',
  elastic: 'uchwyty elastyczne',
};

function ceilingParams(s: CeilingSystem): [string, string][] {
  const out: [string, string][] = [['Płyty', `${s.layers}× ${boardById(s.defaultBoard).name}`]];
  if (s.kind === 'two-level' || s.kind === 'one-level') {
    out.push(['Profile nośne CD 60', `co ${s.mainSpacing} cm`]);
    out.push(['Profile montażowe CD 60', `co ${s.secondarySpacing} cm`]);
    out.push(['Wieszaki', `${HANGER_LABEL[s.hangerType ?? 'noniusz']} co ${s.hangerSpacing} cm`]);
  } else if (s.kind === 'direct') {
    out.push(['Profile CD 60', `co ${s.secondarySpacing} cm`]);
    out.push(['Mocowanie', `${HANGER_LABEL[s.hangerType ?? 'es']} co ${s.hangerSpacing} cm`]);
  } else if (s.kind === 'ua-span') {
    out.push(['Profile UA 50', `co ${s.mainSpacing} cm, oparte na ścianach`]);
    out.push(['Profile CD 60', `co ${s.secondarySpacing} cm`]);
  } else if (s.kind === 'point-fix') {
    out.push(['Łącznik', fixerLabel(s.fixer)]);
    out.push(['Siatka łączników', `${s.mainSpacing}×${s.secondarySpacing} cm`]);
  } else {
    out.push([`Profile CW ${s.profile}`, `co ${s.secondarySpacing} cm, w UW przy ścianach`]);
  }
  const span = ceilingMaxSpan(s);
  if (span) out.push(['Maks. rozpiętość', `${fmtNum(span / 100)} m`]);
  if (s.kind !== 'point-fix') out.push(['Wkręty', `zewn. ${fmtNum(s.screwsOuter, 1)} szt./m²${s.layers > 1 ? `, wewn. ${fmtNum(s.screwsInner, 1)} szt./m²` : ''}`]);
  if (s.fire) out.push(['Ogień', s.fire]);
  return out;
}

function CeilingList({ onCopy, onEdit, onRemove }: { onCopy: (s: CeilingSystem) => void; onEdit: (s: CeilingSystem) => void; onRemove: (id: string) => void }) {
  const all = allCeilingSystems();
  const kinds = Object.keys(CEILING_KIND_LABEL) as CeilingKind[];
  const groups: [string, CeilingSystem[]][] = [
    ...kinds.map((k) => [CEILING_KIND_LABEL[k], all.filter((s) => s.kind === k && !s.custom)] as [string, CeilingSystem[]]),
    ['Systemy własne', all.filter((s) => s.custom)],
  ];
  return (
    <>
      {groups
        .filter(([, l]) => l.length)
        .map(([g, list]) => (
          <section key={g} className="catalog-group">
            <h2>{g}</h2>
            {list.map((s) => (
              <SystemCard
                key={s.id}
                name={s.name}
                code={s.code}
                custom={s.custom}
                info={s.info}
                params={ceilingParams(s)}
                consumption={() => ceilingConsumption(s)}
                reference={s.reference}
                source={s.source}
                onCopy={() => onCopy(s)}
                onEdit={s.custom ? () => onEdit(s) : undefined}
                onRemove={s.custom ? () => onRemove(s.id) : undefined}
              />
            ))}
          </section>
        ))}
    </>
  );
}

function BoardList() {
  return (
    <section className="catalog-group">
      <h2>Płyty Rigips</h2>
      <p className="muted small">Długości handlowe mogą się różnić w zależności od sklepu – sprawdź dostępność przed zakupem.</p>
      <ul className="board-list">
        {BOARDS.map((b) => (
          <li key={b.id} className="card">
            <span className="swatch" style={{ background: b.color }} aria-hidden />
            <div>
              <strong>{b.name}</strong>
              <div className="muted small">
                {b.type} · {fmtNum(b.thickness, 1)} mm · {b.width} × {b.lengths.join(' / ')} cm
              </div>
              <div className="small">{b.description}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SystemCard(props: {
  name: string;
  code?: string;
  custom?: boolean;
  info: string;
  params: [string, string][];
  consumption: () => ConsumptionLine[];
  reference?: RefLine[];
  source: { label: string; url?: string; approx?: boolean };
  onCopy: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card element">
      <header className="element-head">
        <button className="element-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>
            <h3>
              {props.name} {props.code && <span className="badge">{props.code}</span>} {props.custom && <span className="badge custom">własny</span>}
            </h3>
            <span className="muted small">{props.info}</span>
          </span>
        </button>
      </header>
      {open && <SystemDetails {...props} />}
    </article>
  );
}

function SystemDetails(props: Parameters<typeof SystemCard>[0]) {
  const lines = useMemo(() => props.consumption(), [props]);
  const refFor = (l: ConsumptionLine) =>
    props.reference?.find((r) => r.product === l.key || (l.key.startsWith('board:') && /Płyta/.test(r.label)));
  const unmatched = props.reference?.filter((r) => !lines.some((l) => refFor(l) === r)) ?? [];
  return (
    <div className="system-details">
      <dl className="params">
        {props.params.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <table className="consumption">
        <caption>Zużycie materiałów na 1 m²</caption>
        <thead>
          <tr>
            <th scope="col">Materiał</th>
            <th scope="col">Aplikacja</th>
            {props.reference && <th scope="col">Karta</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const r = refFor(l);
            return (
              <tr key={l.key}>
                <td>{l.name}</td>
                <td>
                  {fmtNum(l.qty)} {l.unit}
                </td>
                {props.reference && <td>{r ? `${fmtNum(r.qty)} ${r.unit}` : '–'}</td>}
              </tr>
            );
          })}
          {unmatched.map((r) => (
            <tr key={r.label} className="muted">
              <td>{r.label}</td>
              <td>–</td>
              <td>
                {fmtNum(r.qty)} {r.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Źródło:{' '}
        {props.source.url ? (
          <a href={props.source.url} target="_blank" rel="noreferrer">
            {props.source.label}
          </a>
        ) : (
          props.source.label
        )}
        {props.source.approx && <span className="muted"> · wartości orientacyjne</span>}
      </p>
      <div className="actions wrap">
        <button className="btn small" onClick={props.onCopy}>
          Na podstawie tego – system własny
        </button>
        {props.onEdit && (
          <button className="btn small" onClick={props.onEdit}>
            Edytuj
          </button>
        )}
        {props.onRemove && (
          <button className="btn small ghost danger" onClick={props.onRemove}>
            Usuń
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edytory systemów własnych
// ---------------------------------------------------------------------------

function NumField({ id, label, unit, value, min, max, step = 1, onChange }: { id: string; label: string; unit: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value.replace(',', '.'));
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
        />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}

const PROFILE_OPTIONS: PickOption<50 | 75 | 100>[] = [
  { value: 50, label: '50 mm' },
  { value: 75, label: '75 mm' },
  { value: 100, label: '100 mm' },
];
const SPACING_OPTIONS: PickOption<StudSpacing>[] = [
  { value: 60, label: '60 cm' },
  { value: 40, label: '40 cm' },
  { value: 30, label: '30 cm' },
];

function BoardSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>Płyta</label>
      <Picker id={id} label="Płyta" value={value} options={BOARDS.map((b) => ({ value: b.id, label: b.name, hint: b.description }))} onChange={onChange} />
    </div>
  );
}

function WallEditor({ initial, onSave, onCancel }: { initial: WallSystem; onSave: (s: WallSystem) => void; onCancel: () => void }) {
  const [s, setS] = useState(initial);
  const set = (p: Partial<WallSystem>) => setS((x) => ({ ...x, ...p }));
  const maxH = s.maxHeight?.[s.studSpacing] ?? 0;
  const preview = useMemo(() => wallConsumption(s), [s]);
  return (
    <form
      className="card editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...s, info: s.info || 'System własny' });
      }}
    >
      <div className="field">
        <label htmlFor="ew-name">Nazwa</label>
        <input id="ew-name" value={s.name} onChange={(e) => set({ name: e.target.value })} required />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ew-cat">Rodzaj</label>
          <Picker
            id="ew-cat"
            label="Rodzaj"
            value={s.category}
            mode="sheet"
            options={(Object.keys(WALL_CATEGORY_LABEL) as WallCategory[]).map((c) => ({ value: c, label: WALL_CATEGORY_LABEL[c] }))}
            onChange={(v) => set({ category: v })}
          />
        </div>
        <div className="field">
          <label htmlFor="ew-frame">Ruszt</label>
          <Picker
            id="ew-frame"
            label="Ruszt"
            value={s.frame}
            mode="sheet"
            options={(Object.keys(WALL_FRAME_LABEL) as WallFrame[]).map((f) => ({ value: f, label: WALL_FRAME_LABEL[f] }))}
            onChange={(v) => set({ frame: v })}
          />
        </div>
      </div>
      <div className="grid-3">
        {s.frame !== 'cd-lining' && s.frame !== 'glued' && s.frame !== 'point-fix' && (
          <div className="field">
            <label htmlFor="ew-prof">Profil CW/UW</label>
            <Picker id="ew-prof" label="Profil CW/UW" value={s.profile} options={PROFILE_OPTIONS} onChange={(v) => set({ profile: v })} />
          </div>
        )}
        {s.frame !== 'glued' && (
          <div className="field">
            <label htmlFor="ew-sp">{s.frame === 'point-fix' ? 'Rozstaw łączników poziomo' : 'Rozstaw profili'}</label>
            <Picker id="ew-sp" label="Rozstaw" value={s.studSpacing} options={SPACING_OPTIONS} onChange={(v) => set({ studSpacing: v })} />
          </div>
        )}
        <div className="field">
          <label htmlFor="ew-sides">Płyty</label>
          <Picker
            id="ew-sides"
            label="Płyty"
            value={s.sides}
            options={[
              { value: 2, label: 'obustronnie', short: 'obie strony' },
              { value: 1, label: 'jednostronnie', short: 'jedna' },
            ]}
            onChange={(v) => set({ sides: v })}
          />
        </div>
      </div>
      <div className="grid-3">
        <NumField id="ew-layers" label="Warstwy płyt na stronę" unit="szt." value={s.layers} min={1} max={3} onChange={(v) => set({ layers: Math.round(v) })} />
        <NumField
          id="ew-maxh"
          label="Maks. wysokość (0 = brak)"
          unit="cm"
          value={maxH}
          min={0}
          max={1200}
          onChange={(v) => set({ maxHeight: v > 0 ? { [s.studSpacing]: v } : undefined })}
        />
        {s.frame === 'cd-lining' && (
          <NumField id="ew-br" label="Rozstaw uchwytów ES" unit="cm" value={s.bracketSpacing ?? 100} min={30} max={150} onChange={(v) => set({ bracketSpacing: v })} />
        )}
        {s.frame === 'point-fix' && (
          <NumField id="ew-pt" label="Rozstaw łączników pionowo" unit="cm" value={s.pointSpacing ?? 50} min={30} max={60} onChange={(v) => set({ pointSpacing: v })} />
        )}
        {s.frame === 'separate' && (
          <NumField id="ew-gap" label="Odstęp między rusztami" unit="cm" value={s.gap ?? 10} min={0} max={60} onChange={(v) => set({ gap: v })} />
        )}
      </div>
      <BoardSelect id="ew-board" value={s.defaultBoard} onChange={(v) => set({ defaultBoard: v })} />
      <label className="check">
        <input type="checkbox" checked={s.insulationDefault} onChange={(e) => set({ insulationDefault: e.target.checked })} />
        Domyślnie z wełną mineralną
      </label>
      <div className="field">
        <label htmlFor="ew-info">Opis</label>
        <input id="ew-info" value={s.info} onChange={(e) => set({ info: e.target.value })} />
      </div>
      <Preview lines={preview} />
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Anuluj
        </button>
        <button type="submit" className="btn primary">
          Zapisz system
        </button>
      </div>
    </form>
  );
}

function CeilingEditor({ initial, onSave, onCancel }: { initial: CeilingSystem; onSave: (s: CeilingSystem) => void; onCancel: () => void }) {
  const [s, setS] = useState(initial);
  const set = (p: Partial<CeilingSystem>) => setS((x) => ({ ...x, ...p }));
  const preview = useMemo(() => ceilingConsumption(s), [s]);
  const hung = s.kind === 'two-level' || s.kind === 'one-level' || s.kind === 'direct';
  return (
    <form
      className="card editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...s, info: s.info || 'System własny' });
      }}
    >
      <div className="field">
        <label htmlFor="ec-name">Nazwa</label>
        <input id="ec-name" value={s.name} onChange={(e) => set({ name: e.target.value })} required />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ec-kind">Rodzaj</label>
          <Picker
            id="ec-kind"
            label="Rodzaj"
            value={s.kind}
            mode="sheet"
            options={(Object.keys(CEILING_KIND_LABEL) as CeilingKind[]).map((k) => ({ value: k, label: CEILING_KIND_LABEL[k] }))}
            onChange={(kind) =>
              set({ kind, profile: kind === 'cw-span' ? (s.profile ?? 75) : s.profile, hangerType: kind === 'direct' ? 'es' : 'noniusz' })
            }
          />
        </div>
        <NumField id="ec-layers" label="Warstwy płyt" unit="szt." value={s.layers} min={1} max={3} onChange={(v) => set({ layers: Math.round(v) })} />
      </div>
      <div className="grid-3">
        {(s.kind === 'two-level' || s.kind === 'one-level' || s.kind === 'ua-span' || s.kind === 'point-fix') && (
          <NumField id="ec-main" label={s.kind === 'ua-span' ? 'Rozstaw UA 50' : s.kind === 'point-fix' ? 'Siatka łączników – kierunek 1' : 'Rozstaw nośnych'} unit="cm" value={s.mainSpacing} min={40} max={150} onChange={(v) => set({ mainSpacing: v })} />
        )}
        <NumField
          id="ec-sec"
          label={s.kind === 'cw-span' ? 'Rozstaw CW' : s.kind === 'direct' ? 'Rozstaw CD' : s.kind === 'point-fix' ? 'Siatka łączników – kierunek 2' : 'Rozstaw montażowych'}
          unit="cm"
          value={s.secondarySpacing}
          min={20}
          max={60}
          onChange={(v) => set({ secondarySpacing: v })}
        />
        {hung && (
          <NumField id="ec-hang" label="Rozstaw wieszaków" unit="cm" value={s.hangerSpacing} min={30} max={150} onChange={(v) => set({ hangerSpacing: v })} />
        )}
        {s.kind === 'cw-span' && (
          <div className="field">
            <label htmlFor="ec-prof">Profil CW/UW</label>
            <Picker id="ec-prof" label="Profil CW/UW" value={s.profile ?? 75} options={PROFILE_OPTIONS} onChange={(v) => set({ profile: v })} />
          </div>
        )}
        {s.kind === 'direct' && (
          <div className="field">
            <label htmlFor="ec-ht">Mocowanie</label>
            <Picker
              id="ec-ht"
              label="Mocowanie"
              value={s.hangerType ?? 'es'}
              options={[
                { value: 'es' as HangerType, label: 'uchwyty ES', short: 'ES' },
                { value: 'elastic' as HangerType, label: 'uchwyty elastyczne', short: 'elastyczne' },
              ]}
              onChange={(v) => set({ hangerType: v })}
            />
          </div>
        )}
      </div>
      {s.kind !== 'point-fix' && <div className="grid-2">
        <NumField id="ec-so" label="Wkręty – warstwa zewn." unit="szt./m²" value={s.screwsOuter} min={5} max={40} step={0.5} onChange={(v) => set({ screwsOuter: v })} />
        <NumField id="ec-si" label="Wkręty – warstwy wewn." unit="szt./m²" value={s.screwsInner} min={0} max={30} step={0.5} onChange={(v) => set({ screwsInner: v })} />
      </div>}
      <BoardSelect id="ec-board" value={s.defaultBoard} onChange={(v) => set({ defaultBoard: v })} />
      <div className="field">
        <label htmlFor="ec-info">Opis</label>
        <input id="ec-info" value={s.info} onChange={(e) => set({ info: e.target.value })} />
      </div>
      <Preview lines={preview} />
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Anuluj
        </button>
        <button type="submit" className="btn primary">
          Zapisz system
        </button>
      </div>
    </form>
  );
}

function Preview({ lines }: { lines: ConsumptionLine[] }) {
  return (
    <table className="consumption">
      <caption>Podgląd zużycia na 1 m²</caption>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <td>{l.name}</td>
            <td>
              {fmtNum(l.qty)} {l.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
