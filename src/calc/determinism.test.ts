import { describe, expect, it } from 'vitest';
import { calculateProject } from './materials';
import { quickProject, sampleProject } from '../model/factory';
import type { Project } from '../model/types';

/**
 * Ten sam projekt z innymi id węzłów, ścian i otworów. `order` decyduje o kolejności alfabetycznej
 * nowych id: rosnąco albo malejąco względem pozycji ściany na liście.
 */
function withNewIds(src: Project, order: 'asc' | 'desc'): Project {
  const p: Project = structuredClone(src);
  const map = new Map<string, string>();
  let n = 0;
  const next = () => {
    n++;
    const k = order === 'asc' ? n : 1000 - n;
    return `id${String(k).padStart(4, '0')}`;
  };
  for (const node of p.nodes) map.set(node.id, next());
  for (const node of p.nodes) node.id = map.get(node.id)!;
  for (const w of p.walls) {
    w.id = next();
    w.a = map.get(w.a) ?? w.a;
    w.b = map.get(w.b) ?? w.b;
    for (const o of w.openings) o.id = next();
  }
  return p;
}

const quantities = (p: Project) =>
  calculateProject(p)
    .total.map((l) => `${l.key}|${l.name}|${l.qty}`)
    .sort();

describe('powtarzalność wyliczeń', () => {
  const cases: [string, () => Project][] = [
    ['projekt przykładowy', sampleProject],
    [
      'pomieszczenie z szybkiego wyliczenia',
      () =>
        quickProject({
          mode: 'room',
          length: 420,
          width: 310,
          height: 260,
          wallSystemId: 'W-CW75-1',
          ceilingSystemId: 'S-CD-2P-1',
          withCeiling: true,
          doors: 1,
          windows: 1,
        }),
    ],
  ];
  for (const [name, make] of cases) {
    it(`${name}: te same ilości niezależnie od id`, () => {
      const base = make();
      const a = quantities(withNewIds(base, 'asc'));
      const b = quantities(withNewIds(base, 'desc'));
      expect(b).toEqual(a);
      expect(quantities(make())).toEqual(a);
    });
  }
});
