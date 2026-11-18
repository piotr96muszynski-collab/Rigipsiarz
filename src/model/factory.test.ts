import { describe, expect, it } from 'vitest';
import { duplicateProject, sampleProject } from './factory';

describe('duplicateProject', () => {
  it('tworzy niezależną kopię z nowym id i nazwą', () => {
    const p = sampleProject();
    const c = duplicateProject(p, 123);
    expect(c.id).not.toBe(p.id);
    expect(c.name).toBe(`${p.name} (kopia)`);
    expect(c.createdAt).toBe(123);
    expect(c.updatedAt).toBe(123);
    expect(c.walls).toEqual(p.walls);
    c.walls[0].height = 999;
    expect(p.walls[0].height).not.toBe(999);
  });
});
