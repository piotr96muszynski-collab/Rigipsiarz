import { boardById, ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { maxCeilingHeight } from '../calc/ceilingLevels';
import type { Attic, Ceiling, Lining, Opening, OpeningKind, Point, Project, Wall } from './types';

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).slice(0, 12);

export function createProject(name = 'Nowy projekt'): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    walls: [],
    ceilings: [],
    bought: {},
    settings: {
      wasteEnabled: true,
      waste: 10,
      defaultHeight: 260,
      defaultWallSystem: 'W-CW75-1',
      defaultCeilingSystem: 'S-CD-2P-1',
      gridSnap: 5,
    },
  };
}

export function createWall(p: Project, a: string, b: string, overrides: Partial<Wall> = {}): Wall {
  const sys = wallSystemById(overrides.systemId ?? p.settings.defaultWallSystem);
  // ustawienia nowych ścian z planu dotyczą tylko systemu domyślnego
  const def = sys.id === p.settings.defaultWallSystem ? (p.settings.wallDefaults ?? {}) : {};
  return {
    id: uid(),
    a,
    b,
    height: p.settings.defaultHeight,
    systemId: sys.id,
    boardId: def.boardId ?? sys.defaultBoard,
    studSpacing: def.studSpacing ?? sys.studSpacing,
    insulation: def.insulation ?? sys.insulationDefault,
    ...(def.insulationThickness ? { insulationThickness: def.insulationThickness } : {}),
    endA: 'existing-wall',
    endB: 'existing-wall',
    openings: [],
    ...overrides,
  };
}

/** Istniejąca ściana (obrys): mur o podanej grubości, bez zabudowy */
export function createExistingWall(p: Project, a: string, b: string, overrides: Partial<Wall> = {}): Wall {
  return createWall(p, a, b, { kind: 'existing', thickness: 25, linings: [], insulation: false, ...overrides });
}

/** Domyślna okładzina: suchy tynk (płyta na kleju gipsowym) */
export function createLining(side: 1 | -1, systemId = 'O-KLEJ'): Lining {
  const sys = wallSystemById(systemId);
  return { side, systemId: sys.id, boardId: sys.defaultBoard, studSpacing: sys.studSpacing, insulation: false };
}

export function createOpening(kind: OpeningKind, offset: number, overrides: Partial<Opening> = {}): Opening {
  return kind === 'door'
    ? { id: uid(), kind, offset, width: 90, height: 205, sill: 0, reinforced: true, ...overrides }
    : { id: uid(), kind, offset, width: 120, height: 120, sill: 90, reinforced: false, ...overrides };
}

/**
 * Nowy sufit: strop na wysokości `defaultHeight` (tam kończą się ściany), spód płyt na `ceilingHeight`
 * z ustawień, ale nie wyżej, niż pozwala minimalna wysokość zabudowy systemu.
 */
export function createCeiling(p: Project, points: Point[], overrides: Partial<Ceiling> = {}): Ceiling {
  const sys = ceilingSystemById(overrides.systemId ?? p.settings.defaultCeilingSystem);
  const boardId = overrides.boardId ?? boardById(sys.defaultBoard).id;
  const slabHeight = overrides.slabHeight ?? p.settings.defaultHeight;
  const top = maxCeilingHeight(slabHeight, sys, boardId);
  return {
    id: uid(),
    points,
    systemId: sys.id,
    boardId,
    insulation: false,
    direction: 0,
    ...overrides,
    slabHeight,
    height: Math.min(overrides.height ?? p.settings.ceilingHeight ?? top, top),
  };
}

/** Po zmianie stropu, systemu lub płyty: sufit nie może wejść w minimalną wysokość zabudowy */
export function fitCeilingHeight(c: Ceiling) {
  c.slabHeight ??= c.height;
  c.height = Math.min(c.height, maxCeilingHeight(c.slabHeight, ceilingSystemById(c.systemId), c.boardId));
}

/** Nowa zabudowa poddasza: dach dwuspadowy 40°, krokwie 8×18 co 90 cm, jętka na 2,60 m, system Rigips 4.70.06 */
export function createAttic(overrides: Partial<Attic> = {}): Attic {
  const sys = ceilingSystemById(overrides.systemId ?? 'S-PODD-1');
  return {
    id: uid(),
    roof: 'gable',
    width: 800,
    length: 1000,
    kneeLeft: 100,
    kneeRight: 100,
    pitch: 40,
    collarHeight: 260,
    rafterSpacing: 90,
    rafterWidth: 8,
    rafterHeight: 18,
    firstRafter: 10,
    systemId: sys.id,
    boardId: sys.defaultBoard,
    woolBetween: 150,
    woolUnder: 50,
    ...overrides,
  };
}

/** Szybkie wyliczenie: sama zabudowa poddasza */
export function quickAtticProject(a: Attic): Project {
  const p = createProject(`Poddasze ${a.width / 100}×${a.length / 100} m`);
  p.attics = [a];
  return p;
}

/** Projekt przykładowy – pokój z działówką i drzwiami */
export function sampleProject(): Project {
  const p = createProject('Przykład: pokój z garderobą');
  const pts = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ];
  p.nodes = pts.map((pt) => ({ id: uid(), ...pt }));
  const [n0, n1, n2, n3] = p.nodes;
  const w1 = createWall(p, n0.id, n1.id, { systemId: 'O-CW50-1', boardId: 'RB12.5', insulation: false });
  const w2 = createWall(p, n1.id, n2.id);
  w2.openings.push(createOpening('door', 100));
  const w3 = createWall(p, n2.id, n3.id, { systemId: 'O-CW50-1', boardId: 'RB12.5', insulation: false });
  w3.openings.push(createOpening('window', 140));
  p.walls = [w1, w2, w3];
  p.ceilings = [createCeiling(p, pts)];
  return p;
}

export interface QuickInput {
  mode: 'wall' | 'room' | 'ceiling';
  /** cm */
  length: number;
  width: number;
  height: number;
  wallSystemId: string;
  ceilingSystemId: string;
  withCeiling: boolean;
  doors: number;
  windows: number;
}

/** Szybkie wyliczenie: pojedyncza ściana, pomieszczenie (4 ściany + opcjonalny sufit) albo sam sufit */
export function quickProject(q: QuickInput): Project {
  const label =
    q.mode === 'wall'
      ? `Ściana ${q.length / 100} m × ${q.height / 100} m`
      : q.mode === 'room'
        ? `Pomieszczenie ${q.width / 100}×${q.length / 100} m, wys. ${q.height / 100} m`
        : `Sufit ${q.width / 100}×${q.length / 100} m`;
  const p = createProject(label);
  p.settings.defaultHeight = q.height;
  p.settings.defaultWallSystem = q.wallSystemId;
  p.settings.defaultCeilingSystem = q.ceilingSystemId;
  const rect = [
    { x: 0, y: 0 },
    { x: q.length, y: 0 },
    { x: q.length, y: q.width },
    { x: 0, y: q.width },
  ];
  if (q.mode === 'wall') {
    p.nodes = [
      { id: uid(), ...rect[0] },
      { id: uid(), ...rect[1] },
    ];
    const w = createWall(p, p.nodes[0].id, p.nodes[1].id);
    distributeOpenings(w, q.length, q.doors, q.windows);
    p.walls = [w];
  } else {
    if (q.mode === 'room') {
      p.nodes = rect.map((pt) => ({ id: uid(), ...pt }));
      p.walls = p.nodes.map((n, i) => createWall(p, n.id, p.nodes[(i + 1) % 4].id));
      // drzwi i okna rozdzielamy po kolei na ściany
      let d = q.doors;
      let win = q.windows;
      p.walls.forEach((w, i) => {
        const len = i % 2 === 0 ? q.length : q.width;
        const dd = d > 0 ? 1 : 0;
        const ww = win > 0 && (i >= 1 || q.windows > 3) ? 1 : 0;
        d -= dd;
        win -= ww;
        distributeOpenings(w, len, dd, ww);
      });
    }
    if (q.mode === 'ceiling' || q.withCeiling) p.ceilings = [createCeiling(p, rect, { slabHeight: q.height })];
  }
  return p;
}

function distributeOpenings(w: Wall, lengthCm: number, doors: number, windows: number) {
  const items: Opening[] = [];
  for (let i = 0; i < doors; i++) items.push(createOpening('door', 0));
  for (let i = 0; i < windows; i++) items.push(createOpening('window', 0));
  const total = items.reduce((a, o) => a + o.width, 0);
  const gap = (lengthCm - total) / (items.length + 1);
  if (gap < 10) return;
  let x = gap;
  for (const o of items) {
    o.offset = Math.round(x);
    x += o.width + gap;
  }
  w.openings = items;
}

/** Kopia projektu z nowym id i nazwą „… (kopia)”. Identyfikatory elementów zostają – są unikalne tylko w obrębie projektu. */
export function duplicateProject(p: Project, now = Date.now()): Project {
  const copy: Project = structuredClone(p);
  copy.id = uid();
  copy.name = `${p.name} (kopia)`;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}
