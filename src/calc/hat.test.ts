import { describe, expect, it } from 'vitest';
import { BOARDS, CEILING_SYSTEMS, HAT_MM, PRODUCTS, WALL_SYSTEMS, isHatCeiling, isHatWall, wallSystemById } from '../catalog/rigips';
import { HAT_FLANGE, hatFixPositions, wallLayout } from './layout';
import { ceilingConsumption, ceilingRequirement, wallConsumption, wallRequirement } from './materials';
import { ceilingFrameMm } from './ceilingLevels';
import { createCeiling, createOpening, createProject, createWall } from '../model/factory';
import { analyzeJunctions } from '../geometry/geometry';

const hatWalls = WALL_SYSTEMS.filter(isHatWall);
const hatCeilings = CEILING_SYSTEMS.filter(isHatCeiling);

describe('profile kapeluszowe – katalog', () => {
  it('są systemy Rigips, Norgips i Siniat na ścianach i sufitach', () => {
    for (const prefix of ['R-HAT-W', 'NG-OS-KAP', 'SN-O-PK48']) expect(hatWalls.some((s) => s.id.startsWith(prefix))).toBe(true);
    for (const prefix of ['R-HAT-S', 'NG-OSF-KAP', 'SN-S-PK48']) expect(hatCeilings.some((s) => s.id.startsWith(prefix))).toBe(true);
  });
  it('płyty, kotwy i źródła istnieją', () => {
    const boards = new Set(BOARDS.map((b) => b.id));
    for (const s of [...hatWalls, ...hatCeilings]) {
      expect(boards.has(s.defaultBoard)).toBe(true);
      if (s.innerBoard) expect(boards.has(s.innerBoard)).toBe(true);
      for (const v of s.variants ?? []) {
        expect(boards.has(v.board)).toBe(true);
        if (v.innerBoard) expect(boards.has(v.innerBoard)).toBe(true);
      }
      expect(s.source?.url).toMatch(/^https:\/\//);
    }
    for (const s of hatWalls) expect(PRODUCTS[s.anchor ?? 'KOLEK']).toBeTruthy();
  });
  it('ruszt ma 15 mm (także sufit wprost na stropie)', () => {
    for (const s of hatCeilings) expect(ceilingFrameMm(s)).toBe(HAT_MM);
  });
});

describe('hatFixPositions', () => {
  it('kołki w dwóch rzędach na zmianę, w rzędzie co najwyżej rozstaw z karty', () => {
    const pts = hatFixPositions(0, 2.6, 1);
    expect(pts.length).toBe(6);
    for (let i = 1; i < pts.length; i++) expect(pts[i].side).toBe(-pts[i - 1].side as -1 | 1);
    for (const side of [-1, 1]) {
      const row = pts.filter((p) => p.side === side).map((p) => p.at);
      for (let i = 1; i < row.length; i++) expect(row[i] - row[i - 1]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('krótki odcinek ma kołek w każdej półce', () => {
    const pts = hatFixPositions(0, 0.2, 1);
    expect(pts.map((p) => p.side).sort()).toEqual([-1, 1]);
  });
  it('pusty odcinek nie ma kołków', () => expect(hatFixPositions(1, 1, 1)).toEqual([]));
});

describe('okładzina ściany na profilach kapeluszowych', () => {
  const sys = wallSystemById('R-HAT-W-1');
  const make = (withDoor = false) => {
    const p = createProject();
    p.nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 400, y: 0 },
    ];
    const w = createWall(p, 'a', 'b', { systemId: sys.id, boardId: sys.defaultBoard, height: 260, studSpacing: sys.studSpacing });
    if (withDoor) w.openings.push(createOpening('door', 150));
    p.walls = [w];
    return { p, w, j: analyzeJunctions(p).get(w.id)! };
  };

  it('bez UD, uchwytów ES i pchełek – profil kapeluszowy i kołki', () => {
    const { p, w, j } = make();
    const { req } = wallRequirement(p, w, j, sys);
    expect(req.pieces.KAPELUSZ?.length).toBeGreaterThan(0);
    for (const k of ['UD30', 'CD60', 'UW50', 'CW50']) expect(req.pieces[k]).toBeUndefined();
    for (const k of ['WIESZAK_ES', 'LN9']) expect(req.counts[k]).toBeUndefined();
    // kołki = kołki wszystkich profili wg tej samej reguły co rysunek wiercenia
    const lay = wallLayout(p, w, j);
    expect(lay.brackets?.hat).toBe(true);
    expect(lay.tracks).toHaveLength(0);
    expect(req.counts.KOLEK).toBe(lay.brackets!.points.length);
  });

  it('kołki w rysunku wiercenia leżą na półkach profili', () => {
    const { p, w, j } = make();
    const lay = wallLayout(p, w, j);
    const xs = lay.studs.map((s) => s.x);
    // skrajne profile stoją całą szerokością (8 cm) na okładzinie, więc ich oś może być przesunięta o 4 cm do środka
    for (const pt of lay.brackets!.points) expect(xs.some((x) => Math.abs(pt.x - x) <= HAT_FLANGE + 0.04 + 1e-6)).toBe(true);
    expect(lay.brackets!.points.every((pt) => !xs.includes(pt.x))).toBe(true);
  });

  it('nad drzwiami jest poziomy odcinek profilu, bez łączników LN', () => {
    const a = make();
    const plain = wallRequirement(a.p, a.w, a.j, sys).req;
    const door = make(true);
    const { req } = wallRequirement(door.p, door.w, door.j, sys);
    expect(req.counts.LN9).toBeUndefined();
    expect(req.counts.KOLEK).toBeGreaterThan(0);
    expect(req.pieces.KAPELUSZ.length).not.toBe(plain.pieces.KAPELUSZ.length);
  });

  it('ściana na drewnie kotwiona wkrętami do drewna', () => {
    const lines = wallConsumption(wallSystemById('R-HAT-WD-1'));
    expect(lines.some((l) => l.key === 'WKRET_DREWNO')).toBe(true);
    expect(lines.some((l) => l.key === 'KOLEK')).toBe(false);
  });
});

describe('okładzina sufitu na profilach kapeluszowych', () => {
  it('bez obwodowego UD i wieszaków – kotwy przez półki profili', () => {
    const sys = CEILING_SYSTEMS.find((s) => s.id === 'R-HAT-S-1')!;
    const p = createProject();
    const c = createCeiling(
      p,
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      { systemId: sys.id, boardId: sys.defaultBoard },
    );
    const { req } = ceilingRequirement(c, sys);
    expect(req.pieces.KAPELUSZ?.length).toBeGreaterThan(0);
    expect(req.pieces.UD30).toBeUndefined();
    expect(req.pieces.CD60).toBeUndefined();
    for (const k of ['WIESZAK_ES', 'LN9', 'KOLEK', 'LACZNIK_WZDL']) expect(req.counts[k]).toBeUndefined();
    // kotwy: na każdym profilu dwa rzędy, w rzędzie co najwyżej rozstaw z karty
    const pieces = req.pieces.KAPELUSZ;
    expect(req.counts.KOTWA).toBe(pieces.reduce((n, len) => n + hatFixPositions(0, len, sys.hangerSpacing / 100).length, 0));
  });

  it('gęstszy rozstaw kotew daje więcej kotew na m²', () => {
    const at = (id: string) => ceilingConsumption(CEILING_SYSTEMS.find((s) => s.id === id)!).find((l) => l.key === 'KOTWA')!.qty;
    expect(at('R-HAT-S-1-50')).toBeGreaterThan(at('R-HAT-S-1'));
  });
});
