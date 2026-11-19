// Rysunki poddasza z narożnikami dachu i koszami: rzut płaszczyzn z liniami narożników, koszy
// i kalenic oraz rozwinięcie każdej płaszczyzny z krokwiami, odcinkami rusztu i punktami mocowania.

import type { AtticGrid, AtticRoofGrid } from '../calc/attic';
import { faceRafterSpans, planToFace, type P2, type RoofFace } from '../calc/atticRoof';
import { PRODUCTS } from '../catalog/rigips';
import type { Attic } from '../model/types';
import { C, ChainV, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

const RAFTER = '#d9b98a';
const RAFTER_EDGE = '#8a6230';
/** Kolory linii dachu */
export const ROOF_LINE_COLOR = { hip: '#d9822b', valley: '#7b4fb5', ridge: '#4a5a6a', fold: '#4a5a6a' } as const;
const LINE_LABEL = { hip: 'narożnik dachu', valley: 'kosz', ridge: 'kalenica', fold: 'załamanie skos / sufit' } as const;

const ptsStr = (list: { x: number; y: number }[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** Rzut zabudowy poddasza: płaszczyzny, ściany, narożniki dachu, kosze i kalenice */
export function AtticRoofPlanDrawing({ attic, roof, title }: { attic: Attic; roof: AtticRoofGrid; title: string }) {
  const r = roof.structure;
  const us = r.rects.flatMap((x) => [x[0], x[1]]);
  const vs = r.rects.flatMap((x) => [x[2], x[3]]);
  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);
  const f = clamp(Math.max(u1 - u0, v1 - v0) / 28, 8, 30);
  const m = f * 5;
  const vb: [number, number, number, number] = [u0 - m, v0 - m, u1 - u0 + 2 * m, v1 - v0 + 2 * m];
  const P = (p: P2) => ({ x: p.u, y: p.v });
  const kinds = new Set(r.lines.map((l) => l.kind));
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        {r.faces.map((fc, i) =>
          fc.pieces.map((pc, j) => <polygon key={`${i}-${j}`} points={ptsStr(pc.map(P))} fill={fc.kind === 'collar' ? '#eef1f5' : '#f7f8fa'} stroke="none" />),
        )}
        {/* osie krokwi */}
        {r.faces.flatMap((fc, i) =>
          faceRafterSpans(fc).map((sp) => {
            const a = faceAt(fc, sp.t, sp.s0);
            const b = faceAt(fc, sp.t, sp.s1);
            return <line key={`${i}-${sp.t}`} x1={a.u} y1={a.v} x2={b.u} y2={b.v} stroke={RAFTER_EDGE} strokeWidth={0.8} strokeOpacity={0.5} {...nss} />;
          }),
        )}
        {r.faces.flatMap((fc, i) =>
          fc.edges.filter((e) => e.kind === 'wall').map((e, j) => <line key={`w${i}-${j}`} x1={e.p.u} y1={e.p.v} x2={e.q.u} y2={e.q.v} stroke={INK} strokeWidth={4} {...nss} />),
        )}
        {r.lines.map((l, i) => (
          <line key={`l${i}`} x1={l.p.u} y1={l.p.v} x2={l.q.u} y2={l.q.v} stroke={ROOF_LINE_COLOR[l.kind]} strokeWidth={l.kind === 'hip' || l.kind === 'valley' ? 3 : 1.5} strokeDasharray={l.kind === 'fold' ? '8 5' : undefined} {...nss} />
        ))}
        {r.lines
          .filter((l) => l.kind === 'hip' || l.kind === 'valley')
          .map((l, i) => (
            <text key={`t${i}`} x={(l.p.u + l.q.u) / 2 + f * 0.6} y={(l.p.v + l.q.v) / 2} fontSize={f * 0.8} fill={ROOF_LINE_COLOR[l.kind]}>
              {cm(l.len)}
            </text>
          ))}
        {r.faces.map((fc, i) => {
          const big = fc.pieces.reduce((a, b) => (area(b) > area(a) ? b : a));
          const c = centroid(big);
          return (
            <text key={`n${i}`} x={c.u} y={c.v} fontSize={f * 0.8} textAnchor="middle" fill={INK}>
              {i + 1}
            </text>
          );
        })}
        <Dim x1={0} y1={v0} x2={attic.length} y2={v0} off={-f * 2} f={f} label={cm(attic.length)} />
        <Dim x1={u1} y1={0} x2={u1} y2={attic.width} off={f * 2} f={f} label={cm(attic.width)} />
      </Paper>
      <Legend
        items={[
          ...r.faces.map((fc, i) => ({ n: i + 1, label: `${fc.label} – ${(fc.areaM2).toFixed(2).replace('.', ',')} m² po spodzie krokwi` })),
          ...[...kinds].map((k) => ({ color: ROOF_LINE_COLOR[k], label: `${LINE_LABEL[k]}${k === 'hip' || k === 'valley' ? ' (długość po skosie)' : ''}` })),
          { color: INK, label: 'ściany szczytowe i kolankowe' },
          { color: RAFTER_EDGE, label: `osie krokwi co ${cm(attic.rafterSpacing)} cm` },
        ]}
      />
    </figure>
  );
}

const area = (pc: P2[]) => Math.abs(pc.reduce((s, p, i) => s + p.u * pc[(i + 1) % pc.length].v - pc[(i + 1) % pc.length].u * p.v, 0) / 2);
const centroid = (pc: P2[]) => ({ u: pc.reduce((s, p) => s + p.u, 0) / pc.length, v: pc.reduce((s, p) => s + p.v, 0) / pc.length });
const faceAt = (fc: RoofFace, t: number, s: number): P2 => {
  const dd = fc.d0 + s * fc.cos;
  return { u: fc.e.u * t + fc.d.u * dd, v: fc.e.v * t + fc.d.v * dd };
};

/**
 * Rozwinięcie płaszczyzny dachu z narożnikami / koszami: poziomo wzdłuż profili, pionowo po skosie od dolnej
 * krawędzi. Krokwie (kulawe), odcinki rusztu z długościami, mocowania, profile wzdłuż narożników i koszy.
 */
export function AtticRoofFaceDrawing({ attic, grid, index, title }: { attic: Attic; grid: AtticGrid & { roof: AtticRoofGrid }; index: number; title: string }) {
  const { face, cd } = grid.roof.faces[index];
  const W = face.t1 - face.t0;
  const run = face.run;
  const f = clamp(Math.max(W, run) / 26, 8, 30);
  const m = f * 6;
  const vb: [number, number, number, number] = [-m, -m, W + 2 * m, run + 2 * m];
  const X = (t: number) => t - face.t0;
  const Y = (s: number) => run - s;
  const L = (p: P2) => {
    const q = planToFace(face, p);
    return { x: X(q.t), y: Y(q.s) };
  };
  const fr = grid.frame;
  const profName = PRODUCTS[grid.profile].name.replace(/^Profil (Rigips )?/, '');
  const edgeName = fr.edge ? PRODUCTS[fr.edge].name.replace(/^Profil (Rigips )?/, '').replace(/ \(.*$/, '') : '';
  const lines = grid.roof.lineProfiles.filter((lp) => lp.face === grid.roof.roof.faces.indexOf(face));
  const fixes = cd.reduce((s, l) => s + l.fix.length, 0);
  const lineFixes = lines.reduce((s, l) => s + l.fix.length, 0);
  const hasCorner = face.edges.some((e) => e.kind === 'hip' || e.kind === 'valley');
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <defs>
          <clipPath id={`rf-${attic.id}-${index}`}>
            {face.pieces.map((pc, j) => (
              <polygon key={j} points={ptsStr(pc.map(L))} />
            ))}
          </clipPath>
        </defs>
        {face.pieces.map((pc, j) => (
          <polygon key={j} points={ptsStr(pc.map(L))} fill="#f7f8fa" stroke="none" />
        ))}
        <g clipPath={`url(#rf-${attic.id}-${index})`}>
          {faceRafterSpans(face).map((sp) => (
            <rect key={sp.t} x={X(sp.t) - attic.rafterWidth / 2} y={Y(sp.s1)} width={attic.rafterWidth} height={sp.s1 - sp.s0} fill={RAFTER} stroke={RAFTER_EDGE} strokeWidth={0.6} {...nss} />
          ))}
        </g>
        {cd.map((l, i) => (
          <g key={i}>
            <line x1={X(l.t0)} y1={Y(l.s)} x2={X(l.t1)} y2={Y(l.s)} stroke={C.main} strokeWidth={3} {...nss} />
            {l.fix.map((t) => (
              <circle key={t} cx={X(t)} cy={Y(l.s)} r={f * 0.3} fill={C.hanger} />
            ))}
            {(l.end0 === 'hip' || l.end0 === 'valley' || l.end1 === 'hip' || l.end1 === 'valley') && (
              <text x={(X(l.t0) + X(l.t1)) / 2} y={Y(l.s) - f * 0.35} fontSize={f * 0.6} textAnchor="middle" fill={C.main}>
                {cm(l.t1 - l.t0)}
              </text>
            )}
          </g>
        ))}
        {face.edges.map((e, j) => {
          const a = L(e.p);
          const b = L(e.q);
          const color = e.kind === 'wall' ? C.ud : e.kind === 'hip' || e.kind === 'valley' ? ROOF_LINE_COLOR[e.kind] : INK;
          return <line key={`e${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={e.kind === 'wall' || e.kind === 'hip' || e.kind === 'valley' ? 4 : 1} {...nss} />;
        })}
        {/* mocowania profili wzdłuż krokwi narożnej / koszowej */}
        {lines.flatMap((lp, i) => {
          const a = L(lp.line.p);
          const b = L(lp.line.q);
          const k = Math.hypot(b.x - a.x, b.y - a.y) / lp.line.len;
          return lp.fix.map((d) => <circle key={`${i}-${d}`} cx={a.x + ((b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y)) * d * k} cy={a.y + ((b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y)) * d * k} r={f * 0.3} fill={C.hanger} stroke="#fff" strokeWidth={0.8} {...nss} />);
        })}
        <ChainV ys={[0, ...[...new Set(cd.map((l) => l.s))].map(Y), run]} x={0} off={-f * 1.6} f={f * 0.75} color={C.main} />
        <Dim x1={0} y1={run} x2={W} y2={run} off={f * 2.2} f={f} label={cm(W)} />
        <Dim x1={W} y1={0} x2={W} y2={run} off={f * 2.2} f={f} label={cm(run)} />
        <text x={W / 2} y={-f * 1.4} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          {face.kind === 'slope' ? 'góra połaci' : ''}
        </text>
      </Paper>
      <Legend
        items={[
          { color: RAFTER, label: `krokwie${hasCorner ? ' (kulawe – skrócone do narożnika / kosza)' : ''} co ${cm(attic.rafterSpacing)} cm` },
          { color: C.main, label: `${profName} w poprzek krokwi – ${cd.length} odc., razem ${cm(cd.reduce((s, l) => s + l.t1 - l.t0, 0))} cm` },
          { color: C.hanger, label: `${fr.hanger ? fr.hangerLabel : 'mocowanie do krokwi'} – ${fixes + lineFixes} szt.${lineFixes ? ` (w tym ${lineFixes} na krokwi narożnej / koszowej)` : ''}` },
          ...(lines.some((l) => l.line.kind === 'hip') ? [{ color: ROOF_LINE_COLOR.hip, label: `narożnik dachu: ${profName} wzdłuż krokwi narożnej, końce profili przykręcone` }] : []),
          ...(lines.some((l) => l.line.kind === 'valley') ? [{ color: ROOF_LINE_COLOR.valley, label: `kosz: ${profName} wzdłuż krokwi koszowej, końce profili przykręcone` }] : []),
          ...(fr.edge && face.edges.some((e) => e.kind === 'wall') ? [{ color: C.ud, label: `${edgeName} na ścianach` }] : []),
        ]}
      />
    </figure>
  );
}
