import { describe, expect, it } from 'vitest';
import { ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { createCeiling, createExistingWall, createLining, createProject, uid } from '../model/factory';
import type { Project } from '../model/types';
import { calculateProject, ceilingConsumption, summarize, type Requirement } from './materials';
import { ceilingVaporSpec, vaporBarrierLines, vaporBarrierOn, wallVaporSpec } from './vaporBarrier';

const RECT = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 500, y: 400 },
  { x: 0, y: 400 },
];

function withCeiling(systemId: string, vaporBarrier?: boolean): Project {
  const p = createProject();
  p.settings.wasteEnabled = false;
  p.settings.waste = 0;
  p.ceilings = [createCeiling(p, RECT, { systemId, vaporBarrier })];
  return p;
}

const line = (p: Project, key: string) => calculateProject(p).total.find((l) => l.key === key);

describe('paroizolacja – co mówią systemy', () => {
  it('poddasza Rigips 4.70.0x: folia w systemie, 1,18 m²/m², KB1 0,98 mb/m², taśma dwustronna 0,5 mb/m²', () => {
    const s = ceilingVaporSpec(ceilingSystemById('S-PODD-1'));
    expect(s).toMatchObject({ mode: 'system', foil: 1.18, overlapTape: 0.98, doubleTape: 0.5, assumed: false });
  });

  it('poddasza Norgips i Knauf: folia w systemie, zużycie przyjęte wg Rigips', () => {
    expect(ceilingVaporSpec(ceilingSystemById('KN-D612-1'))).toMatchObject({ mode: 'system', assumed: true });
  });

  it('zwykłe sufity i okładziny na ruszcie: folia opcjonalna; klej i ATLAS – brak', () => {
    expect(ceilingVaporSpec(ceilingSystemById('S-CD-2P-1')).mode).toBe('optional');
    expect(wallVaporSpec(wallSystemById('O-CD-1')).mode).toBe('optional');
    expect(wallVaporSpec(wallSystemById('O-KLEJ')).mode).toBe('none');
    expect(vaporBarrierOn(true, wallVaporSpec(wallSystemById('O-KLEJ')))).toBe(false);
  });

  it('domyślnie wg systemu, wybór użytkownika ma pierwszeństwo', () => {
    const attic = ceilingVaporSpec(ceilingSystemById('S-PODD-1'));
    const plain = ceilingVaporSpec(ceilingSystemById('S-CD-2P-1'));
    expect(vaporBarrierOn(undefined, attic)).toBe(true);
    expect(vaporBarrierOn(false, attic)).toBe(false);
    expect(vaporBarrierOn(undefined, plain)).toBe(false);
    expect(vaporBarrierOn(true, plain)).toBe(true);
  });
});

describe('paroizolacja – ilości', () => {
  it('poddasze 5×4 m: 20 m² × 1,18 = 23,6 m² folii (1 rolka), 20 mb KB1, 10 mb taśmy dwustronnej', () => {
    const p = withCeiling('S-PODD-1');
    expect(line(p, 'FOLIA_PAROIZ')).toMatchObject({ qty: 23.6, unit: 'm²', packs: 1, packUnit: 'rolka' });
    expect(line(p, 'TASMA_PAROIZ')).toMatchObject({ qty: 20, unit: 'mb' });
    expect(line(p, 'TASMA_DWUSTR')).toMatchObject({ qty: 10, unit: 'mb' });
  });

  it('zgodne z kalkulatorem Rigips na m²', () => {
    const c = ceilingConsumption(ceilingSystemById('S-PODD-1'));
    expect(c.find((l) => l.key === 'FOLIA_PAROIZ')?.qty).toBeCloseTo(1.18, 5);
  });

  it('sufit podwieszany: bez folii, chyba że ją włączono', () => {
    expect(line(withCeiling('S-CD-2P-1'), 'FOLIA_PAROIZ')).toBeUndefined();
    expect(line(withCeiling('S-CD-2P-1', true), 'FOLIA_PAROIZ')?.qty).toBe(23.6);
    expect(line(withCeiling('S-PODD-1', false), 'FOLIA_PAROIZ')).toBeUndefined();
  });

  it('okładzina CD 60 muru z folią: powierzchnia netto okładziny', () => {
    const p = createProject();
    p.settings.wasteEnabled = false;
    p.settings.waste = 0;
    p.nodes = [
      { id: uid(), x: 0, y: 0 },
      { id: uid(), x: 400, y: 0 },
    ];
    const w = createExistingWall(p, p.nodes[0].id, p.nodes[1].id, { height: 250 });
    w.linings = [{ ...createLining(1, 'O-CD-1'), insulation: true, vaporBarrier: true }];
    p.walls = [w];
    const calc = calculateProject(p);
    const net = [...calc.linings.values()][0].info.netAreaM2;
    expect(calc.total.find((l) => l.key === 'FOLIA_PAROIZ')?.qty).toBeCloseTo(Math.ceil(net * 1.18 * 10 - 1e-9) / 10, 5);
  });

  it('vaporBarrierLines działa na samych liczbach (np. skosy poddasza) i naddatek na odpady się dolicza', () => {
    const req: Requirement = { pieces: {}, boardArea: {}, counts: {}, meters: {}, kg: {}, area: {} };
    vaporBarrierLines(req, 50, ceilingVaporSpec(ceilingSystemById('S-PODD-1')));
    expect(req.area.FOLIA_PAROIZ).toBeCloseTo(59, 5);
    const lines = summarize([req], 10);
    expect(lines.find((l) => l.key === 'FOLIA_PAROIZ')).toMatchObject({ qty: 64.9, packs: 1 });
    expect(lines.find((l) => l.key === 'TASMA_PAROIZ')?.note).toMatch(/DoubleFit/);
  });
});
