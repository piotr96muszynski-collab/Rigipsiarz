// Wybór długości handlowej profili (lista zakupów): rozkrój, przedłużenia i łączniki z projektu
import { afterEach, describe, expect, it } from 'vitest';
import { calculateProject, cutPieces } from './materials';
import { splicePositions } from './layout';
import {
  activeProfileLength,
  joinsFor,
  profileLengthChoices,
  profileOverlap,
  profileStocks,
  setAppProfileLengths,
  setProjectProfileLengths,
} from './profileLength';
import { createCeiling, createProject, createWall, uid } from '../model/factory';
import type { Project } from '../model/types';
import { buildModel3D, type BoxPart } from '../view3d/model3d';

function wall(lengthCm: number, heightCm: number): Project {
  const p = createProject();
  p.nodes = [
    { id: uid(), x: 0, y: 0 },
    { id: uid(), x: lengthCm, y: 0 },
  ];
  p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { height: heightCm, systemId: 'W-CW75-1', boardId: 'RB12.5' })];
  p.settings.wasteEnabled = false;
  return p;
}

function ceiling(lengthCm: number, widthCm: number): Project {
  const p = createProject();
  const pts = [
    { x: 0, y: 0 },
    { x: lengthCm, y: 0 },
    { x: lengthCm, y: widthCm },
    { x: 0, y: widthCm },
  ];
  p.ceilings = [createCeiling(p, pts, { systemId: 'S-CD-2P-1', height: 250 })];
  return p;
}

const bars = (p: Project, pid: string) =>
  calculateProject(p)
    .total.filter((l) => l.key.startsWith(`bar-${pid}-`))
    .map((l) => [Number(l.key.split('-').pop()), l.qty] as const);
const sumPieces = (p: Project, pid: string) =>
  calculateProject(p)
    .walls.get(p.walls[0].id)!
    .req.pieces[pid].reduce((a, b) => a + b, 0);

afterEach(() => {
  setProjectProfileLengths(undefined);
  setAppProfileLengths(undefined);
});

describe('ustawienie długości profili', () => {
  it('projekt nadpisuje aplikację, aplikacja – auto', () => {
    expect(activeProfileLength('CW75')).toBe('auto');
    setAppProfileLengths({ CW: 3 });
    expect(activeProfileLength('CW75')).toBe(3);
    expect(activeProfileLength('CW50')).toBe(3);
    setProjectProfileLengths({ CW75: 4 });
    expect(activeProfileLength('CW75')).toBe(4);
    expect(activeProfileLength('CW50')).toBe(3);
    expect(profileStocks('CW75')).toEqual([4]);
  });
  it('odrzuca długości spoza katalogu i profile bez wyboru (UA)', () => {
    setProjectProfileLengths({ CW75: 3.3, UA50: 3 });
    expect(activeProfileLength('CW75')).toBe('auto');
    expect(activeProfileLength('UA50')).toBe('auto');
    expect(profileLengthChoices('UA50')).toEqual([]);
    expect(profileLengthChoices('UD30')).toEqual([3, 4]);
  });
  it('zakład przedłużenia tylko dla CW (szerokość × 10)', () => {
    expect(profileOverlap('CW50')).toBeCloseTo(0.5);
    expect(profileOverlap('CW75AKU')).toBeCloseTo(0.75);
    expect(profileOverlap('UW75')).toBe(0);
    expect(profileOverlap('CD60')).toBe(0);
    expect(joinsFor(3.5, 3, 0.75)).toBe(1);
    expect(joinsFor(5.5, 3, 0.75)).toBe(2); // 3 + (2,5+0,75=3,25 > 3) → 3 + 1
    expect(joinsFor(8, 4)).toBe(1);
  });
});

describe('rozkrój z zakładem', () => {
  it('dostawka słupka zachodzi na zakład', () => {
    // 3,5 m z profili 3 m, zakład 0,75 → 3 m + 1,25 m
    const r = cutPieces([3.5], [3], 0.75);
    expect(r.joins).toBe(1);
    expect(r.bars).toHaveLength(2);
    expect(r.bars[1].pieces[0]).toBeCloseTo(1.25);
  });
  it('bez zakładu jak dotąd', () => {
    const r = cutPieces([9], [4]);
    expect(r.joins).toBe(2);
    expect(r.bars).toHaveLength(3);
  });
});

describe('ściana 3,5 m: CW po 3,5 / 3,0 / 4,0 m', () => {
  it('auto – profile 3,5 m, bez przedłużeń', () => {
    const p = wall(300, 350);
    const b = bars(p, 'CW75');
    expect(b.map(([s]) => s)).toEqual([3.5]);
  });
  it('3,0 m – każdy słupek przedłużony na zakład, ilość z rozkroju projektu', () => {
    const p = wall(300, 350);
    const studs = calculateProject(p).walls.get(p.walls[0].id)!.req.pieces.CW75.filter((l) => l > 3).length;
    expect(studs).toBeGreaterThan(0);
    setProjectProfileLengths({ CW75: 3 });
    const lines = calculateProject(p).total.filter((l) => l.key.startsWith('bar-CW75-'));
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toContain('3,00 m');
    expect(lines[0].note).toContain(`${studs} na zakład 75 cm`);
    expect(lines[0].profile).toMatchObject({ pid: 'CW75', pref: 3, first: true });
    // metry w sztukach pokrywają elementy + zakłady
    const total = sumPieces(p, 'CW75');
    expect(lines[0].qty * 3).toBeGreaterThanOrEqual(total + studs * 0.75 - 1e-6);
    // dostawki 1,25 m – po dwie z jednej sztuki 3 m
    const auto = bars(wall(300, 350), 'CW75');
    expect(lines[0].qty).toBeLessThan(auto[0][1] * 2);
  });
  it('4,0 m – ścinki 0,5 m idą na krótsze elementy', () => {
    const p = wall(300, 350);
    setProjectProfileLengths({ CW75: 4 });
    const b = bars(p, 'CW75');
    expect(b.map(([s]) => s)).toEqual([4]);
    expect(b[0][1] * 4).toBeGreaterThanOrEqual(sumPieces(p, 'CW75'));
  });
});

describe('sufit 7 m: CD 60 po 3 m zamiast 4 m', () => {
  const connectors = (p: Project) => buildModel3D(p).parts.filter((x): x is BoxPart => x.type === 'box' && x.mat === 'connector').length;
  it('więcej łączników wzdłużnych – w zestawieniu, na rysunku i w 3D tyle samo', () => {
    const p = ceiling(700, 400);
    const c = p.ceilings[0];
    const before = calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_WZDL ?? 0;
    const conn4 = connectors(p);
    setProjectProfileLengths({ CD60: 3 });
    const after = calculateProject(p).ceilings.get(c.id)!.req.counts.LACZNIK_WZDL ?? 0;
    expect(after).toBeGreaterThan(before);
    expect(connectors(p) - conn4).toBe(after - before);
    expect(splicePositions(0, 700)).toEqual([300, 600]);
    const cd = calculateProject(p).total.filter((l) => l.key.startsWith('bar-CD60-'));
    expect(cd.map((l) => l.key)).toEqual(['bar-CD60-3']);
    expect(cd[0].note).toContain('łącznikiem wzdłużnym');
  });
});
