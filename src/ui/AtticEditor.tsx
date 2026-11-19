import { useId } from 'react';
import { ceilingSystemById } from '../catalog/rigips';
import { ATTIC_REVEAL, atticFrameOf, atticGrid, pitchForRidge, ridgeHeightFor, type AtticGrid } from '../calc/attic';
import { ATTIC_WOOL_BETWEEN, ATTIC_WOOL_UNDER, type AtticResult } from '../calc/atticMaterials';
import type { Attic, AtticEnd, AtticWing } from '../model/types';
import { uid } from '../model/factory';
import { AtticRoofPlanDrawing } from '../drawings/AtticRoofDrawing';
import { DimInput } from './DimInput';
import { Picker, type PickOption } from './Picker';
import { BOARD_OPTIONS, LiningEditor } from './ElementsPanel';
import { createLining } from '../model/factory';
import { AtticSystemSelect, Warnings } from './SystemSelect';
import { VaporField } from './WoolField';
import { ceilingVaporSpec, vaporBarrierOn } from '../calc/vaporBarrier';
import { fmtNum } from './wallStyle';
import { AtticWindowsField } from './AtticWindows';

const ROOF_OPTIONS: PickOption<Attic['roof']>[] = [
  { value: 'gable', label: 'dwuspadowy', hint: 'skosy z obu stron' },
  { value: 'mono', label: 'jednospadowy', hint: 'skos z jednej strony' },
];
const RIDGE_OPTIONS: PickOption<0 | 90>[] = [
  { value: 0, label: 'poziomo' },
  { value: 90, label: 'pionowo' },
];
const COLLAR_OPTIONS: PickOption<0 | 1>[] = [
  { value: 1, label: 'sufit pod jętkami' },
  { value: 0, label: 'skosy do kalenicy' },
];
const END_OPTIONS: PickOption<AtticEnd>[] = [
  { value: 'gable', label: 'ściana szczytowa' },
  { value: 'hip', label: 'połać z narożnikami', hint: 'dach kopertowy' },
];
const SIDE_OPTIONS: PickOption<AtticWing['side']>[] = [
  { value: 'left', label: 'lewa' },
  { value: 'right', label: 'prawa' },
];
const mmOptions = (list: number[]): PickOption<number>[] => list.map((v) => ({ value: v, label: v ? `${v} mm` : 'bez wełny', short: v ? `${v} mm` : 'bez wełny' }));
/** Pole liczbowe bez jednostki długości (kąt dachu) */
function AngleInput({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={5}
          max={80}
          step={0.5}
          value={Math.round(value * 10) / 10}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = Number(e.target.value.replace(',', '.'));
            if (Number.isFinite(v) && v >= 5 && v <= 80) onChange(v);
          }}
        />
        <span className="unit">°</span>
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

interface Props {
  attic: Attic;
  edit: (fn: (a: Attic) => void) => void;
  /** Wynik wyliczeń (gdy poddasze jest już w projekcie); bez niego liczony jest sam ruszt */
  result?: AtticResult;
}

/** Formularz zabudowy poddasza z przekrojem rysowanym na żywo */
export function AtticEditor({ attic, edit, result }: Props) {
  const sys = ceilingSystemById(attic.systemId);
  const grid = result?.grid ?? atticGrid(attic, sys);
  const ridge = ridgeHeightFor(attic);
  const mono = attic.roof === 'mono';
  const roof = grid.roof;
  const hangers =
    result?.hangers ??
    (roof
      ? roof.faces.reduce((n, g) => n + g.cd.reduce((k, l) => k + l.fix.length, 0), 0) + roof.lineProfiles.reduce((n, l) => n + l.fix.length, 0)
      : grid.surfaces.reduce((n, g) => n + (g.fixS.length || g.cd.length) * g.hangerU.length, 0));
  const area = roof ? roof.faces.reduce((s, g) => s + g.face.areaM2, 0) : grid.surfaces.reduce((s, g) => s + g.areaM2, 0);
  const cdCount = roof ? roof.faces.reduce((n, g) => n + g.cd.length, 0) : grid.surfaces.reduce((n, g) => n + g.cd.length, 0);
  const ends = attic.ends ?? ['gable', 'gable'];
  const setEnd = (i: 0 | 1, v: AtticEnd) =>
    edit((a) => {
      const e: [AtticEnd, AtticEnd] = [...(a.ends ?? ['gable', 'gable'])] as [AtticEnd, AtticEnd];
      e[i] = v;
      a.ends = e[0] === 'gable' && e[1] === 'gable' ? undefined : e;
    });
  const editWing = (id: string, fn: (w: AtticWing) => void) => edit((a) => fn(a.wings!.find((w) => w.id === id)!));
  const roofLines = roof ? { hips: roof.roof.lines.filter((l) => l.kind === 'hip').length, valleys: roof.roof.lines.filter((l) => l.kind === 'valley').length } : undefined;
  const pickSystem = (id: string, boardId: string) =>
    edit((a) => {
      const s = ceilingSystemById(id);
      a.systemId = s.id;
      a.boardId = boardId;
      // ruszt przykręcony do krokwi albo między krokwiami nie zostawia miejsca na wełnę pod krokwiami
      const fr = atticFrameOf(s);
      if (fr.mount === 'between' || (fr.mount === 'direct' && a.woolUnder > (fr.battens?.[fr.battens.length - 1].mm ?? fr.profileMm))) a.woolUnder = 0;
    });

  return (
    <div className="editor attic-editor">
      <AtticSectionPreview attic={attic} grid={grid} />
      <p className="muted small attic-summary" role="status">
        {fmtNum(area, 1)} m² zabudowy · {grid.rafters.length} krokwi{roofLines ? ` · narożniki dachu: ${roofLines.hips}, kosze: ${roofLines.valleys}` : ''} · {cdCount} {roof ? 'odcinków' : 'linii'} rusztu (
        {grid.frame.profileLabel}) co {grid.cdSpacing} cm{grid.carrier ? ` na ${grid.carrier.label} pod każdą krokwią` : ''}{hangers ? ` · ${hangers} ${grid.frame.hanger ? 'wieszaków' : 'mocowań do krokwi'}` : ''} ·{' '}
        {grid.depthMm < 0 ? `płyty ${-grid.depthMm} mm nad spodem krokwi` : `zabudowa ${grid.depthMm} mm pod krokwią`}
      </p>

      <div className="field">
        <span className="label">Dach</span>
        <Picker label="Dach" value={attic.roof} mode="segments" options={ROOF_OPTIONS} onChange={(v) => edit((a) => void (a.roof = v))} />
      </div>
      <div className="grid-2">
        <DimInput label="Szerokość (między ścianami okapowymi)" unit="m" value={attic.width} min={100} max={3000} onChange={(v) => edit((a) => void (a.width = v))} />
        <DimInput label="Długość (wzdłuż kalenicy)" unit="m" value={attic.length} min={50} max={5000} onChange={(v) => edit((a) => void (a.length = v))} />
      </div>
      <div className="grid-2">
        <DimInput
          label={mono ? 'Ścianka kolankowa (niższa ściana)' : 'Ścianka kolankowa lewa'}
          unit="cm"
          value={attic.kneeLeft}
          min={0}
          max={400}
          hint="od posadzki do spodu krokwi przy ścianie"
          onChange={(v) => edit((a) => void (a.kneeLeft = v))}
        />
        {!mono && (
          <DimInput label="Ścianka kolankowa prawa" unit="cm" value={attic.kneeRight} min={0} max={400} onChange={(v) => edit((a) => void (a.kneeRight = v))} />
        )}
      </div>
      <div className="grid-2">
        <AngleInput label="Kąt dachu" value={attic.pitch} onChange={(v) => edit((a) => void (a.pitch = v))} />
        <DimInput
          label={mono ? 'Wysokość przy wyższej ścianie' : 'Wysokość w kalenicy'}
          unit="m"
          value={Math.round(ridge)}
          min={Math.max(attic.kneeLeft, mono ? 0 : attic.kneeRight) + 10}
          max={2000}
          hint="spód krokwi; zmienia kąt dachu"
          onChange={(v) => edit((a) => void (a.pitch = Math.round(pitchForRidge(a, v) * 10) / 10))}
        />
      </div>
      <div className="field">
        <span className="label">Góra zabudowy</span>
        <Picker
          label="Góra zabudowy"
          value={attic.collarHeight === undefined ? 0 : 1}
          mode="segments"
          options={COLLAR_OPTIONS}
          onChange={(v) => edit((a) => void (a.collarHeight = v ? Math.min(260, Math.round(ridgeHeightFor(a)) - 30) : undefined))}
        />
      </div>
      {attic.collarHeight !== undefined && (
        <div className="grid-2">
          <DimInput label="Spód jętek od posadzki" unit="m" value={attic.collarHeight} min={100} max={1000} onChange={(v) => edit((a) => void (a.collarHeight = v))} />
        </div>
      )}

      {!mono && (
        <>
          <h4 className="attic-sub">Narożniki dachu i kosze</h4>
          <div className="field">
            <span className="label">Przy 1. ścianie szczytowej</span>
            <Picker label="Zakończenie przy 1. ścianie szczytowej" value={ends[0]} mode="segments" options={END_OPTIONS} onChange={(v) => setEnd(0, v)} />
          </div>
          <div className="field">
            <span className="label">Przy 2. ścianie szczytowej</span>
            <Picker label="Zakończenie przy 2. ścianie szczytowej" value={ends[1]} mode="segments" options={END_OPTIONS} onChange={(v) => setEnd(1, v)} />
          </div>
          {(attic.wings ?? []).map((w, i) => (
            <fieldset key={w.id} className="attic-wing">
              <legend>
                Dobudówka {i + 1} (kosze){' '}
                <button type="button" className="btn small" onClick={() => edit((a) => void (a.wings = a.wings!.filter((x) => x.id !== w.id)))}>
                  Usuń
                </button>
              </legend>
              <div className="field">
                <span className="label">Strona</span>
                <Picker label="Strona dobudówki" value={w.side} mode="segments" options={SIDE_OPTIONS} onChange={(v) => editWing(w.id, (x) => void (x.side = v))} />
              </div>
              <div className="grid-2">
                <DimInput label="Oś dobudówki od 1. ściany szczytowej" unit="m" value={w.at} min={0} max={attic.length} onChange={(v) => editWing(w.id, (x) => void (x.at = v))} />
                <DimInput label="Szerokość dobudówki" unit="m" value={w.width} min={100} max={attic.length} hint="między jej ścianami okapowymi" onChange={(v) => editWing(w.id, (x) => void (x.width = v))} />
                <DimInput label="Wysunięcie od ściany okapowej" unit="m" value={w.length} min={0} max={3000} onChange={(v) => editWing(w.id, (x) => void (x.length = v))} />
              </div>
              <div className="field">
                <span className="label">Koniec dobudówki</span>
                <Picker label="Koniec dobudówki" value={w.end} mode="segments" options={END_OPTIONS} onChange={(v) => editWing(w.id, (x) => void (x.end = v))} />
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              edit((a) => {
                const width = Math.min(a.length, Math.round(a.width * 0.6));
                a.wings = [...(a.wings ?? []), { id: uid(), side: 'left', at: Math.round(a.length / 2), width, length: 300, end: 'gable' }];
              })
            }
          >
            + Dobudówka z koszami (dach L / T)
          </button>
          {roof && <AtticRoofPlanDrawing attic={attic} roof={roof} title="Rzut dachu" />}
        </>
      )}

      {attic.plan && (
        <div className="field">
          <span className="label">Kalenica na planie</span>
          <Picker label="Kalenica na planie" value={attic.planRot ?? 0} mode="segments" options={RIDGE_OPTIONS} onChange={(v) => edit((a) => void (a.planRot = v))} />
        </div>
      )}

      <h4 className="attic-sub">Krokwie</h4>
      <div className="grid-2">
        <DimInput label="Rozstaw osiowy krokwi" unit="cm" value={attic.rafterSpacing} min={30} max={200} onChange={(v) => edit((a) => void (a.rafterSpacing = v))} />
        <DimInput
          label="Pierwsza krokiew od ściany szczytowej"
          unit="cm"
          value={attic.firstRafter}
          min={0}
          max={200}
          hint="do osi krokwi"
          onChange={(v) => edit((a) => void (a.firstRafter = v))}
        />
        <DimInput label="Szerokość krokwi" unit="cm" value={attic.rafterWidth} min={3} max={30} onChange={(v) => edit((a) => void (a.rafterWidth = v))} />
        <DimInput label="Wysokość krokwi" unit="cm" value={attic.rafterHeight} min={8} max={40} onChange={(v) => edit((a) => void (a.rafterHeight = v))} />
      </div>

      <h4 className="attic-sub">Zabudowa</h4>
      <div className="grid-2">
        <div className="field attic-system">
          <label htmlFor={`as-${attic.id}`}>System</label>
          <AtticSystemSelect
            id={`as-${attic.id}`}
            value={sys.id}
            onChange={(id) => pickSystem(id, ceilingSystemById(id).defaultBoard)}
            onPick={(p) => pickSystem(p.system.id, p.boardId)}
          />
          <small className="hint">{sys.info}</small>
        </div>
        <div className="field">
          <label htmlFor={`ab-${attic.id}`}>Płyta</label>
          <Picker id={`ab-${attic.id}`} label="Płyta" value={attic.boardId} options={BOARD_OPTIONS()} onChange={(v) => edit((a) => void (a.boardId = v))} />
        </div>
        <div className="field">
          <label htmlFor={`aw1-${attic.id}`}>Wełna między krokwiami</label>
          <Picker id={`aw1-${attic.id}`} label="Wełna między krokwiami" value={attic.woolBetween} mode="sheet" options={mmOptions(ATTIC_WOOL_BETWEEN)} onChange={(v) => edit((a) => void (a.woolBetween = v))} />
        </div>
        {grid.frame.mount === 'between' ? (
          <DimInput
            label="Widoczna część krokwi"
            unit="cm"
            value={attic.reveal ?? ATTIC_REVEAL}
            min={0}
            max={Math.max(0, attic.rafterHeight - 4)}
            hint="od lica płyt do spodu krokwi"
            onChange={(v) => edit((a) => void (a.reveal = v))}
          />
        ) : (
          <div className="field">
            <label htmlFor={`aw2-${attic.id}`}>Wełna pod krokwiami</label>
            <Picker id={`aw2-${attic.id}`} label="Wełna pod krokwiami" value={attic.woolUnder} mode="sheet" options={mmOptions(ATTIC_WOOL_UNDER)} onChange={(v) => edit((a) => void (a.woolUnder = v))} />
            <small className="hint">
              {grid.frame.mount === 'direct'
                ? `ruszt leży na krokwiach: mieści się najwyżej ${Math.round(grid.profileMm)} mm`
                : grid.hangerSize
                  ? `druga warstwa w poprzek krokwi, obniża zabudowę · dobrany ${grid.frame.hangerLabel ?? 'wieszak'}: ${grid.hangerSize.name}`
                  : 'druga warstwa w poprzek krokwi, obniża zabudowę'}
            </small>
          </div>
        )}
      </div>

      <AtticWindowsField attic={attic} grid={grid} edit={edit} />

      <VaporField spec={ceilingVaporSpec(sys)} enabled={vaporBarrierOn(attic.vaporBarrier, ceilingVaporSpec(sys))} areaM2={area} onToggle={(on) => edit((a) => void (a.vaporBarrier = on))} />

      <h4>Okładziny ścian</h4>
      {(
        [
          ['kneeLining', attic.roof === 'mono' ? 'Ścianka kolankowa i ściana wysoka' : 'Ścianki kolankowe', ['knee-left', 'knee-right']],
          ['gableLining', 'Ściany szczytowe (obie)', ['gable']],
        ] as const
      ).map(([key, label, ids]) => {
        const faces = result?.walls.filter((w) => (ids as readonly string[]).includes(w.face.id)) ?? [];
        return (
          <LiningEditor
            key={key}
            label={label}
            lining={attic[key]}
            result={
              attic[key] && result
                ? { info: { netAreaM2: faces.reduce((t, w) => t + w.areaM2 * w.face.count, 0), warnings: faces.flatMap((w) => w.warnings) } }
                : undefined
            }
            onToggle={(on) =>
              edit((a) => {
                if (on) a[key] = createLining(1, 'O-CD-1');
                else delete a[key];
              })
            }
            onEdit={(fn) =>
              edit((a) => {
                const l = a[key];
                if (l) fn(l);
              })
            }
            idBase={`${attic.id}-${key}`}
            areaLabel="okładziny, płyty docięte do skosu"
          />
        );
      })}

      <Warnings items={result?.warnings ?? grid.warnings} />
      <details className="attic-assumptions">
        <summary>Założenia wyliczeń ({(result?.assumptions ?? grid.assumptions).length})</summary>
        <ul>
          {(result?.assumptions ?? grid.assumptions).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Przekrój poprzeczny: mury, krokwie, wełna, lico płyt, linie CD i wymiary */
export function AtticSectionPreview({ attic, grid }: { attic: Attic; grid: AtticGrid }) {
  const W = attic.width;
  const st = grid.structure;
  const top = Math.max(st.ridgeHeight, ...st.surfaces.map((s) => Math.max(s.a.z, s.b.z))) + attic.rafterHeight + 20;
  const pad = 95;
  const wall = 25;
  const X = (x: number) => x;
  const Z = (z: number) => top - z;
  const pitch = (attic.pitch * Math.PI) / 180;
  const rh = attic.rafterHeight / Math.cos(pitch);
  const slopes = st.surfaces.filter((s) => s.kind === 'slope');
  const collar = st.surfaces.find((s) => s.kind === 'collar');
  const face = grid.section.surfaces;
  const poly = (pts: { x: number; z: number }[]) => pts.map((p) => `${X(p.x).toFixed(1)},${Z(p.z).toFixed(1)}`).join(' ');
  const outline = (list: typeof face) => list.flatMap((q, i) => (q.id === 'right' ? (i === 0 ? [q.b, q.a] : [q.a]) : i === 0 ? [q.a, q.b] : [q.b]));
  const facePts = outline(face);
  const mono = attic.roof === 'mono';
  const rightH = mono ? st.ridgeHeight : attic.kneeRight;
  const vbW = W + 2 * (wall + pad);
  // tekst czytelny także na telefonie: ok. 1/30 szerokości rysunku
  const fs = Math.max(22, vbW / 30);
  const dimY = Z(0) + fs;

  return (
    <svg
      className="attic-section"
      viewBox={`${-wall - pad} ${-fs} ${vbW} ${top + 3.4 * fs}`}
      style={{ fontSize: fs }}
      role="img"
      aria-label={`Przekrój poddasza: szerokość ${fmtNum(W / 100)} m, kalenica ${fmtNum(st.ridgeHeight / 100)} m, kąt ${fmtNum(attic.pitch, 1)}°`}
    >
      {/* posadzka i mury */}
      <line x1={-wall - 10} y1={Z(0)} x2={W + wall + 10} y2={Z(0)} className="as-floor" />
      {attic.kneeLeft > 0 && <rect x={-wall} y={Z(attic.kneeLeft)} width={wall} height={attic.kneeLeft} className="as-masonry" />}
      {rightH > 0 && <rect x={W} y={Z(rightH)} width={wall} height={rightH} className="as-masonry" />}
      {/* krokwie i wełna między nimi */}
      {slopes.map((s) => {
        const up = { x: st.ridgeX, z: st.ridgeHeight };
        const low = s.id === 'left' ? { x: 0, z: attic.kneeLeft } : { x: W, z: attic.kneeRight };
        const wool = Math.min(attic.woolBetween / 10, attic.rafterHeight) / Math.cos(pitch);
        return (
          <g key={s.id}>
            <polygon points={poly([low, up, { x: up.x, z: up.z + rh }, { x: low.x, z: low.z + rh }])} className="as-rafter" />
            {attic.woolBetween > 0 && (
              <polygon points={poly([s.a.z > low.z ? s.a : low, s.b, { x: s.b.x, z: s.b.z + wool }, { x: low.x, z: low.z + wool }])} className="as-wool" />
            )}
          </g>
        );
      })}
      {collar && (
        <g>
          <rect x={collar.a.x} y={Z(collar.a.z + 14)} width={collar.run} height={14} className="as-rafter" />
          {attic.woolBetween > 0 && <rect x={collar.a.x} y={Z(collar.a.z + Math.min(attic.woolBetween / 10, 30))} width={collar.run} height={Math.min(attic.woolBetween / 10, 30)} className="as-wool" />}
        </g>
      )}
      {/* wełna pod krokwiami: pas między spodem konstrukcji a licem płyt */}
      {attic.woolUnder > 0 && face.length > 0 && (
        <polygon
          points={poly([...facePts, ...outline(st.surfaces).reverse()])}
          className="as-wool under"
        />
      )}
      {/* lico płyt i linie CD */}
      <polyline points={poly(facePts)} className="as-board" />
      {grid.surfaces.flatMap((g) =>
        g.cd.map((sPos) => {
          const k = g.surface.run ? sPos / g.surface.run : 0;
          const x = g.surface.a.x + (g.surface.b.x - g.surface.a.x) * k;
          const z = g.surface.a.z + (g.surface.b.z - g.surface.a.z) * k;
          return <circle key={`${g.surface.id}-${sPos}`} cx={X(x)} cy={Z(z)} r={3.2} className="as-cd" />;
        }),
      )}
      {/* wymiary */}
      <line x1={0} y1={dimY} x2={W} y2={dimY} className="as-dim" />
      <text x={W / 2} y={dimY + fs} textAnchor="middle" className="as-text">
        {fmtNum(W / 100)} m
      </text>
      {attic.kneeLeft > 0 && (
        <text x={-wall - 6} y={Z(attic.kneeLeft / 2)} textAnchor="end" className="as-text">
          {Math.round(attic.kneeLeft)}
        </text>
      )}
      {!mono && attic.kneeRight > 0 && (
        <text x={W + wall + 6} y={Z(attic.kneeRight / 2)} textAnchor="start" className="as-text">
          {Math.round(attic.kneeRight)}
        </text>
      )}
      {collar && (
        <text x={collar.a.x + collar.run / 2} y={Z(collar.a.z) + 1.5 * fs} textAnchor="middle" className="as-text">
          jętka {fmtNum((attic.collarHeight ?? 0) / 100)} m
        </text>
      )}
      <text x={mono ? W - 10 : st.ridgeX} y={Z(st.ridgeHeight) + (collar ? -attic.rafterHeight - fs * 0.4 : 2.5 * fs)} textAnchor={mono ? 'end' : 'middle'} className="as-text">
        {fmtNum(st.ridgeHeight / 100)} m · {fmtNum(attic.pitch, 1)}°
      </text>
    </svg>
  );
}
