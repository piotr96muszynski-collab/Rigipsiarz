import { FIXER_EDGE, OPENING_JOINT_MIN, pieceOutline, type BoardFace, type BoardPiece, type CutRect, type StudKind, type WallLayout } from '../calc/layout';
import { C, ChainH, ChainV, Dim, INK, Legend, Paper, clamp, cm, dedupe, nss } from './svg';

const STUD_COLOR: Record<StudKind, string> = {
  stud: C.stud,
  short: C.short,
  jamb: C.jamb,
  'jamb-ua': C.ua,
  extra: C.extra,
  joint: C.joint,
};

const STUD_W = 5; // cm – szerokość półki profilu na widoku

/** Wspólny układ arkusza: cm, oś Y w dół (posadzka na dole) */
function frame(l: WallLayout) {
  const Lc = l.L * 100;
  const Hc = l.H * 100;
  const f = clamp(Math.max(Lc, Hc) / 26, 8, 30);
  const left = f * 4;
  const right = f * 2;
  const top = f * 4.2 + (l.openings.length ? f * 2.2 : 0);
  const bottom = f * 6.5;
  return { Lc, Hc, f, vb: [-left, -top, Lc + left + right, Hc + top + bottom] as [number, number, number, number] };
}


function Openings({ l, f, fill = '#fff' }: { l: WallLayout; f: number; fill?: string }) {
  const Hc = l.H * 100;
  return (
    <g>
      {l.openings.map((o) => {
        const x = o.x0 * 100;
        const y = Hc - o.top * 100;
        const w = o.w * 100;
        const h = o.h * 100;
        return (
          <g key={o.id}>
            <rect x={x} y={y} width={w} height={h} fill={fill} stroke={INK} strokeWidth={1.2} strokeDasharray="6 4" {...nss} />
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#b8c0c8" strokeWidth={0.7} {...nss} />
            <line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#b8c0c8" strokeWidth={0.7} {...nss} />
            <text x={x + w / 2} y={y + h / 2 - f * 0.2} fontSize={f * 0.9} textAnchor="middle" fill={INK} fontWeight={600}>
              {o.kind === 'door' ? 'Drzwi' : 'Okno'}
            </text>
            <text x={x + w / 2} y={y + h / 2 + f * 0.9} fontSize={f * 0.8} textAnchor="middle" fill={INK}>
              {cm(o.w * 100)}×{cm(o.h * 100)}
            </text>
            {o.sill > 0.01 && (
              <text x={x + w / 2} y={y + h / 2 + f * 1.9} fontSize={f * 0.75} textAnchor="middle" fill={INK}>
                parapet {cm(o.sill * 100)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function OuterDims({ l, f, studs }: { l: WallLayout; f: number; studs?: boolean }) {
  const Lc = l.L * 100;
  const Hc = l.H * 100;
  const xs = dedupe(l.studs.map((s) => s.x * 100), 0.5);
  const opXs = [0, ...l.openings.flatMap((o) => [o.x0 * 100, o.x1 * 100]), Lc];
  return (
    <g>
      {studs && <ChainH xs={xs} y={Hc} off={f * 2} f={f * 0.85} />}
      <Dim x1={0} y1={Hc} x2={Lc} y2={Hc} off={studs ? f * 4.2 : f * 2} f={f} label={`${cm(Lc)} cm`} />
      <Dim x1={0} y1={0} x2={0} y2={Hc} off={-f * 2.2} f={f} label={`${cm(Hc)} cm`} />
      {l.openings.length > 0 && <ChainH xs={opXs} y={0} off={-f * 2.2} f={f * 0.85} />}
    </g>
  );
}

/** Widok ściany: konstrukcja (słupki CW/UA, profile UW, nadproża) z wymiarami */
export function WallFrameDrawing({ l, title }: { l: WallLayout; title: string }) {
  const { Lc, Hc, f, vb } = frame(l);
  const has = (k: StudKind) => l.studs.some((s) => s.kind === k);
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        {/* strop i posadzka */}
        <rect x={-f} y={-f * 0.8} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <rect x={-f} y={Hc} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <Openings l={l} f={f} />
        {/* profile UW */}
        {l.tracks.map((t, i) => (
          <rect
            key={i}
            x={t.x0 * 100 - (t.kind === 'header' || t.kind === 'sill' ? 15 : 0)}
            y={Hc - t.y * 100 - (t.kind === 'floor' || t.kind === 'header' ? 4 : 0)}
            width={(t.kind === 'header' || t.kind === 'sill' ? t.cut : t.x1 - t.x0) * 100}
            height={4}
            fill={C.track}
            opacity={t.kind === 'header' || t.kind === 'sill' ? 0.85 : 1}
          />
        ))}
        {/* słupki */}
        {l.studs.map((s, i) => {
          const x = clamp(s.x * 100 - STUD_W / 2, 0, Lc - STUD_W);
          return s.segments.map(([y0, y1], k) => (
            <rect
              key={`${i}-${k}`}
              x={s.kind === 'extra' ? clamp(x + (s.x * 100 > Lc / 2 ? -STUD_W - 1 : STUD_W + 1), 0, Lc - STUD_W) : x}
              y={Hc - y1 * 100}
              width={STUD_W}
              height={(y1 - y0) * 100}
              fill={STUD_COLOR[s.kind]}
            />
          ));
        })}
        <OuterDims l={l} f={f} studs />
      </Paper>
      <Legend
        items={[
          { color: C.stud, label: `${l.frame === 'cd-lining' ? 'profil' : 'słupek'} ${l.studLabel} (rozstaw ${cm(l.spacing * 100)} cm)${l.rows > 1 ? ' – dwa rzędy, drugi identyczny' : ''}` },
          ...(has('short') ? [{ color: C.short, label: 'słupek skrócony nad/pod otworem' }] : []),
          ...(has('jamb') ? [{ color: C.jamb, label: `ościeże ${l.studLabel}` }] : []),
          ...(has('jamb-ua') ? [{ color: C.ua, label: `ościeże UA ${l.profile} + kątowniki` }] : []),
          ...(has('extra') ? [{ color: C.extra, label: `dodatkowy ${l.studLabel} (narożnik / połączenie)` }] : []),
          ...(has('joint') ? [{ color: C.joint, label: `dodatkowy ${l.studLabel} pod styk płyt przy otworze (styki warstw muszą się minąć)` }] : []),
          { color: C.track, label: `${l.trackLabel} posadzka i strop, nadproża/podokienniki +15 cm na stronę` },
          ...(l.frame === 'cd-lining' ? [{ color: C.hanger, label: 'uchwyty ES do ściany wg rozstawu z karty systemu' }] : []),
          ...(l.openings.length ? [{ dashed: true, label: 'otwór w świetle' }] : []),
        ]}
      />
      <figcaption className="muted small">
        Wymiary w cm. Dolny łańcuch: odległości między osiami słupków liczone od początku ściany (lewa krawędź).
      </figcaption>
    </figure>
  );
}

/** Opis końców płyty z modelu styków (narożnik, trójnik, mur, wolny koniec) */
function endNote(face: BoardFace, L: number) {
  const part = (d: number, at: string) =>
    Math.abs(d) < 0.0005 ? '' : d > 0 ? ` ${at}: płyta wychodzi ${cm(d * 100)} cm poza oś węzła (zachodzi na czoło sąsiedniej ściany).` : ` ${at}: płyta kończy się ${cm(-d * 100)} cm przed osią węzła (dochodzi do sąsiedniej ściany).`;
  return part(-face.x0, 'Lewy koniec') + part(face.x1 - L, 'Prawy koniec');
}

const faceName = (face: BoardFace, sides: number, layers: number) =>
  `${sides > 1 ? `Strona ${face.side === 0 ? 'A' : 'B'}` : 'Okładzina'}${layers > 1 ? `, warstwa ${face.layer + 1}` : ''}`;

export { faceName };

/** Obrys elementu (z wycięciem L/U) jako ścieżka SVG w cm, oś Y w dół */
function piecePath(p: BoardPiece, Hc: number): string {
  return pieceOutline(p)
    .map((loop) => 'M' + loop.map((q) => `${q.x * 100},${Hc - q.y * 100}`).join('L') + 'Z')
    .join(' ');
}

/** Największy pas elementu poza wycięciami (miejsce na opis), m */
function labelRect(p: BoardPiece) {
  const ns = p.notches ?? [];
  const nx0 = Math.min(...ns.map((n) => n.x0));
  const nx1 = Math.max(...ns.map((n) => n.x1));
  const ny0 = Math.min(...ns.map((n) => n.y0));
  const ny1 = Math.max(...ns.map((n) => n.y1));
  const strips = [
    { x0: p.x0, x1: nx0, y0: p.y0, y1: p.y1 },
    { x0: nx1, x1: p.x1, y0: p.y0, y1: p.y1 },
    { x0: p.x0, x1: p.x1, y0: p.y0, y1: ny0 },
    { x0: p.x0, x1: p.x1, y0: ny1, y1: p.y1 },
  ].filter((r) => r.x1 - r.x0 > 0.01 && r.y1 - r.y0 > 0.01);
  // pas szeroki na tyle, by zmieścić opis, ma pierwszeństwo przed niskim paskiem
  const score = (r: CutRect) => Math.min(r.x1 - r.x0, 0.6) * Math.min(r.y1 - r.y0, 0.6);
  return strips.sort((a, b) => score(b) - score(a))[0] ?? p;
}

/** Widok ściany: rozkład płyt na jednej okładzinie */
export function WallBoardsDrawing({ l, face, title }: { l: WallLayout; face: BoardFace; title: string }) {
  const { Lc, Hc, f, vb } = frame(l);
  const full = face.pieces.filter((p) => !p.cut).length;
  const shaped = face.pieces.filter((p) => p.shape && p.shape !== 'rect').length;
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title}>
        <rect x={-f} y={-f * 0.8} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <rect x={-f} y={Hc} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        {face.pieces.map((p, i) => (
          <path key={i} d={piecePath(p, Hc)} fillRule="evenodd" fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke={INK} strokeWidth={1.1} {...nss} />
        ))}
        {/* linie wkrętów na słupkach */}
        {dedupe(l.studs.map((s) => s.x * 100), 0.5).map((x) => (
          <line key={x} x1={clamp(x, 1, Lc - 1)} y1={0} x2={clamp(x, 1, Lc - 1)} y2={Hc} stroke={C.stud} strokeWidth={0.6} strokeDasharray="2 6" {...nss} />
        ))}
        <Openings l={l} f={f} />
        {face.pieces.map((p, i) => {
          const w = (p.x1 - p.x0) * 100;
          const h = (p.y1 - p.y0) * 100;
          if (w < f * 3 || h < f * 3) return null;
          const n = p.notches?.[0];
          if (n && p.shape !== 'rect') {
            // element L/U: opis w najszerszej części płyty (poza wycięciem), w wąskim pasie – pionowo
            const r = labelRect(p);
            const cx = ((r.x0 + r.x1) / 2) * 100;
            const cy = Hc - ((r.y0 + r.y1) / 2) * 100;
            const rw = (r.x1 - r.x0) * 100;
            const vertical = rw < f * 6 && (r.y1 - r.y0) * 100 > rw;
            const sub = `${p.shape === 'L' ? 'L' : p.shape === 'U' ? 'U' : 'ramka'}, wycięcie ${cm((n.x1 - n.x0) * 100)}×${cm((n.y1 - n.y0) * 100)}`;
            return (
              <text
                key={i}
                x={cx}
                y={cy}
                transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
                fontSize={f * 0.85}
                textAnchor="middle"
                fill={INK}
                stroke="#fff"
                strokeWidth={f * 0.25}
                paintOrder="stroke"
              >
                <tspan x={cx} dy={-f * 0.15}>
                  {cm(w)}×{cm(h)}
                </tspan>
                <tspan x={cx} dy={f * 1.0} fontSize={f * 0.7}>
                  {sub}
                </tspan>
              </text>
            );
          }
          const cx = (p.x0 + p.x1) / 2;
          const cy = (p.y0 + p.y1) / 2;
          // etykieta nie może wypaść w otworze – wtedy przy górnej krawędzi elementu
          const hidden = l.openings.some((o) => cx > o.x0 - 0.15 && cx < o.x1 + 0.15 && cy > o.sill && cy < o.top);
          const ty = hidden ? Hc - p.y1 * 100 + f * 1.6 : Hc - cy * 100 + f * 0.35;
          return (
            <text key={i} x={cx * 100} y={ty} fontSize={f * 0.85} textAnchor="middle" fill={INK} stroke="#fff" strokeWidth={f * 0.25} paintOrder="stroke">
              {cm(w)}×{cm(h)}
            </text>
          );
        })}
        {[...new Set([...face.jambJoints, ...face.layerJoints])].map((x) => (
          <line key={x} x1={x * 100} y1={0} x2={x * 100} y2={Hc} stroke={C.warn} strokeWidth={2.4} {...nss} />
        ))}
        <ChainH xs={[face.x0 * 100, ...face.joints.map((x) => x * 100), face.x1 * 100]} y={Hc} off={f * 2} f={f * 0.85} />
        <Dim x1={0} y1={Hc} x2={Lc} y2={Hc} off={f * 4.2} f={f} label={`${cm(Lc)} cm`} />
        <Dim x1={0} y1={0} x2={0} y2={Hc} off={-f * 2.2} f={f} label={`${cm(Hc)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `arkusz pełny ${cm(l.sheet.width * 100)}×${cm(l.sheet.length * 100)} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${face.pieces.length - full} szt.${shaped ? `, w tym ${shaped} wycinane w kształt L lub U przy otworach` : ''})` },
          { color: C.stud, dashed: true, label: 'oś słupka – linia wkręcania' },
          ...(face.jambJoints.length ? [{ color: C.warn, label: 'styk w linii ościeża – nie było gdzie dostawić słupka' }] : []),
          ...(face.layerJoints.length ? [{ color: C.warn, label: 'styk na styku niższej warstwy – nie było gdzie dostawić słupka' }] : []),
        ]}
      />
      <figcaption className="muted small">
        Styki pionowe zawsze na słupku. {face.offset > 0 ? `Pierwszy pas docięty na ${cm(face.offset * 100)} cm, żeby styki mijały się z sąsiednią okładziną.` : 'Zaczynasz od pełnego arkusza przy lewej krawędzi.'}{' '}
        Wymiary elementów w cm (prostokąt arkusza przed wycięciem).
        {l.openings.length > 0 &&
          ` Przy otworach płyta zachodzi na ościeże i jest wycinana w kształt litery L (U przy wąskim otworze), a styk wypada nad lub pod otworem, co najmniej ${cm(OPENING_JOINT_MIN * 100)} cm od ościeża – dzięki temu narożniki otworu nie pękają.`}
        {endNote(face, l.L)}
      </figcaption>
    </figure>
  );
}

/** Kolor talerzyka łącznika ATLAS M-System 3G na rysunku */
const DISC = '#e07a2a';

/**
 * Widok okładziny ATLAS M-System 3G: rozstaw łączników talerzykowych z łańcuchami wymiarowymi
 * (poziomo – osie kolumn od lewej krawędzi, pionowo – rzędy od posadzki) i styki płyt.
 */
export function WallFixersDrawing({ l, title, fixerName }: { l: WallLayout; title: string; fixerName: string }) {
  const g = l.fixers;
  if (!g) return null;
  const { Lc, Hc, f, vb } = frame(l);
  // miejsce na pionowy łańcuch rzędów po prawej stronie
  const box: [number, number, number, number] = [vb[0], vb[1], vb[2] + f * 3, vb[3]];
  const r = 6; // talerzyk ø 12 cm
  const joints = dedupe(l.faces.flatMap((fc) => fc.joints.map((x) => x * 100)), 0.5);
  const rows = g.ys.map((y) => Hc - y * 100).sort((a, b) => a - b);
  return (
    <figure className="drawing">
      <Paper viewBox={box} title={title}>
        <rect x={-f} y={-f * 0.8} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <rect x={-f} y={Hc} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <rect x={0} y={0} width={Lc} height={Hc} fill={C.concrete} opacity={0.35} stroke={INK} strokeWidth={1.1} {...nss} />
        {/* styki pionowe płyt – zawsze na kolumnie łączników */}
        {joints.map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={Hc} stroke={INK} strokeWidth={0.9} strokeDasharray="10 5" {...nss} />
        ))}
        {/* osie kolumn i rzędów */}
        {g.xs.map((x) => (
          <line key={`x${x}`} x1={x * 100} y1={0} x2={x * 100} y2={Hc} stroke={DISC} strokeWidth={0.5} strokeDasharray="2 5" {...nss} />
        ))}
        {g.ys.map((y) => (
          <line key={`y${y}`} x1={0} y1={Hc - y * 100} x2={Lc} y2={Hc - y * 100} stroke={DISC} strokeWidth={0.5} strokeDasharray="2 5" {...nss} />
        ))}
        <Openings l={l} f={f} />
        {g.points.map((q, i) => (
          <g key={i}>
            <circle cx={q.x * 100} cy={Hc - q.y * 100} r={r} fill={DISC} fillOpacity={0.85} stroke={INK} strokeWidth={0.6} {...nss} />
            <circle cx={q.x * 100} cy={Hc - q.y * 100} r={1.2} fill={INK} />
          </g>
        ))}
        <ChainH xs={[0, ...g.xs.map((x) => x * 100), Lc]} y={Hc} off={f * 2} f={f * 0.85} />
        <Dim x1={0} y1={Hc} x2={Lc} y2={Hc} off={f * 4.2} f={f} label={`${cm(Lc)} cm`} />
        <ChainV ys={[0, ...rows, Hc]} x={Lc} off={f * 2} f={f * 0.85} />
        <Dim x1={0} y1={0} x2={0} y2={Hc} off={-f * 2.2} f={f} label={`${cm(Hc)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: DISC, label: `${fixerName} – talerzyk ø 12 cm (${g.points.length} szt. na rysunku)` },
          { color: DISC, dashed: true, label: `siatka łączników ${cm(g.sx * 100)} × ${cm(g.sy * 100)} cm (poziomo × pionowo)` },
          { color: INK, dashed: true, label: 'styk pionowy płyt – zawsze na kolumnie łączników' },
          ...(l.openings.length ? [{ dashed: true, label: 'otwór w świetle – łączniki w otworze pominięte' }] : []),
        ]}
      />
      <figcaption className="muted small">
        Wymiary w cm. Dolny łańcuch: osie kolumn łączników od lewej krawędzi okładziny, prawy: rzędy od posadzki. Skrajny
        rząd łączników {cm(FIXER_EDGE * 100)} cm od każdego brzegu ściany, kolumny pośrednie w osiach styków płyt (instrukcja
        ATLAS M-System 3G). Najpierw wytycz i osadź łączniki, ustaw talerzyki w płaszczyźnie płyt (łata, laser), potem
        przykręcaj płyty: 4 wkręty na talerzyk, ok. 10 mm odstępu od posadzki, docinek płyty nie węższy niż 20 cm.
      </figcaption>
    </figure>
  );
}
