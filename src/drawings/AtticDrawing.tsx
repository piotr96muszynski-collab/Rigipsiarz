import { splicePositions } from '../calc/layout';
import { atticSection, type AtticGrid, type AtticSurfaceGrid } from '../calc/attic';
import { cdLineSegments, windowFixPoints, type RoofWindowGeom } from '../calc/atticWindows';
import type { AtticBoardLayer } from '../calc/atticBoards';
import { PRODUCTS, boardById } from '../catalog/rigips';
import type { Attic } from '../model/types';
import { C, ChainH, ChainV, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

const RAFTER = '#d9b98a';
const RAFTER_EDGE = '#8a6230';

/**
 * Rozwinięcie jednej płaszczyzny (skosu albo sufitu pod jętkami): krokwie, profile CD w poprzek krokwi
 * i punkty mocowania wieszaków. Poziomo długość wzdłuż kalenicy, pionowo długość po skosie od dolnej krawędzi.
 */
export function AtticSurfaceDrawing({
  attic,
  g,
  grid,
  title,
  windows = [],
  maxHanger = 100,
}: {
  attic: Attic;
  g: AtticSurfaceGrid;
  grid: AtticGrid;
  title: string;
  /** Okna dachowe (wszystkie płaszczyzny – rysowane tylko te z tej) */
  windows?: RoofWindowGeom[];
  /** Największy rozstaw wieszaków systemu, cm (mocowania obramowania okna) */
  maxHanger?: number;
}) {
  const L = attic.length;
  const run = g.surface.run;
  const f = clamp(Math.max(L, run) / 26, 8, 30);
  const m = f * 6.5;
  const vb: [number, number, number, number] = [-m, -m, L + 2 * m, run + 2 * m];
  const Y = (s: number) => run - s;
  const slope = g.surface.kind === 'slope';
  // wszystkie krokwie (jasne) i te z wieszakami (z punktami)
  const all: number[] = [];
  for (let u = Math.max(0, attic.firstRafter); u <= L + 1e-6; u += Math.max(20, attic.rafterSpacing)) all.push(u);
  const fr = grid.frame;
  const between = fr.mount === 'between';
  const splices = fr.joiner && !between ? splicePositions(0, L) : [];
  const edgeName = fr.edge ? PRODUCTS[fr.edge].name.replace(/^Profil (Rigips )?/, '').replace(/ \(.*$/, '') : '';
  const profName = PRODUCTS[grid.profile].name.replace(/^Profil (Rigips )?/, '');
  // ruszt krzyżowy: profile nośne pod krokwiami (pionowo), profile pod płyty w poprzek, wieszaki na nośnych
  const carrier = grid.carrier;
  const lineColor = carrier ? C.secondary : C.main;
  const wins = windows.filter((x) => x.surfaceId === g.surface.id);
  const sOf = (p: { x: number; z: number }) => {
    const d = { x: (g.surface.b.x - g.surface.a.x) / run, z: (g.surface.b.z - g.surface.a.z) / run };
    return (p.x - g.surface.a.x) * d.x + (p.z - g.surface.a.z) * d.z;
  };
  const winPts = wins.flatMap((x) => windowFixPoints(x, grid, maxHanger));
  const hangerPts = carrier ? g.hangerU.flatMap((u) => g.fixS.map((s) => [u, s] as const)) : g.cd.flatMap((s) => g.hangerU.map((u) => [u, s] as const));

  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <rect x={0} y={0} width={L} height={run} fill="#f7f8fa" />
        {all.map((u) => (
          <rect key={u} x={u - attic.rafterWidth / 2} y={0} width={attic.rafterWidth} height={run} fill={RAFTER} stroke={RAFTER_EDGE} strokeWidth={0.6} {...nss} />
        ))}
        {between
          ? grid.bays.flatMap((b) => [
              ...g.cd.map((s) => <line key={`${b.u}-${s}`} x1={b.u} y1={Y(s)} x2={b.u + b.w} y2={Y(s)} stroke={C.main} strokeWidth={3} {...nss} />),
              <line key={`${b.u}-l`} x1={b.u + 1} y1={0} x2={b.u + 1} y2={run} stroke={C.ud} strokeWidth={3} {...nss} />,
              <line key={`${b.u}-r`} x1={b.u + b.w - 1} y1={0} x2={b.u + b.w - 1} y2={run} stroke={C.ud} strokeWidth={3} {...nss} />,
            ])
          : g.cd.flatMap((s) =>
              cdLineSegments(L, s, g.surface.id, wins).map(([u0, u1]) => <line key={`${s}-${u0}`} x1={u0} y1={Y(s)} x2={u1} y2={Y(s)} stroke={lineColor} strokeWidth={3} {...nss} />),
            )}
        {/* okna dachowe: otwór w płytach (krawędzie glifów), rzut ościeżnicy, obramowanie otworu */}
        {wins.map((x) => {
          const f0 = sOf(x.frameBottom);
          const f1 = sOf(x.frameTop);
          return (
            <g key={x.w.id}>
              <rect x={x.u0} y={Y(x.s1)} width={x.u1 - x.u0} height={x.s1 - x.s0} fill="#ffffff" stroke={INK} strokeWidth={1.5} {...nss} />
              <rect x={x.u0} y={Y(f1)} width={x.u1 - x.u0} height={f1 - f0} fill="#dbeafe" stroke={C.main} strokeWidth={1} strokeDasharray="6 4" {...nss} />
              <line x1={x.u0} y1={Y(f0)} x2={x.u0 + (x.u1 - x.u0) / 2} y2={Y(f1)} stroke={C.main} strokeWidth={0.6} {...nss} />
              <line x1={x.u1} y1={Y(f0)} x2={x.u0 + (x.u1 - x.u0) / 2} y2={Y(f1)} stroke={C.main} strokeWidth={0.6} {...nss} />
              {x.cross.map((c) => (
                <line key={`c${c.s}`} x1={c.u0} y1={Y(c.s)} x2={c.u1} y2={Y(c.s)} stroke={C.extra} strokeWidth={4} {...nss} />
              ))}
              {x.side.map((sd) => (
                <line key={`s${sd.u}`} x1={sd.u} y1={Y(sd.s0)} x2={sd.u} y2={Y(sd.s1)} stroke={C.extra} strokeWidth={4} {...nss} />
              ))}
              <text x={(x.u0 + x.u1) / 2} y={Y((f0 + f1) / 2)} fontSize={Math.min(f * 0.8, (x.u1 - x.u0) / 6)} textAnchor="middle" fill={INK}>
                {x.w.sizeCode ?? `${cm(x.w.width)}×${cm(x.w.height)}`}
              </text>
              <ChainH xs={[0, x.u0, x.u1, L]} y={run} off={f * 1.6 + f * 1.4} f={f * 0.7} color={C.extra} />
              <ChainV ys={[run, Y(x.s0), Y(x.s1), 0].sort((p, q) => p - q)} x={x.u1} off={f * 1.2} f={f * 0.7} color={C.extra} />
            </g>
          );
        })}
        {carrier && g.hangerU.map((u) => <line key={`n${u}`} x1={u} y1={0} x2={u} y2={run} stroke={C.main} strokeWidth={4} {...nss} />)}
        {carrier?.cross && g.cd.flatMap((s) => g.hangerU.map((u) => <rect key={`x${s}-${u}`} x={u - f * 0.25} y={Y(s) - f * 0.25} width={f * 0.5} height={f * 0.5} fill="none" stroke={INK} strokeWidth={1} {...nss} />))}
        {g.cd.flatMap((s) => splices.map((u) => <rect key={`${s}-${u}`} x={u - f * 0.5} y={Y(s) - f * 0.15} width={f} height={f * 0.3} fill={INK} />))}
        {hangerPts.map(([u, s]) => <circle key={`${s}-${u}`} cx={u} cy={Y(s)} r={f * 0.3} fill={C.hanger} />)}
        {winPts.map(([u, s], i) => <circle key={`w${i}`} cx={u} cy={Y(s)} r={f * 0.3} fill={C.hanger} stroke="#fff" strokeWidth={1} {...nss} />)}
        {/* profil przyścienny na ścianach szczytowych */}
        {fr.edge && !between && (
          <>
            <line x1={0} y1={0} x2={0} y2={run} stroke={C.ud} strokeWidth={4} {...nss} />
            <line x1={L} y1={0} x2={L} y2={run} stroke={C.ud} strokeWidth={4} {...nss} />
          </>
        )}
        <rect x={0} y={0} width={L} height={run} fill="none" stroke={INK} strokeWidth={1} {...nss} />

        {/* osie krokwi z wieszakami */}
        <ChainH xs={between ? [0, ...grid.rafters, L] : [0, ...g.hangerU, L]} y={0} off={-f * 1.6} f={f * 0.75} color={C.hanger} />
        <Dim x1={0} y1={0} x2={L} y2={0} off={-f * 3.6} f={f} label={cm(L)} />
        {/* rozstaw profili CD od dolnej krawędzi */}
        <ChainV ys={[0, ...g.cd.map(Y), run]} x={0} off={-f * 1.6} f={f * 0.75} color={lineColor} />
        {carrier && <ChainV ys={[0, ...g.fixS.map(Y), run]} x={L} off={f * 1.6} f={f * 0.75} color={C.hanger} />}
        <Dim x1={L} y1={0} x2={L} y2={run} off={carrier ? f * 4 : f * 2.2} f={f} label={cm(run)} />
        <text x={L / 2} y={run + f * 1.8} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          {slope ? 'dół skosu (ścianka kolankowa / podłoga)' : 'krawędź przy lewym skosie'}
        </text>
        <text x={L / 2} y={-f * 5.4} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          {slope ? (g.surface.b.z > g.surface.a.z ? 'góra skosu' : '') : 'krawędź przy prawym skosie / ścianie'}
        </text>
      </Paper>
      <Legend
        items={[
          { color: RAFTER, label: `krokwie${slope ? '' : ' / jętki'} ${cm(attic.rafterWidth)}×${cm(attic.rafterHeight)} co ${cm(attic.rafterSpacing)} cm` },
          between
            ? { color: C.main, label: `${profName}: poprzeczki między krokwiami – ${g.cd.length * grid.bays.length} szt.` }
            : { color: lineColor, label: `${profName} w poprzek krokwi – ${g.cd.length} szt. po ${cm(L)} cm` },
          ...(carrier
            ? [
                { color: C.main, label: `${carrier.label} pod każdą ${slope ? 'krokwią' : 'jętką'} – ${g.hangerU.length} szt. po ${cm(run)} cm` },
                ...(carrier.cross ? [{ color: INK, label: `${carrier.crossLabel ?? 'łącznik krzyżowy'} – ${g.cd.length * g.hangerU.length} szt.` }] : []),
              ]
            : []),
          ...(between
            ? [{ color: C.ud, label: `${fr.edge ? edgeName : profName} wzdłuż krokwi, po obu stronach każdego pola – ${grid.bays.length * 2} szt. po ${cm(run)} cm` }]
            : [
                {
                  color: C.hanger,
                  label: `${fr.hanger ? fr.hangerLabel : 'mocowanie do krokwi'} – ${hangerPts.length} szt., po ${fr.woodScrews} ${fr.woodScrews === 1 ? 'wkręcie' : 'wkręty'} do drewna w krokiew`,
                },
              ]),
          ...(fr.edge && !between ? [{ color: C.ud, label: `${edgeName} na ścianach szczytowych` }] : []),
          ...(splices.length ? [{ color: INK, label: 'łącznik wzdłużny' }] : []),
          ...(wins.length
            ? [
                {
                  color: C.extra,
                  label: `okno dachowe: obramowanie otworu (${profName}) ${grid.frame.mount === 'between' ? 'w polu okna' : 'nad, pod i po bokach otworu'}${winPts.length ? ` + ${winPts.length} dodatkowych mocowań do krokwi` : ''}`,
                },
                { color: C.main, dashed: true, label: 'rzut ościeżnicy okna; biały prostokąt = otwór w płytach na krawędziach glifów' },
              ]
            : []),
        ]}
      />
    </figure>
  );
}

/** Przekrój poprzeczny poddasza z wymiarami: mury, krokwie, jętka, wełna, lico płyt, profile CD */
export function AtticSectionDrawing({ attic, grid, title }: { attic: Attic; grid: AtticGrid; title: string }) {
  const W = attic.width;
  const st = grid.structure;
  const pitch = (Math.min(80, Math.max(5, attic.pitch)) * Math.PI) / 180;
  const rh = attic.rafterHeight / Math.cos(pitch);
  const top = st.ridgeHeight + rh;
  const f = clamp(Math.max(W, top) / 30, 8, 30);
  const m = f * 6;
  const wall = 25;
  const vb: [number, number, number, number] = [-m - wall, -m * 0.5, W + 2 * (m + wall), top + m * 1.6];
  const Z = (z: number) => top - z;
  const pts = (list: { x: number; z: number }[]) => list.map((p) => `${p.x.toFixed(1)},${Z(p.z).toFixed(1)}`).join(' ');
  const outline = (list: typeof st.surfaces) => list.flatMap((q, i) => (q.id === 'right' ? (i === 0 ? [q.b, q.a] : [q.a]) : i === 0 ? [q.a, q.b] : [q.b]));
  const mono = attic.roof === 'mono';
  const rightH = mono ? st.ridgeHeight : attic.kneeRight;
  const slopes = st.surfaces.filter((s) => s.kind === 'slope');
  const collar = st.surfaces.find((s) => s.kind === 'collar');
  const face = grid.section.surfaces;
  const faceCollar = face.find((s) => s.kind === 'collar');
  const woolB = Math.min(attic.woolBetween / 10, attic.rafterHeight) / Math.cos(pitch);
  const carrier = grid.carrier;
  // ruszt krzyżowy: oś profili nośnych (pod krokwiami) nad profilami pod płyty
  const carrierLine = carrier ? atticSection(attic, (grid.depthMm - grid.boardsMm - grid.profileMm - carrier.mm / 2) / 10).surfaces : [];

  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <line x1={-wall - f} y1={Z(0)} x2={W + wall + f} y2={Z(0)} stroke={INK} strokeWidth={2} {...nss} />
        {attic.kneeLeft > 0 && <rect x={-wall} y={Z(attic.kneeLeft)} width={wall} height={attic.kneeLeft} fill="url(#hatch)" stroke={INK} strokeWidth={1} {...nss} />}
        {rightH > 0 && <rect x={W} y={Z(rightH)} width={wall} height={rightH} fill="url(#hatch)" stroke={INK} strokeWidth={1} {...nss} />}
        {slopes.map((s) => {
          const low = s.id === 'left' ? { x: 0, z: attic.kneeLeft } : { x: W, z: attic.kneeRight };
          const up = { x: st.ridgeX, z: st.ridgeHeight };
          return (
            <g key={s.id}>
              {attic.woolBetween > 0 && <polygon points={pts([low, s.b, { x: s.b.x, z: s.b.z + woolB }, { x: low.x, z: low.z + woolB }])} fill="url(#wool)" />}
              <polygon points={pts([low, up, { x: up.x, z: up.z + rh }, { x: low.x, z: low.z + rh }])} fill={RAFTER} fillOpacity={attic.woolBetween > 0 ? 0.45 : 1} stroke={RAFTER_EDGE} strokeWidth={1} {...nss} />
            </g>
          );
        })}
        {collar && (
          <g>
            {attic.woolBetween > 0 && <rect x={collar.a.x} y={Z(collar.a.z + attic.woolBetween / 10)} width={collar.run} height={attic.woolBetween / 10} fill="url(#wool)" />}
            <rect x={collar.a.x} y={Z(collar.a.z + 14)} width={collar.run} height={14} fill={RAFTER} fillOpacity={attic.woolBetween > 0 ? 0.45 : 1} stroke={RAFTER_EDGE} strokeWidth={1} {...nss} />
          </g>
        )}
        {attic.woolUnder > 0 && face.length > 0 && <polygon points={pts([...outline(face), ...outline(st.surfaces).reverse()])} fill="url(#wool)" fillOpacity={0.7} />}
        <polyline points={pts(outline(face))} fill="none" stroke={INK} strokeWidth={3} {...nss} />
        {carrierLine.length > 0 && <polyline points={pts(outline(carrierLine))} fill="none" stroke={C.main} strokeWidth={2.5} {...nss} />}
        {grid.surfaces.flatMap((g) =>
          g.cd.map((s) => {
            const k = g.surface.run ? s / g.surface.run : 0;
            return (
              <circle
                key={`${g.surface.id}-${s}`}
                cx={g.surface.a.x + (g.surface.b.x - g.surface.a.x) * k}
                cy={Z(g.surface.a.z + (g.surface.b.z - g.surface.a.z) * k)}
                r={f * 0.22}
                fill={carrier ? C.secondary : C.main}
              />
            );
          }),
        )}

        <Dim x1={0} y1={Z(0)} x2={W} y2={Z(0)} off={f * 2} f={f} label={cm(W)} />
        {attic.kneeLeft > 0 && <Dim x1={-wall} y1={Z(attic.kneeLeft)} x2={-wall} y2={Z(0)} off={-f * 1.5} f={f} label={cm(attic.kneeLeft)} />}
        {!mono && attic.kneeRight > 0 && <Dim x1={W + wall} y1={Z(attic.kneeRight)} x2={W + wall} y2={Z(0)} off={f * 2.2} f={f} label={cm(attic.kneeRight)} />}
        {faceCollar && (
          <>
            <Dim x1={faceCollar.a.x} y1={Z(faceCollar.a.z)} x2={faceCollar.b.x} y2={Z(faceCollar.b.z)} off={f * 1.6} f={f} label={cm(faceCollar.run)} />
            <Dim x1={faceCollar.a.x + faceCollar.run * 0.3} y1={Z(faceCollar.a.z)} x2={faceCollar.a.x + faceCollar.run * 0.3} y2={Z(0)} off={0} f={f} label={cm(faceCollar.a.z)} ext={false} />
          </>
        )}
        <Dim x1={mono ? W + wall : st.ridgeX} y1={Z(st.ridgeHeight)} x2={mono ? W + wall : st.ridgeX} y2={Z(0)} off={mono ? f * 2.2 : W - st.ridgeX + wall + f * 4.4} f={f} label={cm(st.ridgeHeight)} />
        {face
          .filter((s) => s.kind === 'slope')
          .map((s) => {
            const mx = (s.a.x + s.b.x) / 2;
            const mz = (s.a.z + s.b.z) / 2;
            const left = s.id === 'left';
            const ang = left ? -attic.pitch : attic.pitch;
            return (
              <text key={s.id} x={mx + (left ? f : -f) * 1.5} y={Z(mz) + f * 2.2} fontSize={f} textAnchor="middle" fill={INK} transform={`rotate(${ang} ${mx + (left ? f : -f) * 1.5} ${Z(mz) + f * 2.2})`}>
                skos {cm(s.run)} · {cm(attic.pitch)}°
              </text>
            );
          })}
      </Paper>
      <Legend
        items={[
          { color: RAFTER, label: `krokwie ${cm(attic.rafterWidth)}×${cm(attic.rafterHeight)} cm${collar ? ', jętki' : ''}` },
          ...(attic.woolBetween || attic.woolUnder
            ? [{ pattern: 'wool' as const, label: `wełna: ${attic.woolBetween ? `${attic.woolBetween} mm między krokwiami` : ''}${attic.woolBetween && attic.woolUnder ? ' + ' : ''}${attic.woolUnder ? `${attic.woolUnder} mm pod krokwiami` : ''}` }]
            : []),
          ...(carrier ? [{ color: C.main, label: `${carrier.label} pod krokwiami${collar ? ' i jętkami' : ''} (ruszt krzyżowy)` }] : []),
          { color: carrier ? C.secondary : C.main, label: `${grid.frame.profileLabel} co ${grid.cdSpacing} cm` },
          {
            color: INK,
            label:
              grid.depthMm < 0
                ? `lico płyt ${-grid.depthMm} mm nad spodem krokwi (krokwie widoczne); wymiary sufitu i skosów po licu płyt`
                : `lico płyt ${grid.depthMm} mm pod spodem krokwi; wymiary sufitu i skosów po licu płyt`,
          },
          { pattern: 'hatch', label: 'ściany murowane' },
        ]}
      />
    </figure>
  );
}

/**
 * Rozkład płyt jednej płaszczyzny poddasza (jedna warstwa): elementy z wymiarami, pełne arkusze
 * i docinane, linie rusztu, na których wypadają styki. Ten sam rozkład idzie do 3D i na listę zakupów.
 */
export function AtticBoardsDrawing({ attic, g, layer, layers, title }: { attic: Attic; g: AtticSurfaceGrid; layer: AtticBoardLayer; layers: number; title: string }) {
  const L = attic.length;
  const run = g.surface.run;
  const f = clamp(Math.max(L, run) / 26, 8, 30);
  const m = f * 6.5;
  const vb: [number, number, number, number] = [-m, -m, L + 2 * m, run + 2 * m];
  const Y = (s: number) => run - s;
  const slope = g.surface.kind === 'slope';
  const full = layer.pieces.filter((p) => !p.cut).length;
  const joints = [...new Set(layer.pieces.filter((p) => p.s0 > 0.5).map((p) => p.s0))].sort((a, b) => a - b);
  const cols = [...new Set(layer.pieces.flatMap((p) => [p.u0, p.u1]))].sort((a, b) => a - b);
  const name = boardById(layer.boardId).name;
  const top = slope ? (attic.roof === 'mono' && !attic.collarHeight ? 'góra skosu (ściana)' : g.surface.b.z > g.surface.a.z ? 'góra skosu – docinka pod kątem przy kalenicy / jętce' : '') : 'krawędź przy prawym skosie / ścianie';
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <rect x={0} y={0} width={L} height={run} fill="#f7f8fa" />
        {layer.pieces.map((p, i) => {
          const pw = p.u1 - p.u0;
          const ph = p.s1 - p.s0;
          return (
            <g key={i}>
              <rect x={p.u0} y={Y(p.s1)} width={pw} height={ph} fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke={INK} strokeWidth={1.1} {...nss} />
              {(p.notches ?? []).map((n, k) => (
                <rect key={k} x={n.u0} y={Y(n.s1)} width={n.u1 - n.u0} height={n.s1 - n.s0} fill="#fff" stroke={INK} strokeWidth={1.1} strokeDasharray="4 3" {...nss} />
              ))}
              {pw > f * 2.8 && ph > f * 1.5 && (
                <text x={p.u0 + pw / 2} y={Y(p.s0 + ph / 2) + f * 0.2} fontSize={f * 0.5} textAnchor="middle" fill={INK}>
                  {cm(pw)}×{cm(ph)}
                </text>
              )}
            </g>
          );
        })}
        {g.cd.map((s) => (
          <line key={s} x1={0} y1={Y(s)} x2={L} y2={Y(s)} stroke={C.secondary} strokeWidth={0.8} strokeDasharray="3 5" {...nss} />
        ))}
        <rect x={0} y={0} width={L} height={run} fill="none" stroke={INK} strokeWidth={2} {...nss} />
        <ChainH xs={cols} y={0} off={-f * 1.6} f={f * 0.75} color={INK} />
        <Dim x1={0} y1={0} x2={L} y2={0} off={-f * 3.6} f={f} label={cm(L)} />
        {joints.length > 0 && <ChainV ys={[0, ...joints.map(Y), run]} x={0} off={-f * 1.6} f={f * 0.75} color={C.secondary} />}
        <Dim x1={L} y1={0} x2={L} y2={run} off={f * 2.2} f={f} label={cm(run)} />
        <text x={L / 2} y={run + f * 1.8} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          {slope ? 'dół skosu (ścianka kolankowa / podłoga)' : 'krawędź przy lewym skosie'}
        </text>
        {top && (
          <text x={L / 2} y={-f * 5.4} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
            {top}
          </text>
        )}
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `${name}, arkusz pełny ${layer.sheetW}×${layer.sheetLen} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${layer.pieces.length - full} szt.)` },
          { color: C.secondary, dashed: true, label: 'element rusztu – tu wypadają styki i wkręty' },
        ]}
      />
      <figcaption className="muted small">
        {layers > 1 ? `Warstwa ${layer.layer + 1} z ${layers} (${layer.layer === 0 ? 'przy ruszcie' : layer.layer === layers - 1 ? 'lico' : 'środkowa'}). ` : ''}
        Płyty dłuższą krawędzią w poprzek rusztu, wzdłuż krokwi. Styki krótkich krawędzi zawsze na elemencie rusztu, w sąsiednich pasach
        przesunięte o min. 40 cm{layers > 1 ? ', kolejna warstwa przesunięta o pół płyty' : ''}. Docinki węższe niż 30 cm zastąpione krótszą płytą obok.
        {slope ? ' Przy kalenicy lub jętce i przy ściance kolankowej płyty docinasz pod kątem dachu.' : ''} Wymiary w cm, po licu zabudowy.
      </figcaption>
    </figure>
  );
}
