import { describe, expect, it } from 'vitest';
import { wallStudLabel, wallSystemById, wallTieCount, WALL_SYSTEMS, type WallSystem } from '../catalog/rigips';
import { SINIAT_SKIPPED } from '../catalog/siniat';
import { RIGIPS_SKIPPED } from '../catalog/rigips.gen';
import { analyzeJunctions } from '../geometry/geometry';
import { createOpening, createProject, createWall } from '../model/factory';
import { wallRequirement } from './materials';

/** Zużycie na 1 m² ściany o zadanych wymiarach (jak wallConsumption, ale z wysokością z karty) */
function perM2(sys: WallSystem, heightCm: number, opts: { doubleStuds?: boolean; lengthCm?: number; door?: boolean } = {}) {
  const p = createProject();
  const L = opts.lengthCm ?? 600;
  p.nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: L, y: 0 },
  ];
  const w = createWall(p, 'a', 'b', {
    systemId: sys.id,
    boardId: sys.defaultBoard,
    height: heightCm,
    studSpacing: 60,
    insulation: false,
    doubleStuds: opts.doubleStuds,
  });
  if (opts.door) w.openings.push(createOpening('door', 200));
  p.walls = [w];
  const j = analyzeJunctions(p).get(w.id)!;
  const { req, info } = wallRequirement(p, w, j, sys);
  const a = info.netAreaM2;
  const mb = (id: string) => (req.pieces[id] ?? []).reduce((x, y) => x + y, 0) / a;
  const n = (id: string) => (req.counts[id] ?? 0) / a;
  const boards = Object.values(req.boardArea).reduce((x, y) => x + y, 0) / a;
  return { mb, n, boards, req };
}

const near = (v: number, card: number, tol: number) => {
  expect(v).toBeGreaterThan(card * (1 - tol));
  expect(v).toBeLessThan(card * (1 + tol));
};

describe('słupki z profili UA (Siniat UAR) – zużycie z kart', () => {
  it('okładzina UAR50 1×12,5 przy 3,88 m: UA 1,8 mb, kątownik UA 0,85 szt., śruby M8 2 szt. na m², bez CW', () => {
    const sys = wallSystemById('SN-O-UA50-1');
    expect(sys.studKind).toBe('UA');
    expect(wallStudLabel(sys)).toBe('UA 50');
    const c = perM2(sys, 388);
    near(c.mb('UA50'), 1.8, 0.1);
    near(c.n('KATUA'), 0.85, 0.15);
    near(c.n('SRUBA_M8'), 2.0, 0.15);
    expect(c.mb('CW50')).toBe(0);
    expect(c.mb('UW50')).toBeGreaterThan(0);
    near(c.boards, 1, 0.05);
  });
  it('okładzina UARUAR50 przy 5 m: UA 3,6 mb, para skręcona M8 (8 szt./m²), kątowniki pod jednym profilem pary', () => {
    const c = perM2(wallSystemById('SN-O-UA50-1'), 500, { doubleStuds: true });
    near(c.mb('UA50'), 3.6, 0.1);
    near(c.n('SRUBA_M8'), 8.0, 0.15);
    // karta: 1,0 szt./m²; rysunek: jeden kątownik na końcu pary → 2 na parę
    near(c.n('KATUA'), 0.73, 0.1);
  });
  it('obudowa pionu A/UAR75 ma wysokość z karty i liczy UA 75', () => {
    const sys = wallSystemById('SN-SZ-UA75-1');
    expect(sys.category).toBe('szacht');
    const v = sys.variants!.find((x) => x.code === '87,5A/UAR75' && x.board === 'SN-EXP12.5')!;
    expect(v.maxHeight).toBeGreaterThan(300);
    expect(sys.variants!.some((x) => x.doubleStuds && x.code?.includes('AA/UAR75'))).toBe(true);
    expect(perM2(sys, 300).mb('UA75')).toBeGreaterThan(1.5);
  });
  it('otwór w okładzinie na UA: ościeża z UA z kątownikami, bez CW', () => {
    const sys = wallSystemById('SN-O-UA75-1');
    const c = perM2(sys, 300, { door: true });
    expect(c.mb('CW75')).toBe(0);
    expect(c.req.pieces.UA75?.filter((l) => Math.abs(l - 3) < 1e-9).length).toBeGreaterThanOrEqual(2);
  });
});

describe('słupki UU (dwa U w skrzynkę, płyta rdzeniowa) – Siniat Nida Szacht UU', () => {
  it('UU75 1×12,5 + 1×12,5 przy 5,21 m: U 75 4,3 mb, UD 3,6 mb, płyty 2 m² na m²', () => {
    const sys = wallSystemById('SN-SZ-UU75-2');
    expect([sys.studKind, sys.layers, sys.sides]).toEqual(['UU', 2, 1]);
    expect(sys.maxHeight?.[60]).toBe(521);
    const c = perM2(sys, 521);
    near(c.mb('UW75'), 4.3, 0.1);
    near(c.mb('UD30'), 3.6, 0.1);
    near(c.boards, 2, 0.05);
    expect(c.mb('CW75')).toBe(0);
  });
  it('UU100 1×12,5 + 2×12,5: trzy warstwy, EI 90', () => {
    const sys = wallSystemById('SN-SZ-UU100-3');
    expect(sys.layers).toBe(3);
    expect(sys.variants!.every((v) => v.fire === 90)).toBe(true);
  });
});

describe('kotwienie słupków do ściany: kątowniki (C100/L, CC100/L) i przewiązki PWA', () => {
  it('liczba kotew na słupek: kątowniki z końcami, PWA tylko pośrednie', () => {
    expect(wallTieCount({ kind: 'angle', spacing: 250 }, 10)).toBe(5);
    expect(wallTieCount({ kind: 'angle', spacing: 250 }, 2.6)).toBe(3);
    expect(wallTieCount({ kind: 'pwa', spacing: 100 }, 2.8)).toBe(2);
    expect(wallTieCount({ kind: 'pwa', spacing: 100 }, 0.8)).toBe(0);
  });
  it('C100/L do 10 m, zdwojone CC100/L do 12 m (wysokość z karty, nie rozstaw kątowników 2,5 m)', () => {
    const sys = wallSystemById('SN-O-C100L-1');
    expect(sys.wallTie).toEqual({ kind: 'angle', spacing: 250 });
    expect(sys.maxHeight?.[60]).toBe(1000);
    const cc = sys.variants!.filter((v) => v.code === 'CC100/L-12,5');
    expect(cc.length).toBeGreaterThan(0);
    for (const v of cc) expect([v.doubleStuds, v.maxHeight]).toEqual([true, 1200]);
    expect(sys.info).not.toMatch(/nie liczy/);
  });
  it('CC100/L przy 12 m: C100 3,6 mb, kątownik 0,8 szt. na m²; C100/L przy 10 m: 0,8 szt.', () => {
    const sys = wallSystemById('SN-O-C100L-1');
    const cc = perM2(sys, 1200, { doubleStuds: true });
    near(cc.mb('CW100'), 3.6, 0.1);
    near(cc.n('KATUA'), 0.8, 0.15);
    near(perM2(sys, 1000).n('KATUA'), 0.8, 0.15);
  });
  it('C50/PWA przy 2,8 m: przewiązki PWA 1,1 szt. na m²', () => {
    const sys = WALL_SYSTEMS.find((s) => s.maker === 'siniat' && s.wallTie?.kind === 'pwa' && s.profile === 50 && s.layers === 1)!;
    expect(sys.wallTie?.spacing).toBe(100);
    near(perM2(sys, 280).n('PWA'), 1.1, 0.2);
  });
});

describe('lista pominiętych', () => {
  it('Siniat: UAR, UARUAR, UU i CC100/L nie są już pominięte (poza poszyciem 12,5 + 15)', () => {
    const lines = SINIAT_SKIPPED.filter((l) => !l.startsWith('odmiany z poszyciem z płyt różnej grubości'));
    for (const l of lines) expect(l, l.slice(0, 60)).not.toMatch(/UAR|UU\d|CC100/);
  });
  it('Rigips 3.50.10 (słupki z UW 100, płyta rdzeniowa) jest w katalogu', () => {
    expect(RIGIPS_SKIPPED.some((l) => l.startsWith('3.50.10 '))).toBe(false);
    const s = WALL_SYSTEMS.find((x) => x.variants?.some((v) => v.code === '3.50.10'))!;
    expect([s.studKind, s.profile, s.category]).toEqual(['UU', 100, 'szacht']);
  });
});

describe('dobór', () => {
  it('przy tej samej płycie i rozstawie okładzina na CW wyprzedza okładzinę na UA', async () => {
    const { recommendWalls } = await import('./recommend');
    const picks = recommendWalls({ purpose: 'lining', heightCm: 300, room: 'dry', fire: 0, acoustic: 'any', maker: 'siniat' });
    const ua = picks.findIndex((p) => p.system.studKind === 'UA');
    const c = picks.findIndex((p) => p.system.frame === 'single' && !p.system.studKind && p.system.layers === 1);
    if (ua >= 0 && c >= 0) expect(c).toBeLessThan(ua);
  });
});
