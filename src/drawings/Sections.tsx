// Przekroje systemowe (schematy, wymiary w mm). Rozpiętości są skrócone (linie urwania),
// żeby profile i płyty były czytelne na telefonie – wymiary podane są rzeczywiste.

import { HAT_MM, PRODUCTS, boardById, midBoardMm, panelEdgeLabel, sideBoards, type Board, type CeilingSystem, type WallBoarding, type WallSystem } from '../catalog/rigips';
import { C, Callout, Dim, INK, Legend, Paper, cm, nss } from './svg';
import type { CeilingLevels } from '../calc/ceilingLevels';

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

export function WallSection({
  sys,
  board,
  spacing,
  wool,
  vapor = false,
  boarding,
}: {
  sys: WallSystem;
  board: Board;
  spacing: number;
  wool: Wool;
  vapor?: boolean;
  /** płyty ściany (różna grubość warstw, inne poszycie strony 2); brak = `board` na każdej warstwie */
  boarding?: WallBoarding;
}) {
  const P = sys.profile;
  // płyty kolejnych warstw każdej strony, od rusztu
  const sideB: [Board[], Board[]] = [0, 1].map((side) =>
    boarding ? sideBoards(sys, boarding, side as 0 | 1).map(boardById) : side < sys.sides ? Array.from({ length: sys.layers }, () => board) : [],
  ) as [Board[], Board[]];
  const tbOf = (b: Board) => b.thickness || T_BOARD;
  const stack = (side: 0 | 1) => sideB[side].reduce((a, b) => a + tbOf(b), 0);
  const nt = stack(0);
  const frame = sys.frame;
  const isCD = frame === 'cd-lining';
  const hat = frame === 'hat-lining';
  const point = frame === 'point-fix';
  const panel = frame === 'panel';
  // obudowa z samych płyt: przekrój jak płyty bez rusztu (styki są poziome – w przekroju poziomym ich nie widać)
  const glued = frame === 'glued' || point || panel;
  const onWall = isCD || (glued && !panel) || hat; // okładzina na istniejącej ścianie
  // głębokość rusztu i rzędy słupków (y względem lica rdzenia)
  const core = point ? 100 : panel ? 0 : glued ? 10 : isCD ? 40 : hat ? HAT_MM : frame === 'double' ? 2 * P + 5 + midBoardMm(sys) : frame === 'separate' ? 2 * P + (sys.gap ?? 10) * 10 : P;
  const rows: [number, number][] = glued || isCD || hat ? [] : frame === 'single' ? [[0, P]] : [[0, P], [core - P, core]];
  const sides = onWall ? 1 : sys.sides;
  const T = core + nt + (sides > 1 ? stack(1) : 0);
  const s = 420; // rysunkowa odległość słupków (rzeczywista w opisie)
  const x0 = -40;
  const x1 = s * 2 + 40;
  const f = 22;
  const yCore0 = nt;
  const yCore1 = nt + core;
  const studs = [0, s, 2 * s];
  const layers = (side: 0 | 1) => {
    let acc = 0;
    return sideB[side].map((b, k) => {
      const tb = tbOf(b);
      const y = side === 0 ? nt - acc - tb : yCore1 + acc;
      acc += tb;
      return { y, k, tb, b };
    });
  };
  /** Opis poszycia jednej strony od rusztu: „2×Ogień Plus 12,5 + 1×RTG 12,5+1,0” */
  const describe = (list: Board[]) => {
    const groups: { b: Board; n: number }[] = [];
    for (const b of list) {
      const last = groups[groups.length - 1];
      if (last && last.b.id === b.id) last.n++;
      else groups.push({ b, n: 1 });
    }
    return groups.map((g) => `${g.n}×${g.b.name}`).join(' + ');
  };
  const sameSides = sides < 2 || sideB[0].map((b) => b.id).join() === sideB[1].map((b) => b.id).join();
  const uniform = sideB[0].every((b) => b.id === sideB[0][0]?.id);
  const legend: { n: number; label: string }[] = [
    {
      n: 1,
      label: sameSides
        ? uniform
          ? `${sideB[0][0]?.name ?? board.name}, ${sideB[0].length}×${cm(tbOf(sideB[0][0] ?? board))} mm${sides > 1 ? ' z każdej strony' : ''}`
          : `${describe(sideB[0])} (od rusztu)${sides > 1 ? ' z każdej strony' : ''}`
        : `strona A (u góry): ${describe(sideB[0])}; strona B (u dołu): ${describe(sideB[1])} – warstwy od rusztu`,
    },
  ];
  if (point) legend.push({ n: 2, label: `łączniki ATLAS M-System 3G kotwione w ścianie, siatka ${cm(spacing)}×${sys.pointSpacing ?? 50} cm` });
  else if (panel)
    legend.push({
      n: 2,
      label: `bez słupków: płyty poziomo, każda w jednym kawałku od ściany do ściany (do ${String((sys.panel?.maxWidth ?? 0) / 100).replace('.', ',')} m), warstwy skręcone ze sobą, przykręcone do profilu obwodowego (${panelEdgeLabel(sys)}) ${sys.panel?.edgeSides === 'all' ? 'po obwodzie' : 'przy ścianach'} (kołki co ${sys.panel?.anchorSpacing} cm)`,
    });
  else if (glued) legend.push({ n: 2, label: 'placki kleju gipsowego, ok. 10 mm, na istniejącej ścianie' });
  else if (hat)
    legend.push({
      n: 2,
      label: `profil kapeluszowy 15/48 co ${cm(spacing * 10)} mm, ${PRODUCTS[sys.anchor ?? 'KOLEK']?.name.toLowerCase() ?? 'kołki'} przez obie półki${sys.bracketSpacing ? `, w każdym rzędzie co ${sys.bracketSpacing} cm (na przemian)` : ''} · bez UD, płyta 15 mm od ściany`,
    });
  else if (isCD) legend.push({ n: 2, label: `profil CD 60 co ${cm(spacing * 10)} mm na uchwytach ES${sys.bracketSpacing ? ` co ${sys.bracketSpacing} cm` : ''}, UD 30 przy posadzce i stropie` });
  else
    legend.push({
      n: 2,
      label: `${sys.studKind === 'UA' ? 'profil UA' : sys.studKind === 'UU' ? 'słupek z dwóch profili U' : sys.studKind === 'UW2' ? 'słupek z dwóch profili UW (płyta pośrednia między nimi)' : 'profil CW'} ${P} co ${cm(spacing * 10)} mm, w UW ${P} przy posadzce i stropie${sys.studKind === 'UA' ? ', kątowniki UA na końcach' : ''}${sys.wallTie ? `, ${sys.wallTie.kind === 'angle' ? 'kątowniki' : 'przewiązki PWA'} do ściany co ${sys.wallTie.spacing} cm` : ''}${rows.length > 1 ? (frame === 'double' ? ' – dwa rzędy obok siebie' : ` – dwa rzędy rozsunięte (${sys.gap ?? 10} cm), łączone ${sys.rowTie ? (PRODUCTS[sys.rowTie.product]?.name.toLowerCase() ?? 'łącznikami') : 'paskami płyty'}`) : ''}`,
    });
  const woolOn = !!wool && !glued;
  const woolH = wool ? Math.min(core, wool.thickness) : 0;
  if (wool && woolOn)
    legend.push({ n: 3, label: `wełna mineralna ${wool.thickness} mm${wool.layers > 1 ? ` – ${wool.layers} warstwy (w obu rzędach)` : ''}` });
  if (!glued)
    legend.push({
      n: woolOn ? 4 : 3,
      label: `styk płyt na ${isCD || hat ? 'profilu' : 'słupku'}${sys.layers > 1 ? ', w kolejnej warstwie przesunięty o rozstaw' : ''}${sides > 1 ? ', po drugiej stronie przesunięty' : ''}`,
    });
  // paroizolacja od strony pomieszczenia: między rusztem a płytami strony 1
  const nVapor = vapor && !glued ? legend.length + 1 : 0;
  if (nVapor)
    legend.push({ n: nVapor, label: `folia paroizolacyjna (np. Isover Stopair 1104 / Vario KM Duplex UV), przyklejona taśmą dwustronną do profili pod płytami, zakłady ok. 10 cm sklejone taśmą (np. Vario KB1), szczelnie doprowadzona do sąsiednich przegród` });
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
            layers(side).map(({ y, k, tb, b }) => {
              // styki płyt na słupkach, w kolejnych warstwach i po drugiej stronie przesunięte
              const joint = (side + k) % 2 === 0 ? s : 2 * s;
              return glued ? (
                <rect key={`${side}-${k}`} x={x0} y={y} width={x1 - x0} height={tb} fill={b.color} stroke={INK} strokeWidth={0.9} {...nss} />
              ) : (
                <g key={`${side}-${k}`}>
                  <rect x={x0} y={y} width={joint - 1.5 - x0} height={tb} fill={b.color} stroke={INK} strokeWidth={0.9} {...nss} />
                  <rect x={joint + 1.5} y={y} width={x1 - joint - 1.5} height={tb} fill={b.color} stroke={INK} strokeWidth={0.9} {...nss} />
                </g>
              );
            }),
          )}
        {nVapor > 0 && <line x1={x0} y1={yCore0 + 1.2} x2={x1} y2={yCore0 + 1.2} stroke={C.vapor} strokeWidth={2.4} strokeDasharray="14 5" {...nss} />}
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
        {hat &&
          studs.map((x) => (
            <g key={x}>
              <path
                d={`M${x - 49} ${yCore1} L${x - 24} ${yCore1} L${x - 24} ${yCore0} L${x + 24} ${yCore0} L${x + 24} ${yCore1} L${x + 49} ${yCore1}`}
                fill="none"
                stroke={C.stud}
                strokeWidth={2.2}
                {...nss}
              />
              {[-36, 36].map((d) => (
                <rect key={d} x={x + d - 3} y={yCore1 - 2} width={6} height={45} fill={C.hanger} opacity={0.85} />
              ))}
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
        {nVapor > 0 && <Callout x={s * 1.25} y={yCore0 + 1.2} tx={s * 1.25 + 60} ty={-f * 2.2} n={nVapor} f={f} />}
      </Paper>
      <Legend items={legend} />
      <figcaption className="muted small">
        Przekrój poziomy, wymiary w mm. {onWall ? `Grubość okładziny ${cm(T)} mm (bez istniejącej ściany).` : `Grubość ściany ${cm(T)} mm.`}
        {glued ? '' : ` Wkręty TN ${sys.layers > 1 ? 'krótsze w 1. warstwie (co 75 cm), dłuższe w ostatniej (co 25 cm)' : 'co 25 cm'}.`}
      </figcaption>
    </figure>
  );
}

const m2 = (cmv: number) => (cmv / 100).toFixed(2).replace('.', ',');

/** Przekrój pionowy sufitu poprzecznie do profili nośnych */
export function CeilingSection({ sys, board, wool, levels, vapor = false }: { sys: CeilingSystem; board: Board; wool: Wool; levels?: CeilingLevels; vapor?: boolean }) {
  const f = 22;
  const tb = board.thickness || T_BOARD;
  const nt = sys.layers * tb;
  const kind = sys.kind;
  // profile kapeluszowe przykręcone wprost do stropu – bez uchwytów i bez UD
  const hat = kind === 'direct' && sys.hangerType === 'hat';
  const direct = kind === 'direct' && !hat;
  const cw = kind === 'cw-span';
  const ua = kind === 'ua-span';
  const parallel = kind === 'parallel';
  const hung = kind === 'two-level' || kind === 'one-level' || parallel;
  const point = kind === 'point-fix';
  const mf = sys.profiles;
  const P = sys.profile ?? 50;
  const mainDepth = cw ? P : ua ? 40 : point ? 4 : hat ? HAT_MM : 27;
  const D = hat ? 0 : direct ? 40 : hung ? 220 : 90; // odległość od stropu (rysunkowa)
  const yMain = D;
  const hasSecondary = !direct && !cw && !point && !parallel && !hat;
  const yLow = kind === 'one-level' ? D : D + mainDepth; // poziom profilu montażowego
  const yBoard = hasSecondary ? yLow + 27 : yMain + mainDepth;
  const bottom = yBoard + nt;
  const first = 220;
  const span = 520;
  const xs = [first, first + span];
  const x1 = first + span + 160;
  const singleGrid = direct || cw || point || parallel || hat;
  const firstOff = singleGrid ? sys.secondarySpacing : Math.min(sys.mainSpacing / 2, 40);
  const spacing = singleGrid ? sys.secondarySpacing : sys.mainSpacing;
  const mainName = cw ? `CW ${P}` : ua ? 'UA 50' : point ? 'łącznika' : 'CD 60';
  const perimeter = cw ? `UW ${P}` : mf ? `profil przyścienny ${mf.edge}` : 'UD 30';
  const yPerim = hasSecondary ? yLow : yMain;
  const hPerim = hasSecondary ? 27 : mainDepth;

  const legend: { n: number; label: string }[] = [];
  const n = () => legend.length + 1;
  const nMain = n();
  legend.push({
    n: nMain,
    label: point
      ? `łącznik ATLAS M-System 3G kotwiony w stropie, siatka ${sys.mainSpacing}×${sys.secondarySpacing} cm (bez profili)`
      : hat
      ? `profil kapeluszowy 15/48 co ${sys.secondarySpacing} cm, półkami na stropie`
      : direct
      ? `profil CD 60 co ${sys.secondarySpacing} cm`
      : cw
        ? `profil CW ${P} co ${sys.secondarySpacing} cm, oparty na UW przy ścianach (bez wieszaków)`
        : ua
          ? `profil UA 50 co ${sys.mainSpacing} cm, oparty na ścianach na kątownikach (bez wieszaków)`
          : parallel
            ? `profil CD 60 co ${sys.secondarySpacing} cm, równolegle (bez profili głównych)`
            : mf
              ? `profil główny ${mf.main} co ${sys.mainSpacing} cm`
              : `profil nośny CD 60 co ${sys.mainSpacing} cm`,
  });
  const nSec = hasSecondary ? n() : 0;
  if (hasSecondary)
    legend.push({
      n: nSec,
      label: mf
        ? `profil nośny ${mf.secondary} co ${sys.secondarySpacing} cm, wpięty w profil główny i skręcony`
        : `profil montażowy CD 60 co ${sys.secondarySpacing} cm, ${
            kind === 'one-level' ? 'w jednym poziomie, łączniki jednopoziomowe' : ua ? 'pod UA, łączniki UA–CD' : 'pod nośnym, łącznik krzyżowy'
          }`,
    });
  const nHang = direct || hung || hat ? n() : 0;
  if (nHang)
    legend.push({
      n: nHang,
      label: hat
        ? `dybel stalowy 6×40 przez półkę profilu, w dwóch rzędach (na obu półkach na przemian), w rzędzie co ${sys.hangerSpacing} cm`
        : direct
        ? `uchwyt bezpośredni ${sys.hangerType === 'elastic' ? 'elastyczny' : sys.hangerType === 'attic' ? 'do poddaszy' : 'ES'} co ${sys.hangerSpacing} cm, kotwa w stropie`
        : mf
          ? `zawiesie z kątownika ${mf.hangerAngle} + kotwa stropowa, co ${sys.hangerSpacing} cm wzdłuż profilu głównego`
          : `wieszak noniuszowy + kotwa stropowa, co ${sys.hangerSpacing} cm wzdłuż profilu nośnego`,
    });
  const nPer = point || hat ? 0 : n();
  if (nPer) legend.push({ n: nPer, label: `${perimeter} na taśmie uszczelniającej, kołki przy ścianie` });
  const nBoard = n();
  legend.push({ n: nBoard, label: `${board.name}, ${sys.layers}×${cm(tb)} mm` });
  const nWool = wool && !point ? n() : 0;
  if (wool && nWool) legend.push({ n: nWool, label: `wełna mineralna ${wool.thickness} mm, układana na płytach między profilami` });
  // paroizolacja: pod rusztem, nad płytami (mocowana taśmą dwustronną do spodu profili), wełna nad nią
  const nVapor = vapor && !point ? n() : 0;
  if (nVapor)
    legend.push({
      n: nVapor,
      label: `folia paroizolacyjna (np. Isover Stopair 1104 / Vario KM Duplex UV), przyklejona taśmą dwustronną do spodu profili CD przed płytami, zakłady ok. 10 cm sklejone taśmą (np. Vario KB1), wywinięta na ściany i doszczelniona`,
    });
  const yVapor = yBoard - 1.5;
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
        {!point && !hat && <rect x={0} y={yPerim - 2} width={4} height={hPerim + 4} fill={C.wool} />}
        {!point && !hat && <path d={cVert(4, yPerim, yPerim + hPerim, 1, cw ? 40 : 27, 5)} fill="none" stroke={C.ud} strokeWidth={2.2} {...nss} />}
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
            {hat ? (
              <g>
                <path
                  d={`M${x - 49} 0 L${x - 24} 0 L${x - 24} ${HAT_MM} L${x + 24} ${HAT_MM} L${x + 24} 0 L${x + 49} 0`}
                  fill="none"
                  stroke={C.main}
                  strokeWidth={2.4}
                  {...nss}
                />
                {[-36, 36].map((d) => (
                  <rect key={d} x={x + d - 3} y={-45} width={6} height={47} fill={C.hanger} opacity={0.85} />
                ))}
              </g>
            ) : point ? (
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
        {/* paroizolacja nad płytami, wywinięta na ścianę */}
        {nVapor > 0 && (
          <path d={`M${x1} ${yVapor} L${2} ${yVapor} L${2} ${yVapor - 60}`} fill="none" stroke={C.vapor} strokeWidth={2.4} strokeDasharray="14 5" {...nss} />
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
        <Dim
          x1={x1}
          y1={0}
          x2={x1}
          y2={bottom}
          off={f * 3.4}
          f={f * 0.85}
          label={levels ? cm(Math.round((levels.slab - levels.ceiling) * 10)) : direct || hat ? `≈ ${cm(bottom)}` : 'wg projektu'}
        />
        {levels && (hung || direct) && yMain > 30 && (
          <Dim x1={x1} y1={0} x2={x1} y2={yMain} off={f * 1.3} f={f * 0.75} label={cm(Math.round(levels.hangerGap * 10))} />
        )}
        <Dim x1={x1} y1={yMain} x2={x1} y2={bottom} off={f * 1.3} f={f * 0.75} label={cm(bottom - yMain)} />
        {/* odnośniki */}
        <Callout x={xs[0] + 20} y={yMain + 10} tx={xs[0] + 140} ty={yMain - 60} n={nMain} f={f} />
        {nSec > 0 && <Callout x={xs[0] - 120} y={yLow + 20} tx={xs[0] - 120} ty={bottom + f * 3} n={nSec} f={f} />}
        {nHang > 0 && <Callout x={xs[1]} y={Math.max(10, yMain - 70)} tx={xs[1] + 120} ty={-120} n={nHang} f={f} />}
        {nPer > 0 && <Callout x={12} y={yPerim + 10} tx={60} ty={bottom + f * 3} n={nPer} f={f} />}
        {nWool > 0 && <Callout x={first + span * 0.75} y={(woolY + yBoard) / 2} tx={first + span * 0.75} ty={-120} n={nWool} f={f} />}
        {nVapor > 0 && <Callout x={first + span * 0.3} y={yVapor} tx={first + span * 0.3} ty={bottom + f * 3} n={nVapor} f={f} />}
        <Callout x={xs[1] + 80} y={yBoard + nt / 2} tx={xs[1] + 80} ty={bottom + f * 3} n={nBoard} f={f} />
      </Paper>
      <Legend items={legend} />
      <figcaption className="muted small">
        Przekrój poprzeczny do profili {singleGrid ? mainName : 'nośnych'}, wymiary w mm. Rozpiętość skrócona. Pierwszy profil{' '}
        {cm(firstOff)} cm od ściany (tak jak na rzucie rusztu). Od wierzchu profilu {mainName} do spodu płyty: {cm(bottom - yMain)} mm.
        {levels &&
          ` Strop na ${m2(levels.slab)} m, spód płyt na ${m2(levels.ceiling)} m${
            hung || direct ? `, zwieszenie (wierzch rusztu – strop) ${cm(Math.round(levels.hangerGap * 10))} mm` : ''
          }; min. ${cm(levels.depth.minMm)} mm od stropu do spodu płyt (${levels.depth.source}).`}
      </figcaption>
    </figure>
  );
}
