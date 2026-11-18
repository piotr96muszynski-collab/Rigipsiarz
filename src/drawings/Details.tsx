// Detale połączeń ścian (rzuty poziome, schematy poglądowe, wymiary w mm)
// i detal otworu (widok, cm). Parametry – szerokość profilu i liczba warstw – z systemu ściany.

import type { ReactNode } from 'react';
import { cHorz, cVert } from './Sections';
import { C, Callout, INK, Legend, Paper, nss } from './svg';

const TB = 12.5;
const F = 30;

export type DetailKind = 'corner' | 'tee' | 'cross' | 'existing-wall' | 'free';

interface WallParams {
  profile: number;
  layers: number;
  sides: number;
  boardColor: string;
}

const Board = ({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) => (
  <rect x={x} y={y} width={w} height={h} fill={color} stroke={INK} strokeWidth={0.9} {...nss} />
);
const Core = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <rect x={x} y={y} width={w} height={h} fill="url(#wool)" opacity={0.45} />
);
const Stud = ({ d, color = C.stud }: { d: string; color?: string }) => (
  <path d={d} fill="none" stroke={color} strokeWidth={2.4} {...nss} />
);
const Bead = ({ x, y, rot }: { x: number; y: number; rot: number }) => (
  <path d="M0 22 L0 0 L22 0" transform={`translate(${x} ${y}) rotate(${rot})`} fill="none" stroke={C.warn} strokeWidth={2.6} {...nss} />
);

/** Ściana pozioma w rzucie: x od x0 do x1, okładziny od góry (strona A) i od dołu (strona B) */
function HWall({ x0, x1, y, p, aFrom = x0, bFrom = x0, aTo = x1, bTo = x1 }: { x0: number; x1: number; y: number; p: WallParams; aFrom?: number; bFrom?: number; aTo?: number; bTo?: number }) {
  const nt = p.layers * TB;
  return (
    <g>
      <Core x={x0} y={y + nt} w={x1 - x0} h={p.profile} />
      {Array.from({ length: p.layers }, (_, k) => (
        <Board key={`a${k}`} x={aFrom} y={y + k * TB} w={aTo - aFrom} h={TB} color={p.boardColor} />
      ))}
      {p.sides > 1 &&
        Array.from({ length: p.layers }, (_, k) => (
          <Board key={`b${k}`} x={bFrom} y={y + nt + p.profile + k * TB} w={bTo - bFrom} h={TB} color={p.boardColor} />
        ))}
    </g>
  );
}

/** Ściana pionowa w rzucie: y od y0 do y1 */
function VWall({ y0, y1, x, p, aFrom = y0, bFrom = y0 }: { y0: number; y1: number; x: number; p: WallParams; aFrom?: number; bFrom?: number }) {
  const nt = p.layers * TB;
  return (
    <g>
      <Core x={x + nt} y={y0} w={p.profile} h={y1 - y0} />
      {Array.from({ length: p.layers }, (_, k) => (
        <Board key={`a${k}`} x={x + k * TB} y={aFrom} w={TB} h={y1 - aFrom} color={p.boardColor} />
      ))}
      {p.sides > 1 &&
        Array.from({ length: p.layers }, (_, k) => (
          <Board key={`b${k}`} x={x + nt + p.profile + k * TB} y={bFrom} w={TB} h={y1 - bFrom} color={p.boardColor} />
        ))}
    </g>
  );
}

function Frame({ title, vb, children, legend, caption }: { title: string; vb: [number, number, number, number]; children: ReactNode; legend: { n: number; label: string }[]; caption?: string }) {
  return (
    <figure className="drawing detail">
      <h4>{title}</h4>
      <Paper viewBox={vb} title={title}>
        {children}
      </Paper>
      <Legend items={legend} />
      {caption && <figcaption className="muted small">{caption}</figcaption>}
    </figure>
  );
}

export function JunctionDetail({ kind, p }: { kind: DetailKind; p: WallParams }) {
  const nt = p.layers * TB;
  const T = p.profile + nt * (p.sides > 1 ? 2 : 1);
  const P = p.profile;
  const L = 420;

  if (kind === 'corner') {
    return (
      <Frame
        title="Narożnik L"
        vb={[-90, -90, L + 160, L + 140]}
        legend={[
          { n: 1, label: 'słupek końcowy ściany 1 w narożniku' },
          { n: 2, label: 'dodatkowy słupek CW – podparcie płyt od wewnątrz (jest w zestawieniu)' },
          { n: 3, label: 'pierwszy słupek ściany 2, skręcony ze słupkiem 1 wkrętami LN co ok. 50 cm' },
          { n: 4, label: 'narożnik ochronny na krawędzi zewnętrznej, zaszpachlowany' },
        ]}
        caption="Płyty zewnętrzne zachodzą na czoło płyt sąsiedniej ściany. Rzut, schemat poglądowy."
      >
        <HWall x0={nt} x1={L} y={0} p={p} aFrom={0} bFrom={T} />
        <VWall y0={T - nt} y1={L} x={0} p={p} aFrom={nt} bFrom={T - nt} />
        <Stud d={cVert(nt, nt, nt + P, 1)} />
        <Stud d={cVert(T + 50, nt, nt + P, -1)} color={C.extra} />
        <Stud d={cHorz(T - nt + 0.5, nt, nt + P, 1)} />
        <Bead x={0} y={0} rot={0} />
        <Callout x={nt + 25} y={nt + 3} tx={L * 0.55} ty={-60} n={1} f={F} />
        <Callout x={T + 50} y={nt + P / 2} tx={L * 0.75} ty={T + 90} n={2} f={F} />
        <Callout x={nt + P / 2} y={T - nt + 30} tx={T + 100} ty={L * 0.6} n={3} f={F} />
        <Callout x={4} y={4} tx={-55} ty={-55} n={4} f={F} />
      </Frame>
    );
  }

  if (kind === 'tee' || kind === 'cross') {
    const c = L;
    const W = 2 * L;
    const both = kind === 'cross';
    return (
      <Frame
        title={both ? 'Skrzyżowanie ścian' : 'Połączenie T'}
        vb={[-60, both ? -L * 0.75 - 40 : -90, W + 120, both ? L * 1.5 + T + 80 : L * 0.75 + T + 120]}
        legend={[
          { n: 1, label: `dodatkowy słupek CW w ścianie przechodzącej${both ? ' – po jednym z każdej strony' : ''} (jest w zestawieniu)` },
          { n: 2, label: 'słupek końcowy ściany dochodzącej, przykręcony przez płyty do słupka 1' },
          { n: 3, label: 'płyty ściany przechodzącej bez przerwy na styku' },
        ]}
        caption="Taśma uszczelniająca pod słupkiem 2. Narożniki wewnętrzne szpachluj z taśmą. Rzut, schemat poglądowy."
      >
        <HWall x0={0} x1={W} y={0} p={p} />
        <VWall y0={T} y1={T + L * 0.75} x={c - T / 2} p={p} />
        <Stud d={cVert(c - 25, nt, nt + P, 1)} color={C.extra} />
        <Stud d={cHorz(T + 0.5, c - T / 2 + nt, c - T / 2 + nt + P, 1)} />
        <Stud d={cVert(120, nt, nt + P, 1)} />
        <Stud d={cVert(W - 120, nt, nt + P, -1)} />
        {both && (
          <>
            <VWall y0={-L * 0.75} y1={0} x={c - T / 2} p={p} />
            <Stud d={cVert(c + 25 + 30, nt, nt + P, -1)} color={C.extra} />
            <Stud d={cHorz(-0.5, c - T / 2 + nt, c - T / 2 + nt + P, -1)} />
          </>
        )}
        <Callout x={c} y={nt + 4} tx={c + 160} ty={both ? -L * 0.5 : -60} n={1} f={F} />
        <Callout x={c - T / 2 + nt + P / 2} y={T + 30} tx={c - 170} ty={T + L * 0.5} n={2} f={F} />
        <Callout x={W * 0.85} y={T - nt / 2} tx={W * 0.85} ty={T + 80} n={3} f={F} />
      </Frame>
    );
  }

  if (kind === 'existing-wall') {
    return (
      <Frame
        title="Połączenie z istniejącą ścianą"
        vb={[-180, -90, L + 220, T + 190]}
        legend={[
          { n: 1, label: 'taśma uszczelniająca pod słupkiem przyściennym' },
          { n: 2, label: 'słupek CW kotwiony kołkami co max 100 cm (min. 2 szt.)' },
          { n: 3, label: 'szczelina ok. 5 mm przy murze: taśma rozdzielająca + masa' },
        ]}
        caption="Rzut, schemat poglądowy."
      >
        <rect x={-150} y={-60} width={150} height={T + 120} fill={C.concrete} />
        <rect x={-150} y={-60} width={150} height={T + 120} fill="url(#hatch)" />
        <rect x={0} y={nt} width={5} height={P} fill={C.wool} stroke={INK} strokeWidth={0.5} {...nss} />
        <HWall x0={5} x1={L} y={0} p={p} aFrom={5} bFrom={5} />
        <Stud d={cVert(5, nt, nt + P, 1)} />
        <line x1={-60} y1={nt + P / 2} x2={30} y2={nt + P / 2} stroke={INK} strokeWidth={2} strokeDasharray="6 3" {...nss} />
        <Callout x={2} y={nt + P * 0.25} tx={-80} ty={-40} n={1} f={F} />
        <Callout x={30} y={nt + 4} tx={150} ty={-50} n={2} f={F} />
        <Callout x={4} y={T - 2} tx={-80} ty={T + 60} n={3} f={F} />
      </Frame>
    );
  }

  // wolny koniec
  return (
    <Frame
      title="Wolny koniec ściany"
      vb={[-60, -90, L + 160, T + 190]}
      legend={[
        { n: 1, label: 'słupek końcowy CW (półkami do środka ściany)' },
        { n: 2, label: 'pas płyty na czole ściany' },
        { n: 3, label: 'narożniki ochronne na obu krawędziach (są w zestawieniu)' },
      ]}
      caption="Rzut, schemat poglądowy."
    >
      <HWall x0={0} x1={L} y={0} p={p} />
      <Board x={L} y={0} w={TB} h={T} color={p.boardColor} />
      <Stud d={cVert(L - 0.5, nt, nt + P, -1)} />
      <Bead x={L + TB} y={0} rot={90} />
      {p.sides > 1 && <Bead x={L + TB} y={T} rot={180} />}
      <Callout x={L - 25} y={nt + 3} tx={L - 160} ty={-50} n={1} f={F} />
      <Callout x={L + TB / 2} y={T / 2} tx={L + 90} ty={T / 2} n={2} f={F} />
      <Callout x={L + TB} y={2} tx={L + 80} ty={-55} n={3} f={F} />
    </Frame>
  );
}

/** Detal otworu (widok od strony A, cm) */
export function OpeningDetail({ kind, reinforced, profile }: { kind: 'door' | 'window'; reinforced: boolean; profile: number }) {
  const H = 260;
  const W = 260;
  const ow = kind === 'door' ? 90 : 120;
  const oh = kind === 'door' ? 205 : 120;
  const sill = kind === 'door' ? 0 : 90;
  const x0 = (W - ow) / 2;
  const x1 = x0 + ow;
  const yTop = H - (sill + oh);
  const ySill = H - sill;
  const f = 11;
  const jamb = reinforced ? C.ua : C.jamb;
  const jambName = reinforced ? `UA ${profile}` : `CW ${profile}`;
  return (
    <figure className="drawing detail">
      <h4>{kind === 'door' ? 'Otwór drzwiowy' : 'Otwór okienny'}</h4>
      <Paper viewBox={[-50, -30, W + 100, H + 60]} title={kind === 'door' ? 'Detal otworu drzwiowego' : 'Detal otworu okiennego'}>
        <rect x={-20} y={-6} width={W + 40} height={6} fill="url(#hatch)" />
        <rect x={-20} y={H} width={W + 40} height={6} fill="url(#hatch)" />
        {/* UW posadzka (przerwany przy drzwiach) i strop */}
        <rect x={0} y={0} width={W} height={4} fill={C.track} />
        {kind === 'door' ? (
          <>
            <rect x={0} y={H - 4} width={x0} height={4} fill={C.track} />
            <rect x={x1} y={H - 4} width={W - x1} height={4} fill={C.track} />
          </>
        ) : (
          <rect x={0} y={H - 4} width={W} height={4} fill={C.track} />
        )}
        <rect x={x0} y={yTop} width={ow} height={oh} fill="#fff" stroke={INK} strokeWidth={1.2} strokeDasharray="6 4" {...nss} />
        {/* ościeża */}
        <rect x={x0 - 5} y={0} width={5} height={H} fill={jamb} />
        <rect x={x1} y={0} width={5} height={H} fill={jamb} />
        {/* nadproże UW z zagiętymi końcami */}
        <path d={`M${x0 - 15} ${yTop - 14} L${x0 - 15} ${yTop - 4} L${x1 + 15} ${yTop - 4} L${x1 + 15} ${yTop - 14}`} fill="none" stroke={C.track} strokeWidth={3} {...nss} />
        {kind === 'window' && (
          <path d={`M${x0 - 15} ${ySill + 14} L${x0 - 15} ${ySill + 4} L${x1 + 15} ${ySill + 4} L${x1 + 15} ${ySill + 14}`} fill="none" stroke={C.track} strokeWidth={3} {...nss} />
        )}
        {/* słupki skrócone */}
        <rect x={(x0 + x1) / 2 - 2.5} y={4} width={5} height={yTop - 8} fill={C.short} />
        {kind === 'window' && <rect x={(x0 + x1) / 2 - 2.5} y={ySill + 4} width={5} height={H - ySill - 8} fill={C.short} />}
        {/* zwykłe słupki */}
        <rect x={0} y={0} width={5} height={H} fill={C.stud} />
        <rect x={W - 5} y={0} width={5} height={H} fill={C.stud} />
        {/* kątowniki UA */}
        {reinforced &&
          [x0 - 5, x1].flatMap((x) => [
            <path key={`t${x}`} d={`M${x - 3} 10 L${x - 3} 4 L${x + 8} 4`} fill="none" stroke={INK} strokeWidth={2} {...nss} />,
            <path key={`b${x}`} d={`M${x - 3} ${H - 10} L${x - 3} ${H - 4} L${x + 8} ${H - 4}`} fill="none" stroke={INK} strokeWidth={2} {...nss} />,
          ])}
        {/* przykładowy rozkład płyt – styk nad otworem, nie w linii ościeża */}
        <path d={`M${x0 + 30} 0 L${x0 + 30} ${yTop}`} stroke={C.warn} strokeWidth={1.4} strokeDasharray="4 3" fill="none" {...nss} />
        {kind === 'window' && <path d={`M${x0 + 30} ${ySill} L${x0 + 30} ${H}`} stroke={C.warn} strokeWidth={1.4} strokeDasharray="4 3" fill="none" {...nss} />}
        <Callout x={x0 - 3} y={H * 0.55} tx={-30} ty={H * 0.55} n={1} f={f} />
        <Callout x={x0 + ow * 0.7} y={yTop - 4} tx={x0 + ow * 0.7} ty={yTop - 30 < 10 ? yTop + 20 : yTop - 30} n={2} f={f} />
        <Callout x={(x0 + x1) / 2} y={yTop / 2} tx={(x0 + x1) / 2 + 40} ty={yTop / 2} n={3} f={f} />
        <Callout x={x0 + 30} y={yTop / 3} tx={x0 - 30} ty={yTop / 3} n={4} f={f} />
        {reinforced && <Callout x={x1 + 3} y={6} tx={x1 + 40} ty={-14} n={5} f={f} />}
      </Paper>
      <Legend
        items={[
          { n: 1, label: `ościeże ${jambName} na całą wysokość${reinforced ? ' (drzwi ciężkie)' : ''}` },
          { n: 2, label: `nadproże${kind === 'window' ? ' i podokiennik' : ''} z UW ${profile}: długość otworu + 2×15 cm, końce nacięte i zagięte` },
          { n: 3, label: `słupki skrócone CW ${profile} w rozstawie` },
          { n: 4, label: 'styk płyt nad otworem, min. 15 cm od ościeża (płyta w kształcie litery L)' },
          ...(reinforced ? [{ n: 5, label: 'kątowniki przyłączeniowe UA kotwione do stropu i posadzki' }] : []),
        ]}
      />
      <figcaption className="muted small">Widok, schemat poglądowy. Rzeczywiste wymiary otworów – na rysunkach ścian.</figcaption>
    </figure>
  );
}

export const detailTitle = (k: DetailKind) =>
  ({ corner: 'narożnik L', tee: 'połączenie T', cross: 'skrzyżowanie', 'existing-wall': 'przy istniejącej ścianie', free: 'wolny koniec' })[k];

