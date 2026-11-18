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

/** Przekrój poziomy ściany: płyty, ruszt (CW / podwójny / instalacyjny / CD na uchwytach / klejenie), wełna */
export type Wool = { thickness: number; layers: number } | null;

export function WallSection({ sys, board, spacing, wool }: { sys: WallSystem; board: Board; spacing: number; wool: Wool }) {
  const P = sys.profile;
  const tb = board.thickness || T_BOARD;
  const nt = sys.layers * tb;
  const frame = sys.frame;
  const isCD = frame === 'cd-lining';
  const point = frame === 'point-fix';
  const glued = frame === 'glued' || point;
  const onWall = isCD || glued; // okładzina na istniejącej ścianie
  // głębokość rusztu i rzędy słupków (y względem lica rdzenia)
  const core = point ? 100 : glued ? 10 : isCD ? 40 : frame === 'double' ? 2 * P + 5 : frame === 'separate' ? 2 * P + (sys.gap ?? 10) * 10 : P;
  const rows: [number, number][] = glued || isCD ? [] : frame === 'single' ? [[0, P]] : [[0, P], [core - P, core]];
  const sides = onWall ? 1 : sys.sides;
  const T = core + nt * sides;
  const s = 420; // rysunkowa odległość słupków (rzeczywista w opisie)
  const x0 = -40;
  const x1 = s * 2 + 40;
  const f = 22;
  const yCore0 = nt;
  const yCore1 = nt + core;
  const studs = [0, s, 2 * s];
  const layers = (side: 0 | 1) =>
    Array.from({ length: sys.layers }, (_, k) => {
      const y = side === 0 ? nt - (k + 1) * tb : yCore1 + k * tb;
      return { y, k };
    });
  const legend: { n: number; label: string }[] = [
    { n: 1, label: `${board.name}, ${sys.layers}×${cm(tb)} mm${sides > 1 ? ' z każdej strony' : ''}` },
  ];
  if (point) legend.push({ n: 2, label: `łączniki ATLAS M-System 3G kotwione w ścianie, siatka ${cm(spacing)}×${sys.pointSpacing ?? 50} cm` });
  else if (glued) legend.push({ n: 2, label: 'placki kleju gipsowego, ok. 10 mm, na istniejącej ścianie' });
  else if (isCD) legend.push({ n: 2, label: `profil CD 60 co ${cm(spacing * 10)} mm na uchwytach ES${sys.bracketSpacing ? ` co ${sys.bracketSpacing} cm` : ''}, UD 30 przy posadzce i stropie` });
  else
    legend.push({
      n: 2,
      label: `profil CW ${P} co ${cm(spacing * 10)} mm, w UW ${P} przy posadzce i stropie${rows.length > 1 ? (frame === 'double' ? ' – dwa rzędy obok siebie' : ` – dwa rzędy rozsunięte (${sys.gap ?? 10} cm), łączone paskami płyty`) : ''}`,
    });
  const woolOn = !!wool && !glued;
  const woolH = wool ? Math.min(core, wool.thickness) : 0;
  if (wool && woolOn)
    legend.push({ n: 3, label: `wełna mineralna ${wool.thickness} mm${wool.layers > 1 ? ` – ${wool.layers} warstwy (w obu rzędach)` : ''}` });
  if (!glued)
    legend.push({
      n: woolOn ? 4 : 3,
      label: `styk płyt na ${isCD ? 'profilu' : 'słupku'}${sys.layers > 1 ? ', w kolejnej warstwie przesunięty o rozstaw' : ''}${sides > 1 ? ', po drugiej stronie przesunięty' : ''}`,
    });
  return (
    <figure className="drawing">
      <Paper viewBox={[x0 - 140, -f * 4, x1 - x0 + 330, T + (onWall ? 90 : 0) + f * 9]} title={`Przekrój ściany ${sys.name}`}>
        {onWall && (
          <>
            <rect x={x0} y={yCore1} width={x1 - x0} height={80} fill={C.concrete} />
            <rect x={x0} y={yCore1} width={x1 - x0} height={80} fill="url(#hatch)" />
          </>
        )}
        {woolOn &&
          (rows.length > 1 && wool && wool.layers > 1 ? rows : [[0, 0] as [number, number]]).map(([r0], i) => (
            <rect key={i} x={x0} y={yCore0 + r0} width={x1 - x0} height={Math.min(woolH, core - r0)} fill="url(#wool)" opacity={0.85} />
          ))}
        {([0, 1] as const)
          .filter((side) => side < sides)
          .flatMap((side) =>
            layers(side).map(({ y, k }) => {
              // styki płyt na słupkach, w kolejnych warstwach i po drugiej stronie przesunięte
              const joint = (side + k) % 2 === 0 ? s : 2 * s;
              return glued ? (
                <rect key={`${side}-${k}`} x={x0} y={y} width={x1 - x0} height={tb} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
              ) : (
                <g key={`${side}-${k}`}>
                  <rect x={x0} y={y} width={joint - 1.5 - x0} height={tb} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
                  <rect x={joint + 1.5} y={y} width={x1 - joint - 1.5} height={tb} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
                </g>
              );
            }),
          )}
        {glued && !point &&
          [s * 0.25, s * 0.75, s * 1.25, s * 1.75].map((x) => <ellipse key={x} cx={x} cy={yCore0 + 5} rx={45} ry={5} fill="#c9c2b0" />)}
        {point &&
          studs.map((x) => (
            <g key={x}>
              <rect x={x - 30} y={yCore0} width={60} height={4} fill={C.stud} />
              <rect x={x - 5} y={yCore0 + 4} width={10} height={core + 40} fill={C.stud} opacity={0.8} />
            </g>
          ))}
        {isCD &&
          studs.map((x) => (
            <g key={x}>
              <path d={cHorz(yCore0, x - 30, x + 30, 1, 27, 5)} fill="none" stroke={C.stud} strokeWidth={2.2} {...nss} />
              <path d={`M${x - 34} ${yCore0 + 20} L${x - 34} ${yCore1} M${x + 34} ${yCore0 + 20} L${x + 34} ${yCore1}`} stroke={C.hanger} strokeWidth={1.6} {...nss} />
            </g>
          ))}
        {rows.flatMap(([r0, r1], ri) =>
          studs.map((x) => <path key={`${ri}-${x}`} d={cVert(x, yCore0 + r0, yCore0 + r1, 1)} fill="none" stroke={C.stud} strokeWidth={2.2} {...nss} />),
        )}
        <BreakLine x={x0} y0={-10} y1={T + 10} />
        <BreakLine x={x1} y0={-10} y1={T + 10} />
        {/* wymiary */}
        {(!glued || point) && (
          <>
            <Dim x1={0} y1={T} x2={s} y2={T} off={f * 2 + (onWall ? 80 : 0)} f={f} label={`${cm(spacing * 10)} mm`} />
            <Dim x1={s} y1={T} x2={2 * s} y2={T} off={f * 2 + (onWall ? 80 : 0)} f={f} label={`${cm(spacing * 10)} mm`} />
          </>
        )}
        <Dim x1={x1} y1={0} x2={x1} y2={T} off={f * 5.6} f={f} label={`${cm(T)}`} />
        <Dim x1={x1} y1={yCore0} x2={x1} y2={yCore1} off={f * 2.6} f={f * 0.85} label={cm(core)} />
        <Dim x1={x1} y1={0} x2={x1} y2={nt} off={f * 2.6} f={f * 0.7} label={cm(nt)} ext={false} />
        {/* odnośniki */}
        <Callout x={s * 0.5} y={nt / 2} tx={s * 0.5} ty={-f * 2.2} n={1} f={f} />
        <Callout x={point ? 2 * s : glued ? s * 1.75 : 2 * s + 30} y={yCore0 + 4} tx={2 * s + 120} ty={-f * 2.2} n={2} f={f} />
        {woolOn && <Callout x={s * 1.5} y={yCore0 + woolH / 2} tx={s * 1.5} ty={-f * 2.2} n={3} f={f} />}
        {!glued && <Callout x={s} y={nt / 2} tx={s - 110} ty={-f * 2.2} n={woolOn ? 4 : 3} f={f} />}
      </Paper>
      <Legend items={legend} />
      <figcaption className="muted small">
        Przekrój poziomy, wymiary w mm. {onWall ? `Grubość okładziny ${cm(T)} mm (bez istniejącej ściany).` : `Grubość ściany ${cm(T)} mm.`}
        {glued ? '' : ` Wkręty TN ${sys.layers > 1 ? 'krótsze w 1. warstwie (co 75 cm), dłuższe w ostatniej (co 25 cm)' : 'co 25 cm'}.`}
      </figcaption>
    </figure>
  );
}

/** Przekrój pionowy sufitu poprzecznie do profili nośnych */
export function CeilingSection({ sys, board, wool }: { sys: CeilingSystem; board: Board; wool: Wool }) {
  const f = 22;
  const tb = board.thickness || T_BOARD;
  const nt = sys.layers * tb;
  const kind = sys.kind;
  const direct = kind === 'direct';
  const cw = kind === 'cw-span';
  const ua = kind === 'ua-span';
  const hung = kind === 'two-level' || kind === 'one-level';
  const point = kind === 'point-fix';
  const P = sys.profile ?? 50;
  const mainDepth = cw ? P : ua ? 40 : point ? 4 : 27;
  const D = direct ? 40 : hung ? 220 : 90; // odległość od stropu (rysunkowa)
  const yMain = D;
  const hasSecondary = !direct && !cw && !point;
  const yLow = kind === 'one-level' ? D : D + mainDepth; // poziom profilu montażowego
  const yBoard = hasSecondary ? yLow + 27 : yMain + mainDepth;
  const bottom = yBoard + nt;
  const first = 220;
  const span = 520;
  const xs = [first, first + span];
  const x1 = first + span + 160;
  const singleGrid = direct || cw || point;
  const firstOff = singleGrid ? sys.secondarySpacing : Math.min(sys.mainSpacing / 2, 40);
  const spacing = singleGrid ? sys.secondarySpacing : sys.mainSpacing;
  const mainName = cw ? `CW ${P}` : ua ? 'UA 50' : point ? 'łącznika' : 'CD 60';
  const perimeter = cw ? `UW ${P}` : 'UD 30';
  const yPerim = hasSecondary ? yLow : yMain;
  const hPerim = hasSecondary ? 27 : mainDepth;

  const legend: { n: number; label: string }[] = [];
  const n = () => legend.length + 1;
  const nMain = n();
  legend.push({
    n: nMain,
    label: point
      ? `łącznik ATLAS M-System 3G kotwiony w stropie, siatka ${sys.mainSpacing}×${sys.secondarySpacing} cm (bez profili)`
      : direct
      ? `profil CD 60 co ${sys.secondarySpacing} cm`
      : cw
        ? `profil CW ${P} co ${sys.secondarySpacing} cm, oparty na UW przy ścianach (bez wieszaków)`
        : ua
          ? `profil UA 50 co ${sys.mainSpacing} cm, oparty na ścianach na kątownikach (bez wieszaków)`
          : `profil nośny CD 60 co ${sys.mainSpacing} cm`,
  });
  const nSec = hasSecondary ? n() : 0;
  if (hasSecondary)
    legend.push({
      n: nSec,
      label: `profil montażowy CD 60 co ${sys.secondarySpacing} cm, ${
        kind === 'one-level' ? 'w jednym poziomie, łączniki jednopoziomowe' : ua ? 'pod UA, łączniki UA–CD' : 'pod nośnym, łącznik krzyżowy'
      }`,
    });
  const nHang = direct || hung ? n() : 0;
  if (nHang)
    legend.push({
      n: nHang,
      label: direct
        ? `uchwyt bezpośredni ${sys.hangerType === 'elastic' ? 'elastyczny' : 'ES'} co ${sys.hangerSpacing} cm, kotwa w stropie`
        : `wieszak noniuszowy + kotwa stropowa, co ${sys.hangerSpacing} cm wzdłuż profilu nośnego`,
    });
  const nPer = point ? 0 : n();
  if (nPer) legend.push({ n: nPer, label: `${perimeter} na taśmie uszczelniającej, kołki przy ścianie` });
  const nBoard = n();
  legend.push({ n: nBoard, label: `${board.name}, ${sys.layers}×${cm(tb)} mm` });
  const nWool = wool && !point ? n() : 0;
  if (wool && nWool) legend.push({ n: nWool, label: `wełna mineralna ${wool.thickness} mm, układana na płytach między profilami` });
  const woolY = yBoard - Math.min(wool?.thickness ?? 0, yBoard - 10);

  return (
    <figure className="drawing">
      <Paper viewBox={[-180, -210, x1 + 180 + 200, bottom + 210 + f * 6]} title={`Przekrój sufitu ${sys.name}`}>
        {/* strop */}
        <rect x={-100} y={-80} width={x1 + 100} height={80} fill={C.concrete} />
        <rect x={-100} y={-80} width={x1 + 100} height={80} fill="url(#hatch)" />
        {/* ściana */}
        <rect x={-100} y={0} width={100} height={bottom + 60} fill={C.concrete} />
        <rect x={-100} y={0} width={100} height={bottom + 60} fill="url(#hatch)" />
        {/* wełna na płytach */}
        {nWool > 0 && <rect x={4} y={woolY} width={x1 - 4} height={yBoard - woolY} fill="url(#wool)" opacity={0.7} />}
        {/* profil obwodowy na taśmie */}
        {!point && <rect x={0} y={yPerim - 2} width={4} height={hPerim + 4} fill={C.wool} />}
        {!point && <path d={cVert(4, yPerim, yPerim + hPerim, 1, cw ? 40 : 27, 5)} fill="none" stroke={C.ud} strokeWidth={2.2} {...nss} />}
        {/* profile */}
        {xs.map((x) => (
          <g key={x}>
            {direct && (
              <path
                d={`M${x - 34} 0 L${x - 34} ${yMain + 20} M${x + 34} 0 L${x + 34} ${yMain + 20} M${x - 44} 0 L${x - 24} 0 M${x + 24} 0 L${x + 44} 0`}
                stroke={C.hanger}
                strokeWidth={2}
                fill="none"
                {...nss}
              />
            )}
            {hung && (
              <g>
                <line x1={x} y1={0} x2={x} y2={yMain - 30} stroke={C.hanger} strokeWidth={1.6} {...nss} />
                <rect x={x - 14} y={yMain - 40} width={28} height={40} fill="none" stroke={C.hanger} strokeWidth={1.6} {...nss} />
                <rect x={x - 6} y={-6} width={12} height={6} fill={INK} />
              </g>
            )}
            {point ? (
              <g>
                <rect x={x - 5} y={-40} width={10} height={yMain + 40} fill={C.main} opacity={0.8} />
                <rect x={x - 30} y={yMain} width={60} height={4} fill={C.main} />
              </g>
            ) : cw ? (
              <path d={cVert(x - 25, yMain, yMain + P, 1, 50, 7)} fill="none" stroke={C.main} strokeWidth={2.4} {...nss} />
            ) : (
              // profil CD / UA w przekroju, otwarty do góry
              <path d={cHorz(yMain + mainDepth, x - (ua ? 25 : 30), x + (ua ? 25 : 30), -1, mainDepth, 6)} fill="none" stroke={C.main} strokeWidth={ua ? 3.2 : 2.4} {...nss} />
            )}
          </g>
        ))}
        {/* profil montażowy (w widoku) */}
        {hasSecondary && (
          <g>
            <rect x={4} y={yLow} width={x1 - 4} height={27} fill="none" stroke={C.secondary} strokeWidth={1.6} {...nss} />
            <line x1={4} y1={yLow + 13.5} x2={x1} y2={yLow + 13.5} stroke={C.secondary} strokeWidth={0.6} strokeDasharray="6 6" {...nss} />
          </g>
        )}
        {/* płyty */}
        {Array.from({ length: sys.layers }, (_, k) => (
          <rect key={k} x={0} y={yBoard + k * tb} width={x1} height={tb} fill={board.color} stroke={INK} strokeWidth={0.9} {...nss} />
        ))}
        <BreakLine x={first + span / 2} y0={-90} y1={bottom + 10} />
        <BreakLine x={x1} y0={-90} y1={bottom + 10} />
        {/* wymiary */}
        <Dim x1={0} y1={0} x2={first} y2={0} off={-f * 5.4} f={f * 0.85} label={`${cm(firstOff * 10)}`} ext={false} />
        <Dim x1={first} y1={0} x2={first + span} y2={0} off={-f * 5.4} f={f * 0.85} label={`${cm(spacing * 10)} mm`} ext={false} />
        <Dim x1={x1} y1={0} x2={x1} y2={bottom} off={f * 3.4} f={f * 0.85} label={direct ? `≈ ${cm(bottom)}` : 'wg projektu'} />
        <Dim x1={x1} y1={yMain} x2={x1} y2={bottom} off={f * 1.3} f={f * 0.75} label={cm(bottom - yMain)} />
        {/* odnośniki */}
        <Callout x={xs[0] + 20} y={yMain + 10} tx={xs[0] + 140} ty={yMain - 60} n={nMain} f={f} />
        {nSec > 0 && <Callout x={xs[0] - 120} y={yLow + 20} tx={xs[0] - 120} ty={bottom + f * 3} n={nSec} f={f} />}
        {nHang > 0 && <Callout x={xs[1]} y={Math.max(10, yMain - 70)} tx={xs[1] + 120} ty={-120} n={nHang} f={f} />}
        {nPer > 0 && <Callout x={12} y={yPerim + 10} tx={60} ty={bottom + f * 3} n={nPer} f={f} />}
        {nWool > 0 && <Callout x={first + span * 0.75} y={(woolY + yBoard) / 2} tx={first + span * 0.75} ty={-120} n={nWool} f={f} />}
        <Callout x={xs[1] + 80} y={yBoard + nt / 2} tx={xs[1] + 80} ty={bottom + f * 3} n={nBoard} f={f} />
      </Paper>
      <Legend items={legend} />
      <figcaption className="muted small">
        Przekrój poprzeczny do profili {singleGrid ? mainName : 'nośnych'}, wymiary w mm. Rozpiętość skrócona. Pierwszy profil{' '}
        {cm(firstOff)} cm od ściany (tak jak na rzucie rusztu). Od wierzchu profilu {mainName} do spodu płyty: {cm(bottom - yMain)} mm.
      </figcaption>
    </figure>
  );
}
