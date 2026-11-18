import { describe, expect, it } from 'vitest';
import { calculateProject, ceilingGrid, cutPieces, wallRequirement } from './materials';
import { createCeiling, createOpening, createProject, createWall, uid } from '../model/factory';
import { analyzeJunctions } from '../geometry/geometry';
import type { Project } from '../model/types';

function straightWall(lengthCm: number, heightCm = 260): Project {
  const p = createProject();
  p.nodes = [
    { id: uid(), x: 0, y: 0 },
    { id: uid(), x: lengthCm, y: 0 },
  ];
  p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { height: heightCm, systemId: 'W-CW75-1', boardId: 'RB12.5' })];
  return p;
}

const line = (p: Project, keyPart: string) => calculateProject(p).total.filter((l) => l.key.includes(keyPart));

describe('rozkrój profili', () => {
  it('łączy krótkie elementy w jedną sztukę', () => {
    const r = cutPieces([1, 1, 0.9], [3]);
    expect(r.bars).toHaveLength(1);
  });
  it('dzieli elementy dłuższe niż profil', () => {
    const r = cutPieces([9], [4]);
    expect(r.bars).toHaveLength(3);
  });
  it('dobiera najkrótszy pasujący profil dla długich elementów', () => {
    const r = cutPieces([2.55], [3, 2.6, 2.75, 3.5, 4]);
    expect(r.bars[0].stock).toBe(2.6);
  });
});

describe('ściana działowa', () => {
  it('ściana 3 m: słupki co 60 cm + końcowy', () => {
    const p = straightWall(300);
    const j = analyzeJunctions(p).get(p.walls[0].id)!;
    const { info } = wallRequirement(p, p.walls[0], j);
    expect(info.studPositions).toHaveLength(6); // 0, .6, 1.2, 1.8, 2.4, 3.0
    expect(info.netAreaM2).toBeCloseTo(7.8);
  });

  it('liczy płyty z obu stron z naddatkiem', () => {
    const p = straightWall(300);
    p.settings.waste = 10;
    const boards = line(p, 'board-');
    // 2 strony × 7,8 m² × 1,1 / (1,2 × 2,6) = 5,5 → 6
    expect(boards[0].qty).toBe(6);
  });

  it('bez naddatku', () => {
    const p = straightWall(300);
    p.settings.waste = 0;
    expect(line(p, 'board-')[0].qty).toBe(5);
  });

  it('drzwi przerywają UW przy posadzce i dodają ościeża UA', () => {
    const p = straightWall(400);
    p.walls[0].openings.push(createOpening('door', 100));
    const { req } = wallRequirement(p, p.walls[0], analyzeJunctions(p).get(p.walls[0].id)!);
    const uw = req.pieces['UW75'];
    // strop 4,0 + posadzka 1,0 + 2,1 + nadproże 1,2
    expect(uw.reduce((a, b) => a + b, 0)).toBeCloseTo(4 + 1 + 2.1 + 1.2);
    expect(req.pieces['UA75']).toHaveLength(2);
    expect(req.counts['KATUA']).toBe(4);
  });

  it('okno daje krótkie słupki nad i pod otworem', () => {
    const p = straightWall(400);
    p.walls[0].openings.push(createOpening('window', 100, { width: 120, height: 120, sill: 90 }));
    const { req } = wallRequirement(p, p.walls[0], analyzeJunctions(p).get(p.walls[0].id)!);
    const short = req.pieces['CW75'].filter((x) => x < 2.5);
    // słupki w x = 1,2 i 1,8 w świetle okna: po 0,5 m nad i 0,9 m pod
    expect(short.map((x) => Math.round(x * 100)).sort()).toEqual([50, 50, 90, 90]);
  });
});

describe('połączenia ścian', () => {
  it('narożnik L dodaje jeden słupek i jeden narożnik ochronny', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 300, y: 0 },
      { id: 'n3', x: 300, y: 300 },
    ];
    p.walls = [createWall(p, 'n1', 'n2', { id: 'a' }), createWall(p, 'n2', 'n3', { id: 'b' })];
    const j = analyzeJunctions(p);
    expect(j.get('a')!.endB).toBe('corner');
    expect(j.get('b')!.endA).toBe('corner');
    expect(j.get('a')!.extraStuds + j.get('b')!.extraStuds).toBe(1);
    expect(j.get('a')!.externalEdges + j.get('b')!.externalEdges).toBe(1);
  });

  it('trójnik: koniec ściany na środku innej', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 400, y: 0 },
      { id: 'n3', x: 200, y: 0 },
      { id: 'n4', x: 200, y: 300 },
    ];
    p.walls = [createWall(p, 'n1', 'n2', { id: 'a' }), createWall(p, 'n3', 'n4', { id: 'b' })];
    const j = analyzeJunctions(p);
    expect(j.get('b')!.endA).toBe('tee-abut');
    expect(j.get('a')!.extraStuds).toBe(1);
  });

  it('wolny koniec ściany działowej – dwie krawędzie z narożnikiem', () => {
    const p = straightWall(300);
    p.walls[0].endB = 'free';
    expect(analyzeJunctions(p).get(p.walls[0].id)!.externalEdges).toBe(2);
  });
});

describe('sufit podwieszany CD 60', () => {
  it('pokój 4×3 m: profile nośne co 100 cm, montażowe co 50 cm', () => {
    const p = createProject();
    const c = createCeiling(p, [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ]);
    const grid = ceilingGrid(c);
    expect(grid.filter((g) => g.level === 'main')).toHaveLength(3); // y = 40, 140, 240
    expect(grid.filter((g) => g.level === 'secondary')).toHaveLength(7); // x = 50..350
    p.ceilings = [c];
    const calc = calculateProject(p);
    expect(calc.stats.ceilingAreaM2).toBeCloseTo(12);
    const krz = calc.total.find((l) => l.key === 'LACZNIK_KRZ')!;
    expect(krz.qty).toBe(21);
    const hangers = calc.total.find((l) => l.key === 'WIESZAK_NONIUSZ')!;
    expect(hangers.qty).toBe(15); // 3 linie × ceil(4/0,9)=5
  });

  it('sufit w kształcie L liczy pole wielokąta', () => {
    const p = createProject();
    p.ceilings = [
      createCeiling(p, [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 200 },
        { x: 200, y: 200 },
        { x: 200, y: 400 },
        { x: 0, y: 400 },
      ]),
    ];
    expect(calculateProject(p).stats.ceilingAreaM2).toBeCloseTo(12);
  });
});

import { findRoomAt } from '../geometry/rooms';
describe('wykrywanie pomieszczenia', () => {
  it('znajduje obrys z czterech ścian', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 300, y: 0 },
      { id: 'n3', x: 300, y: 200 },
      { id: 'n4', x: 0, y: 200 },
    ];
    p.walls = [
      createWall(p, 'n1', 'n2'),
      createWall(p, 'n2', 'n3'),
      createWall(p, 'n3', 'n4'),
      createWall(p, 'n4', 'n1'),
    ];
    const room = findRoomAt(p, { x: 100, y: 100 });
    expect(room).toHaveLength(4);
    expect(findRoomAt(p, { x: 500, y: 100 })).toBeNull();
  });
});
