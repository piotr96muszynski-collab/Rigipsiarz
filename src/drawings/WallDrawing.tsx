import type { BoardFace, StudKind, WallLayout } from '../calc/layout';
import { C, ChainH, Dim, INK, Legend, Paper, clamp, cm, dedupe, nss } from './svg';

const STUD_COLOR: Record<StudKind, string> = {
  stud: C.stud,
  short: C.short,
  jamb: C.jamb,
  'jamb-ua': C.ua,
  extra: C.extra,
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

const minW = (Lc: number) => clamp(Lc * 1.4, 480, 1100);

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
      <Paper viewBox={vb} title={title} minWidth={minW(Lc)}>
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

const faceName = (face: BoardFace, sides: number, layers: number) =>
  `${sides > 1 ? `Strona ${face.side === 0 ? 'A' : 'B'}` : 'Okładzina'}${layers > 1 ? `, warstwa ${face.layer + 1}` : ''}`;

export { faceName };

/** Widok ściany: rozkład płyt na jednej okładzinie */
export function WallBoardsDrawing({ l, face, title }: { l: WallLayout; face: BoardFace; title: string }) {
  const { Lc, Hc, f, vb } = frame(l);
  const full = face.pieces.filter((p) => !p.cut).length;
  return (
    <figure className="drawing">
      <Paper viewBox={vb} title={title} minWidth={minW(Lc)}>
        <rect x={-f} y={-f * 0.8} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        <rect x={-f} y={Hc} width={Lc + 2 * f} height={f * 0.8} fill="url(#hatch)" />
        {face.pieces.map((p, i) => {
          const x = p.x0 * 100;
          const y = Hc - p.y1 * 100;
          const w = (p.x1 - p.x0) * 100;
          const h = (p.y1 - p.y0) * 100;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={p.cut ? 'url(#hatch-cut)' : C.board} stroke={INK} strokeWidth={1.1} {...nss} />
            </g>
          );
        })}
        {/* linie wkrętów na słupkach */}
        {dedupe(l.studs.map((s) => s.x * 100), 0.5).map((x) => (
          <line key={x} x1={clamp(x, 1, Lc - 1)} y1={0} x2={clamp(x, 1, Lc - 1)} y2={Hc} stroke={C.stud} strokeWidth={0.6} strokeDasharray="2 6" {...nss} />
        ))}
        <Openings l={l} f={f} />
        {face.pieces.map((p, i) => {
          const w = (p.x1 - p.x0) * 100;
          const h = (p.y1 - p.y0) * 100;
          if (w < f * 3 || h < f * 3) return null;
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
        {face.jambJoints.map((x) => (
          <line key={x} x1={x * 100} y1={0} x2={x * 100} y2={Hc} stroke={C.warn} strokeWidth={2.4} {...nss} />
        ))}
        <ChainH xs={[0, ...face.pieces.map((p) => p.x1 * 100)]} y={Hc} off={f * 2} f={f * 0.85} />
        <Dim x1={0} y1={Hc} x2={Lc} y2={Hc} off={f * 4.2} f={f} label={`${cm(Lc)} cm`} />
        <Dim x1={0} y1={0} x2={0} y2={Hc} off={-f * 2.2} f={f} label={`${cm(Hc)} cm`} />
      </Paper>
      <Legend
        items={[
          { color: C.board, label: `arkusz pełny ${cm(l.sheet.width * 100)}×${cm(l.sheet.length * 100)} cm (${full} szt.)` },
          { pattern: 'cut', label: `element docinany (${face.pieces.length - full} szt.)` },
          { color: C.stud, dashed: true, label: 'oś słupka – linia wkręcania' },
          ...(face.jambJoints.length ? [{ color: C.warn, label: 'styk w linii ościeża – przesuń płytę lub wytnij ją w kształt litery L' }] : []),
        ]}
      />
      <figcaption className="muted small">
        Styki pionowe zawsze na słupku. {face.offset > 0 ? `Pierwszy pas docięty na ${cm(face.offset * 100)} cm, żeby styki mijały się z sąsiednią okładziną.` : 'Zaczynasz od pełnego arkusza przy lewej krawędzi.'}{' '}
        Wymiary elementów w cm, przed wycięciem otworów.
      </figcaption>
    </figure>
  );
}
