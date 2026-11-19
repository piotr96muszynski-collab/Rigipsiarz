import { ceilingBoardLayout, hangerPositions, splicePositions } from '../calc/layout';
import { ceilingCrossings, ceilingFixerGrid, ceilingGrid, type CeilingGridLine } from '../calc/materials';
import { ceilingSystemById, isHungCeiling } from '../catalog/rigips';
import { bbox } from '../geometry/geometry';
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
  const crossings = ceilingCrossings(c, sys, grid);
  const kind = sys.kind;
  const hung = isHungCeiling(kind);
  const cwSpan = kind === 'cw-span';
  // najdłuższy odcinek nośny – na nim wymiarujemy wieszaki
  const longest = !hung ? undefined : mains
    .flatMap((g) => g.segments.map((s) => ({ g, s })))
    .sort((a, b) => b.s[1] - b.s[0] - (a.s[1] - a.s[0]))[0];
  const hangers = !hung ? [] : mains.flatMap((g) => g.segments.flatMap(([a, b]) => hangerPositions(a, b, sys.hangerSpacing).map((s) => pt(g, s))));
  // łączniki wzdłużne tylko na CD (UA i CW docina się na długość przęsła)
  const splices = grid.filter((g) => !sys.profiles && (g.level === 'secondary' || hung)).flatMap((g) => g.segments.flatMap(([a, b]) => splicePositions(a, b).map((s) => ({ g, ...pt(g, s) }))));
  const mainLabel =
    kind === 'direct'
      ? sys.hangerType === 'attic' ? 'CD 60 na wieszakach do poddaszy' : `CD 60 na uchwytach ${sys.hangerType === 'elastic' ? 'elastycznych' : 'ES'}`
      : cwSpan
        ? `CW ${sys.profile ?? 50} oparty na UW (przęsło)`
        : kind === 'ua-span'
          ? 'UA 50 oparty na ścianach (przęsło)'
          : kind === 'parallel'
            ? `CD 60 na wieszakach ${sys.hangerType === 'noniusz' ? 'noniuszowych' : ''}`.trim()
            : sys.profiles
              ? `profil główny ${sys.profiles.main} (górny)`
              : 'CD 60 nośny (górny)';
  const mainSpacing = kind === 'direct' || kind === 'parallel' || cwSpan ? sys.secondarySpacing : sys.mainSpacing;
  const crossLabel = sys.profiles ? `wpięcie profilu dolnego, ${sys.profiles.crossScrews} wkręty` : kind === 'two-level' ? 'łącznik krzyżowy' : kind === 'ua-span' ? 'łącznik UA–CD ×2' : 'łącznik jednopoziomowy ×2';

  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
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
          { color: C.ud, label: `${cwSpan ? `UW ${sys.profile ?? 50}` : sys.profiles ? `profil przyścienny ${sys.profiles.edge}` : 'UD 30'} po obwodzie na taśmie, kołki` },
          { color: C.main, label: `${mainLabel} co ${mainSpacing} cm (${mains.length} linii)` },
          ...(secs.length ? [{ color: C.secondary, label: `${sys.profiles ? `profil nośny ${sys.profiles.secondary}` : 'CD 60 montażowy'} (dolny) co ${sys.secondarySpacing} cm (${secs.length} linii)` }] : []),
          ...(hung
            ? [{ color: C.hanger, label: `${kind === 'direct' ? 'uchwyt bezpośredni + kotwa' : sys.profiles ? 'zawiesie z kątownika + kotwa' : 'wieszak noniuszowy + kotwa'}, max co ${sys.hangerSpacing} cm (${hangers.length} szt.)` }]
            : []),
          ...(crossings.length
            ? [{ color: '#fff', label: `${crossLabel} (${crossings.length} skrzyżowań)` }]
            : []),
          ...(splices.length ? [{ color: INK, label: `łącznik wzdłużny CD (${splices.length} szt.)` }] : []),
        ]}
      />
      <figcaption className="muted small">
        Rzut od dołu, wymiary w cm od krawędzi ścian. Łańcuchy przy krawędziach: rozstaw profili. {hung ? 'Czerwony łańcuch: rozmieszczenie wieszaków na najdłuższym profilu nośnym.' : ''}
      </figcaption>
    </figure>
  );
}

/** Rzut sufitu: rozkład płyt */
export function CeilingBoardsDrawing({ c, title }: { c: Ceiling; title: string }) {
  const sys = ceilingSystemById(c.systemId);
  const { bb, w, h, f, vb } = frame(c);
  const grid = ceilingGrid(c);
  const carriers = grid.filter((g) => g.level === (sys.kind === 'direct' || sys.kind === 'parallel' || sys.kind === 'cw-span' ? 'main' : 'secondary'));
  const { pieces, sheetLen, stagger } = ceilingBoardLayout(c);
  const clip = `clipb-${c.id}`;
  const full = pieces.filter((p) => !p.cut).length;
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
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

/** Rzut sufitu ATLAS M-System 3G: łączniki talerzykowe w siatce z łańcuchami wymiarowymi */
export function CeilingFixersDrawing({ c, title }: { c: Ceiling; title: string }) {
  const sys = ceilingSystemById(c.systemId);
  const { bb, w, h, f, vb } = frame(c);
  const g = ceilingFixerGrid(c, sys);
  const clip = `clip-fx-${c.id}`;
  const disc = '#e07a2a';
  const name = `łącznik ATLAS M-System 3G ${(sys.fixer?.product ?? 'ATLAS_3G_L100').replace('ATLAS_3G_', '')}${sys.fixer?.extension ? ` + przedłużka ${sys.fixer.extension.replace('ATLAS_PLUS_', '')}` : ''}`;
  const sx = c.direction === 0 ? sys.mainSpacing : sys.secondarySpacing;
  const sy = c.direction === 0 ? sys.secondarySpacing : sys.mainSpacing;
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <defs>
          <clipPath id={clip}>
            <polygon points={poly(c)} />
          </clipPath>
        </defs>
        <polygon points={poly(c)} fill={C.concrete} fillOpacity={0.35} />
        <g clipPath={`url(#${clip})`}>
          {g.xs.map((x) => (
            <line key={`x${x}`} x1={x} y1={bb.minY} x2={x} y2={bb.maxY} stroke={disc} strokeWidth={0.6} strokeDasharray="2 5" {...nss} />
          ))}
          {g.ys.map((y) => (
            <line key={`y${y}`} x1={bb.minX} y1={y} x2={bb.maxX} y2={y} stroke={disc} strokeWidth={0.6} strokeDasharray="2 5" {...nss} />
          ))}
        </g>
        <polygon points={poly(c)} fill="none" stroke={INK} strokeWidth={1.4} {...nss} />
        {g.points.map((q, i) => (
          <g key={i}>
            <circle cx={q.x} cy={q.y} r={6} fill={disc} fillOpacity={0.85} stroke={INK} strokeWidth={0.6} {...nss} />
            <circle cx={q.x} cy={q.y} r={1.2} fill={INK} />
          </g>
        ))}
        <ChainH xs={[bb.minX, ...g.xs, bb.maxX]} y={bb.minY} off={-f * 2} f={f * 0.8} color={disc} />
        <ChainV ys={[bb.minY, ...g.ys, bb.maxY]} x={bb.minX} off={-f * 2} f={f * 0.8} color={disc} />
        <Dim x1={bb.minX} y1={bb.maxY} x2={bb.maxX} y2={bb.maxY} off={f * 2} f={f} label={`${cm(w)} cm`} />
        <Dim x1={bb.maxX} y1={bb.minY} x2={bb.maxX} y2={bb.maxY} off={f * 2} f={f} label={`${cm(h)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: disc, label: `${name} – talerzyk ø 12 cm (${g.points.length} szt.)` },
          { color: disc, dashed: true, label: `siatka ${cm(sx)} × ${cm(sy)} cm` },
        ]}
      />
      <figcaption className="muted small">
        Wymiary w cm. Łańcuchy wymiarowe: osie rzędów łączników od krawędzi sufitu. Najpierw łączniki wzdłuż ścian, 7 cm od
        każdej ściany (instrukcja ATLAS M-System 3G), potem pośrednie co rozstaw; przy ścianie odstęp może wyjść mniejszy. Talerzyki wypoziomuj laserem przed montażem płyt.
      </figcaption>
    </figure>
  );
}
