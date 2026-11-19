import { describe, expect, it } from 'vitest';
import { ceilingSystemById, wallSystemById } from '../catalog/rigips';
import { boardGroups, wallSystemShort } from '../catalog/systemLabel';
import { layerBoards } from './ceilingLevels';
import { ceilingConsumption, wallConsumption } from './materials';

/** m² płyty danego rodzaju na m² elementu wzorcowego */
const boardM2 = (lines: { key: string; qty: number }[], id: string) => lines.find((l) => l.key === `board:${id}`)?.qty ?? 0;

describe('Poszycie z płyt w kilku grubościach i rodzajach (Rigidur 10 + 12,5, X OCEAN)', () => {
  it('layerBoards: płyta przy ruszcie, wewnętrzna, zewnętrzna', () => {
    const sys = { layers: 4, baseBoard: 'RFI15', baseLayers: 2, innerBoard: 'RFI12.5', innerLayers: 1 };
    expect(layerBoards(sys, 'XOCEAN12.5')).toEqual(['RFI15', 'RFI15', 'RFI12.5', 'XOCEAN12.5']);
    // bez płyty przy ruszcie – jak dotąd
    expect(layerBoards({ layers: 2, innerBoard: 'RB12.5', innerLayers: 1 }, 'HABITO12.5')).toEqual(['RB12.5', 'HABITO12.5']);
  });

  it('Rigips 3.65.015: CW 75, 1×10 + 1×12,5 Rigidur H obustronnie – płyty jak w kalkulatorze Rigips', () => {
    const sys = wallSystemById('W-CW75-1RIGIDUR10+1RIGIDUR');
    expect(sys.code).toBe('3.65.015');
    expect(layerBoards(sys, sys.defaultBoard)).toEqual(['RIGIDUR10', 'RIGIDUR12.5']);
    expect(wallSystemShort(sys)).toBe('CW 75, 1×10 + 1×12,5');
    const lines = wallConsumption(sys);
    // kalkulator: 200 m² płyty 10 mm i 200 m² płyty 12,5 mm na 100 m² ściany
    expect(boardM2(lines, 'RIGIDUR10')).toBeCloseTo(2, 1);
    expect(boardM2(lines, 'RIGIDUR12.5')).toBeCloseTo(2, 1);
  });

  it('Rigips 3.66.011…016: ściany podwójne 2×CW z Rigidur 1×10 + 1×12,5', () => {
    for (const p of [50, 75, 100]) {
      const sys = wallSystemById(`W-2CW${p}-1RIGIDUR10+1RIGIDUR`);
      expect(sys.frame).toBe('double');
      expect([sys.innerBoard, sys.defaultBoard]).toEqual(['RIGIDUR10', 'RIGIDUR12.5']);
    }
  });

  it('Rigips 3.22.00 X OCEAN: okładzina 2×15 DFH2 + 1×12,5 DFH2 + 1×12,5 X OCEAN', () => {
    const sys = wallSystemById('O-CW75-2x15+1+1XOCEAN');
    expect(sys.sides).toBe(1);
    expect(layerBoards(sys, sys.defaultBoard)).toEqual(['RFI15', 'RFI15', 'RFI12.5', 'XOCEAN12.5']);
    expect(boardGroups(sys).map((g) => `${g.n}×${g.id}`)).toEqual(['2×RFI15', '1×RFI12.5', '1×XOCEAN12.5']);
    expect(wallSystemShort(sys)).toBe('CW 75, 2×15 + 2×12,5');
    const lines = wallConsumption(sys);
    expect(boardM2(lines, 'RFI15')).toBeCloseTo(2, 1);
    expect(boardM2(lines, 'RFI12.5')).toBeCloseTo(1, 1);
    expect(boardM2(lines, 'XOCEAN12.5')).toBeCloseTo(1, 1);
  });

  it('Rigips 4.10.25 X OCEAN: sufit EI 120 z 2×15 + 1×12,5 DFH2 + X OCEAN', () => {
    const sys = ceilingSystemById('S-4.10.25XOCEAN-4');
    expect(layerBoards(sys, sys.defaultBoard)).toEqual(['RFI15', 'RFI15', 'RFI12.5', 'XOCEAN12.5']);
    expect(sys.fire).toMatch(/EI 120/);
    const lines = ceilingConsumption(sys);
    expect(boardM2(lines, 'RFI15')).toBeCloseTo(2, 1);
    expect(boardM2(lines, 'XOCEAN12.5')).toBeCloseTo(1, 1);
  });
});
