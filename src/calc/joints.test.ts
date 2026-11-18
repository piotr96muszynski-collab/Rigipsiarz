import { describe, expect, it } from 'vitest';
import { analyzeJoints, edgesTotal, wallThicknessMm } from './joints';
import { calculateProject } from './materials';
import { createCeiling, createOpening, createProject, createWall } from '../model/factory';
import { wallSystemById } from '../catalog/rigips';
import { COMPOUNDS, CORNER_TYPES, FINISHING_PRODUCTS, boardEdge } from '../catalog/finishing';
import { BOARDS, PRODUCTS } from '../catalog/rigips';
import type { Project } from '../model/types';

/** Dwie ściany CW 75 (2,60 m) w narożniku L pod kątem `deg` */
function corner(deg = 90): Project {
  const p = createProject();
  const r = (deg * Math.PI) / 180;
  p.nodes = [
    { id: 'n1', x: 300, y: 0 },
    { id: 'n2', x: 0, y: 0 },
    { id: 'n3', x: Math.round(300 * Math.cos(r)), y: Math.round(300 * Math.sin(r)) },
  ];
  p.walls = [createWall(p, 'n1', 'n2', { id: 'a' }), createWall(p, 'n2', 'n3', { id: 'b' })];
  return p;
}

const byId = (p: Project, id: string) => analyzeJoints(p).find((j) => j.id === id)!;
const total = (p: Project, key: string) => calculateProject(p).total.filter((l) => l.key === key || l.key.startsWith(`bar-${key}-`));

describe('połączenia ścian', () => {
  it('narożnik L: krawędź zewnętrzna i kąt wewnętrzny, słupki skręcone LN', () => {
    const j = byId(corner(), 'n:n2');
    expect(j.kind).toBe('L');
    expect(j.angleDeg).toBeCloseTo(90);
    expect(j.outer!.lengths).toEqual([2.6]);
    expect(j.outer!.type.id).toBe('alu-perf');
    expect(j.inner!.type.id).toBe('paper-tape');
    // 2,6 m / 0,75 m → 4 odstępy + 1 = 5 wkrętów
    expect(j.req.counts.LN9).toBe(5);
    expect(j.req.pieces.NAROZNIK).toEqual([2.6]);
    expect(j.req.meters.TASMA_SPOIN).toBeCloseTo(2.6);
    // masa: narożnik 0,3 + kąt 0,2 kg/mb
    expect(j.req.kg.MASA).toBeCloseTo(2.6 * 0.5);
  });

  it('kąt nietypowy: domyślnie No-Coat, ostrzeżenie dla narożnika 90°', () => {
    const p = corner(135);
    const j = byId(p, 'n:n2');
    expect(j.outer!.odd).toBe(true);
    expect(j.outer!.type.id).toBe('nocoat');
    expect(j.warnings).toHaveLength(0);
    p.jointFinish = { 'n:n2': { outer: 'alu-perf' } };
    expect(byId(p, 'n:n2').warnings.length).toBe(1);
  });

  it('wybór użytkownika zmienia wykończenie i listę zakupów', () => {
    const p = corner();
    p.jointFinish = { 'n:n2': { outer: 'tuff-original', inner: 'acrylic' } };
    const j = byId(p, 'n:n2');
    expect(j.outer!.isDefault).toBe(false);
    expect(j.req.meters.TUFF_ORIGINAL).toBeCloseTo(2.6);
    expect(j.req.counts.AKRYL).toBeCloseTo(0.26);
    // narożnik zewnętrzny nie może być użyty jako styk – wraca wartość domyślna
    p.jointFinish = { 'n:n2': { inner: 'alu-perf' } };
    expect(byId(p, 'n:n2').inner!.type.id).toBe('paper-tape');
  });

  it('trójnik T: słupek dochodzący przykręcony przez płytę, dwa kąty wewnętrzne', () => {
    const p = createProject();
    p.nodes = [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 400, y: 0 },
      { id: 'n3', x: 200, y: 0 },
      { id: 'n4', x: 200, y: 300 },
    ];
    p.walls = [createWall(p, 'n1', 'n2', { id: 'a' }), createWall(p, 'n3', 'n4', { id: 'b' })];
    const j = byId(p, 'n:n3');
    expect(j.kind).toBe('T');
    expect(j.inner!.lengths).toEqual([2.6, 2.6]);
    // 2,6 / 0,5 → 6 + 1 = 7 wkrętów TN 25 (płyta 12,5 mm) i taśma pod słupkiem
    expect(j.req.counts.TN25).toBe(7);
    expect(j.req.meters.TASMA_USZ70).toBeCloseTo(2.6);
  });

  it('skrzyżowanie X z czterech ścian: cztery kąty wewnętrzne', () => {
    const p = createProject();
    p.nodes = [
      { id: 'c', x: 0, y: 0 },
      { id: 'e', x: 200, y: 0 },
      { id: 'w', x: -200, y: 0 },
      { id: 'n', x: 0, y: 200 },
      { id: 's', x: 0, y: -200 },
    ];
    p.walls = ['e', 'w', 'n', 's'].map((k) => createWall(p, 'c', k, { id: k }));
    const j = byId(p, 'n:c');
    expect(j.kind).toBe('X');
    expect(j.inner!.lengths).toHaveLength(4);
    expect(j.req.counts.TN25).toBe(14);
  });

  it('styk z murem i stropem: taśma Rigips PRO do połączeń ślizgowych', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { id: 'w' })];
    const end = byId(p, 'e:w:a');
    expect(end.kind).toBe('masonry');
    expect(end.inner!.lengths).toEqual([2.6, 2.6]);
    const top = byId(p, 'top:w');
    expect(edgesTotal(top.inner)).toBeCloseTo(8);
    expect(top.req.meters.TASMA_ROZDZ).toBeCloseTo(8);
  });

  it('wolny koniec: dwa narożniki i pasek płyty na czole', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { id: 'w', endB: 'free' })];
    const j = byId(p, 'e:w:b');
    expect(j.kind).toBe('free');
    expect(j.outer!.lengths).toEqual([2.6, 2.6]);
    const t = wallThicknessMm(wallSystemById('W-CW75-1'), 'RB12.5');
    expect(t).toBe(100);
    expect(Object.values(j.req.boardArea)[0]).toBeCloseTo(0.1 * 2.6);
  });

  it('otwór: krawędzie ościeży z obu stron ściany', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 0 },
    ];
    const w = createWall(p, 'a', 'b', { id: 'w' });
    const door = createOpening('door', 100);
    w.openings.push(door);
    p.walls = [w];
    const j = byId(p, `op:${door.id}`);
    // 2 strony × (2 × 2,05 + 0,9)
    expect(edgesTotal(j.outer)).toBeCloseTo(2 * (2 * 2.05 + 0.9));
  });

  it('obwód sufitu przy ścianach', () => {
    const p = createProject();
    p.ceilings = [
      createCeiling(p, [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ]),
    ];
    const j = analyzeJoints(p).find((x) => x.kind === 'ceiling')!;
    expect(edgesTotal(j.inner)).toBeCloseTo(14);
  });

  it('przedłużenie w linii nie tworzy narożnika', () => {
    expect(analyzeJoints(corner(180)).some((j) => j.id === 'n:n2')).toBe(false);
  });
});

describe('spoinowanie Q1 – masa i taśma z ustawień', () => {
  const wall = () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 500, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { systemId: 'W-CW75-1', boardId: 'RB12.5', height: 260 })];
    p.settings.wasteEnabled = false;
    return p;
  };

  it('domyślnie Vario 0,25 kg/m² i taśma papierowa', () => {
    const { req } = calculateProject(wall()).walls.values().next().value!;
    // 2 strony × 13 m²
    expect(req.kg.MASA).toBeCloseTo(26 * 0.25);
    expect(req.meters.TASMA_SPOIN).toBeCloseTo(26 * 1.4);
    expect(req.kg.MASA_WYK).toBeUndefined();
  });

  it('ProMix Mega i Tuff-Tape', () => {
    const p = wall();
    p.settings.finishing = { compound: 'promix', tape: 'tuff' };
    const { req } = calculateProject(p).walls.values().next().value!;
    expect(req.kg.MASA_PROMIX).toBeCloseTo(26 * 0.4);
    expect(req.meters.TASMA_TUFF).toBeCloseTo(26 * 1.4);
    expect(req.meters.TASMA_SPOIN).toBeUndefined();
    // kąty wewnętrzne z taśmą: wybrana taśma
    expect(total(p, 'TASMA_TUFF')[0].qty).toBeGreaterThan(26 * 1.4);
  });

  it('listwy narożnikowe trafiają na listę zakupów z rozkroju', () => {
    const p = wall();
    p.walls[0].endB = 'free';
    const bars = total(p, 'NAROZNIK');
    expect(bars.reduce((s, l) => s + l.qty, 0)).toBe(2); // 2 × 2,60 m → 2 listwy 3 m
  });
});

describe('katalog wykończenia', () => {
  it('produkty wykończenia są w katalogu, typy narożników wskazują istniejące produkty', () => {
    for (const id of Object.keys(FINISHING_PRODUCTS)) expect(PRODUCTS[id]).toBeDefined();
    for (const c of CORNER_TYPES) if (c.product) expect(PRODUCTS[c.product], c.id).toBeDefined();
    for (const c of COMPOUNDS) expect(PRODUCTS[c.product]).toBeDefined();
  });
  it('rodzaj krawędzi płyt', () => {
    expect(boardEdge(BOARDS.find((b) => b.id === 'RB12.5')!)).toBe('4PRO');
    expect(boardEdge(BOARDS.find((b) => b.id === 'AQUAROC12.5')!)).toBe('KP');
  });
});
