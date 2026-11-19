import { describe, expect, it } from 'vitest';
import { analyzeJunctions, dist, interiorSide, isNewWall, masonryEndExtension, masonrySide, wallEnds } from './geometry';
import { createExistingWall, createLining, createOpening, createProject, createWall, uid } from '../model/factory';
import { addWall, addWalls, removeOverlaps } from '../model/ops';
import type { Point, Project, Wall } from '../model/types';
import { buildContacts, cornerStudPositions, findCollisions, findGaps, findOverlaps, partRange, wallOutline } from './contacts';

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

  it('pokój w kształcie L: mur w narożniku wklęsłym kończy się w węźle, okładziny się domykają', () => {
    // obrys jak na zrzucie Piotra: wewnętrzny róg w (290, 0) między ścianą 290 cm a 135 cm
    const p = createProject();
    const pts = [
      [0, 0],
      [290, 0],
      [290, -135],
      [495, -135],
      [495, 205],
      [0, 205],
    ].map(([x, y]) => ({ id: uid(), x, y }));
    p.nodes.push(...pts);
    for (let i = 0; i < pts.length; i++) p.walls.push(createExistingWall(p, pts[i].id, pts[(i + 1) % pts.length].id));
    const [w290, w135] = p.walls;
    const ext = (w: Wall, end: 'a' | 'b') => masonryEndExtension(p, w, end, masonrySide(p, w));
    // narożnik wklęsły: oba mury kończą się w węźle (nie wystają za lico drugiej ściany)
    expect(ext(w290, 'b')).toBe(0);
    expect(ext(w135, 'a')).toBe(0);
    // narożniki wypukłe: mur dochodzi do zewnętrznego lica drugiej ściany
    expect(ext(w290, 'a')).toBeCloseTo(25, 6);
    expect(ext(w135, 'b')).toBeCloseTo(25, 6);
    for (const w of p.walls) w.linings = [createLining(interiorSide(p, w) || 1, 'O-CD-1')];
    const m = buildContacts(p);
    // okładzina ściany narysowanej wcześniej wychodzi za węzeł o grubość drugiej, druga zaczyna się w węźle
    const L290 = m.linings.get(`${w290.id}:${w290.linings![0].side}`)!;
    const L135 = m.linings.get(`${w135.id}:${w135.linings![0].side}`)!;
    expect(L290[1]).toBeCloseTo(2.9 + 0.0495, 6);
    expect(L135[0]).toBeCloseTo(0, 6);
    expect(findCollisions(p, m)).toEqual([]);
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

describe('ściana narysowana na istniejącej', () => {
  const rect = (x0: number, y0: number, w: number, h: number) => [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + h },
    { x: x0, y: y0 + h },
  ];
  const room = (p: Project, pts: Point[], kind?: 'existing') => pts.forEach((pt, i) => addWalls(p, pt, pts[(i + 1) % 4], kind ? { kind } : {}));

  it('drugi pokój w narożniku pierwszego dokłada tylko 2 brakujące ściany', () => {
    const p = createProject();
    room(p, rect(0, 0, 400, 300));
    room(p, rect(0, 0, 200, 150));
    expect(p.walls).toHaveLength(6);
    expect(findOverlaps(p)).toHaveLength(0);
    // nowe ściany tworzą trójniki z ścianami pierwszego pokoju
    const j = analyzeJunctions(p);
    expect([...j.values()].filter((x) => x.endA === 'tee-abut' || x.endB === 'tee-abut')).toHaveLength(2);
  });

  it('ten sam pokój narysowany drugi raz nie dubluje ścian', () => {
    const p = createProject();
    room(p, rect(0, 0, 400, 300));
    room(p, rect(0, 0, 400, 300));
    expect(p.walls).toHaveLength(4);
    expect(p.nodes).toHaveLength(4);
  });

  it('ściana dłuższa od istniejącej w tej samej linii dostaje tylko przedłużenie', () => {
    const p = createProject();
    addWalls(p, { x: 0, y: 0 }, { x: 200, y: 0 });
    const added = addWalls(p, { x: -100, y: 0 }, { x: 400, y: 0 });
    expect(added).toHaveLength(2);
    const lens = added.map((w) => dist(...wallEnds(p, w))).sort((a, b) => a - b);
    expect(lens).toEqual([100, 200]);
    // przedłużenia zaczynają się w węzłach istniejącej ściany
    expect(p.nodes).toHaveLength(4);
  });

  it('obrys i nowa zabudowa to różne warstwy – ściana g-k przy murze nie jest pomijana', () => {
    const p = createProject();
    room(p, rect(0, 0, 400, 300), 'existing');
    addWalls(p, { x: 0, y: 0 }, { x: 200, y: 0 });
    expect(p.walls.filter(isNewWall)).toHaveLength(1);
  });

  it('nakładanie po przeciągnięciu węzła jest wykrywane i usuwane', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 });
    const w = addWall(p, { x: 100, y: 50 }, { x: 300, y: 50 })!;
    for (const id of [w.a, w.b]) p.nodes.find((n) => n.id === id)!.y = 0;
    expect(findOverlaps(p)).toEqual([expect.objectContaining({ over: w.id, lengthCm: 200 })]);
    expect(removeOverlaps(p)).toBe(1);
    expect(p.walls).toHaveLength(1);
    expect(p.nodes).toHaveLength(2);
  });

  it('nałożona ściana z otworem zostaje (otworu nie przenosimy samoczynnie)', () => {
    const p = createProject();
    addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 });
    const w = addWall(p, { x: 0, y: 1 }, { x: 600, y: 1 })!;
    w.openings.push(createOpening('door', 450));
    removeOverlaps(p);
    expect(p.walls).toHaveLength(2);
  });
});

describe('narożnik L ścian różnej grubości – licowanie', () => {
  /** Narożnik: ściana „H” wzdłuż +x, ściana „V” wzdłuż +y; id ustala, która jest ciągła */
  function mixed(sysH: string, sysV: string, hFirst: boolean): Project {
    const p = project([
      [0, 0, 300, 0],
      [0, 0, 0, 250],
    ]);
    p.walls[0] = { ...p.walls[0], id: hFirst ? 'a-h' : 'b-h', systemId: sysH };
    p.walls[1] = { ...p.walls[1], id: hFirst ? 'b-v' : 'a-v', systemId: sysV };
    return p;
  }
  const xs = (pts: Point[]) => pts.map((q) => q.x);
  const ys = (pts: Point[]) => pts.map((q) => q.y);

  for (const [sysH, sysV] of [
    ['W-CW100-2', 'W-CW50-1'],
    ['W-CW50-1', 'W-CW100-2'],
    ['W-CW75-1', 'W-CW100-1'],
  ])
    for (const hFirst of [true, false])
      it(`${sysH} + ${sysV} (ciągła ${hFirst ? 'grubsza/pierwsza' : 'druga'}): zewnętrzny róg w licu, bez kolizji i szczelin`, () => {
        const p = mixed(sysH, sysV, hFirst);
        const m = clean(p);
        const [H, V] = p.walls;
        const oH = wallOutline(p, m, H)!;
        const oV = wallOutline(p, m, V)!;
        // nic nie wystaje poza zewnętrzne lica narożnika: najdalej na zewnątrz sięga lico ściany V (x)
        // i lico ściany H (y) – bez schodka na rogu
        expect(Math.min(...xs(oH), ...xs(oV))).toBeCloseTo(Math.min(...xs(oV)), 6);
        expect(Math.min(...ys(oH), ...ys(oV))).toBeCloseTo(Math.min(...ys(oH)), 6);
        // obrys nie wychodzi poza długość ścian
        expect(oH.every((q) => q.x <= 300 + 1e-6)).toBe(true);
        expect(oV.every((q) => q.y <= 250 + 1e-6)).toBe(true);
      });

  it('ruszt ściany ciągłej sięga do zewnętrznego lica rusztu dochodzącej, dochodzącej – do wewnętrznego lica ciągłej', () => {
    // H = CW 100 (ciągła), V = CW 50
    const p = mixed('W-CW100-1', 'W-CW50-1', true);
    const m = clean(p);
    const [H, V] = p.walls;
    expect(partRange(m, H, 3, { kind: 'frame' })[0]).toBeCloseTo(-0.025, 6);
    expect(partRange(m, V, 2.5, { kind: 'frame' })[0]).toBeCloseTo(0.05, 6);
    // słupek narożny ciągłej tuż za rusztem cieńszej ściany
    expect(cornerStudPositions(m, H, 3)[0]).toBeCloseTo(0.025 + 0.025, 6);
    // i odwrotnie: H = CW 50 ciągła, V = CW 100
    const q = mixed('W-CW50-1', 'W-CW100-1', true);
    const mq = clean(q);
    expect(partRange(mq, q.walls[0], 3, { kind: 'frame' })[0]).toBeCloseTo(-0.05, 6);
    expect(partRange(mq, q.walls[1], 2.5, { kind: 'frame' })[0]).toBeCloseTo(0.025, 6);
    expect(cornerStudPositions(mq, q.walls[0], 3)[0]).toBeCloseTo(0.05 + 0.025, 6);
  });
});
