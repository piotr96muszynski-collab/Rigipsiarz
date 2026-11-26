import { afterEach, describe, expect, it } from 'vitest';
import {
  activeBoardLength,
  baseBoardLength,
  boardLengthChoices,
  pickBoardLengthCm,
  rowSegments,
  setAppBoardLength,
  setProjectBoardLength,
  setProjectBoardLengths,
} from './boardLength';
import { wallLayout } from './layout';
import { calculateProject } from './materials';
import { boardSheets } from '../view3d/model3d';
import { analyzeJunctions } from '../geometry/geometry';
import { createProject, createWall, uid } from '../model/factory';
import type { Project } from '../model/types';

afterEach(() => {
  setAppBoardLength('auto');
  setProjectBoardLength(undefined);
  setProjectBoardLengths(undefined);
});

function wallProject(lengthCm: number, heightCm: number): Project {
  const p = createProject();
  p.nodes = [
    { id: uid(), x: 0, y: 0 },
    { id: uid(), x: lengthCm, y: 0 },
  ];
  p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { height: heightCm, systemId: 'W-CW75-1', boardId: 'RB12.5' })];
  return p;
}
const layoutOf = (p: Project) => wallLayout(p, p.walls[0], analyzeJunctions(p).get(p.walls[0].id)!);
const boardLines = (p: Project) => calculateProject(p).total.filter((l) => l.key.startsWith('board-'));

describe('wybór długości płyty', () => {
  it('auto: najkrótszy arkusz nie niższy od ściany', () => {
    expect(pickBoardLengthCm('RB12.5', 250, 'auto')).toBe(260);
    expect(pickBoardLengthCm('RB12.5', 280, 'auto')).toBe(300);
    expect(pickBoardLengthCm('RB12.5', 320, 'auto')).toBe(300);
  });

  it('wybrana długość jest używana niezależnie od wysokości', () => {
    expect(pickBoardLengthCm('RB12.5', 250, 300)).toBe(300);
    expect(pickBoardLengthCm('RB12.5', 280, 260)).toBe(260);
    expect(pickBoardLengthCm('RB12.5', 150, 200)).toBe(200);
  });

  it('płyty bez wybranej długości: najbliższa krótsza, w ostateczności najkrótsza', () => {
    // Ridurit 25 jest tylko w 2,0 m
    expect(pickBoardLengthCm('RIDURIT25', 250, 300)).toBe(200);
    expect(pickBoardLengthCm('RIDURIT25', 250, 260)).toBe(200);
  });

  it('projekt nadpisuje ustawienie aplikacji', () => {
    setAppBoardLength(300);
    expect(activeBoardLength()).toBe(300);
    setProjectBoardLength(260);
    expect(activeBoardLength()).toBe(260);
    setProjectBoardLength(undefined);
    expect(activeBoardLength()).toBe(300);
    setProjectBoardLength('auto');
    expect(activeBoardLength()).toBe('auto');
  });

  it('lista zakupów i układ ściany biorą wybraną długość', () => {
    const p = wallProject(480, 250);
    expect(boardLines(p).map((l) => l.name)).toEqual([expect.stringContaining('120×260 cm')]);
    setAppBoardLength(300);
    expect(boardLines(p).map((l) => l.name)).toEqual([expect.stringContaining('120×300 cm')]);
    expect(layoutOf(p).sheet.length).toBeCloseTo(3);
    p.settings.boardLength = 200;
    setProjectBoardLength(p.settings.boardLength);
    expect(boardLines(p).map((l) => l.name)).toEqual([expect.stringContaining('120×200 cm')]);
    // 2,0 m na ścianę 2,5 m: pełny arkusz + dostawka 50 cm, mijankowo
    const l = layoutOf(p);
    expect(l.sheet.length).toBeCloseTo(2);
    const col0 = l.faces[0].pieces.filter((b) => b.x0 < 0.01).map((b) => +(b.y1 - b.y0).toFixed(3));
    expect(col0.sort()).toEqual([0.5, 2]);
  });

  it('wybór długości pojedynczej płyty na liście zakupów przelicza ilości', () => {
    // ściana 4,8 × 2,5 m, CW75 z jedną warstwą po obu stronach = 24 m² płyty RB 12,5
    const p = wallProject(480, 250);
    const auto = boardLines(p);
    expect(auto).toHaveLength(1);
    expect(auto[0].name).toContain('120×260 cm');
    expect(auto[0].board).toMatchObject({ bid: 'RB12.5', pref: 'auto', first: true });
    expect(auto[0].board!.choices).toEqual(boardLengthChoices('RB12.5'));

    p.settings.boardLengths = { 'RB12.5': 200 };
    setProjectBoardLengths(p.settings.boardLengths);
    expect(activeBoardLength('RB12.5')).toBe(200);
    // inne płyty nadal wg ustawienia projektu
    expect(activeBoardLength('RF12.5')).toBe('auto');
    const lines = boardLines(p);
    // pełne arkusze 2,0 m + dostawki 0,5 m z arkuszy tej samej długości
    expect(lines.every((l) => l.name.includes('120×200 cm'))).toBe(true);
    expect(lines[0].board).toMatchObject({ pref: 200, first: true });
    // 24 m² z arkuszy 2,4 m² = 10 szt. + zapas – więcej niż z arkuszy 2,6 m (3,12 m²)
    expect(lines.reduce((a, l) => a + l.qty, 0)).toBeGreaterThan(auto[0].qty);
    expect(layoutOf(p).sheet.length).toBeCloseTo(2);
  });

  it('wybór pojedynczej płyty wygrywa z długością projektu, nieznane wartości są pomijane', () => {
    setProjectBoardLength(300);
    setProjectBoardLengths({ 'RB12.5': 260, RF12_5: 999, NIEMA: 200 } as Record<string, number>);
    expect(activeBoardLength('RB12.5')).toBe(260);
    expect(activeBoardLength('RF12.5')).toBe(300);
    expect(baseBoardLength()).toBe(300);
    setProjectBoardLengths(undefined);
    expect(activeBoardLength('RB12.5')).toBe(300);
  });
});

describe('dostawki bez wąskich pasków', () => {
  it('dostawka węższa niż 30 cm – pełny arkusz skrócony', () => {
    // 2,65 m z arkuszy 2,6 m: zamiast 2,60 + 0,05 jest 2,35 + 0,30
    expect(rowSegments(2.65, 2.6, false)).toEqual([
      [0, 2.35],
      [2.35, 2.65],
    ]);
    expect(rowSegments(2.65, 2.6, true)).toEqual([
      [0, 0.3],
      [0.3, 2.65],
    ]);
  });

  it('szeroka dostawka i ściana niższa od arkusza bez zmian', () => {
    expect(rowSegments(3.2, 2.6, false)).toEqual([
      [0, 2.6],
      [2.6, 3.2],
    ]);
    expect(rowSegments(2.5, 2.6, true)).toEqual([[0, 2.5]]);
    expect(rowSegments(5.2, 2.6, true)).toEqual([
      [0, 2.6],
      [2.6, 5.2],
    ]);
  });

  it('przy dostawce u dołu skrócony arkusz leży tuż nad nią', () => {
    // 5,30 m z 2,6 m: 0,30 + 2,40 + 2,60
    expect(rowSegments(5.3, 2.6, true)).toEqual([
      [0, 0.3],
      [0.3, 2.7],
      [2.7, 5.3],
    ]);
  });

  it('rysunek ściany i 3D nie mają pasków węższych niż 30 cm', () => {
    setAppBoardLength(260);
    const p = wallProject(480, 265);
    const heights = layoutOf(p).faces.flatMap((f) => f.pieces.map((b) => b.y1 - b.y0));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0.3 - 1e-6);
    const sheets = boardSheets(4.8, 2.65, 1.2, 2.6, 0, []);
    expect(Math.min(...sheets.map((r) => r.y1 - r.y0))).toBeGreaterThanOrEqual(0.3 - 1e-6);
  });
});
