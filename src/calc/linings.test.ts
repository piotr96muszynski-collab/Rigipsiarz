import { describe, expect, it } from 'vitest';
import { analyzeJunctions, interiorSide } from '../geometry/geometry';
import { createLining, createOpening, createProject } from '../model/factory';
import { addWall } from '../model/ops';
import type { Project } from '../model/types';
import { calculateProject, liningKey } from './materials';

/** Obrys mieszkania 500 × 400 cm narysowany po licu ścian (zgodnie z ruchem wskazówek zegara) */
function outline(): Project {
  const p = createProject();
  const pts = [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 400 },
    { x: 0, y: 400 },
  ];
  pts.forEach((pt, i) => addWall(p, pt, pts[(i + 1) % 4], { kind: 'existing', height: 260 }));
  return p;
}

describe('obrys istniejącej przestrzeni', () => {
  it('istniejące ściany nie trafiają do materiałów ani statystyk zabudowy', () => {
    const p = outline();
    p.walls[0].openings.push(createOpening('window', 100));
    const calc = calculateProject(p);
    expect(calc.walls.size).toBe(0);
    expect(calc.total).toHaveLength(0);
    expect(calc.stats.wallAreaM2).toBe(0);
  });

  it('rozpoznaje stronę pomieszczenia każdej ściany obrysu', () => {
    const p = outline();
    for (const w of p.walls) {
      const side = interiorSide(p, w);
      expect(side).not.toBe(0);
      const a = p.nodes.find((n) => n.id === w.a)!;
      const b = p.nodes.find((n) => n.id === w.b)!;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      // punkt po wskazanej stronie leży wewnątrz prostokąta 0..500 × 0..400
      const px = (a.x + b.x) / 2 + (-(b.y - a.y) / L) * side * 10;
      const py = (a.y + b.y) / 2 + ((b.x - a.x) / L) * side * 10;
      expect(px > 0 && px < 500 && py > 0 && py < 400).toBe(true);
    }
  });

  it('suchy tynk na kleju: płyty i klej z odjęciem okna', () => {
    const p = outline();
    const w = p.walls[0];
    w.openings.push(createOpening('window', 100)); // 120 × 120
    w.linings = [createLining(interiorSide(p, w) || 1, 'O-KLEJ')];
    const calc = calculateProject(p);
    const r = calc.linings.get(liningKey(w.id, w.linings[0].side))!;
    const net = 5 * 2.6 - 1.2 * 1.2;
    expect(r.info.netAreaM2).toBeCloseTo(net);
    expect(calc.stats.liningAreaM2).toBeCloseTo(net);
    const boards = Object.values(r.req.boardArea).reduce((a, b) => a + b, 0);
    expect(boards).toBeCloseTo(net);
    expect(r.req.kg.KLEJ).toBeCloseTo(net * 5); // kalkulator Rigips 3.10.00: 5 kg/m²
    // bez rusztu – żadnych profili ani kołków
    expect(Object.keys(r.req.pieces).filter((k) => k !== 'NAROZNIK')).toHaveLength(0);
    expect(r.req.counts.KOLEK ?? 0).toBe(0);
    // narożniki ochronne na ościeżach okna liczy połączenie otworu (src/calc/joints.ts)
    const reveal = calc.joints.find((j) => j.id === `op:${w.id}:${w.linings![0].side}:${w.openings[0].id}`)!;
    expect(reveal.req.pieces.NAROZNIK).toHaveLength(4);
    // styk okładziny z murem na obu końcach i ze stropem
    expect(calc.joints.find((j) => j.id === `lin:${w.id}:${w.linings![0].side}`)!.inner!.lengths).toEqual([2.6, 2.6]);
  });

  it('okładzina na CD 60: profile, uchwyty ES i UD przy murze', () => {
    const p = outline();
    const w = p.walls[1]; // 400 cm
    w.linings = [createLining(1, 'O-CD-1')];
    const calc = calculateProject(p);
    const r = calc.linings.get(liningKey(w.id, 1))!;
    expect(r.req.pieces.CD60.length).toBeGreaterThanOrEqual(8); // co 60 cm na 4 m
    expect(r.req.counts.WIESZAK_ES).toBeGreaterThan(0);
    expect(r.req.pieces.UD30?.length).toBeGreaterThan(0);
    expect(calc.total.some((l) => l.key.startsWith('bar-CD60'))).toBe(true);
  });

  it('nowa ściana g-k wewnątrz obrysu kotwi się do muru na obu końcach', () => {
    const p = outline();
    const gk = addWall(p, { x: 200, y: 0 }, { x: 200, y: 400 })!;
    const j = analyzeJunctions(p).get(gk.id)!;
    expect(j.endA).toBe('existing-wall');
    expect(j.endB).toBe('existing-wall');
    expect(j.extraStuds).toBe(0);
    const calc = calculateProject(p);
    expect(calc.walls.size).toBe(1);
    expect(calc.stats.wallLengthM).toBeCloseTo(4);
  });
});

describe('model 3D obrysu', () => {
  it('mur leży na zewnątrz lica, a płyty okładziny po stronie pomieszczenia', async () => {
    const { buildModel3D } = await import('../view3d/model3d');
    const p = outline();
    const w = p.walls[0]; // y = 0, pomieszczenie ma y > 0
    w.openings.push(createOpening('window', 100));
    w.linings = [createLining(interiorSide(p, w) || 1)];
    const m = buildModel3D(p, calculateProject(p));
    const masonry = m.parts.filter((x) => x.owner === w.id && x.mat === 'masonry');
    const boards = m.parts.filter((x) => x.owner === w.id && x.layer === 'wallBoards');
    expect(masonry.length).toBeGreaterThan(1); // mur pocięty oknem
    expect(boards.length).toBeGreaterThan(0);
    for (const x of masonry) if (x.type === 'box') expect(x.c[2]).toBeLessThan(0);
    for (const x of boards) if (x.type === 'box') expect(x.c[2]).toBeGreaterThan(0);
  });
});

describe('okładzina ATLAS M-System na murze', () => {
  it('łączniki zamiast profili, z odjęciem otworu', () => {
    const p = outline();
    const w = p.walls[0];
    w.openings.push(createOpening('window', 100));
    w.linings = [createLining(interiorSide(p, w) || 1, 'A-W-L100')];
    const calc = calculateProject(p);
    const r = calc.linings.get(liningKey(w.id, w.linings[0].side))!;
    expect(r.info.netAreaM2).toBeCloseTo(5 * 2.6 - 1.2 * 1.2);
    expect(r.info.warnings.join(' ')).not.toContain('nie jest okładziną');
    expect(r.req.pieces.CD60 ?? []).toHaveLength(0);
    expect(Object.keys(r.req.counts).some((k) => k.startsWith('ATLAS'))).toBe(true);
  });
});
