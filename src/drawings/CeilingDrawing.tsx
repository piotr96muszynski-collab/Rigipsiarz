import { ceilingBoardLayout, hangerPositions, splicePositions } from '../calc/layout';
import { ceilingGrid, type CeilingGridLine } from '../calc/materials';
import { ceilingSystemById } from '../catalog/rigips';
import { bbox, pointInPolygon } from '../geometry/geometry';
import type { Ceiling } from '../model/types';
import { C, ChainH, ChainV, Dim, INK, Legend, Paper, clamp, cm, nss } from './svg';

function frame(c: Ceiling) {
  const bb = bbox(c.points);
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  const f = clamp(Math.max(w, h) / 26, 8, 30);
  const m = f * 5;
  return { bb, w, h, f, vb: [bb.minX - m, bb.minY - m, w + m * 2, h + m * 2] as [number, number, number, number] };
}

const poly = (c: Ceiling) => c.points.map((p) => `${p.x},${p.y}`).join(' ');

function seg(g: CeilingGridLine, a: number, b: number) {
  return g.axis === 'x' ? { x1: a, y1: g.at, x2: b, y2: g.at } : { x1: g.at, y1: a, x2: g.at, y2: b };
}
const pt = (g: CeilingGridLine, s: number) => (g.axis === 'x' ? { x: s, y: g.at } : { x: g.at, y: s });

/** Łańcuch rozstawu linii rusztu, rysowany wzdłuż krawędzi prostokąta otaczającego */
function SpacingChain({ lines, bb, f, off, color }: { lines: CeilingGridLine[]; bb: ReturnType<typeof bbox>; f: number; off: number; color: string }) {
  if (!lines.length) return null;
  const ats = lines.map((g) => g.at);
  if (lines[0].axis === 'x') return <ChainV ys={[bb.minY, ...ats, bb.maxY]} x={bb.minX} off={-off} f={f * 0.8} color={color} />;
  return <ChainH xs={[bb.minX, ...ats, bb.maxX]} y={bb.minY} off={-off} f={f * 0.8} color={color} />;
}

/** Rzut rusztu sufitu: UD po obwodzie, CD nośne i montażowe, wieszaki, łączniki */
export function CeilingGridDrawing({ c, title }: { c: Ceiling; title: string }) {
  const sys = ceilingSystemById(c.systemId);
  const { bb, w, h, f, vb } = frame(c);
  const grid = ceilingGrid(c);
  const mains = grid.filter((g) => g.level === 'main');
  const secs = grid.filter((g) => g.level === 'secondary');
  const clip = `clip-${c.id}`;
  const crossings =
    sys.kind === 'direct'
      ? []
      : mains.flatMap((m) =>
          secs
            .map((s) => (m.axis === 'x' ? { x: s.at, y: m.at } : { x: m.at, y: s.at }))
            .filter((p) => pointInPolygon(p, c.points)),
        );
  // najdłuższy odcinek nośny – na nim wymiarujemy wieszaki
  const longest = mains
    .flatMap((g) => g.segments.map((s) => ({ g, s })))
    .sort((a, b) => b.s[1] - b.s[0] - (a.s[1] - a.s[0]))[0];
  const hangers = mains.flatMap((g) => g.segments.flatMap(([a, b]) => hangerPositions(a, b, sys.hangerSpacing).map((s) => pt(g, s))));
  const splices = grid.flatMap((g) => g.segments.flatMap(([a, b]) => splicePositions(a, b).map((s) => ({ g, ...pt(g, s) }))));
  const mainLabel = sys.kind === 'direct' ? 'CD 60 na wieszakach ES' : 'CD 60 nośny (górny)';

  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title} minWidth={clamp(w * 1.4, 480, 1100)}>
        <defs>
          <clipPath id={clip}>
            <polygon points={poly(c)} />
          </clipPath>
        </defs>
        <polygon points={poly(c)} fill="#f7f8fa" />
        <g clipPath={`url(#${clip})`}>
          {secs.flatMap((g, i) =>
            g.segments.map(([a, b], k) => <line key={`s${i}-${k}`} {...seg(g, a, b)} stroke={C.secondary} strokeWidth={1.6} {...nss} />),
          )}
          {mains.flatMap((g, i) =>
            g.segments.map(([a, b], k) => <line key={`m${i}-${k}`} {...seg(g, a, b)} stroke={C.main} strokeWidth={3} {...nss} />),
          )}
          {crossings.map((p, i) => (
            <rect key={i} x={p.x - f * 0.22} y={p.y - f * 0.22} width={f * 0.44} height={f * 0.44} fill="#fff" stroke={INK} strokeWidth={0.8} {...nss} />
          ))}
          {splices.map((s, i) => (
            <rect
              key={i}
              x={s.x - (s.g.axis === 'x' ? f * 0.5 : f * 0.15)}
              y={s.y - (s.g.axis === 'x' ? f * 0.15 : f * 0.5)}
              width={s.g.axis === 'x' ? f : f * 0.3}
              height={s.g.axis === 'x' ? f * 0.3 : f}
              fill={INK}
            />
          ))}
          {hangers.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={f * 0.32} fill={C.hanger} />
          ))}
        </g>
        <polygon points={poly(c)} fill="none" stroke={C.ud} strokeWidth={4} {...nss} />
        <polygon points={poly(c)} fill="none" stroke={INK} strokeWidth={1} {...nss} />

        <SpacingChain lines={mains} bb={bb} f={f} off={f * 2} color={C.main} />
        <SpacingChain lines={secs} bb={bb} f={f} off={f * 2} color={C.secondary} />
        {longest && (
          <g>
            {longest.g.axis === 'x' ? (
              <ChainH
                xs={[longest.s[0], ...hangerPositions(longest.s[0], longest.s[1], sys.hangerSpacing), longest.s[1]]}
                y={longest.g.at}
                off={-f * 1.1}
                f={f * 0.7}
                color={C.hanger}
              />
            ) : (
              <ChainV
                ys={[longest.s[0], ...hangerPositions(longest.s[0], longest.s[1], sys.hangerSpacing), longest.s[1]]}
                x={longest.g.at}
                off={f * 1.1}
                f={f * 0.7}
                color={C.hanger}
              />
            )}
          </g>
        )}
        <Dim x1={bb.minX} y1={bb.maxY} x2={bb.maxX} y2={bb.maxY} off={f * 2.2} f={f} label={`${cm(w)} cm`} />
        <Dim x1={bb.maxX} y1={bb.minY} x2={bb.maxX} y2={bb.maxY} off={f * 2.2} f={f} label={`${cm(h)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: C.ud, label: 'UD 27 po obwodzie na taśmie, kołki co 60 cm' },
          { color: C.main, label: `${mainLabel} co ${sys.kind === 'direct' ? sys.secondarySpacing : sys.mainSpacing} cm (${mains.length} linii)` },
          ...(secs.length ? [{ color: C.secondary, label: `CD 60 montażowy (dolny) co ${sys.secondarySpacing} cm (${secs.length} linii)` }] : []),
          { color: C.hanger, label: `${sys.kind === 'direct' ? 'wieszak ES' : 'wieszak noniuszowy + kotwa'}, max co ${sys.hangerSpacing} cm (${hangers.length} szt.)` },
          ...(crossings.length
            ? [{ color: '#fff', label: `${sys.kind === 'two-level' ? 'łącznik krzyżowy' : 'łącznik jednopoziomowy ×2'} (${crossings.length} skrzyżowań)` }]
            : []),
          ...(splices.length ? [{ color: INK, label: `łącznik wzdłużny CD (${splices.length} szt.)` }] : []),
        ]}
      />
      <figcaption className="muted small">
        Rzut od dołu, wymiary w cm od krawędzi ścian. Łańcuchy przy krawędziach: rozstaw profili. Czerwony łańcuch: rozmieszczenie
        wieszaków na najdłuższym profilu nośnym.
      </figcaption>
    </figure>
  );
}

/** Rzut sufitu: rozkład płyt */
export function CeilingBoardsDrawing({ c, title }: { c: Ceiling; title: string }) {
  const sys = ceilingSystemById(c.systemId);
  const { bb, w, h, f, vb } = frame(c);
  const grid = ceilingGrid(c);
  const carriers = grid.filter((g) => g.level === (sys.kind === 'direct' ? 'main' : 'secondary'));
  const { pieces, sheetLen, stagger } = ceilingBoardLayout(c);
  const clip = `clipb-${c.id}`;
  const full = pieces.filter((p) => !p.cut).length;
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title} minWidth={clamp(w * 1.4, 480, 1100)}>
        <defs>
          <clipPath id={clip}>
            <polygon points={poly(c)} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {pieces.map((p, i) => {
            const pw = p.x1 - p.x0;
            const ph = p.y1 - p.y0;
            return (
              <g key={i}>
                <rect x={p.x0} y={p.y0} width={pw} height={ph} fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke={INK} strokeWidth={1.1} {...nss} />
                {pw > f * 4 && ph > f * 2 && (
                  <text x={p.x0 + pw / 2} y={p.y0 + ph / 2 + f * 0.35} fontSize={f * 0.85} textAnchor="middle" fill={INK}>
                    {cm(pw)}×{cm(ph)}
                  </text>
                )}
              </g>
            );
          })}
          {carriers.flatMap((g, i) =>
            g.segments.map(([a, b], k) => (
              <line key={`${i}-${k}`} {...seg(g, a, b)} stroke={C.secondary} strokeWidth={0.8} strokeDasharray="3 5" {...nss} />
            )),
          )}
        </g>
        <polygon points={poly(c)} fill="none" stroke={INK} strokeWidth={2} {...nss} />
        <Dim x1={bb.minX} y1={bb.maxY} x2={bb.maxX} y2={bb.maxY} off={f * 2.2} f={f} label={`${cm(w)} cm`} />
        <Dim x1={bb.maxX} y1={bb.minY} x2={bb.maxX} y2={bb.maxY} off={f * 2.2} f={f} label={`${cm(h)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `arkusz pełny 120×${sheetLen} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${pieces.length - full} szt.)` },
          { color: C.secondary, dashed: true, label: 'profil, do którego przykręcasz płyty' },
        ]}
      />
      <figcaption className="muted small">
        Płyty dłuższą krawędzią poprzecznie do profili montażowych. Styki poprzeczne zawsze na profilu, w sąsiednich rzędach
        przesunięte o {stagger} cm (min. 40 cm). {sys.layers > 1 ? 'Druga warstwa: styki przesunięte względem pierwszej o rozstaw profili. ' : ''}
        Przy nieregularnym kształcie elementy docinasz do obrysu.
      </figcaption>
    </figure>
  );
}
