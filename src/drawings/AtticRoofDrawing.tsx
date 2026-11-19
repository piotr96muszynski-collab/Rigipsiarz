// Rysunki poddasza z narożnikami dachu i koszami: rzut płaszczyzn z liniami narożników, koszy
// i kalenic oraz rozwinięcie każdej płaszczyzny z krokwiami, odcinkami rusztu i punktami mocowania.

import type { AtticGrid, AtticRoofGrid } from '../calc/attic';
import { faceRafterSpans, planToFace, type P2, type RoofFace } from '../calc/atticRoof';
import type { RoofBoardLayer } from '../calc/atticRoofBoards';
import { roofCdSegments, windowFixPoints, type RoofWindowGeom } from '../calc/atticWindows';
import { PRODUCTS, boardById } from '../catalog/rigips';
import type { Attic } from '../model/types';
import { C, ChainH, ChainV, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

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
export function AtticRoofFaceDrawing({
  attic,
  grid,
  index,
  title,
  windows = [],
  maxHanger = 100,
}: {
  attic: Attic;
  grid: AtticGrid & { roof: AtticRoofGrid };
  index: number;
  title: string;
  windows?: RoofWindowGeom[];
  maxHanger?: number;
}) {
  const { face, cd } = grid.roof.faces[index];
  const wins = windows.filter((x) => x.face === index);
  const winPts = wins.flatMap((x) => windowFixPoints(x, grid, maxHanger));
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
            {roofCdSegments(l, index, wins).map(([t0, t1]) => (
              <line key={t0} x1={X(t0)} y1={Y(l.s)} x2={X(t1)} y2={Y(l.s)} stroke={C.main} strokeWidth={3} {...nss} />
            ))}
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
        {/* okna dachowe: otwór w płytach (krawędzie glifów), rzut ościeżnicy, obramowanie otworu */}
        {wins.map((x) => {
          const [f0, f1] = x.sFrame;
          return (
            <g key={x.w.id}>
              <rect x={X(x.u0)} y={Y(x.s1)} width={x.u1 - x.u0} height={x.s1 - x.s0} fill="#ffffff" stroke={INK} strokeWidth={1.5} {...nss} />
              <rect x={X(x.u0)} y={Y(f1)} width={x.u1 - x.u0} height={f1 - f0} fill="#dbeafe" stroke={C.main} strokeWidth={1} strokeDasharray="6 4" {...nss} />
              {x.cross.map((c) => (
                <line key={`c${c.s}`} x1={X(c.u0)} y1={Y(c.s)} x2={X(c.u1)} y2={Y(c.s)} stroke={C.extra} strokeWidth={4} {...nss} />
              ))}
              {x.side.map((sd) => (
                <line key={`s${sd.u}`} x1={X(sd.u)} y1={Y(sd.s0)} x2={X(sd.u)} y2={Y(sd.s1)} stroke={C.extra} strokeWidth={4} {...nss} />
              ))}
              <text x={X((x.u0 + x.u1) / 2)} y={Y((f0 + f1) / 2)} fontSize={Math.min(f * 0.8, (x.u1 - x.u0) / 6)} textAnchor="middle" fill={INK}>
                {x.w.sizeCode ?? `${cm(x.w.width)}×${cm(x.w.height)}`}
              </text>
              <ChainH xs={[0, X(x.u0), X(x.u1), W]} y={run} off={f * 3} f={f * 0.7} color={C.extra} />
              <ChainV ys={[run, Y(x.s0), Y(x.s1), 0].sort((p, q) => p - q)} x={X(x.u1)} off={f * 1.2} f={f * 0.7} color={C.extra} />
            </g>
          );
        })}
        {winPts.map(([t, s], k) => (
          <circle key={`wp${k}`} cx={X(t)} cy={Y(s)} r={f * 0.3} fill={C.hanger} stroke="#fff" strokeWidth={0.8} {...nss} />
        ))}
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
          { color: C.hanger, label: `${fr.hanger ? fr.hangerLabel : 'mocowanie do krokwi'} – ${fixes + lineFixes + winPts.length} szt.${lineFixes ? ` (w tym ${lineFixes} na krokwi narożnej / koszowej)` : ''}${winPts.length ? ` (w tym ${winPts.length} przy oknach)` : ''}` },
          ...(wins.length ? [{ color: C.extra, label: `obramowanie otworu okna z ${profName}` }] : []),
          ...(lines.some((l) => l.line.kind === 'hip') ? [{ color: ROOF_LINE_COLOR.hip, label: `narożnik dachu: ${profName} wzdłuż krokwi narożnej, końce profili przykręcone` }] : []),
          ...(lines.some((l) => l.line.kind === 'valley') ? [{ color: ROOF_LINE_COLOR.valley, label: `kosz: ${profName} wzdłuż krokwi koszowej, końce profili przykręcone` }] : []),
          ...(fr.edge && face.edges.some((e) => e.kind === 'wall') ? [{ color: C.ud, label: `${edgeName} na ścianach` }] : []),
        ]}
      />
    </figure>
  );
}

/**
 * Rozkład płyt jednej połaci dachu z narożnikami / koszami (jedna warstwa): elementy przycięte do obrysu
 * połaci (pod kątem przy narożniku, koszu, kalenicy), otwory okien, profile, na których wypadają styki.
 * Ten sam rozkład idzie do 3D i na listę zakupów.
 */
export function AtticRoofBoardsDrawing({ attic, grid, index, layer, layers, title }: { attic: Attic; grid: AtticGrid & { roof: AtticRoofGrid }; index: number; layer: RoofBoardLayer; layers: number; title: string }) {
  const clipId = `${attic.id}-${index}-${layer.layer}`;
  const { face, cd } = grid.roof.faces[index];
  const W = face.t1 - face.t0;
  const run = face.run;
  const f = clamp(Math.max(W, run) / 26, 8, 30);
  const m = f * 6.5;
  const vb: [number, number, number, number] = [-m, -m, W + 2 * m, run + 2 * m];
  const X = (t: number) => t - face.t0;
  const Y = (s: number) => run - s;
  const L = (p: P2) => {
    const q = planToFace(face, p);
    return { x: X(q.t), y: Y(q.s) };
  };
  const full = layer.pieces.filter((p) => !p.cut).length;
  const angled = layer.pieces.filter((p) => p.angled).length;
  const cols = [...new Set(layer.pieces.flatMap((p) => [p.t0, p.t1]))].sort((a, b) => a - b).map(X);
  const lines = [...new Set(cd.map((l) => l.s))];
  const name = boardById(layer.boardId).name;
  const hasCorner = face.edges.some((e) => e.kind === 'hip' || e.kind === 'valley');
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <defs>
          <clipPath id={`rb-${clipId}`}>
            {face.pieces.map((pc, j) => (
              <polygon key={j} points={ptsStr(pc.map(L))} />
            ))}
          </clipPath>
        </defs>
        {face.pieces.map((pc, j) => (
          <polygon key={j} points={ptsStr(pc.map(L))} fill="#f7f8fa" stroke="none" />
        ))}
        {layer.pieces.map((p, i) => {
          const pw = p.t1 - p.t0;
          const ph = p.s1 - p.s0;
          return (
            <g key={i}>
              {p.polys.map((pc, k) => (
                <polygon key={k} points={ptsStr(pc.map((q) => ({ x: X(q.t), y: Y(q.s) })))} fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke="none" />
              ))}
              {/* obrys elementu: prostokąt pasa przycięty do połaci (krawędzie pod kątem rysuje obrys połaci) */}
              <rect x={X(p.t0)} y={Y(p.s1)} width={pw} height={ph} fill="none" stroke={INK} strokeWidth={1.1} clipPath={`url(#rb-${clipId})`} {...nss} />
              {(p.notches ?? []).map((n, k) => (
                <rect key={`n${k}`} x={X(n.t0)} y={Y(n.s1)} width={n.t1 - n.t0} height={n.s1 - n.s0} fill="#fff" stroke={INK} strokeWidth={1.1} strokeDasharray="4 3" {...nss} />
              ))}
              {pw > f * 2.8 && ph > f * 1.5 && p.areaCm2 > pw * ph * 0.5 && (
                <text x={X(p.t0 + pw / 2)} y={Y(p.s0 + ph / 2) + f * 0.2} fontSize={f * 0.5} textAnchor="middle" fill={INK}>
                  {cm(pw)}×{cm(ph)}
                </text>
              )}
            </g>
          );
        })}
        {lines.map((s) => (
          <line key={s} x1={0} y1={Y(s)} x2={W} y2={Y(s)} stroke={C.secondary} strokeWidth={0.8} strokeDasharray="3 5" {...nss} />
        ))}
        {face.edges.map((e, j) => {
          const a = L(e.p);
          const b = L(e.q);
          const color = e.kind === 'hip' || e.kind === 'valley' ? ROOF_LINE_COLOR[e.kind] : INK;
          return <line key={`e${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={e.kind === 'hip' || e.kind === 'valley' ? 3 : 2} {...nss} />;
        })}
        <ChainH xs={cols} y={0} off={-f * 1.6} f={f * 0.75} color={INK} />
        <Dim x1={0} y1={0} x2={W} y2={0} off={-f * 3.6} f={f} label={cm(W)} />
        {lines.length > 0 && <ChainV ys={[0, ...lines.map(Y), run].sort((a, b) => a - b)} x={0} off={-f * 1.6} f={f * 0.75} color={C.secondary} />}
        <Dim x1={W} y1={0} x2={W} y2={run} off={f * 2.2} f={f} label={cm(run)} />
        <text x={W / 2} y={run + f * 1.8} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
          dół połaci (ścianka kolankowa / podłoga)
        </text>
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `${name}, arkusz pełny ${layer.sheetW}×${layer.sheetLen} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${layer.pieces.length - full} szt., w tym ${angled} pod kątem)` },
          { color: C.secondary, dashed: true, label: 'profil rusztu – tu wypadają styki i wkręty' },
          ...(face.edges.some((e) => e.kind === 'hip') ? [{ color: ROOF_LINE_COLOR.hip, label: 'narożnik dachu – płyty docięte pod kątem' }] : []),
          ...(face.edges.some((e) => e.kind === 'valley') ? [{ color: ROOF_LINE_COLOR.valley, label: 'kosz – płyty docięte pod kątem' }] : []),
        ]}
      />
      <figcaption className="muted small">
        {layers > 1 ? `Warstwa ${layer.layer + 1} z ${layers} (${layer.layer === 0 ? 'przy ruszcie' : layer.layer === layers - 1 ? 'lico' : 'środkowa'}). ` : ''}
        Płyty dłuższą krawędzią w poprzek rusztu, wzdłuż krokwi. Styki krótkich krawędzi zawsze na profilu, w sąsiednich pasach przesunięte o min. 40 cm
        {layers > 1 ? ', kolejna warstwa przesunięta o pół płyty' : ''}.{hasCorner ? ' Przy narożniku dachu i koszu płyty docinasz pod kątem wg rysunku – odcięty kawałek idzie na sąsiedni pas.' : ''} Wymiary w cm, po licu zabudowy.
      </figcaption>
    </figure>
  );
}

