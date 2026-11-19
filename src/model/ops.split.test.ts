import { describe, expect, it } from 'vitest';
import { dist, wallEnds } from '../geometry/geometry';
import { createOpening, createProject } from './factory';
import { addWall, insertOpening, splitWall, toggleOpeningKind } from './ops';

describe('podział ściany (menu kontekstowe)', () => {
  it('dzieli ścianę na dwie połączone części z tym samym systemem', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 })!;
    w.height = 280;
    const id = splitWall(p, w.id, 150.4);
    expect(id).not.toBeNull();
    expect(p.walls).toHaveLength(2);
    const second = p.walls.find((x) => x.id === id)!;
    expect(dist(...wallEnds(p, w))).toBeCloseTo(150);
    expect(dist(...wallEnds(p, second))).toBeCloseTo(250);
    expect(w.b).toBe(second.a);
    expect(second.systemId).toBe(w.systemId);
    expect(second.height).toBe(280);
  });

  it('otwory trafiają do swojej części z przeliczonym położeniem', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 500, y: 0 })!;
    w.openings.push(createOpening('door', 20), createOpening('window', 300));
    const id = splitWall(p, w.id, 200)!;
    const second = p.walls.find((x) => x.id === id)!;
    expect(w.openings.map((o) => o.offset)).toEqual([20]);
    expect(second.openings.map((o) => o.offset)).toEqual([100]);
  });

  it('nie dzieli przez otwór ani tuż przy końcu', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 })!;
    w.openings.push(createOpening('door', 100));
    expect(splitWall(p, w.id, 150)).toBeNull();
    expect(splitWall(p, w.id, 5)).toBeNull();
    expect(splitWall(p, w.id, 396)).toBeNull();
    expect(p.walls).toHaveLength(1);
  });
});

describe('otwory z menu kontekstowego', () => {
  it('wstawia drzwi wyśrodkowane na wskazanym miejscu i mieszczące się w ścianie', () => {
    const p = createProject();
    const w = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 })!;
    const op = insertOpening(p, w.id, 'door', 200)!;
    expect(op.offset).toBe(155);
    const edge = insertOpening(p, w.id, 'window', 390)!;
    expect(edge.offset + edge.width).toBe(395);
  });

  it('zamienia drzwi na okno i z powrotem, zostawiając szerokość i położenie', () => {
    const o = createOpening('door', 50, { width: 100 });
    toggleOpeningKind(o);
    expect(o).toMatchObject({ kind: 'window', offset: 50, width: 100, sill: 90 });
    toggleOpeningKind(o);
    expect(o).toMatchObject({ kind: 'door', sill: 0, height: 205 });
  });
});
