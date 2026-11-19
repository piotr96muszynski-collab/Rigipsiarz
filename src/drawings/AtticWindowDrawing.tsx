import type { AtticGrid } from '../calc/attic';
import { WINDOW_TRIM, type RoofWindowGeom } from '../calc/atticWindows';
import type { Attic } from '../model/types';
import { C, Dim, INK, Legend, Paper, cm, nss } from './svg';

const RAFTER = '#d9b98a';
const RAFTER_EDGE = '#8a6230';

/**
 * Przekrój przez okno dachowe w osi okna: krokiew za przekrojem, ościeżnica w płaszczyźnie dachu,
 * glif dolny pionowo i górny poziomo do lica płyt, obramowanie otworu, wełna i kołnierz paroizolacyjny.
 */
export function AtticWindowSection({ attic, grid, x, title, vapor }: { attic: Attic; grid: AtticGrid; x: RoofWindowGeom; title: string; vapor: boolean }) {
  const st = grid.structure.surfaces.find((s) => s.id === x.surfaceId)!;
  const d = { x: (st.b.x - st.a.x) / st.run, z: (st.b.z - st.a.z) / st.run };
  const n = x.surfaceId === 'left' ? { x: -d.z, z: d.x } : { x: d.z, z: -d.x };
  const Hr = attic.rafterHeight;
  const face = grid.depthMm / 10;
  const tb = grid.boardsMm / 10;
  // punkt na płaszczyźnie: t po skosie od dolnej krawędzi konstrukcji, h od spodu krokwi w stronę dachu
  const P = (t: number, h: number) => ({ x: st.a.x + d.x * t + n.x * h, z: st.a.z + d.z * t + n.z * h });
  const tOf = (p: { x: number; z: number }) => (p.x - st.a.x) * d.x + (p.z - st.a.z) * d.z;
  const tB = tOf(x.frameBottom);
  const tT = tOf(x.frameTop);
  const t0 = Math.min(tOf(x.faceBottom), tB) - 40;
  const t1 = Math.max(tOf(x.faceTop), tT) + 40;
  const pts = [P(t0, Hr + 15), P(t1, Hr + 15), P(t0, -face - 10), P(t1, -face - 10), x.faceTop, x.faceBottom];
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minZ = Math.min(...pts.map((p) => p.z));
  const maxZ = Math.max(...pts.map((p) => p.z));
  const f = Math.max(4, Math.min(12, (maxX - minX) / 32));
  const m = f * 6;
  const vb: [number, number, number, number] = [minX - m, -maxZ - m, maxX - minX + 2 * m, maxZ - minZ + 2 * m];
  const X = (p: { x: number; z: number }) => p.x;
  const Z = (p: { x: number; z: number }) => -p.z;
  const poly = (list: { x: number; z: number }[]) => list.map((p) => `${X(p).toFixed(1)},${Z(p).toFixed(1)}`).join(' ');
  // lico płyt na skosie poza otworem
  const sOnFace = (p: { x: number; z: number }) => tOf(p);
  const fb = sOnFace(x.faceBottom);
  const ft = sOnFace(x.faceTop);
  const woolUnder = attic.woolUnder > 0 && grid.depthMm > 0;
  const lowerMid = { x: (x.frameBottom.x + x.faceBottom.x) / 2, z: (x.frameBottom.z + x.faceBottom.z) / 2 };
  const upperMid = { x: (x.frameTop.x + x.faceTop.x) / 2, z: (x.frameTop.z + x.faceTop.z) / 2 };
  // obramowanie otworu (przekrój profili poprzecznych) tuż nad licem przy krawędziach otworu
  const trims = [P(fb - WINDOW_TRIM, -face + tb), P(ft + WINDOW_TRIM, -face + tb)];
  const sx = Math.sign(d.x) || 1;

  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        {/* krokiew za przekrojem (okno leży między krokwiami) */}
        <polygon points={poly([P(t0, 0), P(t1, 0), P(t1, Hr), P(t0, Hr)])} fill={RAFTER} fillOpacity={0.35} stroke={RAFTER_EDGE} strokeWidth={0.8} strokeDasharray="5 3" {...nss} />
        {/* wełna między krokwiami poza oknem */}
        {attic.woolBetween > 0 && (
          <>
            <polygon points={poly([P(t0, 0), P(tB - 3, 0), P(tB - 3, Math.min(Hr, attic.woolBetween / 10)), P(t0, Math.min(Hr, attic.woolBetween / 10))])} fill="url(#wool)" />
            <polygon points={poly([P(tT + 3, 0), P(t1, 0), P(t1, Math.min(Hr, attic.woolBetween / 10)), P(tT + 3, Math.min(Hr, attic.woolBetween / 10))])} fill="url(#wool)" />
          </>
        )}
        {/* wełna pod krokwiami */}
        {woolUnder && (
          <>
            <polygon points={poly([P(t0, -face + tb), x.faceBottom, P(tOf(x.faceBottom), 0), P(t0, 0)])} fill="url(#wool)" fillOpacity={0.7} />
            <polygon points={poly([x.faceTop, P(t1, -face + tb), P(t1, 0), P(tOf(x.faceTop), 0)])} fill="url(#wool)" fillOpacity={0.7} />
          </>
        )}
        {/* wełna wokół ościeżnicy, za płytami glifów */}
        <polygon points={poly([x.frameBottom, x.faceBottom, { x: x.faceBottom.x - sx * 5, z: x.faceBottom.z }, { x: x.frameBottom.x - sx * 5, z: x.frameBottom.z + 3 }])} fill="url(#wool)" />
        <polygon points={poly([x.frameTop, x.faceTop, { x: x.faceTop.x, z: x.faceTop.z + 5 }, { x: x.frameTop.x, z: x.frameTop.z + 5 }])} fill="url(#wool)" />
        {/* lico płyt skosu */}
        <polyline points={poly([P(t0, -face), x.faceBottom])} fill="none" stroke={INK} strokeWidth={3} {...nss} />
        <polyline points={poly([x.faceTop, P(t1, -face)])} fill="none" stroke={INK} strokeWidth={3} {...nss} />
        {/* glify */}
        <line x1={X(x.frameBottom)} y1={Z(x.frameBottom)} x2={X(x.faceBottom)} y2={Z(x.faceBottom)} stroke={INK} strokeWidth={3} {...nss} />
        <line x1={X(x.frameTop)} y1={Z(x.frameTop)} x2={X(x.faceTop)} y2={Z(x.faceTop)} stroke={INK} strokeWidth={3} {...nss} />
        {/* paroizolacja z kołnierzem do ościeżnicy */}
        {vapor && (
          <polyline
            points={poly([P(t0, -face + tb + 0.6), { x: x.faceBottom.x - sx * 1.6, z: x.faceBottom.z + 0.6 }, { x: x.frameBottom.x - sx * 1.6, z: x.frameBottom.z }, x.frameBottom])}
            fill="none"
            stroke={C.vapor}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            {...nss}
          />
        )}
        {vapor && (
          <polyline
            points={poly([x.frameTop, { x: x.frameTop.x, z: x.frameTop.z + 1.6 }, { x: x.faceTop.x, z: x.faceTop.z + 1.6 }, P(t1, -face + tb + 0.6)])}
            fill="none"
            stroke={C.vapor}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            {...nss}
          />
        )}
        {/* okno: ościeżnica w płaszczyźnie dachu i szyba */}
        <polygon points={poly([x.frameBottom, x.frameTop, P(tT, Hr + 10), P(tB, Hr + 10)])} fill="#dbeafe" stroke={C.main} strokeWidth={2} {...nss} />
        <line x1={X(P(tB + 6, Hr + 6))} y1={Z(P(tB + 6, Hr + 6))} x2={X(P(tT - 6, Hr + 6))} y2={Z(P(tT - 6, Hr + 6))} stroke={C.main} strokeWidth={1} {...nss} />
        {/* obramowanie otworu i linie rusztu */}
        {trims.map((p, i) => (
          <rect key={i} x={X(p) - 3} y={Z(p) - 3} width={6} height={6} fill={C.extra} />
        ))}
        {grid.surfaces
          .find((g) => g.surface.id === x.surfaceId)
          ?.cd.filter((s) => !x.interrupted.includes(s))
          .map((s) => {
            const fs = grid.surfaces.find((g) => g.surface.id === x.surfaceId)!.surface;
            const k = s / fs.run;
            const p = { x: fs.a.x + (fs.b.x - fs.a.x) * k, z: fs.a.z + (fs.b.z - fs.a.z) * k };
            const q = { x: p.x + n.x * tb, z: p.z + n.z * tb };
            if (tOf(q) < t0 || tOf(q) > t1) return null;
            return <circle key={s} cx={X(q)} cy={Z(q)} r={2.5} fill={grid.carrier ? C.secondary : C.main} />;
          })}

        {/* wymiary */}
        <Dim x1={X(x.frameBottom)} y1={Z(x.frameBottom)} x2={X(x.faceBottom)} y2={Z(x.faceBottom)} off={-sx * f * 2.2} f={f} label={`${cm(x.lower)}`} />
        <Dim x1={X(x.frameTop)} y1={Z(x.frameTop)} x2={X(x.faceTop)} y2={Z(x.faceTop)} off={f * 2} f={f} label={`${cm(x.upper)}`} />
        {(() => {
          // opis okna wzdłuż ościeżnicy (wymiarowanie skośne – sam opis)
          const c = P((tB + tT) / 2, Hr + 22);
          const ang = (Math.atan2(-(x.frameTop.z - x.frameBottom.z), x.frameTop.x - x.frameBottom.x) * 180) / Math.PI;
          const a2 = ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang;
          return (
            <text x={X(c)} y={Z(c)} fontSize={f} textAnchor="middle" fill={C.main} transform={`rotate(${a2} ${X(c)} ${Z(c)})`}>
              okno {cm(x.w.width)}×{cm(x.w.height)} cm
            </text>
          );
        })()}
        <text x={X(lowerMid) - sx * f * 4.2} y={Z(lowerMid)} fontSize={f * 0.9} textAnchor={sx > 0 ? 'end' : 'start'} fill={INK}>
          glif dolny – pionowo
        </text>
        <text x={X(upperMid)} y={Z(upperMid) - f * 1.4} fontSize={f * 0.9} textAnchor="middle" fill={INK}>
          glif górny – poziomo
        </text>
        <text x={X(x.faceBottom)} y={Z(x.faceBottom) + f * 1.6} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          dół ościeżnicy {cm(x.w.sill)} cm nad posadzką · dół glifu {cm(x.faceBottom.z)} cm
        </text>
      </Paper>
      <Legend
        items={[
          { color: C.main, label: `${x.w.sizeCode ?? 'okno'} ${cm(x.w.width)}×${cm(x.w.height)} cm – ościeżnica na wierzchu krokwi (osadzenie standardowe)` },
          { color: RAFTER, dashed: true, label: `krokiew za przekrojem ${cm(attic.rafterWidth)}×${cm(attic.rafterHeight)} cm` },
          { color: INK, label: `płyty skosu i glifów (${cm(grid.boardsMm / 10)} cm), glif dolny ${cm(x.lower)} cm, górny ${cm(x.upper)} cm, otwór w płytach ${cm(x.s1 - x.s0)} cm po skosie` },
          { color: C.extra, label: `obramowanie otworu: ${grid.frame.profileLabel} ${WINDOW_TRIM} cm nad i pod otworem` },
          { pattern: 'wool', label: 'wełna (między, pod krokwiami i wokół ościeżnicy)' },
          ...(vapor ? [{ color: C.vapor, dashed: true, label: 'paroizolacja + kołnierz paroizolacyjny okna przyklejony do ościeżnicy' }] : []),
        ]}
      />
    </figure>
  );
}
