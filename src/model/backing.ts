// Ściana istniejąca za okładziną. Okładzina (ATLAS M-System 3G, CD 60 na uchwytach ES, płyta
// na kleju) zawsze leży na murze, więc ściana narysowana w takim systemie zamienia się w mur
// z okładziną. Jeśli w tym miejscu jest już mur – okładzina trafia na niego, a nowa linia znika.

import { isLiningSystem, wallSystemById } from '../catalog/rigips';
import { existingRooms, interiorSide, isNewWall, nodeMap } from '../geometry/geometry';
import { deleteWall } from './ops';
import type { Lining, Project, Wall } from './types';

/** Domyślna grubość muru postawionego za okładziną, cm */
export const BACKING_THICKNESS = 25;

/** Czy nowa ściana jest w rzeczywistości okładziną muru */
export const isLiningWall = (w: Wall): boolean => isNewWall(w) && isLiningSystem(wallSystemById(w.systemId));

/** Czy projekt wymaga uzupełnienia murów za okładzinami */
export function needsBacking(p: Project): boolean {
  if (p.walls.some(isLiningWall)) return true;
  // mur automatyczny z okładziną zwróconą na zewnątrz zamkniętego obrysu
  return p.walls.some((w) => w.backing && w.linings?.length === 1) && misoriented(p).length > 0;
}

function misoriented(p: Project): Wall[] {
  const rooms = existingRooms(p);
  if (!rooms.length) return [];
  return p.walls.filter((w) => {
    if (!w.backing || isNewWall(w) || w.linings?.length !== 1) return false;
    const inner = interiorSide(p, w, rooms);
    return inner !== 0 && w.linings[0].side !== inner;
  });
}

/**
 * Mur, na którym leży już nowa ściana-okładzina: równoległy, w odległości grubości muru
 * (z zapasem) i pokrywający co najmniej 80% jej długości. Zwraca też stronę muru, po której leży.
 */
export function hostMasonry(p: Project, w: Wall): { wall: Wall; side: 1 | -1 } | null {
  const nodes = nodeMap(p);
  const a = nodes.get(w.a);
  const b = nodes.get(w.b);
  if (!a || !b) return null;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1) return null;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let best: { wall: Wall; side: 1 | -1; d: number } | null = null;
  for (const o of p.walls) {
    if (o.id === w.id || isNewWall(o)) continue;
    const A = nodes.get(o.a);
    const B = nodes.get(o.b);
    if (!A || !B) continue;
    const Lo = Math.hypot(B.x - A.x, B.y - A.y);
    if (Lo < 1) continue;
    const ux = (B.x - A.x) / Lo;
    const uy = (B.y - A.y) / Lo;
    // równoległość
    if (Math.abs(((b.x - a.x) / L) * uy - ((b.y - a.y) / L) * ux) > 0.05) continue;
    const v = (mid.x - A.x) * -uy + (mid.y - A.y) * ux;
    const T = o.thickness ?? BACKING_THICKNESS;
    if (Math.abs(v) > T + 10) continue;
    const ta = (a.x - A.x) * ux + (a.y - A.y) * uy;
    const tb = (b.x - A.x) * ux + (b.y - A.y) * uy;
    const overlap = Math.min(Lo, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb));
    if (overlap < 0.8 * L) continue;
    let side: 1 | -1 = v >= 0 ? 1 : -1;
    if (Math.abs(v) < 2) {
      // linia okładziny na linii muru: strona pomieszczenia albo strona istniejącej okładziny
      const inner = interiorSide(p, o);
      side = inner || o.linings?.[0]?.side || 1;
    }
    if (!best || Math.abs(v) < best.d) best = { wall: o, side, d: Math.abs(v) };
  }
  return best && { wall: best.wall, side: best.side };
}

/**
 * Stawia mur za każdą ścianą narysowaną w systemie okładziny (zmienia projekt w miejscu).
 * Zwraca id ścian, które zmieniły się w mur, i id ścian scalonych z istniejącym murem.
 */
export function ensureLiningBacking(p: Project): { converted: string[]; merged: string[] } {
  const converted: string[] = [];
  const merged: string[] = [];
  for (const w of [...p.walls]) {
    if (!isLiningWall(w)) continue;
    const lining: Lining = { side: 1, systemId: w.systemId, boardId: w.boardId, studSpacing: w.studSpacing, insulation: w.insulation };
    const host = hostMasonry(p, w);
    if (host) {
      lining.side = host.side;
      host.wall.linings = [...(host.wall.linings ?? []).filter((l) => l.side !== host.side), lining];
      deleteWall(p, w.id);
      merged.push(w.id);
      continue;
    }
    // płyty nowej ściany leżą po stronie normalnej (strona 1), mur – po przeciwnej
    w.kind = 'existing';
    w.thickness = BACKING_THICKNESS;
    w.backing = true;
    w.linings = [lining];
    w.insulation = false;
    w.openings = w.openings.map((o) => ({ ...o, reinforced: false }));
    converted.push(w.id);
  }
  // obrys się zamknął – okładziny murów automatycznych do wnętrza
  for (const w of misoriented(p)) w.linings![0].side = w.linings![0].side === 1 ? -1 : 1;
  return { converted, merged };
}

/** Wersja dla historii zmian: kopia projektu z murami za okładzinami (albo ten sam obiekt) */
export function withLiningBacking(p: Project): Project {
  if (!needsBacking(p)) return p;
  const d = structuredClone(p);
  ensureLiningBacking(d);
  return d;
}
