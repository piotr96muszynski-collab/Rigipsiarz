import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculateProject } from '../calc/materials';
import { CEILING_SYSTEMS, WALL_SYSTEMS, isLiningSystem, wallSystemById } from '../catalog/rigips';
import { interiorSide } from '../geometry/geometry';
import { addWall } from '../model/ops';
import { createCeiling, createLining, createOpening, createProject, createWall, uid } from '../model/factory';
import { DrawingsPanel } from '../ui/DrawingsPanel';

// Test „dymny”: rysunki renderują się dla każdego systemu z katalogu (bez wyjątków i NaN w SVG)
describe('rysunki dla wszystkich systemów', () => {
  it.each(WALL_SYSTEMS.map((s) => [s.id]))('ściana %s', (id) => {
    const p = createProject();
    p.nodes = [
      { id: uid(), x: 0, y: 0 },
      { id: uid(), x: 420, y: 0 },
      { id: uid(), x: 420, y: 300 },
    ];
    p.walls = [
      createWall(p, p.nodes[0].id, p.nodes[1].id, { systemId: id, height: 280 }),
      createWall(p, p.nodes[1].id, p.nodes[2].id, { systemId: id, height: 280 }),
    ];
    p.walls[0].openings.push(createOpening('door', 60), createOpening('window', 220));
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('NaN');
  });

  it.each(CEILING_SYSTEMS.map((s) => [s.id]))('sufit %s', (id) => {
    const p = createProject();
    p.ceilings = [
      createCeiling(
        p,
        [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 200 },
          { x: 250, y: 200 },
          { x: 250, y: 380 },
          { x: 0, y: 380 },
        ],
        { systemId: id },
      ),
    ];
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });
});

describe('wełna w przekrojach', () => {
  it('przekrój ściany pokazuje grubość wełny wybraną dla ściany', () => {
    const p = createProject();
    p.nodes = [
      { id: uid(), x: 0, y: 0 },
      { id: uid(), x: 300, y: 0 },
    ];
    p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { systemId: 'W-CW100-1', insulation: true, insulationThickness: 50 })];
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('wełna mineralna 50 mm');
    expect(html).not.toContain('wełna mineralna 100 mm');
  });

  it('ściana podwójna: wełna w obu rzędach', () => {
    const p = createProject();
    p.nodes = [
      { id: uid(), x: 0, y: 0 },
      { id: uid(), x: 300, y: 0 },
    ];
    p.walls = [createWall(p, p.nodes[0].id, p.nodes[1].id, { systemId: 'W-2CW75-2', insulation: true })];
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('2 warstwy');
  });

  it('przekrój sufitu pokazuje grubość wełny wybraną dla sufitu', () => {
    const p = createProject();
    p.ceilings = [
      createCeiling(
        p,
        [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
        { insulation: true, insulationThickness: 150 },
      ),
    ];
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('wełna mineralna 150 mm');
  });
});

describe('rysunki okładzin murów', () => {
  it.each(WALL_SYSTEMS.filter(isLiningSystem).map((s) => [s.id]))('okładzina %s na murze z oknem', (id) => {
    const p = createProject();
    const pts = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ];
    pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
    for (const w of p.walls) w.linings = [createLining(interiorSide(p, w) || 1, id)];
    p.walls[0].openings.push(createOpening('window', 150));
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('Okładzina muru 1');
    expect(html).toContain('<svg');
    expect(html).not.toContain('NaN');
    if (wallSystemById(id).frame === 'point-fix') {
      expect(html).toContain('Rozstaw łączników talerzykowych');
      expect(html).toContain('talerzyk ø 12 cm');
    }
  });

  it('sufit ATLAS ma rzut łączników z wymiarami', () => {
    const p = createProject();
    p.ceilings = [createCeiling(p, [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }], { systemId: 'A-S-L100' })];
    const html = renderToStaticMarkup(createElement(DrawingsPanel, { project: p, calc: calculateProject(p) }));
    expect(html).toContain('Rozstaw łączników – rzut');
    expect(html).not.toContain('NaN');
  });
});
