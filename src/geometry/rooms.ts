import type { Point, Project } from '../model/types';
import { nodeMap, pointInPolygon, polygonArea } from './geometry';

/**
 * Szuka najmniejszego zamkniętego obrysu ścian zawierającego punkt (np. do utworzenia sufitu
 * „z pomieszczenia”). Działa na grafie węzłów i ścian – ściany muszą łączyć się w węzłach.
 */
export function findRoomAt(p: Project, pt: Point): Point[] | null {
  const nodes = nodeMap(p);
  const adj = new Map<string, string[]>();
  for (const w of p.walls) {
    if (!nodes.has(w.a) || !nodes.has(w.b)) continue;
    adj.set(w.a, [...(adj.get(w.a) ?? []), w.b]);
    adj.set(w.b, [...(adj.get(w.b) ?? []), w.a]);
  }
  const angle = (from: string, to: string) => {
    const a = nodes.get(from)!;
    const b = nodes.get(to)!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const visited = new Set<string>();
  let best: Point[] | null = null;
  let bestArea = Infinity;
  for (const [u, vs] of adj) {
    for (const v of vs) {
      const key = `${u}>${v}`;
      if (visited.has(key)) continue;
      // obchodzenie ściany: na każdym węźle skręcamy możliwie najmocniej w prawo
      const face: string[] = [];
      let a = u;
      let b = v;
      let guard = 0;
      while (guard++ < 500) {
        const k = `${a}>${b}`;
        if (visited.has(k)) break;
        visited.add(k);
        face.push(a);
        const back = angle(b, a);
        const candidates = (adj.get(b) ?? []).filter((c) => c !== a || (adj.get(b) ?? []).length === 1);
        let next: string | null = null;
        let bestTurn = Infinity;
        for (const c of candidates) {
          let turn = angle(b, c) - back;
          while (turn <= 0) turn += Math.PI * 2;
          if (turn < bestTurn) {
            bestTurn = turn;
            next = c;
          }
        }
        if (!next) break;
        a = b;
        b = next;
        if (a === u && b === v) break;
      }
      if (face.length >= 3 && a === u && b === v) {
        const poly = face.map((id) => ({ x: nodes.get(id)!.x, y: nodes.get(id)!.y }));
        const area = polygonArea(poly);
        if (area > 1 && area < bestArea && pointInPolygon(pt, poly)) {
          bestArea = area;
          best = poly;
        }
      }
    }
  }
  return best;
}
