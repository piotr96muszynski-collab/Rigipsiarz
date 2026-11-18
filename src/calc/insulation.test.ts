import { describe, expect, it } from 'vitest';
import { calculateProject, ceilingInsulation, wallInsulation, wallWoolOptions } from './materials';
import { createCeiling, createOpening, createProject, createWall, uid } from '../model/factory';
import { WOOL_PRODUCTS, resolveWool, woolProductsFor } from '../catalog/insulation';
import { wallSystemById } from '../catalog/rigips';
import type { Project, Wall } from '../model/types';

function project(walls: { len: number; over?: Partial<Wall> }[], waste = 0): Project {
  const p = createProject();
  p.settings.waste = waste;
  p.settings.wasteEnabled = waste > 0;
  let x = 0;
  for (const w of walls) {
    const a = { id: uid(), x, y: 0 };
    // kolejne ściany osobno (bez połączeń), żeby nie zmieniać ich długości
    const b = { id: uid(), x: x + w.len, y: 0 };
    p.nodes.push(a, b);
    p.walls.push(createWall(p, a.id, b.id, { height: 260, systemId: 'W-CW75-1', boardId: 'RB12.5', insulation: true, ...w.over }));
    x += w.len + 500;
  }
  return p;
}

const wool = (p: Project) => calculateProject(p).total.filter((l) => l.group === 'Izolacja');

describe('wełna w ścianach', () => {
  it('m² po odjęciu drzwi, zapas i pełne paczki Isover Aku-Płyta 75', () => {
    const p = project([{ len: 400 }], 10);
    p.walls[0].openings.push(createOpening('door', 100)); // 90 × 205
    const [l] = wool(p);
    // 4,0 × 2,6 − 0,9 × 2,05 = 8,555 m² → +10% = 9,41 → 9,5 m² → 2 paczki po 8,64 m²
    expect(l.key).toBe('wool-ISO-AKU-75');
    expect(l.qty).toBe(9.5);
    expect(l.packs).toBe(2);
    expect(l.packUnit).toBe('opak.');
    expect(l.note).toContain('8,55 m² netto');
    expect(l.note).toBe('8,55 m² netto · paczka 8,64 m² (12 pł. 60×120 cm)');
  });

  it('bez zapasu mieści się w jednej paczce', () => {
    const p = project([{ len: 400 }]);
    p.walls[0].openings.push(createOpening('door', 100));
    const [l] = wool(p);
    expect(l.qty).toBe(8.6);
    expect(l.packs).toBe(1);
  });

  it('domyślnie pełna głębokość profilu, cieńsza na życzenie, grubsza niż profil – niemożliwa', () => {
    const sys = wallSystemById('W-CW75-1');
    expect(wallWoolOptions(sys)).toEqual([50, 75]);
    const p = project([{ len: 300 }]);
    expect(wallInsulation(p.walls[0], sys)).toEqual({ thickness: 75, layers: 1 });
    p.walls[0].insulationThickness = 50;
    expect(wallInsulation(p.walls[0], sys)?.thickness).toBe(50);
    expect(wool(p)[0].key).toBe('wool-ISO-AKU-50');
    p.walls[0].insulationThickness = 100;
    expect(wallInsulation(p.walls[0], sys)?.thickness).toBe(75);
  });

  it('podwójny ruszt: dwie warstwy wełny', () => {
    const sys = wallSystemById('W-CW50-1');
    const dbl = { ...sys, frame: 'double' as const };
    const p = project([{ len: 300 }]);
    expect(wallInsulation(p.walls[0], dbl)).toEqual({ thickness: 50, layers: 2 });
  });

  it('płyta klejona – bez wełny', () => {
    const glued = { ...wallSystemById('W-CW75-1'), frame: 'glued' as const };
    expect(wallWoolOptions(glued)).toEqual([]);
    expect(wallInsulation(project([{ len: 300 }]).walls[0], glued)).toBeNull();
  });

  it('wyłączona wełna – brak pozycji', () => {
    expect(wool(project([{ len: 300, over: { insulation: false } }]))).toHaveLength(0);
  });

  it('ściany tej samej grubości sumuje przed zaokrągleniem do paczek', () => {
    // 2 × (2,0 × 2,6) = 10,4 m² → 2 paczki (osobno byłyby 1 + 1, razem też 2); 3 ściany: 15,6 m² → 2 paczki, nie 3
    const p = project([{ len: 200 }, { len: 200 }, { len: 200 }]);
    const [l] = wool(p);
    expect(l.qty).toBe(15.6);
    expect(l.packs).toBe(2);
  });

  it('produkt wybrany w ustawieniach: Rockmin Plus 75 mm (7,32 m²)', () => {
    const p = project([{ len: 400 }], 10);
    p.settings.wool = { '75': { productId: 'RW-ROCKMIN-75' } };
    const [l] = wool(p);
    // 10,4 × 1,1 = 11,44 → 11,5 m² → 2 paczki
    expect(l.key).toBe('wool-RW-ROCKMIN-75');
    expect(l.name).toBe('Rockwool Rockmin Plus 75 mm');
    expect(l.qty).toBe(11.5);
    expect(l.packs).toBe(2);
  });

  it('własne opakowanie (np. URSA) – m² w paczce wpisane ręcznie', () => {
    const p = project([{ len: 400 }]);
    p.settings.wool = { '75': { customM2: 5 } };
    const [l] = wool(p);
    expect(l.key).toBe('wool-custom-75');
    expect(l.packs).toBe(3); // 10,4 / 5
  });
});

describe('wełna na suficie', () => {
  const ceiling = (thickness?: number) => {
    const p = createProject();
    p.settings.wasteEnabled = false;
    p.ceilings = [
      createCeiling(
        p,
        [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
        { insulation: true, insulationThickness: thickness },
      ),
    ];
    return p;
  };

  it('domyślnie 100 mm na całą powierzchnię', () => {
    const p = ceiling();
    expect(ceilingInsulation(p.ceilings[0])).toEqual({ thickness: 100, layers: 1 });
    const [l] = wool(p);
    expect(l.qty).toBe(12);
    expect(l.packs).toBe(2); // 12 / 7,2
  });

  it('150 mm: mata w rolkach', () => {
    const [l] = wool(ceiling(150));
    expect(l.key).toBe('wool-ISO-044-150');
    expect(l.packUnit).toBe('rolka');
    expect(l.packs).toBe(2);
  });
});

describe('katalog wełny', () => {
  it('do profilu 75 pasuje też płyta 70 mm, nie pasuje 100 mm', () => {
    const ids = woolProductsFor(75).map((p) => p.id);
    expect(ids).toContain('RW-SONIC-70');
    expect(ids).not.toContain('ISO-AKU-100');
  });
  it('każda grubość ma domyślny produkt z m² w paczce', () => {
    for (const t of [50, 75, 100, 150]) expect(resolveWool(t).packM2).toBeGreaterThan(0);
  });
  it('m² w paczce zgadza się z liczbą i wymiarem płyt', () => {
    for (const p of WOOL_PRODUCTS)
      if (p.pieces && p.sizeCm) expect(p.pieces * (p.sizeCm[0] / 100) * (p.sizeCm[1] / 100)).toBeCloseTo(p.packM2, 2);
  });
});
