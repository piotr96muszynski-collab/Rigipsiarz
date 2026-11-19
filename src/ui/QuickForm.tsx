import { useState } from 'react';
import { CeilingSystemSelect, WallSystemSelect } from './SystemSelect';
import { createAttic, quickAtticProject, quickProject, type QuickInput } from '../model/factory';
import type { Attic, Project } from '../model/types';
import { AtticEditor } from './AtticEditor';
import { DimInput } from './DimInput';

interface Props {
  onCreate: (p: Project) => void;
  onCancel: () => void;
}

type Mode = QuickInput['mode'] | 'attic';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'wall', label: 'Ściana', hint: 'Jedna ściana działowa lub obudowa' },
  { id: 'room', label: 'Pomieszczenie', hint: '4 ściany, opcjonalnie z sufitem' },
  { id: 'ceiling', label: 'Sufit', hint: 'Sufit podwieszany na profilach CD' },
  { id: 'attic', label: 'Poddasze', hint: 'Skosy i jętki na krokwiach' },
];

export function QuickForm({ onCreate, onCancel }: Props) {
  const [q, setQ] = useState<QuickInput>({
    mode: 'ceiling',
    length: 600,
    width: 200,
    height: 300,
    wallSystemId: 'W-CW75-1',
    ceilingSystemId: 'S-CD-2P-1',
    withCeiling: true,
    doors: 1,
    windows: 0,
  });
  const [mode, setMode] = useState<Mode>('ceiling');
  const [attic, setAttic] = useState<Attic>(() => createAttic());
  const isAttic = mode === 'attic';
  const set = (patch: Partial<QuickInput>) => setQ((s) => ({ ...s, ...patch }));
  const showWalls = !isAttic && q.mode !== 'ceiling';
  const showCeiling = !isAttic && (q.mode === 'ceiling' || (q.mode === 'room' && q.withCeiling));

  return (
    <form
      className="card quick"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(isAttic ? quickAtticProject(attic) : quickProject(q));
      }}
    >
      <div className="card-head">
        <h2>Szybkie wyliczenie</h2>
        <p className="muted">Wpisz wymiary, a dostaniesz listę materiałów. Wymiary możesz podać w metrach (2,5) lub centymetrach (250).</p>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Co liczymy">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            className={mode === m.id ? 'on' : ''}
            onClick={() => {
              setMode(m.id);
              if (m.id !== 'attic') set({ mode: m.id });
            }}
          >
            <strong>{m.label}</strong>
            <small>{m.hint}</small>
          </button>
        ))}
      </div>

      {isAttic && (
        <AtticEditor
          attic={attic}
          edit={(fn) =>
            setAttic((a) => {
              const next = structuredClone(a);
              fn(next);
              return next;
            })
          }
        />
      )}

      {!isAttic && (
      <div className="grid-3">
        <DimInput label={q.mode === 'wall' ? 'Długość ściany' : 'Długość'} unit="m" value={q.length} onChange={(v) => set({ length: v })} min={20} />
        {q.mode !== 'wall' && <DimInput label="Szerokość" unit="m" value={q.width} onChange={(v) => set({ width: v })} min={20} />}
        <DimInput
          label={q.mode === 'wall' ? 'Wysokość' : 'Wysokość do stropu'}
          unit="m"
          value={q.height}
          onChange={(v) => set({ height: v })}
          min={50}
          max={1000}
        />
      </div>
      )}

      {showWalls && (
        <>
          <div className="field">
            <label htmlFor="q-wall">System ściany</label>
            <WallSystemSelect id="q-wall" value={q.wallSystemId} heightCm={q.height} onChange={(id) => set({ wallSystemId: id })} />
          </div>
          <div className="grid-3">
            <Stepper label="Drzwi" value={q.doors} onChange={(v) => set({ doors: v })} />
            <Stepper label="Okna" value={q.windows} onChange={(v) => set({ windows: v })} />
          </div>
        </>
      )}

      {!isAttic && q.mode === 'room' && (
        <label className="check">
          <input type="checkbox" checked={q.withCeiling} onChange={(e) => set({ withCeiling: e.target.checked })} />
          Dolicz sufit podwieszany
        </label>
      )}

      {showCeiling && (
        <div className="field">
          <label htmlFor="q-ceil">System sufitu</label>
          <CeilingSystemSelect
            id="q-ceil"
            value={q.ceilingSystemId}
            spanCm={Math.min(q.length, q.width)}
            onChange={(id) => set({ ceilingSystemId: id })}
          />
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Anuluj
        </button>
        <button type="submit" className="btn primary">
          Wylicz materiały
        </button>
      </div>
    </form>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Mniej: ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`Więcej: ${label}`} onClick={() => onChange(Math.min(8, value + 1))}>
          +
        </button>
      </div>
    </div>
  );
}
