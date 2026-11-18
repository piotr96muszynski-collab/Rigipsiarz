import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculateProject } from '../calc/materials';
import { CEILING_SYSTEMS, WALL_SYSTEMS } from '../catalog/rigips';
import { createCeiling, createOpening, createProject, createWall, uid } from '../model/factory';
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
