// Poddasze z narożnikami dachu i koszami w 3D: płyty i folia jako wielokąty na każdej płaszczyźnie,
// odcinki rusztu, wieszaki, profile wzdłuż krokwi narożnych / koszowych, krokwie (kulawe, narożne,
// koszowe) i ścianki kolankowe – z tej samej siatki co zestawienie i rysunki.

import { boardById, ceilingSystemById, wallFrameDepth } from '../catalog/rigips';
import type { AtticGrid, AtticRoofGrid } from '../calc/attic';
import { atticToPlan } from '../calc/atticPlan';
import { faceOutlines, faceRafterSpans, faceToPlan, polyArea, sideTowardFace, zAt, type P2, type RoofFace } from '../calc/atticRoof';
import { roofBoardLayout } from '../calc/atticRoofBoards';
import { atticWindowGeometry, roofCdSegments, roofWindowHoles } from '../calc/atticWindows';
import { layerBoards } from '../calc/ceilingLevels';
import { ceilingVaporSpec, vaporBarrierOn } from '../calc/vaporBarrier';
import type { Attic, Point } from '../model/types';
import { atticRoofWallFaces } from '../calc/atticRoofWalls';
import { atticWallLayout } from '../calc/atticWalls';
import type { Layer3D, MatKey, Part3D } from './model3d';
import { profileFor, type WebSide } from './profiles';

type V3 = [number, number, number];
const CD_W = 0.06;
const UD_W = 0.028;
const ES_W = 0.07;
const VAPOR_T = 0.002;
const JETKA_H = 0.14;

export function buildAtticRoof(a: Attic, grid: AtticGrid & { roof: AtticRoofGrid }, parts: Part3D[], origin: Point) {
  const walls = atticRoofWallFaces(a, grid.roof).map(atticWallLayout);
  const sys = ceilingSystemById(a.systemId);
  const boards = layerBoards(sys, a.boardId).map((id) => ({ id, t: boardById(id).thickness / 1000 }));
  const tb = boards.reduce((t, b) => t + b.t, 0);
  const vapor = vaporBarrierOn(a.vaporBarrier, ceilingVaporSpec(sys));
  const depth = grid.depthMm / 1000;
  const timber = grid.profile.startsWith('LATA');
  const pH = grid.profileMm / 1000;
  const pW = timber ? (grid.profile === 'LATA5030' ? 0.05 : 0.06) : grid.profile === 'KAPELUSZ' ? 0.08 : CD_W;
  const carrier = grid.carrier;
  const between = grid.frame.mount === 'between';
  // ruszt krzyżowy: profile pod płyty to „montażowe”, nośne biegną pod krokwiami
  const pMat: MatKey = timber ? 'timber' : carrier ? 'cdSec' : 'cdMain';
  const cH = (carrier?.mm ?? 0) / 1000;
  const cW = carrier?.product === 'MFCP44' ? 0.03 : CD_W;
  // więźba widoczna: elementy wzdłuż krokwi z profilu przyściennego albo profilu rusztu
  const sMat: MatKey = grid.frame.edge ? 'ud' : pMat;
  const sW = grid.frame.edge ? UD_W : pW;
  const rw = a.rafterWidth / 100;
  const rh = a.rafterHeight / 100;
  const owner = a.id;

  /** Punkt rzutu poddasza (cm) na wysokości z (cm) → układ 3D (m), z położeniem na planie */
  const M = (p: P2, z: number): V3 => {
    const q = atticToPlan(a, origin, p.u, p.v);
    return [q.x / 100, z / 100, q.y / 100];
  };
  const sub = (x: V3, y: V3): V3 => [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
  const addv = (x: V3, y: V3, k = 1): V3 => [x[0] + y[0] * k, x[1] + y[1] * k, x[2] + y[2] * k];
  const unit = (x: V3): V3 => {
    const l = Math.hypot(...x) || 1;
    return [x[0] / l, x[1] / l, x[2] / l];
  };
  /** Normalna płaszczyzny ku krokwiom (w górę) w układzie 3D – różnica dwóch punktów znosi przesunięcie na planie */
  const normalOf = (fc: RoofFace): V3 => {
    const p0: P2 = { u: 0, v: 0 };
    return unit(sub(M({ u: -fc.plane.a * 100, v: -fc.plane.b * 100 }, 100), M(p0, 0)));
  };
  const on = (fc: RoofFace, p: P2, off: number): V3 => addv(M(p, zAt(fc.plane, p)), normalOf(fc), off);
  /** web – strona środnika CD względem `up`: 'a-' (połacie, up ku krokwiom) albo 'a+' (ściany, up ku płytom); null – bryła */
  const beam = (layer: Layer3D, mat: MatKey, x: V3, y: V3, up: V3, w: number, h: number, web: WebSide | null = 'a-') => {
    if (Math.hypot(...sub(y, x)) < 0.01) return;
    // CD z pełnym przekrojem (środnik od strony płyt); łaty, kapelusze, UD i wieszaki zostają bryłami
    // przekrój 60×27 – wyklucza kapelusze (8 cm), MFCP 44 i niskie profile okładzin na kapeluszach
    const cd = (mat === 'cdMain' || mat === 'cdSec') && Math.abs(w - CD_W) < 1e-6 && h > 0.02 && h < 0.03 && web !== null;
    const profile = cd ? profileFor(mat, 'along', web) : undefined;
    parts.push({ type: 'beam', layer, mat, a: x, b: y, up, w, h, owner, ...(profile ? { profile } : {}) });
  };

  // okna dachowe i rozkład płyt (ten sam co na rysunkach i liście zakupów)
  const wins = atticWindowGeometry(a, grid).list;
  const layout = roofBoardLayout(a, sys, grid, roofWindowHoles(wins, grid.roof));
  const onTS = (fc: RoofFace, t: number, s: number, off: number) => on(fc, faceToPlan(fc, t, s), off);

  for (const [fi, g] of grid.roof.faces.entries()) {
    const fc = g.face;
    const n = normalOf(fc);
    // obrys płaszczyzny w całości (bez styków wypukłych kawałków, które w 3D wyglądały jak załamania)
    const shapes = outlineShapes(fc);
    // płyty z rozkładu: warstwa 0 przy ruszcie, ostatnia = lico; elementy przycięte do połaci i otworów
    for (const l of layout.faces.find((x) => x.face === fi)?.layers ?? []) {
      const t = boards[l.layer]?.t ?? 0.0125;
      const h = boards.slice(l.layer + 1).reduce((v, b) => v + b.t, 0);
      for (const pc of l.pieces)
        for (const poly of pc.polys) parts.push({ type: 'face', layer: 'ceilingBoards', mat: `board:${l.boardId}`, pts: poly.map((q) => onTS(fc, q.t, q.s, h)), normal: n, thickness: t, owner });
    }
    // folia: więźba widoczna – tylko w polach między krokwiami
    if (vapor && g.boardPieces) for (const pc of g.boardPieces) parts.push({ type: 'face', layer: 'ceilingFrame', mat: 'vapor', pts: pc.map((p) => on(fc, p, tb)), normal: n, thickness: VAPOR_T, owner });
    else if (vapor) for (const sh of shapes) parts.push({ type: 'face', layer: 'ceilingFrame', mat: 'vapor', pts: sh.outer.map((p) => on(fc, p, tb)), holes: sh.holes.map((l) => l.map((p) => on(fc, p, tb))), normal: n, thickness: VAPOR_T, owner });
    for (const l of g.cd) {
      // linie przerwane oknami kończą się na obramowaniu otworu
      for (const [t0, t1] of roofCdSegments(l, fi, wins)) beam('ceilingFrame', pMat, onTS(fc, t0, l.s, tb + pH / 2), onTS(fc, t1, l.s, tb + pH / 2), n, pW, pH);
      if (grid.frame.hanger && !carrier) {
        const hh = Math.max(0.03, depth - tb + 0.04);
        for (const t of l.fix) {
          const p = faceToPlan(fc, t + a.rafterWidth / 2 + 0.2, l.s);
          const along = unit(sub(on(fc, faceToPlan(fc, t + 1, l.s), 0), on(fc, faceToPlan(fc, t, l.s), 0)));
          beam('ceilingFrame', 'hanger', on(fc, p, tb), on(fc, p, tb + hh), along, ES_W, 0.004);
        }
      }
    }
    // ruszt krzyżowy: profile nośne pod krokwiami kulawymi, nad profilami pod płyty; wieszaki na nośnych przy boku krokwi
    for (const c of g.carriers ?? []) {
      beam('ceilingFrame', 'cdMain', on(fc, faceToPlan(fc, c.t, c.s0), tb + pH + cH / 2), on(fc, faceToPlan(fc, c.t, c.s1), tb + pH + cH / 2), n, cW, cH);
      if (!grid.frame.hanger) continue;
      const hh = Math.max(0.03, depth - tb - pH + 0.04);
      const across = unit(sub(on(fc, faceToPlan(fc, c.t, c.s0 + 1), 0), on(fc, faceToPlan(fc, c.t, c.s0), 0)));
      for (const s of c.fix) {
        const p = faceToPlan(fc, c.t + a.rafterWidth / 2 + 0.2, s);
        beam('ceilingFrame', 'hanger', on(fc, p, tb + pH), on(fc, p, tb + pH + hh), across, ES_W, 0.004);
      }
    }
    // więźba widoczna: elementy wzdłuż boków krokwi
    for (const sd of g.sides ?? []) beam('ceilingFrame', sMat, on(fc, faceToPlan(fc, sd.t, sd.s0), tb + pH / 2), on(fc, faceToPlan(fc, sd.t, sd.s1), tb + pH / 2), n, sW, pH);
    // profil przyścienny na ścianach
    if (grid.frame.edge && !between)
      for (const e of fc.edges) if (e.kind === 'wall') beam('ceilingFrame', 'ud', on(fc, e.p, tb + pH / 2), on(fc, e.q, tb + pH / 2), n, UD_W, pH);
  }

  // okna dachowe: ościeżnica z szybą w płaszczyźnie krokwi, glify (dolny pionowo, górny poziomo, boczne), obramowanie
  const tR = boardById(a.boardId).thickness / 1000;
  const cross3 = (x: V3, y: V3): V3 => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  const quad = (pts: V3[], mat: MatKey, layer: Layer3D, t: number) => {
    const nn = unit(cross3(sub(pts[1], pts[0]), sub(pts[3], pts[0])));
    parts.push({ type: 'face', layer, mat, pts, normal: nn, thickness: t, owner });
  };
  for (const x of wins) {
    if (x.face === undefined) continue;
    const fc = grid.roof.faces[x.face].face;
    const n = normalOf(fc);
    const d = x.depth / 100;
    const [f0, f1] = x.sFrame;
    const wu0 = x.w.u - x.w.width / 2;
    const wu1 = x.w.u + x.w.width / 2;
    const P = (t: number, s: number, h: number) => onTS(fc, t, s, h);
    parts.push({ type: 'face', layer: 'existing', mat: 'timber', pts: [P(wu0, f0, d), P(wu1, f0, d), P(wu1, f1, d), P(wu0, f1, d)], normal: n, thickness: 0.1, owner });
    parts.push({ type: 'face', layer: 'existing', mat: 'glass', pts: [P(wu0 + 6, f0 + 6, d + 0.04), P(wu1 - 6, f0 + 6, d + 0.04), P(wu1 - 6, f1 - 6, d + 0.04), P(wu0 + 6, f1 - 6, d + 0.04)], normal: n, thickness: 0.01, owner });
    const mat: MatKey = `board:${a.boardId}`;
    // glif dolny (pionowo) i górny (poziomo): od krawędzi otworu na licu do ościeżnicy
    quad([P(x.u0, x.s0, 0), P(x.u1, x.s0, 0), P(x.u1, f0, d), P(x.u0, f0, d)], mat, 'ceilingBoards', tR);
    quad([P(x.u0, x.s1, 0), P(x.u1, x.s1, 0), P(x.u1, f1, d), P(x.u0, f1, d)], mat, 'ceilingBoards', tR);
    // glify boczne
    for (const t of [x.u0, x.u1]) quad([P(t, x.s0, 0), P(t, f0, d), P(t, f1, d), P(t, x.s1, 0)], mat, 'ceilingBoards', tR);
    // obramowanie otworu z profili rusztu
    for (const c of x.cross) beam('ceilingFrame', pMat, P(c.u0, c.s, tb + pH / 2), P(c.u1, c.s, tb + pH / 2), n, pW, pH);
    for (const sd of x.side) beam('ceilingFrame', pMat, P(sd.u, sd.s0, tb + pH / 2), P(sd.u, sd.s1, tb + pH / 2), n, pW, pH);
  }

  // profile wzdłuż krokwi narożnych i koszowych: odsunięte od linii w głąb płaszczyzny
  const faces = grid.roof.roof.faces;
  for (const lp of grid.roof.lineProfiles) {
    const fc = faces[lp.face];
    // strona linii po płaszczyźnie `fc` – środek ciężkości wklęsłej połaci (np. przy koszach) bywa po drugiej stronie
    const side = sideTowardFace(fc, lp.line.p, lp.line.q);
    // ruszt krzyżowy: profil nośny nad profilami pod płyty; więźba widoczna: element przy boku krokwi narożnej
    const w = between ? sW : carrier ? cW : pW;
    const k = (between ? rw / 2 + sW / 2 : w / 2 + 0.01) * 100;
    const p: P2 = { u: lp.line.p.u + side.u * k, v: lp.line.p.v + side.v * k };
    const q: P2 = { u: lp.line.q.u + side.u * k, v: lp.line.q.v + side.v * k };
    const off = carrier ? tb + pH + cH / 2 : tb + pH / 2;
    beam('ceilingFrame', between ? sMat : carrier ? 'cdMain' : pMat, on(fc, p, off), on(fc, q, off), normalOf(fc), w, carrier ? cH : pH);
    if (carrier && grid.frame.hanger) {
      const hh = Math.max(0.03, depth - tb - pH + 0.04);
      const ax = unit(sub(on(fc, q, 0), on(fc, p, 0)));
      for (const d of lp.fix) {
        const x = { u: p.u + ((q.u - p.u) * d) / lp.line.len, v: p.v + ((q.v - p.v) * d) / lp.line.len };
        beam('ceilingFrame', 'hanger', on(fc, x, tb + pH), on(fc, x, tb + pH + hh), ax, ES_W, 0.004);
      }
    }
  }

  // konstrukcja: krokwie (kulawe) i jętki na płaszczyznach spodu konstrukcji, krokwie narożne i koszowe
  const st = grid.roof.structure;
  for (const fc of st.faces) {
    const n = normalOf(fc);
    const collar = fc.kind === 'collar';
    for (const sp of faceRafterSpans(fc)) beam('rafters', 'timber', on(fc, faceToPlan(fc, sp.t, sp.s0), (collar ? JETKA_H : rh) / 2), on(fc, faceToPlan(fc, sp.t, sp.s1), (collar ? JETKA_H : rh) / 2), n, collar ? rw * 0.6 : rw, collar ? JETKA_H : rh);
  }
  for (const l of st.lines) {
    if (l.kind !== 'hip' && l.kind !== 'valley' && l.kind !== 'ridge') continue;
    const f0 = st.faces[l.faces[0]];
    const f1 = st.faces[l.faces[1]];
    const up = unit(addv(normalOf(f0), normalOf(f1)));
    const z0 = zAt(f0.plane, l.p);
    const z1 = zAt(f0.plane, l.q);
    beam('rafters', 'timber', addv(M(l.p, z0), up, rh / 2), addv(M(l.q, z1), up, rh / 2), up, rw * 1.2, rh * 1.15);
  }
  // okładziny ścianek kolankowych i ścian szczytowych (także przy dobudówkach): płyty docięte do skosu, profile pionowe
  for (const lay of walls) {
    const pl = lay.face.place;
    if (!pl) continue;
    const d = wallFrameDepth(lay.sys) / 1000;
    const sH = lay.sys.frame === 'hat-lining' ? 0.015 : 0.027;
    const lt = lay.layers.map((l) => boardById(l.boardId).thickness / 1000);
    const inward = unit(sub(M({ u: pl.inward.u * 100, v: pl.inward.v * 100 }, 0), M({ u: 0, v: 0 }, 0)));
    /** Punkt ściany (x wzdłuż, z w górę, cm) odsunięty o `off` m do wnętrza */
    const W = (x: number, z: number, off: number): V3 => addv(M({ u: pl.o.u + pl.dir.u * x, v: pl.o.v + pl.dir.v * x }, z), inward, off);
    for (const l of lay.layers) {
      const t = lt[l.layer];
      const off = d + lt.slice(0, l.layer).reduce((v, x) => v + x, 0);
      for (const pc of l.pieces) parts.push({ type: 'face', layer: 'wallBoards', mat: `board:${l.boardId}`, pts: pc.outline.map((q) => W(q.x, q.z, off)), normal: inward, thickness: t, owner });
    }
    for (const sd of lay.studs) beam('wallFrame', 'cdMain', W(sd.x, 0, d - sH / 2), W(sd.x, sd.len, d - sH / 2), inward, CD_W, sH, lay.sys.frame === 'hat-lining' ? null : 'a+');
    for (const [p, q] of lay.tracks) beam('wallFrame', 'ud', W(p.x, p.z, d - sH / 2), W(q.x, q.z, d - sH / 2), inward, UD_W, sH);
  }

  // mur pod krawędziami przy ścianach: ścianki kolankowe (krawędź pozioma) i ściany szczytowe (pod skosami
  // i sufitem pod jętkami) – ściany zamykają bryłę, w tym koniec dobudówki
  const wallT = 0.25;
  for (const fc of st.faces) {
    for (const e of fc.edges) {
      if (e.kind !== 'wall') continue;
      const zp = zAt(fc.plane, e.p);
      const zq = zAt(fc.plane, e.q);
      if (zp < 1 && zq < 1) continue;
      // na zewnątrz płaszczyzny
      const s = sideTowardFace(fc, e.p, e.q);
      const out: V3 = unit(sub(M({ u: e.p.u - s.u, v: e.p.v - s.v }, 0), M(e.p, 0)));
      parts.push({ type: 'face', layer: 'existing', mat: 'masonry', pts: [M(e.p, 0), M(e.q, 0), M(e.q, Math.max(0, zq)), M(e.p, Math.max(0, zp))], normal: out, thickness: wallT, owner });
    }
  }
}

/** Obrys płaszczyzny jako wielokąty z otworami (otwór przypisany do obrysu, w którym leży) */
function outlineShapes(fc: RoofFace): { outer: P2[]; holes: P2[][] }[] {
  const loops = faceOutlines(fc);
  const shapes = loops.filter((l) => polyArea(l) > 0).map((outer) => ({ outer, holes: [] as P2[][] }));
  const inside = (poly: P2[], p: P2) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.v > p.v !== b.v > p.v && p.u < ((b.u - a.u) * (p.v - a.v)) / (b.v - a.v) + a.u) c = !c;
    }
    return c;
  };
  for (const h of loops.filter((l) => polyArea(l) < 0)) {
    const mid = { u: (h[0].u + h[1].u) / 2, v: (h[0].v + h[1].v) / 2 };
    shapes.find((sh) => inside(sh.outer, mid))?.holes.push(h);
  }
  return shapes;
}
