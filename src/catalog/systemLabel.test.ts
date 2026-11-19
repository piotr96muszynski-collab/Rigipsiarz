import { describe, expect, it } from 'vitest';
import { boardById, WALL_SYSTEMS, wallSystemById } from './rigips';
import { wallSystemShort } from './systemLabel';

describe('krótki opis systemu ściany', () => {
  it('Rigips 3.41.02 → 2×CW 75, 2×12,5', () => {
    const s = WALL_SYSTEMS.find((x) => x.code === '3.41.02')!;
    expect(wallSystemShort(s)).toBe('2×CW 75, 2×12,5');
  });

  it('domyślna ściana nowego projektu → CW 75, 1×12,5', () => {
    expect(wallSystemShort(wallSystemById('W-CW75-1'))).toBe('CW 75, 1×12,5');
  });

  it('płyta wybrana przez użytkownika zmienia grubość', () => {
    expect(wallSystemShort(wallSystemById('W-CW75-1'), 'RF15')).toBe('CW 75, 1×15');
  });

  it('każdy system ma opis bez numeru katalogowego', () => {
    for (const s of WALL_SYSTEMS) {
      const t = wallSystemShort(s);
      expect(t).toMatch(/\d×\d/);
      if (s.code) expect(t).not.toContain(s.code);
      expect(t.length).toBeLessThanOrEqual(36);
    }
  });

  it('dwie grubości płyt: najpierw warstwa przy ruszcie', () => {
    const s = WALL_SYSTEMS.find((x) => x.innerBoard && x.frame === 'cd-lining' && boardById(x.innerBoard).thickness === 15 && boardById(x.defaultBoard).thickness === 12.5)!;
    expect(wallSystemShort(s)).toBe('Okładzina CD 60, 2×15 + 2×12,5');
  });

  it('szacht, okładzina i ściana podwójna', () => {
    const kinds = new Set(WALL_SYSTEMS.map((s) => wallSystemShort(s).split(',')[0]));
    expect([...kinds].some((k) => k.startsWith('Szacht CW'))).toBe(true);
    expect(kinds.has('Okładzina CD 60')).toBe(true);
    expect([...kinds].some((k) => k.startsWith('2×CW'))).toBe(true);
  });
});
