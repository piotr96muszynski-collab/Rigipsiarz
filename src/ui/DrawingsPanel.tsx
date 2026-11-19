import { AtticSectionDrawing, AtticSurfaceDrawing } from '../drawings/AtticDrawing';
import { useMemo, useState } from 'react';
import { liningAsWall, liningLayout, wallLayout, type WallLayout } from '../calc/layout';
import { ceilingVaporSpec, vaporBarrierOn, wallVaporSpec } from '../calc/vaporBarrier';
import { ceilingFixerGrid, ceilingInsulation, liningKey, wallInsulation } from '../calc/materials';
import type { MaterialLine, ProjectCalc, Requirement } from '../calc/materials';
import { PRODUCTS, boardById, ceilingSystemById, sideLayers, wallSystemById, type WallSystem } from '../catalog/rigips';
import { CeilingBoardsDrawing, CeilingGridDrawing } from '../drawings/CeilingDrawing';
import { JunctionDetail, OpeningDetail, type DetailKind } from '../drawings/Details';
import { CeilingSection, WallSection } from '../drawings/Sections';
import { WallBoardsDrawing, WallBracketsDrawing, WallFixersDrawing, WallFrameDrawing, faceName } from '../drawings/WallDrawing';
import { CeilingFixersDrawing } from '../drawings/CeilingDrawing';
import { analyzeJunctions, type WallJunctions } from '../geometry/geometry';
import { buildContacts } from '../geometry/contacts';
import { isNewWall } from '../geometry/geometry';
import type { Lining, Project, Wall } from '../model/types';
import { fmtNum } from './wallStyle';

interface Props {
  project: Project;
  calc: ProjectCalc;
}

const fmtQty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** Lista cięć profili jednego elementu: produkt → [długość cm, sztuk] */
function cutList(req: Requirement) {
  return Object.entries(req.pieces)
    .map(([pid, lens]) => {
      const m = new Map<number, number>();
      for (const l of lens) {
        const k = Math.round(l * 100);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return {
        pid,
        name: PRODUCTS[pid]?.name ?? pid,
        rows: [...m.entries()].sort((a, b) => b[0] - a[0]),
        total: lens.reduce((a, b) => a + b, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

function CutTable({ req, title }: { req: Requirement; title: string }) {
  const list = cutList(req);
  if (!list.length) return null;
  return (
    <div className="cut-list">
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Długości do cięcia</th>
            <th className="num">Razem</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.pid}>
              <td>{r.name}</td>
              <td>
                {r.rows.map(([len, n]) => (
                  <span key={len} className="cut-chip">
                    {n} × {len} cm
                  </span>
                ))}
              </td>
              <td className="num">{fmtNum(r.total)} mb</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Bez zapasu. Liczbę sztuk profili handlowych (po rozkroju) znajdziesz w zestawieniu materiałów.</p>
    </div>
  );
}

const JUNCTION_DETAIL: Record<string, DetailKind | undefined> = {
  corner: 'corner',
  'tee-through': 'tee',
  'tee-abut': 'tee',
  cross: 'cross',
  'existing-wall': 'existing-wall',
  free: 'free',
};

const wallVapor = (w: Wall) => vaporBarrierOn(w.vaporBarrier, wallVaporSpec(wallSystemById(w.systemId)));
const ceilingVapor = (c: Project['ceilings'][number]) => vaporBarrierOn(c.vaporBarrier, ceilingVaporSpec(ceilingSystemById(c.systemId)));

export function DrawingsPanel({ project, calc }: Props) {
  const junctions = useMemo(() => analyzeJunctions(project), [project]);
  const walls = project.walls.filter((w) => calc.walls.has(w.id));
  const ceilings = project.ceilings.filter((c) => calc.ceilings.has(c.id));
  // okładziny istniejących ścian (mur + płyty na kleju, CD 60 albo łącznikach ATLAS)
  const contacts = useMemo(() => buildContacts(project), [project]);
  const linings = project.walls
    .filter((w) => !isNewWall(w))
    .flatMap((w) => (w.linings ?? []).filter((l) => calc.linings.has(liningKey(w.id, l.side))).map((l) => ({ w, l })));

  // unikalne systemy i detale w projekcie
  const wallSystems = useMemo(() => {
    const m = new Map<string, (typeof walls)[number]>();
    // ściany i okładziny (paroizolacja zwykle tylko w okładzinach)
    for (const w of [...walls, ...linings.map(({ w, l }) => liningAsWall(w, l))])
      m.set(`${w.systemId}|${w.boardId}|${w.studSpacing}|${JSON.stringify(wallInsulation(w))}|${wallVapor(w)}`, w);
    return [...m.values()];
  }, [walls, linings]);
  const ceilingSystems = useMemo(() => {
    const m = new Map<string, (typeof ceilings)[number]>();
    for (const c of ceilings) m.set(`${c.systemId}|${c.boardId}|${JSON.stringify(ceilingInsulation(c))}|${ceilingVapor(c)}`, c);
    return [...m.values()];
  }, [ceilings]);
  const details = useMemo(() => {
    const out = new Map<DetailKind, (typeof walls)[number]>();
    for (const w of walls) {
      const frame = wallSystemById(w.systemId).frame;
      if (frame === 'glued' || frame === 'cd-lining' || frame === 'point-fix' || frame === 'hat-lining') continue; // okładziny: detale połączeń ścian nie dotyczą
      const j = junctions.get(w.id);
      if (!j) continue;
      for (const k of [j.endA, j.endB]) {
        const d = JUNCTION_DETAIL[k];
        if (d && !out.has(d)) out.set(d, w);
      }
    }
    const order: DetailKind[] = ['corner', 'tee', 'cross', 'existing-wall', 'free'];
    return order.filter((k) => out.has(k)).map((k) => ({ kind: k, wall: out.get(k)! }));
  }, [walls, junctions]);
  const openingDetails = useMemo(() => {
    const m = new Map<string, { kind: 'door' | 'window'; reinforced: boolean; profile: number }>();
    for (const w of walls)
      if (wallSystemById(w.systemId).frame !== 'glued' && wallSystemById(w.systemId).frame !== 'point-fix')
      for (const o of w.openings) {
        const profile = wallSystemById(w.systemId).profile;
        m.set(`${o.kind}|${o.reinforced}|${profile}`, { kind: o.kind, reinforced: o.reinforced, profile });
      }
    return [...m.values()];
  }, [walls]);

  const attics = (project.attics ?? []).filter((a) => calc.attics.has(a.id));

  if (!walls.length && !ceilings.length && !linings.length && !attics.length)
    return (
      <div className="empty">
        <h3>Brak rysunków</h3>
        <p>Dodaj ścianę, sufit lub poddasze, a rysunki montażowe przygotują się automatycznie.</p>
      </div>
    );

  return (
    <div className="drawings">
      <div className="print-only print-head">
        <h1>{project.name}</h1>
        <p>
          Rysunki montażowe i zestawienie materiałów · {new Date().toLocaleDateString('pl-PL')} · Rigipsiarz
        </p>
      </div>

      <div className="card drawings-intro no-print">
        <p>
          Rysunki powstają z tych samych wyliczeń co lista zakupów: każdy słupek, profil i wieszak na schemacie jest policzony w
          materiałach. Dotknij rysunku, żeby otworzyć go na całym ekranie i powiększać dwoma palcami.
        </p>
        <div className="actions wrap">
          <button className="btn primary" onClick={() => window.print()}>
            Drukuj / PDF z listą materiałów
          </button>
        </div>
      </div>

      {walls.map((w) => {
        const i = project.walls.indexOf(w) + 1;
        const j = junctions.get(w.id)!;
        return <WallSheet key={w.id} index={i} project={project} wallId={w.id} j={j} req={calc.walls.get(w.id)!.req} />;
      })}

      {linings.map(({ w, l }) => {
        const i = project.walls.filter((x) => !isNewWall(x)).indexOf(w) + 1;
        return (
          <LiningSheet
            key={`${w.id}:${l.side}`}
            index={i}
            wall={w}
            lining={l}
            layout={liningLayout(project, w, l, contacts)}
            req={calc.linings.get(liningKey(w.id, l.side))!.req}
          />
        );
      })}

      {ceilings.map((c) => {
        const i = project.ceilings.indexOf(c) + 1;
        const sys = ceilingSystemById(c.systemId);
        const r = calc.ceilings.get(c.id)!;
        return (
          <section key={c.id} className="card sheet">
            <header className="sheet-head">
              <h3>Sufit {i}</h3>
              <span className="muted small">
                {fmtNum(r.areaM2, 1)} m² · obwód {fmtNum(r.perimeterM)} m · {sys.name}
              </span>
            </header>
            {sys.kind === 'point-fix' ? (
              <>
                <h4>Rozstaw łączników – rzut</h4>
                <CeilingFixersDrawing c={c} title={`Sufit ${i} – łączniki`} />
                <p className="small">
                  Płyta przykręcana do łączników ATLAS M-System 3G w siatce {sys.mainSpacing}×{sys.secondarySpacing} cm – bez
                  profili, razem {ceilingFixerGrid(c, sys).points.length} łączników.
                </p>
              </>
            ) : (
              <>
                <h4>Ruszt – rzut</h4>
                <CeilingGridDrawing c={c} title={`Sufit ${i} – ruszt`} />
              </>
            )}
            <h4>Rozkład płyt</h4>
            <CeilingBoardsDrawing c={c} title={`Sufit ${i} – płyty`} />
            <CutTable req={r.req} title="Lista cięć profili" />
          </section>
        );
      })}

      {attics.map((a, i) => {
        const r = calc.attics.get(a.id)!;
        const sys = ceilingSystemById(a.systemId);
        const fr = r.grid.frame;
        return (
          <section key={a.id} className="card sheet">
            <header className="sheet-head">
              <h3>Poddasze {i + 1}</h3>
              <span className="muted small">
                {fmtNum(r.areaM2, 1)} m² zabudowy{r.hangers ? ` · ${r.hangers} ${fr.hanger ? 'wieszaków' : 'mocowań do krokwi'}` : ''} · {sys.name}
              </span>
            </header>
            <h4>Przekrój poprzeczny</h4>
            <AtticSectionDrawing attic={a} grid={r.grid} title={`Poddasze ${i + 1} – przekrój`} />
            {r.grid.surfaces.map((g) => (
              <div key={g.surface.id}>
                <h4>{g.surface.label} – ruszt i punkty mocowania</h4>
                <AtticSurfaceDrawing attic={a} g={g} grid={r.grid} title={`Poddasze ${i + 1} – ${g.surface.label.toLowerCase()}`} />
              </div>
            ))}
            <p className="small">
              {fr.mount === 'between'
                ? 'Ruszt jest między krokwiami: elementy wzdłuż krokwi po obu stronach każdego pola, poprzeczki między nimi. Wymiary czerwone: osie krokwi od ściany szczytowej.'
                : `${fr.hanger ? 'Wieszaki mocuje się' : 'Ruszt przykręca się'} do krokwi (na suficie do jętek) w miejscach przecięcia z elementami rusztu. Wymiary czerwone: osie krokwi z mocowaniem od ściany szczytowej.`}{' '}
              Wymiary niebieskie: elementy rusztu od dolnej krawędzi płaszczyzny, mierzone po licu zabudowy.
            </p>
            <CutTable req={r.req} title="Lista cięć profili" />
          </section>
        );
      })}

      <section className="card sheet">
        <header className="sheet-head">
          <h3>Przekroje systemów</h3>
          <span className="muted small">Budowa przegród użytych w projekcie</span>
        </header>
        {wallSystems.map((w) => {
          const sys = wallSystemById(w.systemId);
          return (
            <div key={w.id}>
              <h4>{sys.name}</h4>
              <WallSection sys={sys} board={boardById(w.boardId)} boarding={w} spacing={w.studSpacing} wool={wallInsulation(w, sys)} vapor={wallVapor(w)} />
            </div>
          );
        })}
        {ceilingSystems.map((c) => {
          const sys = ceilingSystemById(c.systemId);
          return (
            <div key={c.id}>
              <h4>{sys.name}</h4>
              <CeilingSection sys={sys} board={boardById(c.boardId)} wool={ceilingInsulation(c)} levels={calc.ceilings.get(c.id)?.levels} vapor={ceilingVapor(c)} />
            </div>
          );
        })}
      </section>

      {(details.length > 0 || openingDetails.length > 0) && (
        <section className="card sheet">
          <header className="sheet-head">
            <h3>Detale połączeń</h3>
            <span className="muted small">Tylko te, które występują w projekcie</span>
          </header>
          <div className="detail-grid">
            {details.map(({ kind, wall }) => {
              const sys = wallSystemById(wall.systemId);
              return (
                <JunctionDetail
                  key={kind}
                  kind={kind}
                  p={{ profile: sys.profile, layers: sys.layers, sides: sys.sides, boardColor: boardById(wall.boardId).color }}
                />
              );
            })}
            {openingDetails.map((o) => (
              <OpeningDetail key={`${o.kind}-${o.reinforced}-${o.profile}`} {...o} />
            ))}
          </div>
        </section>
      )}

      <section className="card sheet materials-sheet">
        <header className="sheet-head">
          <h3>Zestawienie materiałów</h3>
          <span className="muted small">
            {project.settings.wasteEnabled ? `Z zapasem ${project.settings.waste}% na płyty, wkręty, taśmy, masę i wełnę` : 'Bez zapasu'} · profile z rozkroju
          </span>
        </header>
        <MaterialsTable lines={calc.total} />
      </section>
    </div>
  );
}

function WallSheet({ index, project, wallId, j, req }: { index: number; project: Project; wallId: string; j: WallJunctions; req: Requirement }) {
  const w = project.walls.find((x) => x.id === wallId)!;
  // req zmienia się też po zmianie długości płyt w ustawieniach aplikacji
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const l = useMemo(() => wallLayout(project, w, j), [project, w, j, req]);
  const sys = wallSystemById(w.systemId);
  return (
    <section className="card sheet">
      <header className="sheet-head">
        <h3>Ściana {index}</h3>
        <span className="muted small">
          {fmtNum(l.L)} × {fmtNum(l.H)} m · {sys.name} · płyta {boardById(w.boardId).short}
        </span>
      </header>
      <SheetBody l={l} sys={sys} name={`Ściana ${index}`} req={req} />
    </section>
  );
}

/** Nazwa łącznika ATLAS do legendy, np. „łącznik ATLAS M-System 3G L100” */
const fixerName = (sys: WallSystem) => `łącznik ATLAS M-System 3G ${(sys.fixer?.product ?? 'ATLAS_3G_L100').replace('ATLAS_3G_', '')}`;

/** Konstrukcja (ruszt albo łączniki) i rozkład płyt – wspólne dla ściany i okładziny muru */
function SheetBody({ l, sys, name, req }: { l: WallLayout; sys: WallSystem; name: string; req: Requirement }) {
  const [face, setFace] = useState(0);
  const studs = [...new Set(l.studs.map((s) => Math.round(s.x * 100)))];
  return (
    <>
      {l.frame === 'glued' ? (
        <p className="small">Płyty klejone do ściany na placki z kleju gipsowego – bez rusztu.</p>
      ) : l.frame === 'panel' ? (
        <p className="small">
          Bez słupków: {l.studLabel} {sys.panel?.edgeSides === 'all' ? 'po obwodzie (przy ścianach, posadzce i stropie)' : 'przy ścianach po obu stronach'}, kołki co{' '}
          {sys.panel?.anchorSpacing} cm. Płyty poziomo, każda w jednym kawałku od ściany do ściany; warstwy skręcone ze sobą, styki poziome warstw
          przesunięte o pół płyty.
        </p>
      ) : l.frame === 'point-fix' ? (
        <>
          <h4>Rozstaw łączników talerzykowych</h4>
          <WallFixersDrawing l={l} title={`${name} – łączniki ATLAS`} fixerName={fixerName(sys)} />
          {l.fixers && (
            <p className="small stud-list">
              <strong>Osie kolumn od lewej krawędzi (cm):</strong> {l.fixers.xs.map((x) => Math.round(x * 100)).join(' · ')}
              <br />
              <strong>Rzędy od posadzki (cm):</strong> {l.fixers.ys.map((y) => Math.round(y * 100)).join(' · ')}
            </p>
          )}
        </>
      ) : (
        <>
          <h4>Konstrukcja</h4>
          <WallFrameDrawing l={l} title={`${name} – konstrukcja`} />
          <p className="small stud-list">
            <strong>Osie {l.frame === 'cd-lining' ? 'profili CD' : l.frame === 'hat-lining' ? 'profili kapeluszowych' : 'słupków'} od lewej krawędzi (cm):</strong> {studs.join(' · ')}
          </p>
          {l.brackets && (
            <>
              <h4>{l.brackets.hat ? 'Kołki profili kapeluszowych' : 'Uchwyty ES'} – miejsca wiercenia</h4>
              <WallBracketsDrawing l={l} title={`${name} – ${l.brackets.hat ? 'kołki' : 'uchwyty ES'}`} />
              <p className="small stud-list">
                <strong>Wysokości {l.brackets.hat ? 'kołków' : 'uchwytów'} od posadzki (cm):</strong>{' '}
                {[...new Set(l.brackets.points.map((q) => Math.round(q.y * 100)))].sort((a, b) => a - b).join(' · ')}
              </p>
            </>
          )}
        </>
      )}
      <h4>Rozkład płyt</h4>
      {l.faces.length > 1 && (
        <div className="seg no-print" role="tablist" aria-label="Okładzina">
          {l.faces.map((f, i) => (
            <button key={i} role="tab" aria-selected={face === i} className={face === i ? 'on' : ''} onClick={() => setFace(i)}>
              {faceName(f, sys.sides, Math.max(...sideLayers(sys)), new Set(l.faces.map((q) => q.board)).size)}
            </button>
          ))}
        </div>
      )}
      {l.faces.map((f, i) => (
        <div key={i} className={i === face ? '' : 'print-only'}>
          {l.faces.length > 1 && <h5 className="print-only">{faceName(f, sys.sides, Math.max(...sideLayers(sys)), new Set(l.faces.map((q) => q.board)).size)}</h5>}
          <WallBoardsDrawing l={l} face={f} title={`${name} – ${faceName(f, sys.sides, Math.max(...sideLayers(sys)), new Set(l.faces.map((q) => q.board)).size)}`} />
        </div>
      ))}
      {l.frame !== 'glued' && l.frame !== 'point-fix' && <CutTable req={req} title="Lista cięć profili" />}
    </>
  );
}

/** Arkusz okładziny istniejącej ściany (muru) */
function LiningSheet({ index, wall, lining, layout, req }: { index: number; wall: Wall; lining: Lining; layout: WallLayout; req: Requirement }) {
  const sys = wallSystemById(lining.systemId);
  const side = (wall.linings ?? []).length > 1 ? (lining.side === 1 ? ', strona 1' : ', strona 2') : '';
  return (
    <section className="card sheet">
      <header className="sheet-head">
        <h3>
          Okładzina muru {index}
          {side}
        </h3>
        <span className="muted small">
          {fmtNum(layout.L)} × {fmtNum(layout.H)} m · {sys.name} · płyta {boardById(lining.boardId).short}
          {wall.backing ? ' · mur dodany automatycznie' : ''}
        </span>
      </header>
      <SheetBody l={layout} sys={sys} name={`Okładzina muru ${index}${side}`} req={req} />
    </section>
  );
}

function MaterialsTable({ lines }: { lines: MaterialLine[] }) {
  return (
    <table className="materials-table">
      <thead>
        <tr>
          <th>Materiał</th>
          <th className="num">Ilość</th>
          <th>Uwagi</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <td>{l.name}</td>
            <td className="num">
              <strong>{l.packs ? `${l.packs} ${l.packUnit}` : `${fmtQty(l.qty)} ${l.unit}`}</strong>
              {l.packs ? <span className="muted small"> ({fmtQty(l.qty)} {l.unit})</span> : null}
            </td>
            <td className="muted small">{l.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

