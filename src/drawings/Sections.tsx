// Przekroje systemowe (schematy, wymiary w mm). Rozpiętości są skrócone (linie urwania),
// żeby profile i płyty były czytelne na telefonie – wymiary podane są rzeczywiste.

import type { Board, CeilingSystem, WallSystem } from '../catalog/rigips';
import { C, Callout, Dim, INK, Legend, Paper, cm, nss } from './svg';

const T_BOARD = 12.5;

/** Profil C w przekroju: środnik pionowy na x, półki w stronę dir */
export function cVert(x: number, y0: number, y1: number, dir: 1 | -1, flange = 50, lip = 7) {
  return `M${x + dir * flange} ${y0 + lip} L${x + dir * flange} ${y0} L${x} ${y0} L${x} ${y1} L${x + dir * flange} ${y1} L${x + dir * flange} ${y1 - lip}`;
}
/** Profil C w przekroju: środnik poziomy na y, półki w stronę dir */
export function cHorz(y: number, x0: number, x1: number, dir: 1 | -1, flange = 50, lip = 7) {
  return `M${x0 + lip} ${y + dir * flange} L${x0} ${y + dir * flange} L${x0} ${y} L${x1} ${y} L${x1} ${y + dir * flange} L${x1 - lip} ${y + dir * flange}`;
}

function BreakLine({ x, y0, y1 }: { x: number; y0: number; y1: number }) {
  const m = (y0 + y1) / 2;
  return (
    <path
      d={`M${x} ${y0} L${x} ${m - 12} L${x - 8} ${m - 4} L${x + 8} ${m + 4} L${x} ${m + 12} L${x} ${y1}`}
      fill="none"
      stroke={INK}
      strokeWidth={1}
      {...nss}
    />
  );
}

/** Przekrój poziomy ściany: płyty, profile CW, wełna */
export function WallSection({ sys, board, spacing, insulation }: { sys: WallSystem; board: Board; spacing: number; insulation: boolean }) {
  const P = sys.profile;
  const nt = sys.layers * T_BOARD;
  const T = P + nt * sys.sides;
  const s = 420; // rysunkowa odległość słupków (rzeczywista w opisie)
  const x0 = -40;
  const x1 = s * 2 + 40;
  const f = 22;
  const yCore0 = nt;
  const yCore1 = nt + P;
  const studs = [0, s, 2 * s];
  const layers = (side: 0 | 1) =>
    Array.from({ length: sys.layers }, (_, k) => {
      const y = side === 0 ? nt - (k + 1) * T_BOARD : yCore1 + k * T_BOARD;
      return { y, k };
    });
  return (
    <figure className="drawing">
      <Paper viewBox={[x0 - 140, -f * 4, x1 - x0 + 330, T + f * 9]} title={`Przekrój ściany ${sys.name}`} minWidth={560}>
        {insulation && <rect x={x0} y={yCore0} width={x1 - x0} height={P} fill="url(#wool)" opacity={0.85} />}
        {([0, 1] as const)
          .filter((side) => side < sys.sides)
          .flatMap((side) =>
            layers(side).map(({ y, k }) => {
              // styki płyt na słupkach, w kolejnych warstwach i po drugiej stronie przesunięte
              const joint = (side + k) % 2 === 0 ? s : 2 * s;
              return (
                <g key={`${side}-${k}`}>
                  <rect x={x0} y={y} width={joint - 1.5 - x0} height={T_BOARD} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
                  <rect x={joint + 1.5} y={y} width={x1 - joint - 1.5} height={T_BOARD} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
                </g>
              );
            }),
          )}
        {studs.map((x) => (
          <path key={x} d={cVert(x, yCore0, yCore1, 1)} fill="none" stroke={C.stud} strokeWidth={2.2} {...nss} />
        ))}
        <BreakLine x={x0} y0={-10} y1={T + 10} />
        <BreakLine x={x1} y0={-10} y1={T + 10} />
        {/* wymiary */}
        <Dim x1={0} y1={T} x2={s} y2={T} off={f * 2} f={f} label={`${cm(spacing * 10)} mm`} />
        <Dim x1={s} y1={T} x2={2 * s} y2={T} off={f * 2} f={f} label={`${cm(spacing * 10)} mm`} />
        <Dim x1={x1} y1={0} x2={x1} y2={T} off={f * 5.6} f={f} label={`${cm(T)}`} />
        <Dim x1={x1} y1={yCore0} x2={x1} y2={yCore1} off={f * 2.6} f={f * 0.85} label={`${P}`} />
        <Dim x1={x1} y1={0} x2={x1} y2={nt} off={f * 2.6} f={f * 0.7} label={cm(nt)} ext={false} />
        {/* odnośniki */}
        <Callout x={s * 0.5} y={nt / 2} tx={s * 0.5} ty={-f * 2.2} n={1} f={f} />
        <Callout x={2 * s + 30} y={yCore0 + 4} tx={2 * s + 120} ty={-f * 2.2} n={2} f={f} />
        {insulation && <Callout x={s * 1.5} y={yCore0 + P / 2} tx={s * 1.5} ty={-f * 2.2} n={3} f={f} />}
        <Callout x={s} y={nt / 2} tx={s - 110} ty={-f * 2.2} n={insulation ? 4 : 3} f={f} />
      </Paper>
      <Legend
        items={[
          { n: 1, label: `${board.name}, ${sys.layers}×${cm(T_BOARD)} mm${sys.sides > 1 ? ' z każdej strony' : ''}` },
          { n: 2, label: `profil CW ${P} co ${cm(spacing * 10)} mm, w UW ${P} przy posadzce i stropie` },
          ...(insulation ? [{ n: 3, label: `wełna mineralna ${P} mm` }] : []),
          {
            n: insulation ? 4 : 3,
            label: `styk płyt na słupku${sys.layers > 1 ? ', w 2. warstwie przesunięty o rozstaw słupków' : ''}${sys.sides > 1 ? ', po drugiej stronie przesunięty' : ''}`,
          },
        ]}
      />
      <figcaption className="muted small">
        Przekrój poziomy, wymiary w mm. Grubość ściany {cm(T)} mm. Wkręty TN {sys.layers > 1 ? '25 (1. warstwa, co 75 cm) i TN 35 (2. warstwa, co 25 cm)' : '25 co 25 cm'}.
      </figcaption>
    </figure>
  );
}

/** Przekrój pionowy sufitu poprzecznie do profili nośnych */
export function CeilingSection({ sys, board }: { sys: CeilingSystem; board: Board }) {
  const f = 22;
  const nt = sys.layers * T_BOARD;
  const direct = sys.kind === 'direct';
  const twoLevel = sys.kind === 'two-level';
  const D = direct ? 40 : 220; // zwis wieszaka (rysunkowy)
  const yMain = D;
  const yLow = twoLevel ? D + 27 : D; // poziom profilu montażowego
  const yBoard = yLow + 27;
  const bottom = yBoard + nt;
  const first = 220;
  const span = 520;
  const xs = [first, first + span];
  const x1 = first + span + 160;
  const firstOff = direct ? sys.secondarySpacing : Math.min(sys.mainSpacing / 2, 40);
  const spacing = direct ? sys.secondarySpacing : sys.mainSpacing;
  return (
    <figure className="drawing">
      <Paper viewBox={[-180, -210, x1 + 180 + 200, bottom + 210 + f * 6]} title={`Przekrój sufitu ${sys.name}`} minWidth={560}>
        {/* strop */}
        <rect x={-100} y={-80} width={x1 + 100} height={80} fill={C.concrete} />
        <rect x={-100} y={-80} width={x1 + 100} height={80} fill="url(#hatch)" />
        {/* ściana */}
        <rect x={-100} y={0} width={100} height={bottom + 60} fill={C.concrete} />
        <rect x={-100} y={0} width={100} height={bottom + 60} fill="url(#hatch)" />
        {/* UD przy ścianie na taśmie, na poziomie profilu, do którego mocuje się płyty */}
        <rect x={0} y={yLow - 2} width={4} height={31} fill={C.wool} />
        <path d={cVert(4, yLow, yLow + 27, 1, 27, 5)} fill="none" stroke={C.ud} strokeWidth={2.2} {...nss} />
        {/* profile */}
        {xs.map((x) => (
          <g key={x}>
            {direct ? (
              <path
                d={`M${x - 34} 0 L${x - 34} ${yMain + 20} M${x + 34} 0 L${x + 34} ${yMain + 20} M${x - 44} 0 L${x - 24} 0 M${x + 24} 0 L${x + 44} 0`}
                stroke={C.hanger}
                strokeWidth={2}
                fill="none"
                {...nss}
              />
            ) : (
              <g>
                <line x1={x} y1={0} x2={x} y2={yMain - 30} stroke={C.hanger} strokeWidth={1.6} {...nss} />
                <rect x={x - 14} y={yMain - 40} width={28} height={40} fill="none" stroke={C.hanger} strokeWidth={1.6} {...nss} />
                <rect x={x - 6} y={-6} width={12} height={6} fill={INK} />
              </g>
            )}
            {/* profil CD w przekroju (60×27), otwarty do góry */}
            <path d={cHorz(yMain + 27, x - 30, x + 30, -1, 27, 6)} fill="none" stroke={C.main} strokeWidth={2.4} {...nss} />
          </g>
        ))}
        {/* profil montażowy (w widoku) */}
        {!direct && (
          <g>
            <rect x={4} y={yLow} width={x1 - 4} height={27} fill="none" stroke={C.secondary} strokeWidth={1.6} {...nss} />
            <line x1={4} y1={yLow + 13.5} x2={x1} y2={yLow + 13.5} stroke={C.secondary} strokeWidth={0.6} strokeDasharray="6 6" {...nss} />
          </g>
        )}
        {/* płyty */}
        {Array.from({ length: sys.layers }, (_, k) => (
          <rect key={k} x={0} y={yBoard + k * T_BOARD} width={x1} height={T_BOARD} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
        ))}
        <BreakLine x={first + span / 2} y0={-90} y1={bottom + 10} />
        <BreakLine x={x1} y0={-90} y1={bottom + 10} />
        {/* wymiary */}
        <Dim x1={0} y1={0} x2={first} y2={0} off={-f * 5.4} f={f * 0.85} label={`${cm(firstOff * 10)}`} ext={false} />
        <Dim x1={first} y1={0} x2={first + span} y2={0} off={-f * 5.4} f={f * 0.85} label={`${cm(spacing * 10)} mm`} ext={false} />
        <Dim x1={x1} y1={0} x2={x1} y2={bottom} off={f * 3.4} f={f * 0.85} label={direct ? `≈ ${cm(bottom)}` : 'wg projektu'} />
        <Dim x1={x1} y1={yMain} x2={x1} y2={bottom} off={f * 1.3} f={f * 0.75} label={cm(bottom - yMain)} />
        {/* odnośniki */}
        <Callout x={xs[0] + 30} y={yMain + 10} tx={xs[0] + 140} ty={yMain - 60} n={1} f={f} />
        {!direct && <Callout x={xs[0] - 120} y={yLow + 20} tx={xs[0] - 120} ty={bottom + f * 3} n={2} f={f} />}
        <Callout x={xs[1]} y={yMain - 70} tx={xs[1] + 120} ty={yMain - 120} n={direct ? 2 : 3} f={f} />
        <Callout x={12} y={yLow + 10} tx={60} ty={bottom + f * 3} n={direct ? 3 : 4} f={f} />
        <Callout x={xs[1] + 80} y={yBoard + nt / 2} tx={xs[1] + 80} ty={bottom + f * 3} n={direct ? 4 : 5} f={f} />
      </Paper>
      <Legend
        items={[
          { n: 1, label: direct ? `profil CD 60 co ${sys.secondarySpacing} cm` : `profil nośny CD 60 co ${sys.mainSpacing} cm` },
          ...(!direct
            ? [
                {
                  n: 2,
                  label: `profil montażowy CD 60 co ${sys.secondarySpacing} cm, ${twoLevel ? 'pod nośnym, łącznik krzyżowy' : 'w jednym poziomie, łączniki jednopoziomowe'}`,
                },
              ]
            : []),
          {
            n: direct ? 2 : 3,
            label: direct
              ? `wieszak bezpośredni ES co ${sys.hangerSpacing} cm, kotwa w stropie`
              : `wieszak noniuszowy + kotwa stropowa, co ${sys.hangerSpacing} cm wzdłuż profilu nośnego`,
          },
          { n: direct ? 3 : 4, label: 'UD 27 na taśmie uszczelniającej, kołki co 60 cm' },
          { n: direct ? 4 : 5, label: `${board.name}, ${sys.layers}×12,5 mm` },
        ]}
      />
      <figcaption className="muted small">
        Przekrój poprzeczny do profili {direct ? 'CD' : 'nośnych'}, wymiary w mm. Rozpiętość skrócona. Pierwszy profil{' '}
        {cm(firstOff)} cm od ściany (tak jak na rzucie rusztu). Od wierzchu profilu {direct ? 'CD' : 'nośnego'} do spodu
        płyty: {cm(bottom - yMain)} mm.
      </figcaption>
    </figure>
  );
}
