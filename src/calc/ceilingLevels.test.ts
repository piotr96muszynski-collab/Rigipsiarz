import { describe, expect, it } from 'vitest';
import { ceilingSystemById } from '../catalog/rigips';
import { createCeiling, createExistingWall, createProject, fitCeilingHeight, uid } from '../model/factory';
import type { Project } from '../model/types';
import { buildModel3D, type BoxPart } from '../view3d/model3d';
import { ceilingDepth, ceilingLevels, hangerGapClass, maxCeilingHeight } from './ceilingLevels';
import { calculateProject } from './materials';

const RECT = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];

/** Pokój z murów 4×3 m o wysokości `wallH` i sufit pod stropem */
function room(wallH: number, ceiling: { slabHeight?: number; height?: number; systemId?: string } = {}): Project {
  const p = createProject();
  p.settings.defaultHeight = wallH;
  p.nodes = RECT.map((pt) => ({ id: uid(), ...pt }));
  p.walls = p.nodes.map((n, i) => createExistingWall(p, n.id, p.nodes[(i + 1) % 4].id));
  p.ceilings = [createCeiling(p, RECT, ceiling)];
  return p;
}

describe('minimalna wysokość zabudowy sufitu', () => {
  it('z karty Rigips: 4.05.24 dwupoziomowy 1×12,5 – 230 mm, 2×12,5 – 240 mm, ES 4.05.23 – 42 mm', () => {
    expect(ceilingDepth(ceilingSystemById('S-CD-2P-1'), 'RB12.5')).toMatchObject({ minMm: 230, assumed: false });
    expect(ceilingDepth(ceilingSystemById('S-CD-2P-2'), 'RB12.5').minMm).toBe(240);
    expect(ceilingDepth(ceilingSystemById('S-ES-1'), 'RB12.5').minMm).toBe(42);
  });

  it('grubsza płyta niż w odmianie z karty podnosi minimum o różnicę grubości', () => {
    const sys = ceilingSystemById('S-CD-2P-2');
    expect(ceilingDepth(sys, 'RF15').minMm).toBe(240 + 2 * 2.5);
  });

  it('system bez grubości w karcie: założenie oznaczone, przęsłowe – sam ruszt', () => {
    const knauf = ceilingDepth(ceilingSystemById('KN-D112-1'));
    expect(knauf.assumed).toBe(true);
    expect(knauf.minMm).toBeGreaterThan(200);
    const ua = ceilingDepth(ceilingSystemById('S-UA-1'));
    expect(ua).toMatchObject({ minMm: 27 + 40 + 13, assumed: false });
  });
});

describe('poziomy sufitu', () => {
  it('strop 3,00 m, sufit 2,70 m: zwieszenie = strop − wierzch rusztu', () => {
    const p = room(300, { slabHeight: 300, height: 270 });
    const lv = ceilingLevels(p.ceilings[0]);
    expect(lv).toMatchObject({ slab: 300, ceiling: 270, warnings: [] });
    expect(lv.frameBottom).toBeCloseTo(271.25);
    expect(lv.frameTop).toBeCloseTo(271.25 + 5.4);
    expect(lv.hangerGap).toBeCloseTo(300 - 276.65);
  });

  it('przykład 3,00 / 2,80 m: dwupoziomowy CD wg 4.05.24 nie zmieści się (min. 23 cm), ES tak', () => {
    expect(ceilingLevels(room(300, { slabHeight: 300, height: 280 }).ceilings[0]).ceiling).toBe(277);
    const es = ceilingLevels(room(300, { slabHeight: 300, height: 280, systemId: 'S-ES-1' }).ceilings[0]);
    expect(es.ceiling).toBe(280);
  });

  it('sufit za blisko stropu jest obniżany do minimum z ostrzeżeniem', () => {
    const p = room(300);
    p.ceilings[0].height = 295;
    const lv = ceilingLevels(p.ceilings[0]);
    expect(lv.ceiling).toBeCloseTo(277);
    expect(lv.warnings[0]).toMatch(/za blisko stropu.*min\. 23 cm/);
  });

  it('nowy sufit: z ustawień, ale nie wyżej niż strop − minimum; zmiana systemu dopasowuje wysokość', () => {
    const p = createProject();
    p.settings.defaultHeight = 300;
    expect(createCeiling(p, RECT)).toMatchObject({ slabHeight: 300, height: 277 });
    p.settings.ceilingHeight = 280;
    expect(createCeiling(p, RECT).height).toBe(277);
    p.settings.ceilingHeight = 260;
    const c = createCeiling(p, RECT, { systemId: 'S-ES-1' });
    expect(c.height).toBe(260);
    c.height = 295;
    fitCeilingHeight(c);
    expect(c.height).toBe(maxCeilingHeight(300, ceilingSystemById('S-ES-1'), c.boardId));
  });

  it('stary projekt bez stropu: dawna wysokość to strop, sufit wisi najbliżej stropu', () => {
    const p = room(260);
    delete p.ceilings[0].slabHeight;
    p.ceilings[0].height = 260;
    const lv = ceilingLevels(p.ceilings[0]);
    expect(lv.slab).toBe(260);
    expect(lv.ceiling).toBe(237);
    expect(lv.warnings).toEqual([]);
  });

  it('uchwyty ES daleko od stropu – ostrzeżenie o sufit podwieszany', () => {
    const p = room(300, { slabHeight: 300, height: 250, systemId: 'S-ES-1' });
    expect(ceilingLevels(p.ceilings[0]).warnings.join()).toMatch(/noniuszowych/);
  });
});

describe('UD kotwiony do ścian i wieszaki do stropu', () => {
  it('UD w 3D leży na wierzchu płyt, poniżej korony ścian dochodzących do stropu', () => {
    const p = room(300, { slabHeight: 300, height: 270 });
    const parts = buildModel3D(p).parts.filter((x): x is BoxPart => x.type === 'box');
    const ud = parts.filter((x) => x.mat === 'ud');
    expect(ud).toHaveLength(4);
    for (const u of ud) {
      expect(u.c[1] - u.s[1] / 2).toBeCloseTo(2.7125, 3);
      expect(u.c[1] + u.s[1] / 2).toBeLessThan(3);
    }
    // wieszak: od wierzchu nośnego CD do spodu stropu
    const hangers = parts.filter((x) => x.mat === 'hanger');
    expect(hangers.length).toBeGreaterThan(0);
    for (const h of hangers) expect(h.c[1] + h.s[1] / 2).toBeCloseTo(3, 3);
  });

  it('ściany niższe niż UD – ostrzeżenie w wyliczeniu sufitu', () => {
    const p = room(260, { slabHeight: 300, height: 270 });
    const w = calculateProject(p).ceilings.get(p.ceilings[0].id)!.warnings;
    expect(w.join()).toMatch(/4 ściany przy suficie kończą się na 2,60 m/);
    const ok = room(300, { slabHeight: 300, height: 270 });
    expect(calculateProject(ok).ceilings.get(ok.ceilings[0].id)!.warnings).toEqual([]);
  });

  it('zestawienie: wieszaki noniuszowe z długością zwieszenia', () => {
    const p = room(300, { slabHeight: 300, height: 270 });
    const line = calculateProject(p).total.find((l) => l.key === 'WIESZAK_NONIUSZ')!;
    expect(line.note).toMatch(/do 25 cm/);
    expect(hangerGapClass(23.35)).toBe(25);
    expect(hangerGapClass(0)).toBe(5);
  });
});
