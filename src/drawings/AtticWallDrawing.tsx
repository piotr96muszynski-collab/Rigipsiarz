import type { AtticWallLayout } from '../calc/atticWalls';
import { boardById } from '../catalog/rigips';
import { C, ChainH, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

/** Widok ściany poddasza: x w prawo, z w górę – w SVG odwrócone */
function frameOf(lay: AtticWallLayout) {
  const W = lay.face.width;
  const H = lay.face.height;
  const f = clamp(Math.max(W, H) / 26, 8, 30);
  const m = f * 6;
  const vb: [number, number, number, number] = [-m, -m, W + 2 * m, H + 2 * m];
  const Y = (z: number) => H - z;
  const pts = (list: { x: number; z: number }[]) => list.map((p) => `${p.x.toFixed(1)},${Y(p.z).toFixed(1)}`).join(' ');
  return { W, H, f, vb, Y, pts };
}

const FIX_LABEL: Record<string, string> = {
  'cd-lining': 'uchwyt ES – miejsce wiercenia (kołek)',
  'hat-lining': 'kołek profilu kapeluszowego',
  'point-fix': 'łącznik ATLAS M-System 3G',
};

/** Ruszt okładziny ściany poddasza: profile pionowe docięte do skosu, UD po obwodzie, punkty mocowania */
export function AtticWallFrameDrawing({ lay, title }: { lay: AtticWallLayout; title: string }) {
  const { W, H, f, vb, Y, pts } = frameOf(lay);
  const stud = lay.sys.frame === 'hat-lining' ? 'profil kapeluszowy' : 'profil CD 60';
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <polygon points={pts(lay.face.poly)} fill={C.concrete} fillOpacity={0.35} stroke={INK} strokeWidth={1.5} {...nss} />
        {lay.tracks.map(([p, q], i) => (
          <line key={i} x1={p.x} y1={Y(p.z)} x2={q.x} y2={Y(q.z)} stroke={C.ud} strokeWidth={4} {...nss} />
        ))}
        {lay.studs.map((s) => (
          <line key={s.x} x1={s.x} y1={Y(0)} x2={s.x} y2={Y(s.len)} stroke={C.main} strokeWidth={3} {...nss} />
        ))}
        {lay.fixings.map((p, i) => (
          <circle key={i} cx={p.x} cy={Y(p.z)} r={f * 0.3} fill={C.hanger} />
        ))}
        {lay.studs.length > 0 && <ChainH xs={[0, ...lay.studs.map((s) => s.x), W]} y={H} off={f * 1.6} f={f * 0.75} color={C.main} />}
        <Dim x1={0} y1={H} x2={W} y2={H} off={f * 3.6} f={f} label={cm(W)} />
        <Dim x1={W} y1={0} x2={W} y2={H} off={f * 2.2} f={f} label={cm(H)} />
      </Paper>
      <Legend
        items={[
          ...(lay.studs.length ? [{ color: C.main, label: `${stud} pionowo co ${lay.face.lining.studSpacing} cm – ${lay.studs.length} szt. na ścianę, docięte do skosu` }] : []),
          ...(lay.tracks.length ? [{ color: C.ud, label: 'profil UD 30 po obwodzie (posadzka, skos, sufit, narożniki)' }] : []),
          ...(lay.fixings.length ? [{ color: C.hanger, label: `${FIX_LABEL[lay.sys.frame] ?? 'mocowanie'} – ${lay.fixings.length} szt. na ścianę` }] : []),
        ]}
      />
      <figcaption className="muted small">
        {lay.face.count > 1 ? `Rysunek dla jednej ściany – takich ścian jest ${lay.face.count}. ` : ''}Wymiary w cm. Łańcuch: osie profili od lewej
        krawędzi. {lay.sys.frame === 'glued' ? 'Płyta klejona do muru plackami kleju gipsowego, bez rusztu.' : ''}
      </figcaption>
    </figure>
  );
}

/** Rozkład płyt okładziny ściany poddasza (jedna warstwa), elementy docięte do skosu */
export function AtticWallBoardsDrawing({ lay, layer, title }: { lay: AtticWallLayout; layer: number; title: string }) {
  const { W, H, f, vb, Y, pts } = frameOf(lay);
  const l = lay.layers[layer];
  const full = l.pieces.filter((p) => !p.cut).length;
  const cols = [...new Set(l.pieces.flatMap((p) => [p.x0, p.x1]))].sort((a, b) => a - b);
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <polygon points={pts(lay.face.poly)} fill="#f7f8fa" />
        {l.pieces.map((p, i) => {
          const pw = p.x1 - p.x0;
          const ph = p.y1 - p.y0;
          return (
            <g key={i}>
              <rect x={p.x0} y={Y(p.y1)} width={pw} height={ph} fill="none" stroke={INK} strokeWidth={0.6} strokeDasharray="3 4" {...nss} />
              <polygon points={pts(p.outline)} fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke={INK} strokeWidth={1.1} {...nss} />
              {pw > f * 2.8 && ph > f * 1.5 && (
                <text x={p.x0 + pw / 2} y={Y(p.y0 + Math.min(ph, 60) / 2) + f * 0.2} fontSize={f * 0.5} textAnchor="middle" fill={INK}>
                  {cm(pw)}×{cm(ph)}
                </text>
              )}
            </g>
          );
        })}
        <polygon points={pts(lay.face.poly)} fill="none" stroke={INK} strokeWidth={2} {...nss} />
        <ChainH xs={cols} y={H} off={f * 1.6} f={f * 0.75} color={INK} />
        <Dim x1={0} y1={H} x2={W} y2={H} off={f * 3.6} f={f} label={cm(W)} />
        <Dim x1={W} y1={0} x2={W} y2={H} off={f * 2.2} f={f} label={cm(H)} />
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `${boardById(l.boardId).name}, arkusz pełny ${l.sheetW}×${l.sheetLen} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${l.pieces.length - full} szt.); linia przerywana – arkusz, z którego go wycinasz` },
        ]}
      />
      <figcaption className="muted small">
        {lay.layers.length > 1 ? `Warstwa ${layer + 1} z ${lay.layers.length}${layer % 2 ? ', przesunięta o pół płyty' : ''}. ` : ''}
        {lay.face.count > 1 ? `Rysunek dla jednej ściany – takich ścian jest ${lay.face.count}. ` : ''}
        Płyty pionowo, styki poziome w sąsiednich pasach na przemian u dołu i u góry, bez dostawek węższych niż 30 cm. Górną krawędź
        docinasz pod kątem skosu. Wymiary w cm.
      </figcaption>
    </figure>
  );
}
