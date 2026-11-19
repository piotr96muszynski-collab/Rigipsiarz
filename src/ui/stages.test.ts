import { describe, expect, it } from 'vitest';
import { stageOf, stagesFor, viewForStage, type Tab } from './stages';

describe('etapy pracy w nawigacji projektu', () => {
  it('każdy widok poza ustawieniami należy do dokładnie jednego etapu', () => {
    const tabs: Tab[] = ['plan', 'elements', 'list', 'joints', 'drawings', '3d'];
    for (const wide of [false, true]) {
      const all = stagesFor(wide).flatMap((s) => s.views.map((v) => v.id));
      expect([...all].sort()).toEqual([...tabs].sort());
    }
    expect(stageOf('settings')).toBeUndefined();
  });

  it('przypisuje widoki do etapów wymiary, materiały, montaż', () => {
    expect(stageOf('plan')).toBe('wymiary');
    expect(stageOf('elements')).toBe('wymiary');
    expect(stageOf('list')).toBe('materialy');
    expect(stageOf('joints')).toBe('materialy');
    expect(stageOf('drawings')).toBe('montaz');
    expect(stageOf('3d')).toBe('montaz');
  });

  it('etap otwiera ostatnio oglądany widok, a za pierwszym razem pierwszy', () => {
    expect(viewForStage('materialy', {})).toBe('list');
    expect(viewForStage('materialy', { materialy: 'joints' })).toBe('joints');
    expect(viewForStage('montaz', { montaz: '3d' })).toBe('3d');
    // zapamiętany widok z innego etapu jest ignorowany
    expect(viewForStage('wymiary', { wymiary: 'joints' })).toBe('plan');
  });
});
