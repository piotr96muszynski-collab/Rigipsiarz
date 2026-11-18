import { describe, expect, it } from 'vitest';
import { OPENING_JOINT_MIN, boardFace, ceilingBoardLayout, cutOpenings, hangerPositions, pieceArea, pieceOutline, splicePositions, wallLayout } from './layout';
import { calculateProject, ceilingGrid } from './materials';
import { analyzeJunctions } from '../geometry/geometry';
import { createCeiling, createOpening, createProject, createWall, uid } from '../model/factory';
import type { Project } from '../model/types';

function wallProject(lengthCm: number, heightCm = 260, systemId = 'W-CW75-1'): Project {
  const p = createProject();
  p.nodes = [
    { id: uid(), x: 0, y: 0 },
    { id: uid(), x: lengthCm, y: 0 },
  ];
  p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { height: heightCm, systemId, boardId: 'RB12.5' })];
  return p;
}

const layoutOf = (p: Project, i = 0) => wallLayout(p, p.walls[i], analyzeJunctions(p).get(p.walls[i].id)!);

/** Suma długości CW z rysunku (słupki w rozstawie, ościeża CW i dodatkowe) */
const drawnCW = (p: Project, i = 0) =>
  layoutOf(p, i)
    .studs.filter((s) => s.kind !== 'jamb-ua')
    .flatMap((s) => s.segments)
    .reduce((a, [y0, y1]) => a + (y1 - y0), 0);

const calcCW = (p: Project, i = 0) =>
  (calculateProject(p).walls.get(p.walls[i].id)!.req.pieces['CW75'] ?? []).reduce((a, b) => a + b, 0);

describe('rysunek ściany = wyliczenie', () => {
  it('słupki co 60 cm na ścianie 3 m', () => {
    const l = layoutOf(wallProject(300));
    expect(l.studs.map((s) => Math.round(s.x * 100))).toEqual([0, 60, 120, 180, 240, 300]);
  });

  it('suma CW na rysunku zgadza się z listą materiałów (drzwi i okno)', () => {
    const p = wallProject(500);
    p.walls[0].openings.push(createOpening('door', 70, { reinforced: false }), createOpening('window', 250));
    expect(drawnCW(p)).toBeCloseTo(calcCW(p), 6);
    const l = layoutOf(p);
    expect(l.studs.filter((s) => s.kind === 'jamb')).toHaveLength(4);
    expect(l.studs.some((s) => s.kind === 'short')).toBe(true);
    expect(l.tracks.filter((t) => t.kind === 'header')).toHaveLength(2);
    expect(l.tracks.filter((t) => t.kind === 'sill')).toHaveLength(1);
    // UW przy posadzce przerwany drzwiami
    expect(l.tracks.filter((t) => t.kind === 'floor')).toHaveLength(2);
  });

  it('drzwi wzmocnione: ościeża UA zamiast CW', () => {
    const p = wallProject(400);
    p.walls[0].openings.push(createOpening('door', 100));
    expect(layoutOf(p).studs.filter((s) => s.kind === 'jamb-ua')).toHaveLength(2);
    expect(drawnCW(p)).toBeCloseTo(calcCW(p), 6);
  });

  it('narożnik L: dodatkowy słupek w narożniku tylko na jednej ścianie', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n0', x: 0, y: 0 },
      { id: 'n1', x: 300, y: 0 },
      { id: 'n2', x: 300, y: 200 },
    ];
    p.walls = [createWall(p, 'n0', 'n1', { id: 'w1' }), createWall(p, 'n1', 'n2', { id: 'w2' })];
    const extra1 = layoutOf(p, 0).studs.filter((s) => s.kind === 'extra');
    const extra2 = layoutOf(p, 1).studs.filter((s) => s.kind === 'extra');
    // tuż za rusztem ściany dochodzącej (połowa CW 75 + połowa półki słupka), pod krawędziami płyt
    expect(extra1.map((s) => +s.x.toFixed(4))).toEqual([3 - 0.0375 - 0.025]);
    expect(extra2).toHaveLength(0);
    expect(drawnCW(p, 0)).toBeCloseTo(calcCW(p, 0), 6);
    // ruszt ściany ciągłej sięga do zewnętrznego lica rusztu drugiej ściany, płyty zachodzą na narożnik
    const l1 = layoutOf(p, 0);
    expect(Math.max(...l1.studs.map((s) => s.x))).toBeCloseTo(3.0375, 6);
    expect(l1.faces.map((f) => +f.x1.toFixed(4)).sort()).toEqual([2.95, 3.05]);
    // druga ściana zaczyna się za rusztem pierwszej
    expect(layoutOf(p, 1).faces.map((f) => +f.x0.toFixed(4)).sort()).toEqual([-0.0375, 0.0375]);
  });

  it('narożnik przy dwóch warstwach: słupek trzyma krawędzie obu warstw od wewnątrz', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n0', x: 0, y: 0 },
      { id: 'n1', x: 300, y: 0 },
      { id: 'n2', x: 300, y: 200 },
    ];
    const opt = { systemId: 'W-CW75-2', boardId: 'RB12.5' };
    p.walls = [createWall(p, 'n0', 'n1', { id: 'w1', ...opt }), createWall(p, 'n1', 'n2', { id: 'w2', ...opt })];
    const l = layoutOf(p, 0);
    const stud = l.studs.find((s) => s.kind === 'extra')!.x;
    const innerEnds = l.faces.filter((f) => f.x1 < 3).map((f) => f.x1);
    expect(innerEnds).toHaveLength(2);
    for (const x of innerEnds) expect(Math.abs(x - stud)).toBeLessThan(0.025);
  });

  it('trójnik: dodatkowy słupek w miejscu dochodzącej ściany', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n0', x: 0, y: 0 },
      { id: 'n1', x: 400, y: 0 },
      { id: 'n2', x: 150, y: 0.5 },
      { id: 'n3', x: 150, y: 300 },
    ];
    p.walls = [createWall(p, 'n0', 'n1', { id: 'w1' }), createWall(p, 'n2', 'n3', { id: 'w2' })];
    const extra = layoutOf(p, 0).studs.filter((s) => s.kind === 'extra');
    expect(extra).toHaveLength(1);
    expect(extra[0].x).toBeCloseTo(1.5, 2);
  });
});

describe('rozkład płyt na ścianie', () => {
  it('ściana 3,0 × 2,6: trzy arkusze, ostatni docięty', () => {
    const pcs = boardFace(3, 2.6, 2.6, 0);
    expect(pcs).toHaveLength(3);
    expect(pcs.map((b) => b.cut)).toEqual([false, false, true]);
  });

  it('druga strona przesunięta o rozstaw słupków', () => {
    const l = layoutOf(wallProject(300));
    expect(l.faces.map((f) => f.offset)).toEqual([0, 0.6]);
    expect(l.faces[1].pieces[0].x1).toBeCloseTo(0.6);
  });

  it('ściana wyższa od arkusza: dostawki mijankowo', () => {
    const pcs = boardFace(2.4, 3.5, 3, 0);
    const col0 = pcs.filter((b) => b.x0 === 0).map((b) => [b.y0, b.y1]);
    const col1 = pcs.filter((b) => b.x0 > 0).map((b) => [b.y0, b.y1]);
    expect(col0[0]).toEqual([0, 3]);
    expect(col1[0][1]).toBeCloseTo(0.5);
  });

  it('powierzchnia płyt z rozkładu = powierzchnia brutto ściany', () => {
    const pcs = boardFace(4.37, 2.75, 2.75, 0.6);
    const area = pcs.reduce((a, b) => a + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    expect(area).toBeCloseTo(4.37 * 2.75, 6);
  });

});

describe('płyty przy otworach: wycięcie w kształt L', () => {
  const jambs = (l: ReturnType<typeof layoutOf>) => l.openings.flatMap((o) => [o.x0, o.x1]);
  const farFromJambs = (l: ReturnType<typeof layoutOf>) => {
    for (const f of l.faces) for (const x of f.joints) for (const j of jambs(l)) expect(Math.abs(x - j)).toBeGreaterThanOrEqual(OPENING_JOINT_MIN - 1e-6);
  };

  it('drzwi z ościeżem na styku arkuszy: styk przeniesiony, płyty w L, brak ostrzeżeń', () => {
    const p = wallProject(400);
    p.walls[0].openings.push(createOpening('door', 120, { reinforced: false }));
    const l = layoutOf(p);
    farFromJambs(l);
    for (const f of l.faces) {
      expect(f.jambJoints).toEqual([]);
      expect(f.pieces.filter((b) => b.shape === 'L').length).toBeGreaterThanOrEqual(2);
      // pas nie szerszy od arkusza
      for (const b of f.pieces) expect(b.x1 - b.x0).toBeLessThanOrEqual(1.2 + 1e-6);
      // styki zawsze na słupku
      for (const x of f.joints) expect(l.studs.some((st) => Math.abs(st.x - x) < 0.005)).toBe(true);
    }
  });

  it('styk płyt nad drzwiami: co najmniej 15 cm od ościeży (obie strony, wszystkie warstwy)', () => {
    for (const sys of ['W-CW75-1', 'W-CW75-2', 'W-CW100-2'])
      for (const off of [40, 75, 100, 133, 180]) {
        const p = wallProject(500, 260, sys);
        p.walls[0].openings.push(createOpening('door', off, { reinforced: false }), createOpening('window', 330, { width: 100 }));
        const l = layoutOf(p);
        for (const f of l.faces) {
          expect(f.jambJoints).toEqual([]);
          for (const x of f.joints) for (const j of jambs(l)) expect(Math.abs(x - j)).toBeGreaterThanOrEqual(OPENING_JOINT_MIN - 1e-6);
        }
      }
  });

  it('druga warstwa: styki przesunięte względem pierwszej', () => {
    const p = wallProject(500, 260, 'W-CW75-2');
    p.walls[0].openings.push(createOpening('door', 75, { reinforced: false }));
    const l = layoutOf(p);
    for (const side of [0, 1]) {
      const [a, b] = l.faces.filter((f) => f.side === side);
      for (const x of b.joints) expect(a.joints.some((y) => Math.abs(x - y) < 0.05)).toBe(false);
      expect(b.layerJoints).toEqual([]);
    }
  });

  it('styki warstw bez miejsca na minięcie: dodatkowy słupek pod styk, doliczony do CW', () => {
    // drzwi 90 cm przy rozstawie 60: bez dodatkowego słupka obie warstwy miałyby styk na tym samym słupku
    const p = wallProject(500, 260, 'W-CW75-2');
    p.walls[0].openings.push(createOpening('door', 100, { reinforced: false }), createOpening('window', 300, { width: 100 }));
    const l = layoutOf(p);
    const extra = l.studs.filter((st) => st.kind === 'joint');
    expect(extra.length).toBeGreaterThan(0);
    for (const f of l.faces) {
      expect(f.layerJoints).toEqual([]);
      expect(f.jambJoints).toEqual([]);
      for (const x of f.joints) expect(l.studs.some((st) => Math.abs(st.x - x) < 0.005 && st.segments.length)).toBe(true);
    }
    // słupek pod styk w połowie rozstawu, zawsze z dala od ościeży
    for (const st of extra) for (const o of l.openings) expect(Math.min(Math.abs(st.x - o.x0), Math.abs(st.x - o.x1))).toBeGreaterThanOrEqual(OPENING_JOINT_MIN - 1e-6);
    expect(drawnCW(p)).toBeCloseTo(calcCW(p), 6);
  });

  it('bez otworów dodatkowych słupków nie ma', () => {
    for (const sys of ['W-CW75-1', 'W-CW75-2'])
      expect(layoutOf(wallProject(500, 260, sys)).studs.filter((st) => st.kind === 'joint')).toHaveLength(0);
  });

  it('element L: obrys z sześciu wierzchołków, pole = arkusz − wycięcie', () => {
    const pcs = cutOpenings([{ x0: 0.6, x1: 1.8, y0: 0, y1: 2.6, cut: false }], [
      { x0: 1.2, x1: 2.1, sill: 0, top: 2.05 } as never,
    ]);
    expect(pcs).toHaveLength(1);
    expect(pcs[0].shape).toBe('L');
    expect(pieceOutline(pcs[0])[0]).toHaveLength(6);
    expect(pieceArea(pcs[0])).toBeCloseTo(1.2 * 2.6 - 0.6 * 2.05, 6);
  });

  it('element w świetle okna dzieli się na pas nad i pod oknem', () => {
    const win = { x0: 0.3, x1: 2, sill: 0.9, top: 2.1 } as never;
    const pcs = cutOpenings([{ x0: 0.6, x1: 1.2, y0: 0, y1: 2.6, cut: false }], [win]);
    expect(pcs.map((b) => [b.y0, b.y1])).toEqual([
      [0, 0.9],
      [2.1, 2.6],
    ]);
  });

  it('powierzchnia płyt z rozkładu = netto ściany; drobny odpad z wycięć doliczony do zakupu', () => {
    const p = wallProject(400);
    p.walls[0].openings.push(createOpening('door', 105, { reinforced: false }));
    const l = layoutOf(p);
    const area = l.faces.flatMap((f) => f.pieces).reduce((a, b) => a + pieceArea(b), 0);
    expect(area).toBeCloseTo((4 * 2.6 - 0.9 * 2.05) * 2, 6);
    const r = calculateProject(p).walls.get(p.walls[0].id)!;
    const total = Object.values(r.req.boardArea).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(area + (r.info.cutWasteM2 ?? 0), 6);
  });

  it('wysoka ściana: styk poziomy przy ościeżu nie wypada w linii nadproża', () => {
    const p = wallProject(400, 320);
    p.walls[0].openings.push(createOpening('door', 100, { reinforced: false, height: 300 }));
    const l = layoutOf(p);
    for (const f of l.faces)
      for (const b of f.pieces)
        if (b.notches?.length) for (const y of [b.y0, b.y1]) if (y > 0.01 && y < 3.19) expect(Math.abs(y - 3)).toBeGreaterThanOrEqual(OPENING_JOINT_MIN - 1e-6);
  });
});

describe('ruszt sufitu', () => {
  it('wieszaki rozmieszczone równo, nie rzadziej niż co rozstaw', () => {
    const h = hangerPositions(0, 400, 90);
    expect(h).toHaveLength(5);
    expect(h[1] - h[0]).toBeCloseTo(80);
    expect(hangerPositions(0, 100, 90)).toHaveLength(2);
  });

  it('łączniki wzdłużne co 4 m', () => {
    expect(splicePositions(0, 390)).toEqual([]);
    expect(splicePositions(10, 900)).toEqual([410, 810]);
  });

  it('liczba wieszaków w zestawieniu = suma z rysunku', () => {
    const p = createProject();
    const c = createCeiling(p, [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 380 },
      { x: 0, y: 380 },
    ]);
    p.ceilings = [c];
    const drawn = ceilingGrid(c)
      .filter((g) => g.level === 'main')
      .flatMap((g) => g.segments.flatMap(([a, b]) => hangerPositions(a, b, 90))).length;
    const counted = calculateProject(p).ceilings.get(c.id)!.req.counts['WIESZAK_NONIUSZ'];
    expect(drawn).toBe(counted);
  });

  it('płyty sufitowe pokrywają cały prostokąt, styki poprzeczne na profilach', () => {
    const p = createProject();
    const c = createCeiling(p, [
      { x: 0, y: 0 },
      { x: 520, y: 0 },
      { x: 520, y: 330 },
      { x: 0, y: 330 },
    ]);
    const { pieces, stagger } = ceilingBoardLayout(c);
    const area = pieces.reduce((a, b) => a + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    expect(area).toBeCloseTo(520 * 330, 3);
    // rozstaw montażowych 50 cm → styki poprzeczne w wielokrotności 50 cm od ściany
    for (const b of pieces) if (b.x1 < 520) expect(b.x1 % 50).toBe(0);
    expect(stagger).toBeGreaterThanOrEqual(40);
  });
});

describe('rysunek ściany – inne rodzaje rusztu', () => {
  const sumOf = (p: Project, pid: string) =>
    (calculateProject(p).walls.get(p.walls[0].id)!.req.pieces[pid] ?? []).reduce((a, b) => a + b, 0);
  const drawn = (p: Project) =>
    layoutOf(p)
      .studs.filter((s) => s.kind !== 'jamb-ua')
      .flatMap((s) => s.segments)
      .reduce((a, [y0, y1]) => a + (y1 - y0), 0);

  it('okładzina na CD: profile CD 60 i UD 30, bez UA', () => {
    const p = wallProject(400, 260, 'O-CD-1');
    p.walls[0].openings.push(createOpening('door', 100));
    const l = layoutOf(p);
    expect(l.studLabel).toBe('CD 60');
    expect(l.trackLabel).toBe('UD 30');
    expect(l.studs.some((s) => s.kind === 'jamb-ua')).toBe(false);
    expect(drawn(p)).toBeCloseTo(sumOf(p, 'CD60'), 6);
  });

  it('ściana podwójna: dwa rzędy, w wyliczeniu dwa razy tyle CW co na rysunku jednego rzędu', () => {
    const p = wallProject(300, 260, 'W-2CW75-2');
    const l = layoutOf(p);
    expect(l.rows).toBe(2);
    expect(2 * drawn(p)).toBeCloseTo(sumOf(p, 'CW75'), 6);
  });

  it('suchy tynk na klej: bez rusztu, same płyty', () => {
    const l = layoutOf(wallProject(300, 260, 'O-KLEJ'));
    expect(l.studs).toHaveLength(0);
    expect(l.tracks).toHaveLength(0);
    expect(l.faces[0].pieces.length).toBeGreaterThan(0);
  });
});

describe('sufit przęsłowy na CW', () => {
  it('płyty poprzecznie do CW, styki na profilach', () => {
    const p = createProject();
    const c = createCeiling(
      p,
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 250 },
        { x: 0, y: 250 },
      ],
      { systemId: 'S-CW50-1', direction: 90 },
    );
    const sp = 50;
    const { pieces } = ceilingBoardLayout(c);
    // CW biegną wzdłuż Y (kierunek 90°), płyty wzdłuż X – styki w X na wielokrotności rozstawu
    for (const b of pieces) if (b.x1 < 300) expect(b.x1 % sp === 0 || b.x1 % 40 === 0).toBe(true);
    const area = pieces.reduce((a, b) => a + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
    expect(area).toBeCloseTo(300 * 250, 3);
  });
});
