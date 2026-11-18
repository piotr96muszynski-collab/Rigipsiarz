// Połączenia ścian (L, T, X, z murem, ze stropem), styki sufitów i krawędzie otworów.
//
// Każde połączenie jest jawnie przeliczane: elementy rusztu wynikające z detali Rigips
// (łączenie słupków, wkręty przez płytę, taśma uszczelniająca, pasek płyty na wolnym
// końcu) oraz wykończenie krawędzi wybranym typem narożnika lub styku.
// Dodatkowe słupki CW w narożnikach i trójnikach dolicza ściana (wallRequirement),
// tutaj są tylko opisane, żeby było widać, skąd się biorą.

import { boardById, wallSystemById, type WallSystem } from '../catalog/rigips';
import {
  ACRYLIC_M_PER_TUBE,
  compoundById,
  cornerTypeById,
  resolveFinishing,
  tapeById,
  type CornerType,
  type EdgeUse,
  type FinishingSettings,
} from '../catalog/finishing';
import { dist, nodeMap, polygonPerimeterEdges, projectOnSegment, wallEnds } from '../geometry/geometry';
import type { Id, Project, Wall } from '../model/types';
import { pickBoardLength, screwFor, type Requirement } from './materials';

export type JointKind = 'L' | 'T' | 'X' | 'masonry' | 'free' | 'slab' | 'ceiling' | 'opening';

export const JOINT_KIND_LABEL: Record<JointKind, string> = {
  L: 'Narożnik L',
  T: 'Trójnik T',
  X: 'Skrzyżowanie X',
  masonry: 'Styk z istniejącą ścianą',
  free: 'Wolny koniec ściany',
  slab: 'Styk ze stropem',
  ceiling: 'Styk sufitu ze ścianami',
  opening: 'Krawędzie otworu',
};

export interface JointEdges {
  /** Rola krawędzi – decyduje o liście dostępnych wykończeń */
  use: EdgeUse;
  /** Długości poszczególnych krawędzi, m */
  lengths: number[];
  /** Kąt inny niż 90° (±5°) */
  odd: boolean;
  /** Wykończenie po uwzględnieniu wyboru użytkownika */
  type: CornerType;
  /** Czy to wartość domyślna z ustawień projektu */
  isDefault: boolean;
}

export interface Joint {
  id: string;
  kind: JointKind;
  wallIds: Id[];
  ceilingId?: Id;
  /** Kąt między ścianami w narożniku, ° */
  angleDeg?: number;
  /** Krawędzie zewnętrzne (narożniki ochronne) */
  outer?: JointEdges;
  /** Kąty wewnętrzne i styki z murem / stropem */
  inner?: JointEdges;
  /** Co dolicza ruszt w tym połączeniu (opis) */
  frame: string[];
  warnings: string[];
  req: Requirement;
}

const emptyReq = (): Requirement => ({ pieces: {}, boardArea: {}, counts: {}, meters: {}, kg: {}, area: {} });
const add = (rec: Record<string, number>, key: string, v: number) => {
  if (v > 0) rec[key] = (rec[key] ?? 0) + v;
};

const TAPE_FOR_PROFILE: Record<number, string> = { 50: 'TASMA_USZ50', 75: 'TASMA_USZ70', 100: 'TASMA_USZ95' };

/** Rozstaw wkrętów łączących słupki w narożniku (LN 3,5×9), m */
const STUD_LINK_SPACING = 0.75;
/** Rozstaw wkrętów mocujących słupek dochodzącej ściany przez płytę do słupka ściany ciągłej, m */
const THROUGH_SCREW_SPACING = 0.5;
/** Rozstaw wkrętów w pasku płyty na wolnym końcu, m */
const STRIP_SCREW_SPACING = 0.25;

const hasCavityFrame = (sys: WallSystem) => sys.frame === 'single' || sys.frame === 'double' || sys.frame === 'separate';

/** Grubość ściany, mm (ruszt + płyty) */
export function wallThicknessMm(sys: WallSystem, boardId: string): number {
  const t = boardById(boardId).thickness;
  const core =
    sys.frame === 'single'
      ? sys.profile
      : sys.frame === 'double'
        ? 2 * sys.profile + 5
        : sys.frame === 'separate'
          ? 2 * sys.profile + (sys.gap ?? 10) * 10
          : sys.frame === 'cd-lining'
            ? 27
            : 10;
  return core + sys.sides * sys.layers * t;
}

const fmt = (m: number) => m.toFixed(2).replace('.', ',');

function angleAt(center: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

const isOdd = (deg: number) => Math.abs(deg - 90) > 5;

/** Domyślne wykończenie dla roli krawędzi */
export function defaultTypeId(f: FinishingSettings, kind: JointKind, use: EdgeUse, odd: boolean): string {
  if (kind === 'opening') return f.opening;
  if (kind === 'masonry') return f.masonry;
  if (kind === 'slab') return f.slab;
  if (kind === 'ceiling') return f.ceilingEdge;
  if (use === 'external') return odd ? f.externalOdd : f.external;
  return odd ? f.internalOdd : f.internal;
}

/** Materiały wykończenia krawędzi wybranym typem */
export function addEdgeFinish(req: Requirement, type: CornerType, lengths: number[], f: FinishingSettings) {
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total <= 0 || type.id === 'none') return;
  if (type.product) {
    if (type.measure === 'bar') for (const l of lengths) if (l > 0.01) (req.pieces[type.product] ??= []).push(l);
    if (type.measure === 'meter') add(req.meters, type.product, total);
    if (type.measure === 'tube') add(req.counts, type.product, total / ACRYLIC_M_PER_TUBE);
  }
  if (type.tapePerM) add(req.meters, tapeById(f.tape).product, total * type.tapePerM);
  add(req.kg, compoundById(f.compound).product, total * type.kgPerM);
}

/**
 * Lista wszystkich połączeń w projekcie z przeliczonymi materiałami.
 * Id połączenia: `n:<węzeł>` (L, T, X), `e:<ściana>:a|b` (koniec ściany),
 * `top:<ściana>` (strop), `ceil:<sufit>`, `op:<otwór>`.
 */
export function analyzeJoints(p: Project): Joint[] {
  const f = resolveFinishing(p.settings.finishing);
  const nodes = nodeMap(p);
  const walls = p.walls.filter((w) => nodes.has(w.a) && nodes.has(w.b));
  const out: Joint[] = [];

  const byNode = new Map<Id, Wall[]>();
  for (const w of walls) for (const nid of [w.a, w.b]) byNode.set(nid, [...(byNode.get(nid) ?? []), w]);

  const edges = (j: Pick<Joint, 'id' | 'kind'>, which: 'outer' | 'inner', use: EdgeUse, lengths: number[], odd: boolean): JointEdges => {
    const chosen = cornerTypeById(p.jointFinish?.[j.id]?.[which]);
    const valid = chosen && chosen.uses.includes(use) ? chosen : undefined;
    const type = valid ?? cornerTypeById(defaultTypeId(f, j.kind, use, odd))!;
    return { use, lengths, odd, type, isDefault: !valid };
  };

  const finish = (j: Joint) => {
    for (const e of [j.outer, j.inner]) {
      if (!e || !e.lengths.length) continue;
      addEdgeFinish(j.req, e.type, e.lengths, f);
      if (e.odd && !e.type.anyAngle && e.type.id !== 'none')
        j.warnings.push(`${e.type.name} jest do kątów prostych – przy ${Math.round(j.angleDeg ?? 0)}° wybierz narożnik do kątów dowolnych.`);
    }
    out.push(j);
  };

  const newJoint = (id: string, kind: JointKind, wallIds: Id[]): Joint => ({ id, kind, wallIds, frame: [], warnings: [], req: emptyReq() });
  const sysOf = (w: Wall) => wallSystemById(w.systemId);

  /** Słupek dochodzącej ściany przykręcony przez płytę do słupka ściany ciągłej (detal T) */
  const abutFrame = (j: Joint, through: Wall, abut: Wall, H: number) => {
    const ts = sysOf(through);
    const as = sysOf(abut);
    if (!hasCavityFrame(as)) return;
    const stack = boardById(through.boardId).thickness * ts.layers;
    const screw = screwFor(stack);
    const n = Math.ceil(H / THROUGH_SCREW_SPACING - 1e-9) + 1;
    add(j.req.counts, screw, n);
    const tape = TAPE_FOR_PROFILE[as.profile];
    if (tape) add(j.req.meters, tape, H);
    j.frame.push(
      `słupek CW ${as.profile} ściany dochodzącej przykręcony przez płytę do słupka ściany ciągłej: ${n} × ${screw.replace('TN', 'TN 3,5×')} co ${THROUGH_SCREW_SPACING * 100} cm, taśma uszczelniająca ${fmt(H)} mb`,
    );
  };

  for (const [nid, list] of byNode) {
    const node = nodes.get(nid)!;
    const hosts = walls.filter((o) => {
      if (o.a === nid || o.b === nid) return false;
      const [oa, ob] = wallEnds(p, o, nodes);
      const pr = projectOnSegment(node, oa, ob);
      return pr.d < 2 && pr.t > 0.001 && pr.t < 0.999;
    });
    const other = (w: Wall) => nodes.get(w.a === nid ? w.b : w.a)!;
    const all = [...list, ...hosts];
    const H = Math.min(...all.map((w) => w.height)) / 100;

    if (list.length === 1 && hosts.length === 0) {
      // koniec ściany: mur albo wolny
      const w = list[0];
      const end = w.a === nid ? 'a' : 'b';
      const sys = sysOf(w);
      const free = (end === 'a' ? w.endA : w.endB) === 'free';
      const j = newJoint(`e:${w.id}:${end}`, free ? 'free' : 'masonry', [w.id]);
      const Hw = w.height / 100;
      if (free) {
        j.outer = edges(j, 'outer', 'external', Array(sys.sides).fill(Hw), false);
        if (sys.frame !== 'glued') {
          const thick = wallThicknessMm(sys, w.boardId) / 1000;
          const key = `${w.boardId}|${pickBoardLength(w.boardId, w.height)}`;
          add(j.req.boardArea, key, thick * Hw * sys.layers);
          const n = (Math.ceil(Hw / STRIP_SCREW_SPACING - 1e-9) + 1) * 2;
          add(j.req.counts, screwFor(boardById(w.boardId).thickness * sys.layers), n);
          j.frame.push(`zamknięcie czoła paskiem płyty ${Math.round(thick * 100)} cm × ${fmt(Hw)} m (${sys.layers} warstw${sys.layers > 1 ? 'y' : 'a'}), ${n} wkrętów`);
        }
      } else {
        j.inner = edges(j, 'inner', 'contact', Array(sys.sides).fill(Hw), false);
        if (sys.frame !== 'glued')
          j.frame.push(`słupek przyścienny kotwiony do muru kołkami co 100 cm, taśma uszczelniająca ${fmt(Hw)} mb (w wyliczeniu ściany)`);
      }
      finish(j);
      continue;
    }

    if (list.length === 2 && hosts.length === 0) {
      const ang = angleAt(node, other(list[0]), other(list[1]));
      if (ang >= 170) continue; // przedłużenie w linii – zwykła spoina
      const j = newJoint(`n:${nid}`, 'L', list.map((w) => w.id));
      j.angleDeg = ang;
      const odd = isOdd(ang);
      const twoSided = list.some((w) => sysOf(w).sides === 2);
      if (twoSided) j.outer = edges(j, 'outer', 'external', [H], odd);
      j.inner = edges(j, 'inner', 'internal', [H], odd);
      if (list.every((w) => hasCavityFrame(sysOf(w)))) {
        const n = Math.ceil(H / STUD_LINK_SPACING - 1e-9) + 1;
        add(j.req.counts, 'LN9', n);
        j.frame.push(`dodatkowy słupek CW do przykręcenia płyt od strony kąta wewnętrznego (w wyliczeniu ściany)`);
        j.frame.push(`słupki narożne skręcone wkrętami LN 3,5×9 co ok. ${STUD_LINK_SPACING * 100} cm: ${n} szt.`);
      }
      finish(j);
      continue;
    }

    // trójnik / skrzyżowanie
    let through: Wall[];
    let abut: Wall[];
    if (hosts.length) {
      through = hosts.slice(0, 1);
      abut = list;
    } else {
      // ściana „ciągła” = para najbardziej współliniowych ścian w węźle
      let best: [Wall, Wall] = [list[0], list[1]];
      let bestAng = -1;
      for (let i = 0; i < list.length; i++)
        for (let k = i + 1; k < list.length; k++) {
          const a = angleAt(node, other(list[i]), other(list[k]));
          if (a > bestAng) {
            bestAng = a;
            best = [list[i], list[k]];
          }
        }
      through = best;
      abut = list.filter((w) => !best.includes(w));
    }
    const kind: JointKind = abut.length >= 2 ? 'X' : 'T';
    const j = newJoint(`n:${nid}`, kind, all.map((w) => w.id));
    const host = through[0];
    for (const a of abut) abutFrame(j, host, a, H);
    j.frame.unshift(kind === 'X' ? 'dwa dodatkowe słupki CW w ścianie ciągłej (w wyliczeniu ściany)' : 'dodatkowy słupek CW w ścianie ciągłej (w wyliczeniu ściany)');
    const innerCount = abut.reduce((s, a) => s + (sysOf(a).sides === 2 ? 2 : 1), 0);
    j.inner = edges(j, 'inner', 'internal', Array(innerCount).fill(H), false);
    finish(j);
  }

  // styk ze stropem i krawędzie otworów
  for (const w of walls) {
    const sys = sysOf(w);
    const L = dist(nodes.get(w.a)!, nodes.get(w.b)!) / 100;
    const top = newJoint(`top:${w.id}`, 'slab', [w.id]);
    top.inner = edges(top, 'inner', 'contact', Array(sys.sides).fill(L), false);
    finish(top);

    const H = w.height / 100;
    for (const o of w.openings) {
      const x0 = Math.max(0, o.offset / 100);
      const x1 = Math.min(L, (o.offset + o.width) / 100);
      const sill = o.kind === 'door' ? 0 : o.sill / 100;
      const topY = Math.min(H, sill + o.height / 100);
      const ow = x1 - x0;
      const oh = topY - sill;
      if (ow <= 0.05 || oh <= 0.05) continue;
      const lens: number[] = [];
      for (let side = 0; side < sys.sides; side++) {
        lens.push(oh, oh);
        if (topY < H - 0.01) lens.push(ow);
        if (sill > 0.01) lens.push(ow);
      }
      const j = newJoint(`op:${o.id}`, 'opening', [w.id]);
      j.outer = edges(j, 'outer', 'external', lens, false);
      finish(j);
    }
  }

  // obwód sufitów
  for (const c of p.ceilings) {
    if (c.points.length < 3) continue;
    const j = newJoint(`ceil:${c.id}`, 'ceiling', []);
    j.ceilingId = c.id;
    j.inner = edges(j, 'inner', 'contact', polygonPerimeterEdges(c.points).map((e) => e / 100), false);
    finish(j);
  }

  return out;
}

/** Suma długości krawędzi, m */
export const edgesTotal = (e?: JointEdges) => (e ? e.lengths.reduce((a, b) => a + b, 0) : 0);
