import { describe, expect, it } from 'vitest';
import { WALL_SYSTEMS, wallSystemById } from '../catalog/rigips';
import { createProject, createWall } from '../model/factory';
import { analyzeJunctions } from '../geometry/geometry';
import { buildContacts } from '../geometry/contacts';
import { wallConsumption, wallRequirement, type ConsumptionLine } from './materials';
import { wallLayout } from './layout';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;

describe('okładziny wolnostojące Siniat z łącznikami stabilizacyjnymi LS', () => {
  it('w katalogu C50/C75/C100 z LS (1 i 2 warstwy), z kartą', () => {
    const ls = WALL_SYSTEMS.filter((s) => s.ls);
    expect(ls.map((s) => s.id).sort()).toEqual(['SN-O-LS100-1', 'SN-O-LS100-2', 'SN-O-LS50-1', 'SN-O-LS50-2', 'SN-O-LS75-1', 'SN-O-LS75-2']);
    for (const s of ls) {
      expect(s.ls!.boarded).toBe(0.75);
      expect(s.studKind).toBeUndefined();
    }
    expect(wallSystemById('SN-O-LS100-2').maxHeight?.[60]).toBe(501);
  });

  it('płyty tylko na 3/4 wysokości (karta: 0,75 m²/m²), słupki i U na całą wysokość', () => {
    const c = wallConsumption(wallSystemById('SN-O-LS50-1'));
    const full = wallConsumption(wallSystemById('SN-O-C50-1'));
    expect(q(c, 'board:SN-EXP12.5')).toBeCloseTo(0.75 * q(full, 'board:SN-EXP12.5'), 1);
    expect(q(c, 'CW50')).toBeCloseTo(q(full, 'CW50'));
    expect(q(c, 'UW50')).toBeCloseTo(q(full, 'UW50'));
    // wkręty i spoinowanie tylko na części opłytowanej (karta: 9 szt./m² = 12 na m² płyty × 0,75)
    expect(q(c, 'TN25')).toBeCloseTo(0.75 * q(full, 'TN25'), 1);
  });

  it('łącznik LS i kołek na każdym słupku', () => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 300, y: 0 },
    ];
    p.walls = [createWall(p, 'a', 'b', { systemId: 'SN-O-LS75-1', boardId: 'SN-EXP12.5', height: 380, studSpacing: 60, insulation: false })];
    const j = analyzeJunctions(p).get(p.walls[0].id)!;
    const { req, info } = wallRequirement(p, p.walls[0], j);
    // słupki co 60 cm na 3 m: 0, 0,6 … 2,4 i 3,0 = 6
    expect(info.studPositions).toHaveLength(6);
    expect(req.counts.LS75).toBe(6);
    // rysunek: płyty do 2,85 m (3/4 z 3,8 m)
    const l = wallLayout(p, p.walls[0], j, buildContacts(p));
    expect(Math.max(...l.faces.flatMap((f) => f.pieces.map((pc) => pc.y1)))).toBeCloseTo(2.85);
    expect(info.warnings).toEqual([]);
  });
});
