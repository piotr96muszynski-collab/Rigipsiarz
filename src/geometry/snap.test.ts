import { describe, expect, it } from 'vitest';
import { createProject } from '../model/factory';
import { addWall } from '../model/ops';
import { anchorsOf, angleMarks, snapGuided, snapMove } from './snap';

function lShape() {
  const p = createProject();
  addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 });
  addWall(p, { x: 400, y: 0 }, { x: 400, y: 300 });
  return p;
}
const nodeAt = (p: ReturnType<typeof createProject>, x: number, y: number) => p.nodes.find((n) => n.x === x && n.y === y)!;

describe('przyciąganie z liniami pomocniczymi', () => {
  it('przeciągany węzeł trzyma kąt prosty do sąsiedniej ściany', () => {
    const p = lShape();
    const n = nodeAt(p, 400, 300);
    const moved = new Set([n.id]);
    const r = snapGuided(p, { x: 404, y: 251 }, 10, { anchors: anchorsOf(p, n.id, moved), moved });
    expect(r.kind).toBe('guide');
    expect(r.point.x).toBeCloseTo(400);
    expect(r.point.y).toBeCloseTo(250);
  });

  it('kąt prosty liczony względem ukośnej ściany, nie tylko osi X/Y', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 300, y: 100 });
    addWall(p, { x: 300, y: 100 }, { x: 250, y: 250 });
    const n = nodeAt(p, 250, 250);
    const moved = new Set([n.id]);
    // prostopadle do (300,100)-(0,0): kierunek (-1, 3)
    const r = snapGuided(p, { x: 233, y: 302 }, 8, { anchors: anchorsOf(p, n.id, moved), moved, grid: 1 });
    expect(r.kind).toBe('guide');
    const dx = r.point.x - 300;
    const dy = r.point.y - 100;
    expect(dx * 300 + dy * 100).toBeCloseTo(0, 3);
  });

  it('koniec rysowanej ściany trafia w przecięcie pionu innego węzła z kątem od startu', () => {
    const p = lShape();
    // start w (0,200); poziomo w prawo, w linii z węzłem (400,…) – przecięcie (400,200) leży na ścianie
    const r = snapGuided(p, { x: 395, y: 197 }, 10, { anchors: [{ at: { x: 0, y: 200 } }] });
    expect(r.point.x).toBeCloseTo(400);
    expect(r.point.y).toBeCloseTo(200);
    expect(r.guides.length).toBe(2);
  });

  it('przesuwana ściana staje w osi innej ściany i w kącie prostym', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 0, y: 300 });
    const moving = addWall(p, { x: 500, y: 0 }, { x: 500, y: 300 })!;
    // ściana pozioma połączona z przesuwaną
    addWall(p, { x: 500, y: 300 }, { x: 800, y: 300 });
    const moved = new Set([moving.a, moving.b]);
    const r = snapMove(p, moved, { x: -3, y: 4 }, 10);
    // pion przez węzły (0,…)? nie – najbliższy jest poziom y=0/300 innych węzłów (przesunięcie 4 → 0)
    expect(r.delta.y).toBeCloseTo(0);
    expect(r.kind).toBe('guide');
    const r2 = snapMove(p, moved, { x: -497, y: 40 }, 10);
    // węzeł (500,300) trafia na (0,300)? (3,340) jest za daleko; x dociągnięte do pionu x=0
    expect(r2.delta.x).toBeCloseTo(-500);
  });

  it('bez linii w pobliżu przesunięcie trzyma siatkę', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 300, y: 0 })!;
    const r = snapMove(p, new Set([w.a, w.b]), { x: 52, y: 77 }, 5);
    expect(r).toEqual({ delta: { x: 50, y: 75 }, guides: [], kind: 'grid' });
  });
});

describe('opis kątów', () => {
  it('narożnik pokazuje 90°, a ściana w linii nic', () => {
    const p = lShape();
    const corner = nodeAt(p, 400, 0);
    const m = angleMarks(p, [corner.id]);
    expect(m).toHaveLength(1);
    expect(m[0].deg).toBeCloseTo(90);
    addWall(p, { x: 400, y: 300 }, { x: 400, y: 600 });
    expect(angleMarks(p, [nodeAt(p, 400, 300).id])).toHaveLength(0);
  });

  it('rysowana ściana: kąt do ściany w punkcie startu', () => {
    const p = lShape();
    const start = nodeAt(p, 400, 300);
    const m = angleMarks(p, [], [{ nodeId: start.id, at: start, to: { x: 100, y: 300 } }]);
    expect(m.map((x) => Math.round(x.deg))).toEqual([90]);
  });
});
