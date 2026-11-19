import { afterEach, describe, expect, it } from 'vitest';
import type { Attic } from '../model/types';
import { createAttic, createLining, createProject } from '../model/factory';
import { atticGrid } from './attic';
import { atticRequirement } from './atticMaterials';
import { atticWallFaces, atticWallLayout, clipRect, polyArea, topAt } from './atticWalls';
import { setAppBoardLength } from './boardLength';
import { buildModel3D, type PanelPart } from '../view3d/model3d';

const attic = (o: Partial<Attic> = {}): Attic => ({
  id: 'a1',
  roof: 'gable',
  width: 800,
  length: 1000,
  kneeLeft: 100,
  kneeRight: 100,
  pitch: 45,
  collarHeight: 260,
  rafterSpacing: 90,
  rafterWidth: 8,
  rafterHeight: 18,
  firstRafter: 10,
  systemId: 'S-PODD-1',
  boardId: 'RB12.5',
  woolBetween: 150,
  woolUnder: 0,
  kneeLining: createLining(1, 'O-CD-1'),
  gableLining: createLining(1, 'O-CD-1'),
  ...o,
});

afterEach(() => setAppBoardLength('auto'));

describe('geometria okładzin ścian poddasza', () => {
  it('przycinanie prostokąta do wielokąta i pole', () => {
    const tri = [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 0, z: 100 },
    ];
    expect(polyArea(clipRect(0, 50, 0, 100, tri))).toBeCloseTo(50 * 100 - 50 * 50 / 2, 6);
    expect(topAt(tri, 25)).toBeCloseTo(75, 6);
  });

  it('ścianki kolankowe do dolnej krawędzi skosu, ściana szczytowa po licu skosów i sufitu', () => {
    const a = attic();
    const grid = atticGrid(a);
    const faces = atticWallFaces(a, grid);
    expect(faces.map((f) => f.id)).toEqual(['knee-left', 'knee-right', 'gable']);
    const left = grid.section.surfaces.find((s) => s.id === 'left')!;
    expect(faces[0].height).toBeCloseTo(left.a.z, 6);
    expect(faces[0].width).toBe(1000);
    const gable = faces[2];
    expect(gable.count).toBe(2);
    // pole ściany szczytowej = prostokąt pod ściankami + trapez skosów + sufit
    const collar = grid.section.surfaces.find((s) => s.id === 'collar')!;
    const expected = 800 * left.a.z + ((800 + collar.run) / 2) * (collar.a.z - left.a.z);
    expect(polyArea(gable.poly)).toBeCloseTo(expected, 3);
  });

  it('bez okładzin nie ma ścian; skos od podłogi – bez ścianki kolankowej', () => {
    expect(atticWallFaces(attic({ kneeLining: undefined, gableLining: undefined }), atticGrid(attic()))).toEqual([]);
    const a = attic({ kneeLeft: 0, kneeRight: 0, gableLining: undefined });
    expect(atticWallFaces(a, atticGrid(a))).toEqual([]);
  });

  it('dach jednospadowy: ściana wysoka po prawej', () => {
    const a = attic({ roof: 'mono', collarHeight: undefined, pitch: 20, width: 500, gableLining: undefined });
    const faces = atticWallFaces(a, atticGrid(a));
    expect(faces.map((f) => f.id)).toEqual(['knee-left', 'knee-right']);
    expect(faces[1].label).toMatch(/wysoka/);
    expect(faces[1].height).toBeGreaterThan(faces[0].height + 100);
  });
});

describe('ruszt i płyty okładzin ścian poddasza', () => {
  it('profile CD co rozstaw, docięte do skosu; płyty pokrywają ścianę bez nakładek', () => {
    const a = attic();
    const gable = atticWallFaces(a, atticGrid(a)).find((f) => f.id === 'gable')!;
    const lay = atticWallLayout(gable);
    expect(lay.studs.length).toBe(Math.ceil(800 / 60 - 1e-9) + 1 - 0);
    for (const s of lay.studs) expect(s.len).toBeLessThanOrEqual(topAt(gable.poly, s.x) + 0.1);
    // pod skosem profil krótszy niż przy kalenicy
    expect(lay.studs[1].len).toBeLessThan(lay.studs[Math.floor(lay.studs.length / 2)].len);
    const covered = lay.layers[0].pieces.reduce((t, p) => t + p.area, 0);
    expect(covered).toBeCloseTo(polyArea(gable.poly), 1);
    for (const p of lay.layers[0].pieces) {
      expect(p.x1 - p.x0).toBeGreaterThanOrEqual(29.5);
      expect(p.x1 - p.x0).toBeLessThanOrEqual(120.01);
    }
    // uchwyty ES na każdym profilu
    expect(lay.fixings.length).toBeGreaterThanOrEqual(lay.studs.length);
  });

  it('zestawienie: płyty, CD, UD, uchwyty ES z okładzin obu ścian szczytowych i ścianek', () => {
    const plain = atticRequirement(attic({ kneeLining: undefined, gableLining: undefined }));
    const r = atticRequirement(attic());
    expect(r.walls).toHaveLength(3);
    const area = r.walls.reduce((t, w) => t + w.areaM2 * w.face.count, 0);
    expect(r.wallAreaM2).toBeCloseTo(area, 6);
    const sum = (o: Record<string, number> = {}) => Object.values(o).reduce((s, v) => s + v, 0);
    const net = (x: typeof r) => sum(x.req.boardArea) - sum(x.req.boardCutWaste);
    expect(net(r) - net(plain)).toBeCloseTo(area, 4);
    const studs = r.walls.reduce((t, w) => t + w.studs.length * w.face.count, 0);
    expect(r.req.pieces.CD60.length - plain.req.pieces.CD60.length).toBe(studs);
    const es = r.walls.reduce((t, w) => t + w.fixings.length * w.face.count, 0);
    expect(r.req.counts.WIESZAK_ES).toBe(es);
    expect(r.req.pieces.UD30.length).toBeGreaterThan(plain.req.pieces.UD30.length);
  });

  it('suchy tynk: klej, bez profili', () => {
    const r = atticRequirement(attic({ kneeLining: createLining(1, 'O-KLEJ'), gableLining: undefined }));
    expect(r.walls.every((w) => w.studs.length === 0 && w.tracks.length === 0)).toBe(true);
    expect(r.req.kg.KLEJ).toBeCloseTo(r.wallAreaM2 * 5, 6);
  });

  it('w 3D płyty ścian to te same elementy co na rysunku', () => {
    const p = createProject();
    p.attics = [{ ...createAttic(), kneeLining: createLining(1, 'O-CD-1'), gableLining: createLining(1, 'O-CD-1') }];
    const r = atticRequirement(p.attics[0]);
    const panels = buildModel3D(p).parts.filter((x) => x.type === 'panel') as PanelPart[];
    const pieces = r.walls.reduce((t, w) => t + w.layers.reduce((n, l) => n + l.pieces.length, 0) * w.face.count, 0);
    expect(panels).toHaveLength(pieces);
    expect(panels.reduce((t, x) => t + x.area, 0)).toBeCloseTo(r.wallAreaM2 * r.walls[0].layers.length, 4);
  });
});
