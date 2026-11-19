import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bbox, dist, existingRooms, isNewWall, masonrySide, nodeMap, pointInPolygon, sameOutline, wallEnds } from '../geometry/geometry';
import { boardById } from '../catalog/rigips';
import { findRoomAt } from '../geometry/rooms';
import { createCeiling, createOpening } from '../model/factory';
import { addWalls, clipToMasonry, hitWall, mergeNodeIfOverlaps, offsetAlongWall, removeOverlaps, type SnapResult } from '../model/ops';
import { findOverlaps, uncoveredParts } from '../geometry/contacts';
import { anchorsOf, angleMarks, snapGuided, snapMove, type AngleMark, type Guide, type GuideSnap } from '../geometry/snap';
import type { Point, Project } from '../model/types';
import { awayFromFinger, BUBBLE_H, BUBBLE_W, type DimLabel, hitDimLabel } from './labelPlace';
import { fmtCm, liningThickness, wallColor, wallThickness } from './wallStyle';

export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'ceiling';

export type Selection =
  | { type: 'wall'; id: string; openingId?: string }
  | { type: 'walls'; ids: string[] }
  | { type: 'ceiling'; id: string }
  | null;

/** Id zaznaczonych ścian (jednej albo kilku) */
export const selectedWallIds = (s: Selection): string[] => (s?.type === 'wall' ? [s.id] : s?.type === 'walls' ? s.ids : []);

/** Dodaje albo odejmuje ścianę z zaznaczenia (zaznaczanie kilku ścian) */
export function toggleWall(s: Selection, id: string): Selection {
  const ids = selectedWallIds(s);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  if (!next.length) return null;
  return next.length === 1 ? { type: 'wall', id: next[0] } : { type: 'walls', ids: next };
}

type Snap = SnapResult & { guides: Guide[] };
const toSnap = (r: GuideSnap): Snap => ({ point: r.point, kind: r.kind === 'guide' ? 'angle' : r.kind, guides: r.guides });

interface Props {
  project: Project;
  update: (fn: (d: Project) => void, opts?: { transient?: boolean }) => void;
  commit: () => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  fitSignal: number;
  /** Polecenie powiększenia z przycisków (seq zmienia się przy każdym kliknięciu) */
  zoom?: { seq: number; factor: number };
  /** Wysokość (px) zasłonięta od dołu przez panel – plan przesuwa się, żeby zaznaczenie było widać */
  insetBottom?: number;
  /** Warstwa, do której trafiają rysowane ściany */
  layer?: 'existing' | 'new';
  /** Tryb zaznaczania kilku ścian: dotknięcie dodaje/odejmuje ścianę */
  multi?: boolean;
  onMessage: (m: string) => void;
  /** Dotknięcie opisu długości ściany – otwiera okno zmiany wymiaru */
  onEditLength?: (wallId: string) => void;
}

interface View {
  ox: number; // świat (cm) w lewym górnym rogu
  oy: number;
  z: number; // px na cm
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean; tapTarget: Selection; additive: boolean; dimWall?: string }
  | { kind: 'pinch'; d0: number; mid: Point; view: View }
  | { kind: 'draw'; start: Point; end: Point; startScreen: Point; moved: boolean; snap: Snap; down: Point }
  | { kind: 'rect'; start: Point; end: Point; startScreen: Point; moved: boolean; mode: 'room' | 'ceiling'; guides: Guide[] }
  | { kind: 'node'; id: string; moved: boolean; guides: Guide[] }
  | {
      kind: 'move';
      /** położenie węzłów przed przesunięciem */
      orig: Map<string, Point>;
      grab: Point;
      startScreen: Point;
      moved: boolean;
      guides: Guide[];
      tapTarget: string;
      additive: boolean;
    }
  | { kind: 'vertex'; ceilingId: string; index: number; moved: boolean }
  | { kind: 'opening'; wallId: string; openingId: string; grab: number; moved: boolean };

const HANDLE_PX = 16;
const DRAG_PX = 7;

export function PlanCanvas(props: Props) {
  const { project, update, commit, tool, selection, setSelection, fitSignal, zoom, onMessage, insetBottom = 0, layer = 'new', multi = false, onEditLength } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ ox: -100, oy: -100, z: 1.2 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);
  const [chain, setChain] = useState<Point | null>(null);
  const [hover, setHover] = useState<Snap | null>(null);
  const selIds = selectedWallIds(selection);

  const nodes = useMemo(() => nodeMap(project), [project]);
  // strona pomieszczenia dla ścian obrysu
  const interiors = useMemo(() => {
    const rooms = existingRooms(project);
    return new Map(project.walls.filter((w) => !isNewWall(w)).map((w) => [w.id, masonrySide(project, w, rooms)]));
  }, [project]);
  // węzły, w których spotykają się co najmniej dwie istniejące ściany
  const cornerNodes = useMemo(() => {
    const c = new Map<string, number>();
    for (const w of project.walls) if (!isNewWall(w)) for (const n of [w.a, w.b]) c.set(n, (c.get(n) ?? 0) + 1);
    return new Set([...c].filter(([, k]) => k > 1).map(([n]) => n));
  }, [project]);

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
    // miejsce na pasek narzędzi u góry i panel/podsumowanie u dołu
    const padX = 70;
    const padTop = 90;
    const padBottom = 80 + insetBottom;
    const z = Math.min(
      (w - padX * 2) / Math.max(b.maxX - b.minX, 100),
      (h - padTop - padBottom) / Math.max(b.maxY - b.minY, 100),
      6,
    );
    const cyScreen = padTop + (h - padTop - padBottom) / 2;
    setView({ ox: (b.minX + b.maxX) / 2 - w / z / 2, oy: (b.minY + b.maxY) / 2 - cyScreen / z, z });
  }, [project, size, insetBottom]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  // pierwsze dopasowanie dopiero, gdy znamy prawdziwy rozmiar obszaru rysowania
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || size.w === 800) return;
    fitted.current = true;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // zaznaczony element nie może chować się pod panelem na dole
  useEffect(() => {
    if (!selection) return;
    let target: Point | null = null;
    if (selection.type === 'walls') return;
    if (selection.type === 'wall') {
      const w = project.walls.find((x) => x.id === selection.id);
      if (!w) return;
      const [a, b] = wallEnds(project, w, nodes);
      const op = w.openings.find((o) => o.id === selection.openingId);
      const L = dist(a, b) || 1;
      const t = op ? (op.offset + op.width / 2) / L : 0.5;
      target = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    } else {
      const c = project.ceilings.find((x) => x.id === selection.id);
      if (!c) return;
      const bb = bbox(c.points);
      target = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
    }
    const sy = (target.y - view.oy) * view.z;
    const visibleBottom = size.h - insetBottom - 30;
    const TOP = 130; // pasek narzędzi i przełącznik warstwy
    if (sy > visibleBottom || sy < TOP) {
      const wanted = TOP + Math.max(0, size.h - insetBottom - TOP) / 2;
      setView((v) => ({ ...v, oy: target!.y - wanted / v.z }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type, selection?.type === 'walls' ? '' : selection?.id, selection?.type === 'wall' ? selection.openingId : undefined, insetBottom]);

  useEffect(() => {
    if (!zoom?.seq) return;
    setView((v) => {
      const z = clampZoom(v.z * zoom.factor);
      const cx = v.ox + size.w / 2 / v.z;
      const cy = v.oy + size.h / 2 / v.z;
      return { z, ox: cx - size.w / 2 / z, oy: cy - size.h / 2 / z };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom?.seq]);

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

  /** Opisy długości ścian w pikselach ekranu (te same pozycje służą do rysowania i do trafiania palcem) */
  const dimLabels = (): DimLabel[] => {
    const out: DimLabel[] = [];
    for (const w of project.walls) {
      const a = nodes.get(w.a);
      const b = nodes.get(w.b);
      if (!a || !b) continue;
      const L = dist(a, b);
      if (L * view.z < 40) continue;
      const sa = toScreen(a);
      const sb = toScreen(b);
      let ang = (Math.atan2(sb.y - sa.y, sb.x - sa.x) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const nx = -(sb.y - sa.y) / (L * view.z);
      const ny = (sb.x - sa.x) / (L * view.z);
      // ściana obrysu: wymiar lica po stronie pomieszczenia
      const inner = isNewWall(w) ? 0 : (interiors.get(w.id) ?? 0);
      const k = inner ? inner : -1;
      const off = inner ? 14 : (wallThickness(w) * view.z) / 2 + 12;
      out.push({ id: w.id, x: (sa.x + sb.x) / 2 + k * nx * off, y: (sa.y + sb.y) / 2 + k * ny * off, ang, L });
    }
    return out;
  };
  const local = (e: React.PointerEvent | React.WheelEvent): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tolCm = HANDLE_PX / view.z;
  const grid = project.settings.gridSnap;
  /** węzeł leżący w punkcie (do kątów względem ścian w punkcie startu) */
  const nodeIdAt = (pt: Point) => project.nodes.find((n) => dist(n, pt) < 0.5)?.id;
  /** przyciąganie końca rysowanej ściany: węzły, osie, piony/poziomy innych węzłów, kąt od startu */
  const snapDraw = (pt: Point, from?: Point) =>
    toSnap(snapGuided(project, pt, tolCm, { anchors: from ? [{ at: from, nodeId: nodeIdAt(from) }] : [], grid }));

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
    svgRef.current?.setPointerCapture?.(e.pointerId);
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
      gesture.current = { kind: 'pan', sx: s.x, sy: s.y, ox: view.ox, oy: view.oy, moved: false, tapTarget: selection, additive: false };
      return;
    }
    const additive = multi || e.shiftKey || e.ctrlKey || e.metaKey;
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
      // dotknięcie opisu długości ściany → okno zmiany wymiaru (po puszczeniu bez przesunięcia)
      const dim = !additive && onEditLength ? hitDimLabel(s, dimLabels()) : null;
      if (dim) {
        gesture.current = { kind: 'pan', sx: s.x, sy: s.y, ox: view.ox, oy: view.oy, moved: false, tapTarget: { type: 'wall', id: dim }, additive: false, dimWall: dim };
        return;
      }
      const n = hitNode(w);
      if (n && !additive) {
        gesture.current = { kind: 'node', id: n.id, moved: false, guides: [] };
        return;
      }
      const ho = hitOpening(w);
      if (ho) {
        setSelection({ type: 'wall', id: ho.wall.id, openingId: ho.op.id });
        gesture.current = { kind: 'opening', wallId: ho.wall.id, openingId: ho.op.id, grab: ho.along - ho.op.offset, moved: false };
        return;
      }
      const hw = hitWall(project, w, Math.max(tolCm, 12));
      // przeciągnięcie zaznaczonej ściany przesuwa ją (razem z pozostałymi zaznaczonymi)
      if (hw && selIds.includes(hw.id)) {
        const ids = new Set(project.walls.filter((x) => selIds.includes(x.id)).flatMap((x) => [x.a, x.b]));
        const orig = new Map(project.nodes.filter((x) => ids.has(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
        gesture.current = { kind: 'move', orig, grab: w, startScreen: s, moved: false, guides: [], tapTarget: hw.id, additive };
        return;
      }
      const hc = hw || additive ? null : hitCeiling(w);
      const tapTarget: Selection = hw ? { type: 'wall', id: hw.id } : hc ? { type: 'ceiling', id: hc.id } : null;
      gesture.current = { kind: 'pan', sx: s.x, sy: s.y, ox: view.ox, oy: view.oy, moved: false, tapTarget, additive };
      return;
    }

    if (tool === 'wall') {
      const snap = snapDraw(w, chain ?? undefined);
      gesture.current = { kind: 'draw', start: chain ?? snap.point, end: snap.point, startScreen: s, moved: false, snap, down: snap.point };
      rerender();
      return;
    }
    if (tool === 'room' || tool === 'ceiling') {
      const snap = snapDraw(w);
      gesture.current = { kind: 'rect', start: snap.point, end: snap.point, startScreen: s, moved: false, mode: tool, guides: snap.guides };
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
      if (tool === 'wall' && e.pointerType === 'mouse') setHover(snapDraw(w, chain ?? undefined));
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
      if (!g.moved && dist(s, g.startScreen) > DRAG_PX) {
        g.moved = true;
        // przeciągnięcie daleko od końca łańcucha zaczyna nową ścianę w miejscu dotknięcia
        if (chain && dist(g.down, chain) > tolCm * 2) g.start = g.down;
      }
      g.snap = snapDraw(w, g.start);
      if (layer === 'new') {
        // nowa ściana zatrzymuje się na licu istniejącego muru
        const c = clipToMasonry(project, g.start, g.snap.point);
        if (c.clipped) g.snap = { point: c.point, kind: 'wall', guides: [] };
      }
      g.end = g.snap.point;
      rerender();
      return;
    }
    if (g.kind === 'rect') {
      if (dist(s, g.startScreen) > DRAG_PX) g.moved = true;
      const sn = snapDraw(w);
      g.end = sn.point;
      g.guides = sn.guides;
      rerender();
      return;
    }
    if (g.kind === 'node') {
      g.moved = true;
      const moved = new Set([g.id]);
      const sp = snapGuided(project, w, tolCm, { anchors: anchorsOf(project, g.id, moved), moved, grid });
      g.guides = sp.guides;
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
      const sp = snapDraw(w);
      update(
        (d) => {
          const c = d.ceilings.find((x) => x.id === g.ceilingId);
          if (c) c.points[g.index] = sp.point;
        },
        { transient: true },
      );
      return;
    }
    if (g.kind === 'move') {
      if (!g.moved && dist(s, g.startScreen) <= DRAG_PX) return;
      g.moved = true;
      const sm = snapMove(project, new Set(g.orig.keys()), { x: w.x - g.grab.x, y: w.y - g.grab.y }, tolCm, grid);
      g.guides = sm.guides;
      update(
        (d) => {
          for (const n of d.nodes) {
            const o = g.orig.get(n.id);
            if (!o) continue;
            n.x = Math.round((o.x + sm.delta.x) * 10) / 10;
            n.y = Math.round((o.y + sm.delta.y) * 10) / 10;
          }
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
      if (!g.moved && tool === 'select') {
        if (g.additive) {
          if (g.tapTarget?.type === 'wall') setSelection(toggleWall(selection, g.tapTarget.id));
        } else setSelection(g.tapTarget);
        if (g.dimWall) onEditLength?.(g.dimWall);
      }
    } else if (g.kind === 'move') {
      if (g.moved) {
        const ids = [...g.orig.keys()];
        update(
          (d) => {
            for (const id of ids) mergeNodeIfOverlaps(d, id);
            // ściana przesunięta na inną: wspólny odcinek zostaje tylko raz
            removeOverlaps(d);
          },
          { transient: true },
        );
        commit();
        if (findOverlaps(project).length) onMessage('Pominięto odcinki ścian nałożone na istniejące');
      } else if (g.additive) setSelection(toggleWall(selection, g.tapTarget));
      else setSelection({ type: 'wall', id: g.tapTarget });
    } else if (g.kind === 'draw') {
      if (g.moved || chain) {
        const from = g.start;
        const to = g.end;
        if (dist(from, to) >= 10) {
          // odcinki, na których stoi już ściana tej samej warstwy, są pomijane
          if (!uncoveredParts(project, from, to, layer).length) onMessage('Ta ściana już tu jest – pominięto');
          update((d) => void addWalls(d, from, to, layer === 'existing' ? { kind: 'existing' } : {}));
          // ściana zamknęła się na istniejącym węźle → koniec łańcucha
          const closed = project.nodes.some((n) => dist(n, to) < 1);
          setChain(closed && chain ? null : to);
          // nowej ściany nie zaznaczamy – panel nie zasłania rysowania kolejnych ścian
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
          // drugi dotyk w tym samym pomieszczeniu nie dokłada drugiego sufitu (niewidoczny duplikat
          // zostawał w 3D i w ilościach po usunięciu pierwszego)
          const same = project.ceilings.find((c) => sameOutline(c.points, room));
          if (same) {
            setSelection({ type: 'ceiling', id: same.id });
            onMessage('W tym pomieszczeniu jest już sufit');
          } else {
            const c = createCeiling(project, room);
            update((d) => void d.ceilings.push(structuredClone(c)));
            setSelection({ type: 'ceiling', id: c.id });
            onMessage('Dodano sufit w obrysie pomieszczenia');
          }
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
          const same = project.ceilings.find((c) => sameOutline(c.points, pts));
          if (same) setSelection({ type: 'ceiling', id: same.id });
          else {
            const c = createCeiling(project, pts);
            update((d) => void d.ceilings.push(structuredClone(c)));
            setSelection({ type: 'ceiling', id: c.id });
          }
        } else {
          // pokój narysowany po ścianach innego pokoju dostaje tylko brakujące ściany
          const full = pts.filter((pt, i) => {
            const parts = uncoveredParts(project, pt, pts[(i + 1) % 4], layer);
            return parts.length === 1 && dist(...parts[0]) >= dist(pt, pts[(i + 1) % 4]) - 1;
          }).length;
          if (full < 4) onMessage(full ? 'Pominięto ściany, które już tu są' : 'Te ściany już tu są – pominięto');
          update((d) => {
            pts.forEach((pt, i) => addWalls(d, pt, pts[(i + 1) % 4], layer === 'existing' ? { kind: 'existing' } : {}));
          });
          setSelection(null);
        }
      }
    } else if (g.kind === 'node') {
      if (g.moved) {
        update(
          (d) => {
            mergeNodeIfOverlaps(d, g.id);
            // ściana przesunięta na inną: wspólny odcinek zostaje tylko raz
            removeOverlaps(d);
          },
          { transient: true },
        );
        commit();
        if (findOverlaps(project).length) onMessage('Pominięto odcinki ścian nałożone na istniejące');
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
    if (!g && chain && hover && tool === 'wall')
      return { a: chain, b: layer === 'new' ? clipToMasonry(project, chain, hover.point).point : hover.point };
    return null;
  })();
  const snapMark = g?.kind === 'draw' ? g.snap : !g && tool === 'wall' ? hover : null;

  const selectedWall = selection?.type === 'wall' ? project.walls.find((w) => w.id === selection.id) : undefined;

  // linie pomocnicze i kąty bieżącego gestu
  const guides: Guide[] =
    g?.kind === 'draw' || (g?.kind === 'rect' && g.moved)
      ? g.kind === 'draw'
        ? g.moved || chain
          ? g.snap.guides
          : []
        : g.guides
      : (g?.kind === 'node' || g?.kind === 'move') && g.moved
        ? g.guides
        : !g && tool === 'wall' && hover
          ? hover.guides
          : [];
  const angles: AngleMark[] = (() => {
    if (g?.kind === 'node' && g.moved) return angleMarks(project, [g.id, ...anchorsOf(project, g.id, new Set([g.id])).map((a) => a.nodeId!)]);
    if (g?.kind === 'move' && g.moved) {
      const ids = new Set(g.orig.keys());
      const near = project.walls.filter((w) => ids.has(w.a) || ids.has(w.b)).flatMap((w) => [w.a, w.b]);
      return angleMarks(project, new Set(near));
    }
    if (preview) return angleMarks(project, [], [{ nodeId: nodeIdAt(preview.a), at: preview.a, to: preview.b }]);
    return [];
  })();
  const far = (2 * (size.w + size.h)) / view.z;

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
            const a0 = nodes.get(w.a);
            const b0 = nodes.get(w.b);
            if (!a0 || !b0) return null;
            const L = dist(a0, b0);
            const t = wallThickness(w);
            const sel = selIds.includes(w.id);
            const ux = (b0.x - a0.x) / (L || 1);
            const uy = (b0.y - a0.y) / (L || 1);
            const nx = -uy;
            const ny = ux;
            const existing = !isNewWall(w);
            const inner = existing ? (interiors.get(w.id) ?? 0) : 0;
            // istniejąca ściana: linia to lico od strony pomieszczenia, mur rysujemy na zewnątrz
            const off = existing ? -inner * (t / 2) : 0;
            // narożnik obrysu: mur przedłużony, żeby domknąć zewnętrzny róg
            const ext = (nid: string) => (existing && inner && cornerNodes.has(nid) ? t / 2 : 0);
            const ea = ext(w.a);
            const eb = ext(w.b);
            const a = { x: a0.x + nx * off - ux * ea, y: a0.y + ny * off - uy * ea };
            const b = { x: b0.x + nx * off + ux * eb, y: b0.y + ny * off + uy * eb };
            const faded = (tool === 'wall' || tool === 'room') && existing !== (layer === 'existing');
            const sorted = [...w.openings].sort((m, n) => m.offset - n.offset);
            return (
              <g key={w.id} className={`${existing ? 'existing' : ''} ${faded ? 'faded' : ''}`}>
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
                  className="wall-edge"
                  strokeWidth={Math.max(t, 3 / view.z) + 2.5 / view.z}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={existing ? undefined : wallColor(w)}
                  className={existing ? 'wall masonry' : 'wall'}
                  strokeWidth={Math.max(t, 3 / view.z)}
                />
                {!existing && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="wall-axis" strokeWidth={1 / view.z} />}
                {(w.linings ?? []).map((l) => {
                  const lt = liningThickness(l);
                  const lo = off + l.side * (t / 2 + lt / 2);
                  // okładzina przerwana w otworach
                  const segs: [number, number][] = [];
                  let cur = 0;
                  for (const o of sorted) {
                    if (o.offset > cur) segs.push([cur, o.offset]);
                    cur = Math.max(cur, o.offset + o.width);
                  }
                  if (cur < L) segs.push([cur, L]);
                  return segs.map(([s0, s1], i) => [
                    <line
                      key={`${l.side}-${i}-e`}
                      x1={a0.x + ux * s0 + nx * lo}
                      y1={a0.y + uy * s0 + ny * lo}
                      x2={a0.x + ux * s1 + nx * lo}
                      y2={a0.y + uy * s1 + ny * lo}
                      className="lining-edge"
                      strokeWidth={Math.max(lt, 2.5 / view.z) + 2 / view.z}
                    />,
                    <line
                      key={`${l.side}-${i}`}
                      x1={a0.x + ux * s0 + nx * lo}
                      y1={a0.y + uy * s0 + ny * lo}
                      x2={a0.x + ux * s1 + nx * lo}
                      y2={a0.y + uy * s1 + ny * lo}
                      stroke={boardById(l.boardId).color}
                      className="lining"
                      strokeWidth={Math.max(lt, 2.5 / view.z)}
                    />,
                  ]);
                })}
                {w.openings.map((o) => {
                  const p0 = { x: a.x + ux * (o.offset + ea), y: a.y + uy * (o.offset + ea) };
                  const p1 = { x: a.x + ux * (o.offset + ea + o.width), y: a.y + uy * (o.offset + ea + o.width) };
                  const opSel = sel && selection?.type === 'wall' && selection.openingId === o.id;
                  // drzwi w murze otwierają się do pomieszczenia
                  const sg = existing && inner ? inner : 1;
                  const f0 = { x: a0.x + ux * o.offset, y: a0.y + uy * o.offset };
                  const f1 = { x: a0.x + ux * (o.offset + o.width), y: a0.y + uy * (o.offset + o.width) };
                  const d0 = existing ? f0 : p0;
                  const d1 = existing ? f1 : p1;
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
                          d={`M ${d0.x} ${d0.y} L ${d0.x + nx * sg * o.width} ${d0.y + ny * sg * o.width} A ${o.width} ${o.width} 0 0 ${sg > 0 ? 0 : 1} ${d1.x} ${d1.y}`}
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
          {guides.map((gd, i) => (
            <line
              key={`guide-${i}`}
              x1={gd.at.x - gd.dir.x * far}
              y1={gd.at.y - gd.dir.y * far}
              x2={gd.at.x + gd.dir.x * far}
              y2={gd.at.y + gd.dir.y * far}
              className={`guide guide-${gd.kind}`}
              strokeWidth={1.2 / view.z}
              strokeDasharray={`${6 / view.z} ${5 / view.z}`}
            />
          ))}
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
          {dimLabels().map((d) => (
            <text key={d.id} x={d.x} y={d.y} transform={`rotate(${d.ang} ${d.x} ${d.y})`} className="dim">
              {fmtCm(d.L)}
            </text>
          ))}
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
          {angles.map((m, i) => {
            const c = toScreen(m.at);
            const r = 20;
            const p0 = { x: c.x + Math.cos(m.from) * r, y: c.y + Math.sin(m.from) * r };
            const p1 = { x: c.x + Math.cos(m.to) * r, y: c.y + Math.sin(m.to) * r };
            const mid = (m.from + m.to) / 2;
            const right = Math.abs(m.deg - 90) < 0.5;
            const t = { x: c.x + Math.cos(mid) * 38, y: c.y + Math.sin(mid) * 38 };
            return (
              <g key={`ang-${i}`} className={`angle-mark ${right ? 'right' : ''}`}>
                {right ? (
                  <path
                    d={`M ${c.x + Math.cos(m.from) * 12} ${c.y + Math.sin(m.from) * 12} L ${c.x + Math.cos(m.from) * 12 + Math.cos(m.to) * 12} ${c.y + Math.sin(m.from) * 12 + Math.sin(m.to) * 12} L ${c.x + Math.cos(m.to) * 12} ${c.y + Math.sin(m.to) * 12}`}
                  />
                ) : (
                  <path d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${m.deg > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`} />
                )}
                <text x={t.x} y={t.y + 4}>
                  {fmtDeg(m.deg)}
                </text>
              </g>
            );
          })}
          {selectedWall &&
            (['a', 'b'] as const).map((k) => {
              const n = nodes.get(selectedWall[k]);
              if (!n) return null;
              const sp = toScreen(n);
              return (
                <g key={k} className="end-tag">
                  <circle cx={sp.x} cy={sp.y - 22} r={10} />
                  <text x={sp.x} y={sp.y - 18}>
                    {k.toUpperCase()}
                  </text>
                </g>
              );
            })}
          {preview &&
            (() => {
              const fa = toScreen(preview.a);
              const fb = toScreen(preview.b);
              // środek odcinka, odsunięty w bok – palec jest na końcu B
              const len = Math.hypot(fb.x - fa.x, fb.y - fa.y) || 1;
              let nx = -(fb.y - fa.y) / len;
              let ny = (fb.x - fa.x) / len;
              if (ny > 0) {
                nx = -nx;
                ny = -ny;
              }
              const target = { x: (fa.x + fb.x) / 2 + nx * 30, y: (fa.y + fb.y) / 2 + ny * 30 };
              return <DimBubble at={awayFromFinger(fb, target, fa, size, insetBottom)} text={fmtCm(dist(preview.a, preview.b))} />;
            })()}
          {g?.kind === 'rect' &&
            (() => {
              const fs = toScreen(g.start);
              const fe = toScreen(g.end);
              const midX = (fs.x + fe.x) / 2;
              const midY = (fs.y + fe.y) / 2;
              // wymiary przy krawędziach po stronie punktu początkowego, z dala od palca
              const sy = fs.y + (fs.y <= fe.y ? -22 : 22);
              const sx = fs.x + (fs.x <= fe.x ? -50 : 50);
              const wTxt = `${Math.round(Math.abs(g.end.x - g.start.x))} cm`;
              const hTxt = `${Math.round(Math.abs(g.end.y - g.start.y))} cm`;
              return (
                <>
                  <DimBubble at={awayFromFinger(fe, { x: midX, y: sy }, fs, size, insetBottom)} text={wTxt} />
                  <DimBubble at={awayFromFinger(fe, { x: sx, y: midY }, fs, size, insetBottom)} text={hTxt} />
                </>
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

function DimBubble({ at, text }: { at: Point; text: string }) {
  return (
    <g>
      <rect x={at.x - BUBBLE_W / 2} y={at.y - BUBBLE_H / 2} width={BUBBLE_W} height={BUBBLE_H} rx={6} className="dim-bubble" />
      <text x={at.x} y={at.y + 5} className="dim-bubble-text">
        {text}
      </text>
    </g>
  );
}

const fmtDeg = (d: number) => `${Math.abs(d - Math.round(d)) < 0.05 ? Math.round(d) : d.toFixed(1).replace('.', ',')}°`;

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

