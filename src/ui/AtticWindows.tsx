import { useState } from 'react';
import { atticWindowGeometry, bayCenter, defaultRoofWindow, ROOF_WINDOW_SIZES, windowFaceKey, windowLabel } from '../calc/atticWindows';
import type { AtticGrid } from '../calc/attic';
import { uid } from '../model/factory';
import type { Attic, RoofWindow } from '../model/types';
import { DimInput } from './DimInput';
import { Picker, type PickOption } from './Picker';
import { fmtNum } from './wallStyle';

const CUSTOM = 'własny';
const SIZE_OPTIONS: PickOption<string>[] = [
  ...ROOF_WINDOW_SIZES.map((s) => ({
    value: `${s.maker} ${s.code}`,
    label: s.maker === 'VELUX' ? `VELUX ${s.code} – ${s.width}×${s.height} cm` : `FAKRO ${s.width}×${s.height} cm`,
    short: s.maker === 'VELUX' ? `${s.code} ${s.width}×${s.height}` : `FAKRO ${s.width}×${s.height}`,
    group: s.maker,
  })),
  { value: CUSTOM, label: 'Wymiar własny', hint: 'wpisz szerokość i wysokość ościeżnicy', group: 'Inne' },
];
const SIDE_OPTIONS: PickOption<RoofWindow['side']>[] = [
  { value: 'left', label: 'lewy skos' },
  { value: 'right', label: 'prawy skos' },
];

/** Okna dachowe w formularzu poddasza: rozmiar z oznaczeń VELUX / FAKRO albo własny, położenie na skosie */
export function AtticWindowsField({ attic, grid, edit }: { attic: Attic; grid: AtticGrid; edit: (fn: (a: Attic) => void) => void }) {
  const [openId, setOpenId] = useState<string>();
  const list = attic.windows ?? [];
  const geom = atticWindowGeometry(attic, grid).list;
  const editWin = (id: string, fn: (w: RoofWindow) => void) =>
    edit((a) => {
      const w = a.windows?.find((x) => x.id === id);
      if (w) fn(w);
    });
  const mono = attic.roof === 'mono';
  // dach z narożnikami / koszami: okno w dowolnej połaci skośnej, oś wzdłuż okapu tej połaci
  const roofFaces = grid.roof?.faces.map((g) => g.face).filter((f) => f.kind === 'slope') ?? [];
  const faceOptions: PickOption<string>[] = roofFaces.map((f) => ({ value: f.key, label: f.label }));
  const faceOf = (w: RoofWindow) => roofFaces.find((f) => f.key === windowFaceKey(w));
  const where = (w: RoofWindow) => (grid.roof ? (faceOf(w)?.label.toLowerCase() ?? 'brak połaci') : mono ? 'skos' : w.side === 'left' ? 'lewy skos' : 'prawy skos');

  return (
    <section className="openings attic-windows">
      <h4 className="attic-sub">Okna dachowe</h4>
      {list.map((w, i) => {
        const name = windowLabel(w, i);
        const g = geom.find((x) => x.w.id === w.id);
        if (w.id !== openId)
          return (
            <button key={w.id} type="button" className="opening-row" aria-expanded={false} onClick={() => setOpenId(w.id)}>
              <span>
                {name} · {where(w)} · dół {fmtNum(w.sill / 100)} m
              </span>
              <span aria-hidden>›</span>
            </button>
          );
        return (
          <div key={w.id} className="opening">
            <div className="opening-head">
              <button type="button" className="opening-toggle" aria-expanded onClick={() => setOpenId(undefined)}>
                <strong>{name}</strong>
              </button>
              <button type="button" className="btn ghost small danger" onClick={() => edit((a) => void (a.windows = (a.windows ?? []).filter((x) => x.id !== w.id)))}>
                Usuń
              </button>
            </div>
            <div className="field">
              <label htmlFor={`rw-${w.id}`}>Rozmiar okna</label>
              <Picker
                id={`rw-${w.id}`}
                label="Rozmiar okna"
                value={w.sizeCode ?? CUSTOM}
                mode="sheet"
                options={SIZE_OPTIONS}
                onChange={(v) =>
                  editWin(w.id, (x) => {
                    if (v === CUSTOM) return void (x.sizeCode = undefined);
                    const s = ROOF_WINDOW_SIZES.find((q) => `${q.maker} ${q.code}` === v);
                    if (!s) return;
                    x.sizeCode = v;
                    x.width = s.width;
                    x.height = s.height;
                  })
                }
              />
              <small className="hint">wymiary zewnętrzne ościeżnicy – sprawdź na tabliczce znamionowej okna</small>
            </div>
            <div className="grid-2">
              <DimInput label="Szerokość okna" value={w.width} min={30} max={300} onChange={(v) => editWin(w.id, (x) => void ((x.width = v), (x.sizeCode = undefined)))} />
              <DimInput label="Wysokość okna (po skosie)" value={w.height} min={30} max={300} onChange={(v) => editWin(w.id, (x) => void ((x.height = v), (x.sizeCode = undefined)))} />
            </div>
            {grid.roof && (
              <div className="field">
                <label htmlFor={`rwf-${w.id}`}>Połać z oknem</label>
                <Picker
                  id={`rwf-${w.id}`}
                  label="Połać z oknem"
                  value={windowFaceKey(w)}
                  mode="sheet"
                  options={faceOptions}
                  onChange={(v) =>
                    editWin(w.id, (x) => {
                      x.face = v;
                      if (v === 'left' || v === 'right') x.side = v;
                      const f = roofFaces.find((q) => q.key === v);
                      if (f && (x.u < f.t0 || x.u > f.t1)) x.u = bayCenter(grid, attic.length, (f.t0 + f.t1) / 2, v);
                    })
                  }
                />
                <small className="hint">numery połaci jak na rzucie w rysunkach</small>
              </div>
            )}
            {!mono && !grid.roof && (
              <div className="field">
                <span className="label">Skos</span>
                <Picker label="Skos z oknem" value={w.side} mode="segments" options={SIDE_OPTIONS} onChange={(v) => editWin(w.id, (x) => void (x.side = v))} />
              </div>
            )}
            <div className="grid-2">
              {(() => {
                // połać narożna i dobudówki: oś od początku połaci (wzdłuż okapu), w modelu – w układzie rzutu
                const f = faceOf(w);
                const own = !!grid.roof && !!f && !['left', 'right'].includes(f.key);
                const t0 = own ? f!.t0 : 0;
                return (
                  <DimInput
                    label={own ? 'Oś okna od krawędzi połaci' : 'Oś okna od ściany szczytowej'}
                    unit="m"
                    value={Math.round((w.u - t0) * 10) / 10}
                    min={0}
                    max={own ? f!.t1 - f!.t0 : attic.length}
                    hint={own ? `wzdłuż okapu, od lewej krawędzi na rysunku połaci (${fmtNum((f!.t1 - f!.t0) / 100)} m)` : 'wzdłuż kalenicy'}
                    onChange={(v) => editWin(w.id, (x) => void (x.u = v + t0))}
                  />
                );
              })()}
              <DimInput
                label="Dolna krawędź okna nad posadzką"
                unit="cm"
                value={w.sill}
                min={0}
                max={1000}
                hint="dół ościeżnicy"
                onChange={(v) => editWin(w.id, (x) => void (x.sill = v))}
              />
            </div>
            <div className="actions wrap">
              <button type="button" className="btn link small" onClick={() => editWin(w.id, (x) => void (x.u = bayCenter(grid, attic.length, x.u, grid.roof ? windowFaceKey(x) : undefined)))}>
                Wyśrodkuj między krokwiami
              </button>
            </div>
            {g && (
              <p className="muted small">
                Otwór w płytach {fmtNum((g.u1 - g.u0) / 100)} × {fmtNum((g.s1 - g.s0) / 100)} m (po skosie) · glif dolny pionowo {Math.round(g.lower)} cm, górny poziomo {Math.round(g.upper)} cm ·
                krokwie przy oknie w osiach {fmtNum(g.flank[0] / 100)} i {fmtNum(g.flank[1] / 100)} m
              </p>
            )}
          </div>
        );
      })}
      <div className="actions wrap">
        <button
          type="button"
          className="btn link small"
          onClick={() => {
            const id = uid();
            setOpenId(id);
            edit((a) => void (a.windows = [...(a.windows ?? []), defaultRoofWindow(a, grid, id)]));
          }}
        >
          + Okno dachowe
        </button>
      </div>
    </section>
  );
}
