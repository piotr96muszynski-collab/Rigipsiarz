// Ustawienia nowych ścian (przed rysowaniem) i wspólna edycja kilku zaznaczonych ścian.

import { wallSystemById } from '../catalog/rigips';
import { dist, isNewWall, wallEnds } from '../geometry/geometry';
import { setDefaultWallSystem, setWallSystem } from '../model/ops';
import type { Project, Wall } from '../model/types';
import { DimInput } from './DimInput';
import { BOARD_OPTIONS, SPACING_OPTIONS } from './ElementsPanel';
import { Picker } from './Picker';
import { WallSystemSelect } from './SystemSelect';
import { fmtNum } from './wallStyle';

type Update = (fn: (d: Project) => void) => void;

/** Krótka nazwa systemu na przycisku nad planem */
export function systemShort(id: string) {
  const s = wallSystemById(id);
  return (s.code ?? s.name).replace(/^Ściana\s+/, '');
}

/** Parametry, z którymi powstaje każda nowa ściana narysowana na planie */
export function WallDefaultsEditor({ project, update }: { project: Project; update: Update }) {
  const st = project.settings;
  const sys = wallSystemById(st.defaultWallSystem);
  const def = st.wallDefaults ?? {};
  const set = (fn: (d: NonNullable<Project['settings']['wallDefaults']>) => void) =>
    update((d) => {
      d.settings.wallDefaults = { ...(d.settings.wallDefaults ?? {}) };
      fn(d.settings.wallDefaults);
    });
  const spacingLabel = sys.frame === 'point-fix' ? 'Rozstaw łączników' : 'Rozstaw CW';
  return (
    <div className="editor wall-defaults">
      <div className="field">
        <label htmlFor="def-sys">System</label>
        <WallSystemSelect id="def-sys" value={sys.id} onChange={(id) => update((d) => setDefaultWallSystem(d, id))} />
        <small className="hint">{sys.info}</small>
      </div>
      <div className="field">
        <label htmlFor="def-board">Płyta</label>
        <Picker id="def-board" label="Płyta" value={def.boardId ?? sys.defaultBoard} options={BOARD_OPTIONS()} onChange={(v) => set((x) => void (x.boardId = v))} />
      </div>
      <div className="field">
        <label htmlFor="def-sp">{spacingLabel}</label>
        <Picker id="def-sp" label={spacingLabel} value={def.studSpacing ?? sys.studSpacing} options={SPACING_OPTIONS} onChange={(v) => set((x) => void (x.studSpacing = v))} />
      </div>
      <div className="grid-2">
        <DimInput label="Wysokość (do stropu)" unit="m" value={st.defaultHeight} min={30} max={1000} onChange={(v) => update((d) => void (d.settings.defaultHeight = v))} />
        <label className="check">
          <input type="checkbox" checked={def.insulation ?? sys.insulationDefault} onChange={(e) => set((x) => void (x.insulation = e.target.checked))} />
          Wełna mineralna
        </label>
      </div>
      <small className="hint">Dotyczy ścian, które dopiero narysujesz. Narysowane zmienisz po zaznaczeniu (także kilku naraz).</small>
    </div>
  );
}

/** Wspólna wartość pola dla wszystkich ścian albo undefined, gdy się różnią */
function common<T>(walls: Wall[], get: (w: Wall) => T): T | undefined {
  const v = get(walls[0]);
  return walls.every((w) => get(w) === v) ? v : undefined;
}

/** Edycja kilku zaznaczonych ścian naraz */
export function MultiWallEditor({ project, ids, update }: { project: Project; ids: string[]; update: Update }) {
  const walls = project.walls.filter((w) => ids.includes(w.id));
  if (!walls.length) return null;
  const fresh = walls.filter(isNewWall);
  const existing = walls.filter((w) => !isNewWall(w));
  const edit = (pick: (w: Wall) => boolean, fn: (w: Wall) => void) =>
    update((d) => {
      for (const w of d.walls) if (ids.includes(w.id) && pick(w)) fn(w);
    });
  const height = common(walls, (w) => w.height);
  const sysId = fresh.length ? common(fresh, (w) => w.systemId) : undefined;
  const sys = wallSystemById(sysId ?? fresh[0]?.systemId ?? project.settings.defaultWallSystem);
  const board = fresh.length ? common(fresh, (w) => w.boardId) : undefined;
  const spacing = fresh.length ? common(fresh, (w) => w.studSpacing) : undefined;
  const wool = fresh.length ? common(fresh, (w) => w.insulation) : undefined;
  const thick = existing.length ? common(existing, (w) => w.thickness ?? 25) : undefined;
  const differs = <span className="tag">różne</span>;

  return (
    <div className="editor multi-walls">
      <div className="grid-2">
        <DimInput
          label="Wysokość"
          unit="m"
          value={height ?? walls[0].height}
          min={30}
          max={1000}
          hint={height === undefined ? 'Ściany mają różne wysokości – wpisz jedną dla wszystkich' : undefined}
          onChange={(v) => edit(() => true, (w) => void (w.height = v))}
        />
        {existing.length > 0 && (
          <DimInput
            label="Grubość muru"
            value={thick ?? existing[0].thickness ?? 25}
            min={5}
            max={100}
            hint={thick === undefined ? 'Różne grubości' : undefined}
            onChange={(v) => edit((w) => !isNewWall(w), (w) => void (w.thickness = v))}
          />
        )}
      </div>
      {fresh.length > 0 && (
        <>
          <div className="field">
            <label htmlFor="multi-sys">System {sysId === undefined && differs}</label>
            <WallSystemSelect id="multi-sys" value={sys.id} onChange={(id) => edit(isNewWall, (w) => setWallSystem(w, id))} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="multi-board">Płyta {board === undefined && differs}</label>
              <Picker id="multi-board" label="Płyta" value={board ?? fresh[0].boardId} options={BOARD_OPTIONS()} onChange={(v) => edit(isNewWall, (w) => void (w.boardId = v))} />
            </div>
            <div className="field">
              <label htmlFor="multi-sp">
                {sys.frame === 'point-fix' ? 'Rozstaw łączników' : 'Rozstaw CW'} {spacing === undefined && differs}
              </label>
              <Picker
                id="multi-sp"
                label="Rozstaw"
                value={spacing ?? fresh[0].studSpacing}
                options={SPACING_OPTIONS}
                onChange={(v) => edit(isNewWall, (w) => void (w.studSpacing = v))}
              />
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={wool ?? false}
              ref={(el) => {
                if (el) el.indeterminate = wool === undefined;
              }}
              onChange={(e) => edit(isNewWall, (w) => void (w.insulation = e.target.checked))}
            />
            Wełna mineralna {wool === undefined && differs}
          </label>
        </>
      )}
      {existing.length > 0 && fresh.length > 0 && (
        <small className="hint">
          System, płyta i wełna dotyczą {fresh.length} nowych ścian; mury ({existing.length}) mają tylko wysokość i grubość.
        </small>
      )}
    </div>
  );
}

/** Podsumowanie zaznaczenia: liczba i łączna długość */
export function multiSummary(project: Project, ids: string[]) {
  const walls = project.walls.filter((w) => ids.includes(w.id));
  const len = walls.reduce((s, w) => s + dist(...wallEnds(project, w)), 0);
  const n = walls.length;
  const word = n === 1 ? 'ściana' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'ściany' : 'ścian';
  return `${n} ${word} · ${fmtNum(len / 100)} mb`;
}
