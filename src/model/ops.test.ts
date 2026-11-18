import { describe, expect, it } from 'vitest';
import { calculateProject } from '../calc/materials';
import { analyzeJunctions } from '../geometry/geometry';
import { findRoomAt } from '../geometry/rooms';
import { createProject } from './factory';
import { addWall, mergeNodeIfOverlaps, moveNode, snapPoint } from './ops';

/** Prostokątny pokój narysowany jak narzędziem „Pokój” na planie */
function drawRoom(w: number, h: number) {
  const p = createProject();
  const pts = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4]));
  return p;
}

describe('rysowanie na planie', () => {
  it('pokój z prostokąta ma 4 ściany połączone w 4 węzłach', () => {
    const p = drawRoom(400, 300);
    expect(p.walls).toHaveLength(4);
    expect(p.nodes).toHaveLength(4);
    const j = analyzeJunctions(p);
    for (const w of p.walls) {
      expect(j.get(w.id)!.endA).toBe('corner');
      expect(j.get(w.id)!.endB).toBe('corner');
    }
    // każdy narożnik liczony raz: 4 dodatkowe słupki i 4 krawędzie
    const extra = [...j.values()].reduce((s, x) => s + x.extraStuds, 0);
    expect(extra).toBe(4);
  });

  it('nie dubluje ściany ani nie tworzy zbyt krótkiej', () => {
    const p = createProject();
    expect(addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 })).not.toBeNull();
    expect(addWall(p, { x: 300, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(addWall(p, { x: 0, y: 0 }, { x: 5, y: 0 })).toBeNull();
    expect(p.walls).toHaveLength(1);
  });

  it('przyciąga do węzła, krawędzi ściany, kąta i siatki', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 });
    expect(snapPoint(p, { x: 396, y: 3 }, 10).kind).toBe('node');
    const onWall = snapPoint(p, { x: 200, y: 4 }, 10);
    expect(onWall.kind).toBe('wall');
    expect(onWall.point.y).toBeCloseTo(0);
    const ang = snapPoint(p, { x: 1000, y: 1012 }, 10, { x: 800, y: 800 });
    expect(ang.kind).toBe('angle');
    expect(ang.point.x - 800).toBeCloseTo(ang.point.y - 800);
    const g = snapPoint(p, { x: 1003, y: 2007 }, 10, undefined, 5);
    expect(g).toEqual({ point: { x: 1005, y: 2005 }, kind: 'grid' });
  });

  it('trójnik: ściana dochodząca do środka innej dodaje słupek ścianie przechodzącej', () => {
    const p = createProject();
    const host = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 })!;
    const branch = addWall(p, { x: 200, y: 0 }, { x: 200, y: 300 })!;
    const j = analyzeJunctions(p);
    expect(j.get(branch.id)!.endA).toBe('tee-abut');
    expect(j.get(host.id)!.extraStuds).toBe(1);
  });

  it('przeciągnięty węzeł łączy się z innym i zamyka obrys', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 });
    addWall(p, { x: 300, y: 0 }, { x: 300, y: 300 });
    addWall(p, { x: 300, y: 300 }, { x: 0, y: 300 });
    addWall(p, { x: 0, y: 300 }, { x: 0, y: 20 });
    const loose = p.nodes.find((n) => n.x === 0 && n.y === 20)!;
    moveNode(p, loose.id, { x: 0, y: 0 });
    mergeNodeIfOverlaps(p, loose.id);
    expect(p.nodes).toHaveLength(4);
    const room = findRoomAt(p, { x: 150, y: 150 });
    expect(room).not.toBeNull();
    expect(room).toHaveLength(4);
  });

  it('sufit z obrysu pomieszczenia i wyliczenie materiałów dla planu', () => {
    const p = drawRoom(500, 400);
    // ściana działowa dzieli pokój na dwa
    addWall(p, { x: 200, y: 0 }, { x: 200, y: 400 });
    const small = findRoomAt(p, { x: 100, y: 200 });
    expect(small).not.toBeNull();
    const xs = small!.map((pt) => pt.x);
    expect(Math.max(...xs)).toBe(200);
    expect(findRoomAt(p, { x: 900, y: 900 })).toBeNull();

    const calc = calculateProject(p);
    expect(calc.walls.size).toBe(5);
    expect(calc.stats.wallLengthM).toBeCloseTo(5 + 4 + 5 + 4 + 4);
    expect(calc.total.length).toBeGreaterThan(0);
  });
});
