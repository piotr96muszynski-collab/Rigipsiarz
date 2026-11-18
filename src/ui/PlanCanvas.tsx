import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bbox, dist, nodeMap, pointInPolygon, wallEnds } from '../geometry/geometry';
import { findRoomAt } from '../geometry/rooms';
import { createCeiling, createOpening } from '../model/factory';
import { addWall, hitWall, mergeNodeIfOverlaps, offsetAlongWall, snapPoint, type SnapResult } from '../model/ops';
import type { Point, Project } from '../model/types';
import { fmtCm, wallColor, wallThickness } from './wallStyle';

export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'ceiling';

export type Selection =
  | { type: 'wall'; id: string; openingId?: string }
  | { type: 'ceiling'; id: string }
  | null;

interface Props {
  project: Project;
  update: (fn: (d: Project) => void, opts?: { transient?: boolean }) => void;
  commit: () => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  fitSignal: number;
  onMessage: (m: string) => void;
}

interface View {
  ox: number; // świat (cm) w lewym górnym rogu
  oy: number;
  z: number; // px na cm
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean; tapTarget: Selection }
  | { kind: 'pinch'; d0: number; mid: Point; view: View }
  | { kind: 'draw'; start: Point; end: Point; startScreen: Point; moved: boolean; snap: SnapResult }
  | { kind: 'rect'; start: Point; end: Point; startScreen: Point; moved: boolean; mode: 'room' | 'ceiling' }
  | { kind: 'node'; id: string; moved: boolean }
  | { kind: 'vertex'; ceilingId: string; index: number; moved: boolean }
  | { kind: 'opening'; wallId: string; openingId: string; grab: number; moved: boolean };

const HANDLE_PX = 16;
const DRAG_PX = 7;

export function PlanCanvas(props: Props) {
  const { project, update, commit, tool, selection, setSelection, fitSignal, onMessage } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ ox: -100, oy: -100, z: 1.2 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);
  const [chain, setChain] = useState<Point | null>(null);
  const [hover, setHover] = useState<SnapResult | null>(null);

  const nodes = useMemo(() => nodeMap(project), [project]);

  // rozmiar
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const pts: Point[] = [...project.nodes, ...project.ceilings.flatMap((c) => c.points)];
    const r = svgRef.current?.getBoundingClientRect();
    const w = r?.width ?? size.w;
    const h = r?.height ?? size.h;
    if (!pts.length) {
      const z = Math.min(w, h) / 700;
      setView({ ox: -w / z / 2 + 300, oy: -h / z / 2 + 250, z });
      return;
    }
    const b = bbox(pts);
    const pad = 80;
    const z = Math.min((w - pad * 2) / Math.max(b.maxX - b.minX, 100), (h - pad * 2) / Math.max(b.maxY - b.minY, 100), 6);
    setView({ ox: (b.minX + b.maxX) / 2 - w / z / 2, oy: (b.minY + b.maxY) / 2 - h / z / 2, z });
  }, [project, size]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  useEffect(() => {
    if (tool !== 'wall') setChain(null);
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChain(null);
        gesture.current = null;
        rerender();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toWorld = (sx: number, sy: number): Point => ({ x: view.ox + sx / view.z, y: view.oy + sy / view.z });
  const toScreen = (p: Point): Point => ({ x: (p.x - view.ox) * view.z, y: (p.y - view.oy) * view.z });
  const local = (e: React.PointerEvent | React.WheelEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tolCm = HANDLE_PX / view.z;
  const grid = project.settings.gridSnap;

  // --------- trafienia ---------
  const hitNode = (w: Point) => project.nodes.find((n) => dist(n, w) < tolCm);
  const hitOpening = (w: Point) => {
    for (const wall of project.walls) {
      const [a, b] = wallEnds(project, wall, nodes);
      const L = dist(a, b);
      if (L < 1) continue;
      const along = offsetAlongWall(project, wall, w);
      const ux = (b.x - a.x) / L;
      const uy = (b.y - a.y) / L;
      const px = a.x + ux * along;
      const py = a.y + uy * along;
      if (Math.hypot(w.x - px, w.y - py) > Math.max(tolCm, wallThickness(wall))) continue;
      const op = wall.openings.find((o) => along >= o.offset - 2 && along <= o.offset + o.width + 2);
      if (op) return { wall, op, along };
    }
    return null;
  };
  const hitCeiling = (w: Point) => [...project.ceilings].reverse().find((c) => pointInPolygon(w, c.points));

  // --------- obsługa wskaźnika ---------
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = local(e);
    pointers.current.set(e.pointerId, s);
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        d0: dist(p1, p2),
        mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        view,
      };
      rerender();
      return;
    }
    if (pointers.current.size > 2) return;
    if (e.button === 1 || e.button === 2) {
      gesture.current = { kind: 'pan', sx: s.x, sy: s.y, ox: view.ox, oy: view.oy, moved: false, tapTarget: selection };
      return;
    }
    const w = toWorld(s.x, s.y);

    if (tool === 'select') {
      // uchwyty wierzchołków wybranego sufitu
      if (selection?.type === 'ceiling') {
        const c = project.ceilings.find((x) => x.id === selection.id);
        const idx = c?.points.findIndex((pt) => dist(pt, w) < tolCm) ?? -1;
        if (c && idx >= 0) {
          gesture.current = { kind: 'vertex', ceilingId: c.id, index: idx, moved: false };
          return;
        }
      }
      const n = hitNode(w);
      if (n) {
        gesture.current = { kind: 'node', id: n.id, moved: false };
        return;
      }
      const ho = hitOpening(w);
      if (ho) {
        setSelection({ type: 'wall', id: ho.wall.id, openingId: ho.op.id });
        gesture.current = { kind: 'opening', wallId: ho.wall.id, openingId: ho.op.id, grab: ho.along - ho.op.offset, moved: false };
        return;
      }
      const hw = hitWall(project, w, Math.max(tolCm, 12));
      const hc = hw ? null : hitCeiling(w);
      const tapTarget: Selection = hw ? { type: 'wall', id: hw.id } : hc ? { type: 'ceiling', id: hc.id } : null;
      gesture.current = { kind: 'pan', sx: s.x, sy: s.y, ox: view.ox, oy: view.oy, moved: false, tapTarget };
      return;
    }

    if (tool === 'wall') {
      const snap = snapPoint(project, w, tolCm, chain ?? undefined, grid);
      gesture.current = { kind: 'draw', start: chain ?? snap.point, end: snap.point, startScreen: s, moved: false, snap };
      rerender();
      return;
    }
    if (tool === 'room' || tool === 'ceiling') {
      const snap = snapPoint(project, w, tolCm, undefined, grid);
      gesture.current = { kind: 'rect', start: snap.point, end: snap.point, startScreen: s, moved: false, mode: tool };
      rerender();
      return;
    }
    if (tool === 'door' || tool === 'window') {
      const hw = hitWall(project, w, Math.max(tolCm, 20));
      if (!hw) {
        onMessage('Dotknij ściany, aby wstawić ' + (tool === 'door' ? 'drzwi' : 'okno'));
        return;
      }
      const L = dist(...wallEnds(project, hw, nodes));
      const along = offsetAlongWall(project, hw, w);
      const op = createOpening(tool, 0);
      if (op.width > L - 10) op.width = Math.max(40, Math.round(L - 20));
      op.offset = Math.round(Math.max(5, Math.min(L - op.width - 5, along - op.width / 2)));
      update((d) => {
        d.walls.find((x) => x.id === hw.id)!.openings.push(op);
      });
      setSelection({ type: 'wall', id: hw.id, openingId: op.id });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    const g = gesture.current;
    const w = toWorld(s.x, s.y);

    if (!g) {
      if (tool === 'wall' && e.pointerType === 'mouse') setHover(snapPoint(project, w, tolCm, chain ?? undefined, grid));
      return;
    }
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const d = dist(p1, p2);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const z = clampZoom(g.view.z * (d / g.d0));
      // punkt świata pod początkowym środkiem ma zostać pod bieżącym środkiem
      const wx = g.view.ox + g.mid.x / g.view.z;
      const wy = g.view.oy + g.mid.y / g.view.z;
      setView({ z, ox: wx - mid.x / z, oy: wy - mid.y / z });
      return;
    }
    if (g.kind === 'pan') {
      const dx = s.x - g.sx;
      const dy = s.y - g.sy;
      if (Math.hypot(dx, dy) > DRAG_PX) g.moved = true;
      if (g.moved) setView((v) => ({ ...v, ox: g.ox - dx / v.z, oy: g.oy - dy / v.z }));
      return;
    }
    if (g.kind === 'draw') {
      if (dist(s, g.startScreen) > DRAG_PX) g.moved = true;
      g.snap = snapPoint(project, w, tolCm, g.start, grid);
      g.end = g.snap.point;
      rerender();
      return;
    }
    if (g.kind === 'rect') {
      if (dist(s, g.startScreen) > DRAG_PX) g.moved = true;
      g.end = snapPoint(project, w, tolCm, undefined, grid).point;
      rerender();
      return;
    }
    if (g.kind === 'node') {
      g.moved = true;
      const sp = snapPoint(project, w, tolCm, undefined, grid, g.id);
      update(
        (d) => {
          const n = d.nodes.find((x) => x.id === g.id);
          if (n) {
            n.x = sp.point.x;
            n.y = sp.point.y;
          }
        },
        { transient: true },
      );
      return;
    }
    if (g.kind === 'vertex') {
      g.moved = true;
      const sp = snapPoint(project, w, tolCm, undefined, grid);
      update(
        (d) => {
          const c = d.ceilings.find((x) => x.id === g.ceilingId);
          if (c) c.points[g.index] = sp.point;
        },
        { transient: true },
      );
      return;
    }
    if (g.kind === 'opening') {
      g.moved = true;
      update(
        (d) => {
          const wall = d.walls.find((x) => x.id === g.wallId);
          const op = wall?.openings.find((o) => o.id === g.openingId);
          if (!wall || !op) return;
          const L = dist(...wallEnds(d, wall));
          const along = offsetAlongWall(d, wall, w);
          op.offset = Math.round(Math.max(0, Math.min(L - op.width, along - g.grab)) / grid) * grid;
        },
        { transient: true },
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;

    if (g.kind === 'pan') {
      if (!g.moved && tool === 'select') setSelection(g.tapTarget);
    } else if (g.kind === 'draw') {
      if (g.moved || chain) {
        const from = g.start;
        const to = g.end;
        if (dist(from, to) >= 10) {
          let created: string | null = null;
          update((d) => {
            const wall = addWall(d, from, to);
            created = wall?.id ?? null;
          });
          // ściana zamknęła się na istniejącym węźle → koniec łańcucha
          const closed = project.nodes.some((n) => dist(n, to) < 1);
          setChain(closed && chain ? null : to);
          if (created) setSelection({ type: 'wall', id: created });
        } else if (!g.moved) {
          setChain(null);
        }
      } else {
        setChain(g.snap.point);
      }
    } else if (g.kind === 'rect') {
      const { start, end } = g;
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (g.mode === 'ceiling' && (!g.moved || w < 20 || h < 20)) {
        const room = findRoomAt(project, start);
        if (room) {
          let id = '';
          update((d) => {
            const c = createCeiling(d, room);
            id = c.id;
            d.ceilings.push(c);
          });
          setSelection({ type: 'ceiling', id });
          onMessage('Dodano sufit w obrysie pomieszczenia');
        } else onMessage('Przeciągnij prostokąt sufitu albo dotknij wnętrza zamkniętego pomieszczenia');
      } else if (w >= 20 && h >= 20) {
        const x0 = Math.min(start.x, end.x);
        const y0 = Math.min(start.y, end.y);
        const pts = [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + h },
          { x: x0, y: y0 + h },
        ];
        if (g.mode === 'ceiling') {
          let id = '';
          update((d) => {
            const c = createCeiling(d, pts);
            id = c.id;
            d.ceilings.push(c);
          });
          setSelection({ type: 'ceiling', id });
        } else {
          update((d) => {
            pts.forEach((pt, i) => addWall(d, pt, pts[(i + 1) % 4]));
          });
          setSelection(null);
        }
      }
    } else if (g.kind === 'node') {
      if (g.moved) {
        update((d) => mergeNodeIfOverlaps(d, g.id), { transient: true });
        commit();
      } else {
        const wall = project.walls.find((x) => x.a === g.id || x.b === g.id);
        if (wall) setSelection({ type: 'wall', id: wall.id });
      }
    } else if (g.kind === 'vertex' || g.kind === 'opening') {
      if (g.moved) commit();
    }
    rerender();
  };

  const onWheel = (e: React.WheelEvent) => {
    const s = local(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const z = clampZoom(v.z * factor);
      const wx = v.ox + s.x / v.z;
      const wy = v.oy + s.y / v.z;
      return { z, ox: wx - s.x / z, oy: wy - s.y / z };
    });
  };

  // --------- rysowanie ---------
  const g = gesture.current;
  const gridLines = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    const step = view.z > 2 ? 10 : view.z > 0.4 ? 50 : 100;
    const x0 = Math.floor(view.ox / step) * step;
    const y0 = Math.floor(view.oy / step) * step;
    const x1 = view.ox + size.w / view.z;
    const y1 = view.oy + size.h / view.z;
    for (let x = x0; x <= x1; x += step) out.push({ x1: x, y1: view.oy, x2: x, y2: y1, major: Math.round(x) % 100 === 0 });
    for (let y = y0; y <= y1; y += step) out.push({ x1: view.ox, y1: y, x2: x1, y2: y, major: Math.round(y) % 100 === 0 });
    return out;
  }, [view, size]);

  const preview = (() => {
    if (g?.kind === 'draw' && (g.moved || chain)) return { a: g.start, b: g.end };
    if (!g && chain && hover && tool === 'wall') return { a: chain, b: hover.point };
    return null;
  })();
  const snapMark = g?.kind === 'draw' ? g.snap : !g && tool === 'wall' ? hover : null;

  const selectedWall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;

  return (
    <div className="plan-wrap">
      <svg
        ref={svgRef}
        className={`plan tool-${tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Rzut – obszar rysowania ścian"
      >
        <g transform={`scale(${view.z}) translate(${-view.ox} ${-view.oy})`}>
          {gridLines.map((l, i) => (
            <line
              key={i}
              {...l}
              className={l.major ? 'grid-major' : 'grid-minor'}
              strokeWidth={(l.major ? 1 : 0.6) / view.z}
            />
          ))}

          {project.ceilings.map((c) => {
            const sel = selection?.type === 'ceiling' && selection.id === c.id;
            return (
              <g key={c.id}>
                <polygon
                  points={c.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  className={`ceiling ${sel ? 'selected' : ''}`}
                  strokeWidth={(sel ? 2.5 : 1.5) / view.z}
                />
                {sel &&
                  c.points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={7 / view.z} className="handle" strokeWidth={2 / view.z} />
                  ))}
              </g>
            );
          })}

          {project.walls.map((w) => {
            const a = nodes.get(w.a);
            const b = nodes.get(w.b);
            if (!a || !b) return null;
            const L = dist(a, b);
            const t = wallThickness(w);
            const sel = selectedWall?.id === w.id;
            const ux = (b.x - a.x) / (L || 1);
            const uy = (b.y - a.y) / (L || 1);
            return (
              <g key={w.id}>
                {sel && (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="wall-halo"
                    strokeWidth={t + 10 / view.z}
                  />
                )}
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={wallColor(w)}
                  className="wall"
                  strokeWidth={Math.max(t, 3 / view.z)}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="wall-axis" strokeWidth={1 / view.z} />
                {w.openings.map((o) => {
                  const p0 = { x: a.x + ux * o.offset, y: a.y + uy * o.offset };
                  const p1 = { x: a.x + ux * (o.offset + o.width), y: a.y + uy * (o.offset + o.width) };
                  const opSel = sel && selection?.type === 'wall' && selection.openingId === o.id;
                  const nx = -uy;
                  const ny = ux;
                  return (
                    <g key={o.id}>
                      <line
                        x1={p0.x}
                        y1={p0.y}
                        x2={p1.x}
                        y2={p1.y}
                        className="opening-gap"
                        strokeWidth={Math.max(t, 3 / view.z) + 1 / view.z}
                      />
                      {o.kind === 'door' ? (
                        <path
                          d={`M ${p0.x} ${p0.y} L ${p0.x + nx * o.width} ${p0.y + ny * o.width} A ${o.width} ${o.width} 0 0 0 ${p1.x} ${p1.y}`}
                          className={`door ${opSel ? 'selected' : ''}`}
                          strokeWidth={(opSel ? 2.5 : 1.2) / view.z}
                        />
                      ) : (
                        <>
                          {[-t / 2, 0, t / 2].map((k) => (
                            <line
                              key={k}
                              x1={p0.x + nx * k}
                              y1={p0.y + ny * k}
                              x2={p1.x + nx * k}
                              y2={p1.y + ny * k}
                              className={`window ${opSel ? 'selected' : ''}`}
                              strokeWidth={(opSel ? 2.5 : 1.2) / view.z}
                            />
                          ))}
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {project.nodes.map((n) => {
            const isSel = selectedWall && (selectedWall.a === n.id || selectedWall.b === n.id);
            return (
              <circle
                key={n.id}
                cx={n.x}
                cy={n.y}
                r={(isSel ? 8 : tool === 'select' ? 4 : 3) / view.z}
                className={isSel ? 'handle' : 'node'}
                strokeWidth={2 / view.z}
              />
            );
          })}

          {g?.kind === 'rect' && (
            <rect
              x={Math.min(g.start.x, g.end.x)}
              y={Math.min(g.start.y, g.end.y)}
              width={Math.abs(g.end.x - g.start.x)}
              height={Math.abs(g.end.y - g.start.y)}
              className={g.mode === 'ceiling' ? 'preview-ceiling' : 'preview-room'}
              strokeWidth={2 / view.z}
            />
          )}

          {preview && (
            <line
              x1={preview.a.x}
              y1={preview.a.y}
              x2={preview.b.x}
              y2={preview.b.y}
              className="preview"
              strokeWidth={Math.max(10, 4 / view.z)}
            />
          )}
          {chain && <circle cx={chain.x} cy={chain.y} r={6 / view.z} className="chain-start" strokeWidth={2 / view.z} />}
          {snapMark && snapMark.kind !== 'grid' && snapMark.kind !== 'none' && (
            <circle
              cx={snapMark.point.x}
              cy={snapMark.point.y}
              r={9 / view.z}
              className={`snap snap-${snapMark.kind}`}
              strokeWidth={2 / view.z}
            />
          )}
        </g>

        {/* opisy wymiarów – w pikselach ekranu, żeby były czytelne przy każdym powiększeniu */}
        <g className="labels">
          {project.walls.map((w) => {
            const a = nodes.get(w.a);
            const b = nodes.get(w.b);
            if (!a || !b) return null;
            const L = dist(a, b);
            if (L * view.z < 40) return null;
            const sa = toScreen(a);
            const sb = toScreen(b);
            let ang = (Math.atan2(sb.y - sa.y, sb.x - sa.x) * 180) / Math.PI;
            if (ang > 90) ang -= 180;
            if (ang < -90) ang += 180;
            const off = (wallThickness(w) * view.z) / 2 + 12;
            const nx = -(sb.y - sa.y) / (L * view.z);
            const ny = (sb.x - sa.x) / (L * view.z);
            const mx = (sa.x + sb.x) / 2 - nx * off;
            const my = (sa.y + sb.y) / 2 - ny * off;
            return (
              <text key={w.id} x={mx} y={my} transform={`rotate(${ang} ${mx} ${my})`} className="dim">
                {fmtCm(L)}
              </text>
            );
          })}
          {project.ceilings.map((c) => {
            const b = bbox(c.points);
            const center = toScreen({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
            const area = Math.abs(
              c.points.reduce((s, p, i) => {
                const q = c.points[(i + 1) % c.points.length];
                return s + p.x * q.y - q.x * p.y;
              }, 0) / 2,
            );
            return (
              <text key={c.id} x={center.x} y={center.y} className="ceiling-label">
                Sufit {(area / 10000).toFixed(2).replace('.', ',')} m²
              </text>
            );
          })}
          {preview &&
            (() => {
              const s = toScreen(preview.b);
              return (
                <g>
                  <rect x={s.x + 14} y={s.y - 34} width={86} height={26} rx={6} className="dim-bubble" />
                  <text x={s.x + 57} y={s.y - 16} className="dim-bubble-text">
                    {fmtCm(dist(preview.a, preview.b))}
                  </text>
                </g>
              );
            })()}
          {g?.kind === 'rect' &&
            (() => {
              const s = toScreen(g.end);
              return (
                <g>
                  <rect x={s.x + 14} y={s.y - 34} width={130} height={26} rx={6} className="dim-bubble" />
                  <text x={s.x + 79} y={s.y - 16} className="dim-bubble-text">
                    {Math.round(Math.abs(g.end.x - g.start.x))} × {Math.round(Math.abs(g.end.y - g.start.y))} cm
                  </text>
                </g>
              );
            })()}
        </g>
      </svg>
      {chain && tool === 'wall' && (
        <button className="chip chain-stop" onClick={() => setChain(null)}>
          Zakończ ścianę
        </button>
      )}
      <ScaleBar z={view.z} />
    </div>
  );
}

function clampZoom(z: number) {
  return Math.max(0.05, Math.min(12, z));
}

function ScaleBar({ z }: { z: number }) {
  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000];
  const cm = candidates.find((c) => c * z >= 60) ?? 2000;
  return (
    <div className="scalebar" aria-hidden>
      <div style={{ width: cm * z }} />
      <span>{cm >= 100 ? `${cm / 100} m` : `${cm} cm`}</span>
    </div>
  );
}
