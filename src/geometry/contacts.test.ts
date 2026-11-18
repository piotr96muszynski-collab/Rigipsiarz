import { describe, expect, it } from 'vitest';
import { interiorSide } from './geometry';
import { createExistingWall, createLining, createProject, createWall, uid } from '../model/factory';
import type { Project, Wall } from '../model/types';
import { buildContacts, cornerStudPositions, findCollisions, findGaps, partRange } from './contacts';

type Seg = [number, number, number, number];

/** Projekt z nowych ścian zadanych odcinkami (cm); wspólne punkty łączone w węzły */
function project(segs: Seg[], systemId = 'W-CW75-1', free = true): Project {
  const p = createProject();
  const nodeAt = (x: number, y: number) => {
    let n = p.nodes.find((q) => q.x === x && q.y === y);
    if (!n) {
      n = { id: uid(), x, y };
      p.nodes.push(n);
    }
    return n.id;
  };
  for (const [x0, y0, x1, y1] of segs)
    p.walls.push(
      createWall(p, nodeAt(x0, y0), nodeAt(x1, y1), {
        systemId,
        boardId: 'RB12.5',
        ...(free ? { endA: 'free', endB: 'free' } : {}),
      } as Partial<Wall>),
    );
  return p;
}

const clean = (p: Project) => {
  const m = buildContacts(p);
  expect(findCollisions(p, m)).toEqual([]);
  expect(findGaps(p, m)).toEqual([]);
  return m;
};

describe('model styków – narożnik L', () => {
  it('pojedyncza płyta: bez przenikania i bez szczeliny', () => {
    const p = project([
      [0, 0, 300, 0],
      [0, 0, 0, 250],
    ]);
    const m = clean(p);
    expect(m.nodes.size).toBe(1);
    expect([...m.nodes.values()][0].kind).toBe('L');
  });

  it('ściana ciągła przechodzi do zewnętrznego lica, dochodząca kończy się na jej ruszcie', () => {
    const p = project([
      [0, 0, 300, 0],
      [0, 0, 0, 250],
    ]);
    const m = buildContacts(p);
    const node = [...m.nodes.values()][0];
    const A = p.walls.find((w) => w.id === node.through[0])!;
    const B = p.walls.find((w) => w.id === node.abut[0])!;
    const LA = A === p.walls[0] ? 3 : 2.5;
    const LB = B === p.walls[0] ? 3 : 2.5;
    // CW 75: rdzeń 37,5 mm na stronę, płyta 12,5 mm
    expect(partRange(m, A, LA, { kind: 'frame' })[0]).toBeCloseTo(-0.0375, 6);
    expect(partRange(m, B, LB, { kind: 'frame' })[0]).toBeCloseTo(0.0375, 6);
    const ea = m.ends.get(`${A.id}:a`)!;
    const sorted = ea.boards.map((s) => s[0].s).sort((x, y) => x - y);
    // zewnątrz: zachodzi na czoło płyty B (−50 mm), wewnątrz: dochodzi do płyty B (+50 mm)
    expect(sorted[0]).toBeCloseTo(-0.05, 6);
    expect(sorted[1]).toBeCloseTo(0.05, 6);
    expect(ea.boards.flat().map((b) => b.contact).sort()).toEqual(['butt', 'lap']);
    // dodatkowy słupek tuż za rusztem ściany dochodzącej
    expect(cornerStudPositions(m, A, LA)[0]).toBeCloseTo(0.0375 + 0.025, 6);
  });

  it('dwie warstwy płyt zachodzą na zakład, słupek narożny trzyma krawędzie obu warstw', () => {
    const p = project(
      [
        [0, 0, 300, 0],
        [0, 0, 0, 250],
      ],
      'W-CW75-2',
    );
    const m = clean(p);
    const node = [...m.nodes.values()][0];
    const A = p.walls.find((w) => w.id === node.through[0])!;
    const L = A === p.walls[0] ? 3 : 2.5;
    const stud = cornerStudPositions(m, A, L)[0];
    const ea = m.ends.get(`${A.id}:a`)!;
    // krawędzie wewnętrznych warstw A leżą na półce dodatkowego słupka (50 mm)
    const inner = ea.boards.find((s) => s.every((b) => b.contact === 'butt'))!;
    for (const b of inner) {
      expect(b.s).toBeGreaterThan(stud - 0.025);
      expect(b.s).toBeLessThan(stud + 0.025);
    }
    expect(inner[1].s - inner[0].s).toBeCloseTo(0.0125, 6);
  });

  it('każda orientacja narożnika jest szczelna', () => {
    for (const segs of [
      [
        [0, 0, 300, 0],
        [300, 0, 300, 200],
      ],
      [
        [300, 0, 0, 0],
        [300, 200, 300, 0],
      ],
      [
        [0, 200, 0, 0],
        [0, 0, 300, 0],
      ],
    ] as Seg[][])
      for (const sys of ['W-CW50-1', 'W-CW75-2', 'W-CW100-2', 'W-2CW75-2'])
        clean(project(segs, sys));
  });

  it('zamknięty prostokąt z czterech ścian', () => {
    clean(
      project([
        [0, 0, 400, 0],
        [400, 0, 400, 300],
        [400, 300, 0, 300],
        [0, 300, 0, 0],
      ], 'W-CW75-2'),
    );
  });
});

describe('model styków – trójnik i skrzyżowanie', () => {
  it('trójnik w węźle: dochodząca ściana kończy się na licu płyt ściany ciągłej', () => {
    const p = project([
      [0, 0, 200, 0],
      [200, 0, 400, 0],
      [200, 0, 200, 250],
    ]);
    const m = clean(p);
    const n = [...m.nodes.values()][0];
    expect(n.kind).toBe('T');
    expect(n.abut).toEqual([p.walls[2].id]);
    expect(partRange(m, p.walls[2], 2.5, { kind: 'frame' })[0]).toBeCloseTo(0.05, 6);
  });

  it('trójnik w środku ściany (bez węzła) i skrzyżowanie X', () => {
    clean(
      project([
        [0, 0, 400, 0],
        [150, 0, 150, 250],
      ]),
    );
    clean(
      project([
        [0, 0, 200, 0],
        [200, 0, 400, 0],
        [200, -200, 200, 0],
        [200, 0, 200, 250],
      ], 'W-CW75-2'),
    );
  });
});

describe('model styków – mur, wolny koniec, kolizje', () => {
  it('ściana dochodzi do lica okładziny muru, okładziny w narożniku obrysu się nie przenikają', () => {
    const p = createProject();
    const pts = [
      [0, 0],
      [500, 0],
      [500, 400],
      [0, 400],
    ].map(([x, y]) => ({ id: uid(), x, y }));
    p.nodes.push(...pts);
    for (let i = 0; i < 4; i++) p.walls.push(createExistingWall(p, pts[i].id, pts[(i + 1) % 4].id));
    // okładziny CD po stronie pomieszczenia
    for (const w of p.walls) w.linings = [createLining(interiorSide(p, w) || 1, 'O-CD-1')];
    // nowa ściana od muru do muru
    const a = { id: uid(), x: 200, y: 0 };
    const b = { id: uid(), x: 200, y: 400 };
    p.nodes.push(a, b);
    p.walls.push(createWall(p, a.id, b.id, { systemId: 'W-CW75-1', boardId: 'RB12.5' }));
    const m = buildContacts(p);
    expect(findCollisions(p, m)).toEqual([]);
    const e = m.ends.get(`${p.walls[4].id}:a`)!;
    expect(e.frame.contact).toBe('lining');
    // CD 27 + 10 mm odstępu + płyta 12,5 mm
    expect(e.frame.s).toBeCloseTo(0.0495, 6);
    // okładziny w narożnikach obrysu: jedna dochodzi do drugiej
    const ranges = [...m.linings.values()];
    expect(ranges.some(([u0]) => u0 > 0.04)).toBe(true);
  });

  it('wolny koniec: ruszt cofnięty za pasek płyty', () => {
    const p = project([[0, 0, 300, 0]], 'W-CW75-2');
    const m = clean(p);
    const e = m.ends.get(`${p.walls[0].id}:a`)!;
    expect(e.joint).toBe('free');
    expect(e.strip?.thickness).toBeCloseTo(0.025, 6);
    expect(e.frame.s).toBeCloseTo(0.025, 6);
  });

  it('wykrywa ściany przecinające się bez połączenia', () => {
    const p = project([
      [0, 0, 400, 0],
      [200, -150, 200, 150],
    ]);
    const cols = findCollisions(p);
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.some((c) => c.a.kind === 'frame' && c.b.kind === 'frame')).toBe(true);
  });

  it('dawny układ (wszystko do węzła) dawał przenikanie i szczelinę w narożniku', () => {
    const p = project([
      [0, 0, 300, 0],
      [0, 0, 0, 250],
    ]);
    const m = buildContacts(p);
    for (const e of m.ends.values()) {
      if (e.joint !== 'L') continue;
      e.frame.s = 0;
      for (const s of e.boards) for (const b of s) b.s = 0;
    }
    expect(findCollisions(p, m).length).toBeGreaterThan(0);
    expect(findGaps(p, m).length).toBeGreaterThan(0);
  });
});

describe('ten sam obrys sufitu', () => {
  it('rozpoznaje duplikat niezależnie od punktu startowego i kierunku', async () => {
    const { sameOutline } = await import('./geometry');
    const a = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(sameOutline(a, [a[2], a[1], a[0], a[3]])).toBe(true);
    expect(sameOutline(a, [{ x: 0.5, y: 0 }, a[1], a[2], a[3]])).toBe(true);
    expect(sameOutline(a, [{ x: 50, y: 0 }, a[1], a[2], a[3]])).toBe(false);
  });
});
