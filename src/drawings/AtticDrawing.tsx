import { splicePositions } from '../calc/layout';
import type { AtticGrid, AtticSurfaceGrid } from '../calc/attic';
import { PRODUCTS } from '../catalog/rigips';
import type { Attic } from '../model/types';
import { C, ChainH, ChainV, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

const RAFTER = '#d9b98a';
const RAFTER_EDGE = '#8a6230';

/**
 * Rozwinięcie jednej płaszczyzny (skosu albo sufitu pod jętkami): krokwie, profile CD w poprzek krokwi
 * i punkty mocowania wieszaków. Poziomo długość wzdłuż kalenicy, pionowo długość po skosie od dolnej krawędzi.
 */
export function AtticSurfaceDrawing({ attic, g, grid, title }: { attic: Attic; g: AtticSurfaceGrid; grid: AtticGrid; title: string }) {
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
          : g.cd.map((s) => <line key={s} x1={0} y1={Y(s)} x2={L} y2={Y(s)} stroke={C.main} strokeWidth={3} {...nss} />)}
        {g.cd.flatMap((s) => splices.map((u) => <rect key={`${s}-${u}`} x={u - f * 0.5} y={Y(s) - f * 0.15} width={f} height={f * 0.3} fill={INK} />))}
        {g.cd.flatMap((s) => g.hangerU.map((u) => <circle key={`${s}-${u}`} cx={u} cy={Y(s)} r={f * 0.3} fill={C.hanger} />))}
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
        <ChainV ys={[0, ...g.cd.map(Y), run]} x={0} off={-f * 1.6} f={f * 0.75} color={C.main} />
        <Dim x1={L} y1={0} x2={L} y2={run} off={f * 2.2} f={f} label={cm(run)} />
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
            : { color: C.main, label: `${profName} w poprzek krokwi – ${g.cd.length} szt. po ${cm(L)} cm` },
          ...(between
            ? [{ color: C.ud, label: `${fr.edge ? edgeName : profName} wzdłuż krokwi, po obu stronach każdego pola – ${grid.bays.length * 2} szt. po ${cm(run)} cm` }]
            : [
                {
                  color: C.hanger,
                  label: `${fr.hanger ? fr.hangerLabel : 'mocowanie do krokwi'} – ${g.cd.length * g.hangerU.length} szt., po ${fr.woodScrews} ${fr.woodScrews === 1 ? 'wkręcie' : 'wkręty'} do drewna w krokiew`,
                },
              ]),
          ...(fr.edge && !between ? [{ color: C.ud, label: `${edgeName} na ścianach szczytowych` }] : []),
          ...(splices.length ? [{ color: INK, label: 'łącznik wzdłużny' }] : []),
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
        {grid.surfaces.flatMap((g) =>
          g.cd.map((s) => {
            const k = g.surface.run ? s / g.surface.run : 0;
            return (
              <circle
                key={`${g.surface.id}-${s}`}
                cx={g.surface.a.x + (g.surface.b.x - g.surface.a.x) * k}
                cy={Z(g.surface.a.z + (g.surface.b.z - g.surface.a.z) * k)}
                r={f * 0.22}
                fill={C.main}
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
          { color: C.main, label: `${grid.frame.profileLabel} co ${grid.cdSpacing} cm` },
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
