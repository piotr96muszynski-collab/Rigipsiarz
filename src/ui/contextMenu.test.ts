import { describe, expect, it } from 'vitest';
import { createCeiling, createOpening, createProject } from '../model/factory';
import { addWall } from '../model/ops';
import { menuItems, menuTitle, placeMenu } from './contextMenu';

describe('menu kontekstowe planu', () => {
  const p = createProject();
  const w = addWall(p, { x: 0, y: 0 }, { x: 400, y: 0 })!;
  const op = createOpening('window', 100);
  w.openings.push(op);
  const c = createCeiling(p, [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);
  p.ceilings.push(c);

  it('ściana: edycja, długość, otwory, podział, usuwanie na końcu', () => {
    const acts = menuItems(p, { type: 'wall', id: w.id }).map((i) => i.action);
    expect(acts).toEqual(['edit', 'length', 'door', 'window', 'split', 'multi', 'delete']);
    expect(menuTitle(p, { type: 'wall', id: w.id })).toBe('Ściana 1');
  });

  it('otwór: zamiana typu i usuwanie', () => {
    const items = menuItems(p, { type: 'wall', id: w.id, openingId: op.id });
    expect(items.map((i) => i.label)).toEqual(['Edytuj okno', 'Zamień na drzwi', 'Usuń okno']);
    expect(menuTitle(p, { type: 'wall', id: w.id, openingId: op.id })).toBe('Okno · ściana 1');
  });

  it('puste miejsce: sufit tylko w pomieszczeniu bez sufitu', () => {
    expect(menuItems(p, null).map((i) => i.action)).toEqual(['select-all', 'fit']);
    expect(menuItems(p, null, { roomWithoutCeiling: true })[0].action).toBe('ceiling-here');
  });

  it('kilka ścian i sufit', () => {
    expect(menuItems(p, { type: 'walls', ids: ['a', 'b'] }).at(-1)!.label).toBe('Usuń zaznaczone (2)');
    expect(menuTitle(p, { type: 'ceiling', id: c.id })).toBe('Sufit 1');
  });

  it('menu mieści się w obszarze planu, na telefonie nad palcem', () => {
    const area = { w: 360, h: 600 };
    const m = { w: 220, h: 300 };
    expect(placeMenu({ x: 180, y: 400 }, m, area, true)).toEqual({ x: 70, y: 76 });
    // za blisko góry – pod palcem
    expect(placeMenu({ x: 180, y: 100 }, m, area, true).y).toBe(124);
    // kursor przy prawej dolnej krawędzi – menu po lewej i nad kursorem
    expect(placeMenu({ x: 350, y: 590 }, m, area, false)).toEqual({ x: 128, y: 288 });
  });
});
