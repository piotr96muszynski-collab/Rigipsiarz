// Wspólne elementy rysunków technicznych (SVG). Rysunki są zawsze na „białym papierze”,
// także w trybie ciemnym – tak samo wyglądają na ekranie, w druku i w PDF.

import { useState, type ReactNode, type Ref } from 'react';
import { ZoomViewer } from './ZoomViewer';

export const INK = '#1f2933';
export const DIM = '#3b4652';
export const C = {
  stud: '#2f6fb0',
  short: '#7fa8d6',
  jamb: '#d9822b',
  ua: '#c0392b',
  extra: '#7b4fb5',
  joint: '#16a3a3',
  track: '#4a5a6a',
  main: '#1d5fd1',
  secondary: '#2e9e5b',
  hanger: '#c0392b',
  ud: '#4a5a6a',
  board: '#efe9dc',
  boardCut: '#f6d9a8',
  wool: '#f3e48c',
  concrete: '#cfd4da',
  warn: '#d0312d',
};

/** Format wymiaru w cm, bez miejsc po przecinku gdy niepotrzebne */
export const cm = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Sam rysunek SVG (na ekranie, w druku i w podglądzie powiększenia) */
export function PaperSvg({
  viewBox,
  title,
  children,
  svgRef,
}: {
  viewBox: [number, number, number, number];
  title: string;
  children: ReactNode;
  svgRef?: Ref<SVGSVGElement>;
}) {
  const [x, y, w, h] = viewBox;
  return (
    <svg
      ref={svgRef}
      viewBox={`${x} ${y} ${w} ${h}`}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
      fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    >
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#8a939d" strokeWidth="1.2" />
        </pattern>
        <pattern id="hatch-cut" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-45)">
          <rect width="14" height="14" fill={C.boardCut} />
          <line x1="0" y1="0" x2="0" y2="14" stroke="#e0b46a" strokeWidth="2" />
        </pattern>
        <pattern id="wool" patternUnits="userSpaceOnUse" width="20" height="20">
          <rect width="20" height="20" fill={C.wool} />
          <path d="M0 10 Q5 2 10 10 T20 10" fill="none" stroke="#c9b13c" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill="#fff" />
      {children}
    </svg>
  );
}

/**
 * Arkusz z rysunkiem: mieści się w szerokości ekranu, a dotknięcie otwiera
 * podgląd na pełnym ekranie z powiększaniem dwoma palcami i przesuwaniem.
 */
export function Paper({
  viewBox,
  title,
  children,
}: {
  viewBox: [number, number, number, number];
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="paper zoomable"
        role="button"
        tabIndex={0}
        aria-label={`${title} – dotknij, aby powiększyć`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <PaperSvg viewBox={viewBox} title={title}>
          {children}
        </PaperSvg>
        <span className="paper-zoom no-print" aria-hidden>
          <svg viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5M10.5 8v5M8 10.5h5" />
          </svg>
        </span>
      </div>
      {open && (
        <ZoomViewer viewBox={viewBox} title={title} onClose={() => setOpen(false)}>
          {children}
        </ZoomViewer>
      )}
    </>
  );
}

const ns = { vectorEffect: 'non-scaling-stroke' as const };
export const nss = ns;

/**
 * Linia wymiarowa między dwoma punktami (pozioma lub pionowa), odsunięta o `off`
 * prostopadle (dodatnie = w dół / w prawo).
 */
export function Dim({
  x1,
  y1,
  x2,
  y2,
  off,
  label,
  f,
  color = DIM,
  ext = true,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  off: number;
  label?: string;
  f: number;
  color?: string;
  ext?: boolean;
}) {
  const horiz = Math.abs(y1 - y2) < Math.abs(x1 - x2);
  const len = horiz ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const t = f * 0.35;
  if (horiz) {
    const y = y1 + off;
    const mid = (x1 + x2) / 2;
    const fits = !label || len > label.length * f * 0.6 + f * 0.4;
    return (
      <g stroke={color} {...ns}>
        {ext && <line x1={x1} y1={y1} x2={x1} y2={y + Math.sign(off) * t} strokeWidth={0.6} {...ns} />}
        {ext && <line x1={x2} y1={y2} x2={x2} y2={y + Math.sign(off) * t} strokeWidth={0.6} {...ns} />}
        <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={0.9} {...ns} />
        <line x1={x1 - t} y1={y + t} x2={x1 + t} y2={y - t} strokeWidth={1.4} {...ns} />
        <line x1={x2 - t} y1={y + t} x2={x2 + t} y2={y - t} strokeWidth={1.4} {...ns} />
        {label && (
          <text
            x={mid}
            y={y - f * 0.3}
            fontSize={fits ? f : f * 0.75}
            textAnchor="middle"
            fill={color}
            stroke="none"
            transform={fits ? undefined : `rotate(-60 ${mid} ${y - f * 0.3})`}
          >
            {label}
          </text>
        )}
      </g>
    );
  }
  const x = x1 + off;
  const mid = (y1 + y2) / 2;
  const fits = !label || len > label.length * f * 0.6 + f * 0.4;
  return (
    <g stroke={color} {...ns}>
      {ext && <line x1={x1} y1={y1} x2={x + Math.sign(off) * t} y2={y1} strokeWidth={0.6} {...ns} />}
      {ext && <line x1={x2} y1={y2} x2={x + Math.sign(off) * t} y2={y2} strokeWidth={0.6} {...ns} />}
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={0.9} {...ns} />
      <line x1={x - t} y1={y1 + t} x2={x + t} y2={y1 - t} strokeWidth={1.4} {...ns} />
      <line x1={x - t} y1={y2 + t} x2={x + t} y2={y2 - t} strokeWidth={1.4} {...ns} />
      {label && (
        <text
          x={x - f * 0.3}
          y={mid}
          fontSize={fits ? f : f * 0.75}
          textAnchor="middle"
          fill={color}
          stroke="none"
          transform={`rotate(-90 ${x - f * 0.3} ${mid})`}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Łańcuch wymiarowy wzdłuż osi poziomej (xs rosnąco) na wysokości y */
export function ChainH({ xs, y, off, f, unit = 1, color }: { xs: number[]; y: number; off: number; f: number; unit?: number; color?: string }) {
  const pts = dedupe(xs, f * 0.05);
  return (
    <g>
      {pts.slice(1).map((x, i) => (
        <Dim key={i} x1={pts[i]} y1={y} x2={x} y2={y} off={off} f={f} label={cm((x - pts[i]) * unit)} color={color} />
      ))}
    </g>
  );
}

/** Łańcuch wymiarowy wzdłuż osi pionowej (ys rosnąco) na pozycji x */
export function ChainV({ ys, x, off, f, unit = 1, color }: { ys: number[]; x: number; off: number; f: number; unit?: number; color?: string }) {
  const pts = dedupe(ys, f * 0.05);
  return (
    <g>
      {pts.slice(1).map((y, i) => (
        <Dim key={i} x1={x} y1={pts[i]} x2={x} y2={y} off={off} f={f} label={cm((y - pts[i]) * unit)} color={color} />
      ))}
    </g>
  );
}

export function dedupe(vals: number[], eps: number): number[] {
  const s = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) if (!out.length || v - out[out.length - 1] > eps) out.push(v);
  return out;
}

/** Odnośnik z numerem (do legendy pod rysunkiem) */
export function Callout({ x, y, tx, ty, n, f }: { x: number; y: number; tx: number; ty: number; n: number; f: number }) {
  const r = f * 0.75;
  return (
    <g>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke={INK} strokeWidth={0.8} {...ns} />
      <circle cx={x} cy={y} r={f * 0.15} fill={INK} />
      <circle cx={tx} cy={ty} r={r} fill="#fff" stroke={INK} strokeWidth={1} {...ns} />
      <text x={tx} y={ty + f * 0.35} fontSize={f} textAnchor="middle" fill={INK} fontWeight={600}>
        {n}
      </text>
    </g>
  );
}

export function Legend({ items }: { items: { color?: string; pattern?: 'cut' | 'hatch' | 'wool'; dashed?: boolean; label: string; n?: number }[] }) {
  return (
    <ul className="dw-legend">
      {items.map((it, i) => (
        <li key={i}>
          {it.n !== undefined ? (
            <span className="dw-num">{it.n}</span>
          ) : (
            <span
              className={`dw-swatch${it.pattern ? ` dw-${it.pattern}` : ''}${it.dashed ? ' dw-dashed' : ''}`}
              style={it.color ? { background: it.color } : undefined}
            />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}
