import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  CEILING_SYSTEMS,
  WALL_SYSTEMS,
  boardById,
  boardStackMm,
  ceilingSystemById,
  wallFrameDepth,
  wallMaxHeight,
  wallMidBoard,
  wallStudLabel,
  wallSystemById,
} from '../catalog/rigips';
import { wallThicknessMm } from './joints';
import { KNAUF_BOARDS, KNAUF_CEILING_SYSTEMS, KNAUF_WALL_SYSTEMS } from '../catalog/knauf';
import { ceilingConsumption, wallConsumption, type ConsumptionLine } from './materials';
import { recommendCeilings, recommendWalls } from './recommend';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
const all = [...KNAUF_WALL_SYSTEMS, ...KNAUF_CEILING_SYSTEMS];

describe('katalog Knauf – spójność', () => {
  it('systemy i płyty Knauf są dołączone do wspólnego katalogu', () => {
    for (const s of KNAUF_WALL_SYSTEMS) expect(WALL_SYSTEMS).toContain(s);
    for (const s of KNAUF_CEILING_SYSTEMS) expect(CEILING_SYSTEMS).toContain(s);
    for (const b of KNAUF_BOARDS) expect(BOARDS).toContain(b);
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length);
  });
  it('każdy system ma producenta, źródło Knauf i płytę Knauf; systemy z Systemfindera mają odmiany', () => {
    for (const s of all) {
      expect(s.maker, s.id).toBe('knauf');
      expect(s.code, s.id).toBeUndefined(); // numery Rigips nie dotyczą Knauf
      expect(s.source.url, s.id).toMatch(/^https:\/\/(systems\.)?knauf\.com\/pl-PL\//);
      expect(boardById(s.defaultBoard).maker, s.id).toBe('knauf');
      if (s.source.approx) continue;
      expect(s.variants?.length, s.id).toBeGreaterThan(0);
      for (const v of s.variants!) {
        expect(boardById(v.board!).id, `${s.id}: ${v.label}`).toBe(v.board);
        expect(boardById(v.board!).maker).toBe('knauf');
        for (const id of v.innerBoards ?? []) expect(boardById(id).maker).toBe('knauf');
      }
    }
    // szacunki tylko dla systemów opisanych na stronie bez tabeli (W623, W611)
    expect(all.filter((s) => s.source.approx).map((s) => s.id)).toEqual(['KN-W623-1', 'KN-W623-2', 'KN-W611']);
  });
  it('obejmuje ściany, przedścianki, szachty, sufity i poddasza, z systemami podstawowymi w każdej grupie', () => {
    const wallCats = new Set(KNAUF_WALL_SYSTEMS.map((s) => s.category));
    expect(wallCats).toEqual(new Set(['działowa', 'podwójna', 'instalacyjna', 'okładzina', 'szacht']));
    for (const c of wallCats) expect(KNAUF_WALL_SYSTEMS.some((s) => s.category === c && s.basic), c).toBe(true);
    expect(new Set(KNAUF_CEILING_SYSTEMS.map((s) => s.kind))).toEqual(new Set(['two-level', 'one-level', 'direct']));
    expect(KNAUF_CEILING_SYSTEMS.some((s) => s.attic && s.basic)).toBe(true);
    expect(all.filter((s) => s.basic).length).toBeLessThan(all.length / 2);
  });
  it('wysokość systemu przy każdym rozstawie = wysokość z tabeli dla płyty domyślnej', () => {
    for (const s of KNAUF_WALL_SYSTEMS) {
      if (!s.maxHeight || !s.variants) continue;
      for (const [sp, h] of Object.entries(s.maxHeight)) {
        const v = s.variants.find((x) => x.board === s.defaultBoard && !x.doubleStuds && x.studSpacing === Number(sp));
        expect(v?.maxHeight, `${s.id} co ${sp} cm`).toBe(h);
      }
    }
  });
});

describe('katalog Knauf – wartości z Systemfindera', () => {
  it('W111 CW 75, 1×12,5: A13 EI 30 / Rw 43 dB, do 4,5 m co 60 cm, 6 m co 40 cm, 6,5 m co 30 cm', () => {
    const s = wallSystemById('KN-W111-CW75');
    expect(s.maxHeight).toEqual({ 30: 650, 40: 600, 60: 450 });
    expect(wallMaxHeight(s, 40)).toBe(600);
    const a13 = s.variants!.find((v) => v.board === 'KN-A13' && v.studSpacing === 60)!;
    expect(a13).toMatchObject({ fire: 30, rw: 43, ra1: 40, wool: 75, thickness: 100, mass: 16, maxHeight: 450 });
    expect(s.variants!.find((v) => v.board === 'KN-F13')?.fire).toBe(60);
  });
  it('W112 CW 100 na słupkach zdwojonych: do 10 m co 40 cm', () => {
    const s = wallSystemById('KN-W112-CW100');
    const d = s.variants!.find((v) => v.doubleStuds && v.board === 'KN-DIA13' && v.studSpacing === 40)!;
    expect(d.maxHeight).toBe(1000);
    expect(wallMaxHeight(s, 40, { board: 'KN-DIA13', doubleStuds: true })).toBe(1000);
  });
  it('szyb W628B ze zdwojonymi słupkami z W629 i poszyciem 2×15 + 2×12,5 do EI 120', () => {
    const s = wallSystemById('KN-W628B-CW75-2');
    expect(s.sides).toBe(1);
    const single = s.variants!.find((v) => v.board === 'KN-F13' && !v.doubleStuds)!;
    const dbl = s.variants!.find((v) => v.board === 'KN-F13' && v.doubleStuds)!;
    expect([single.maxHeight, dbl.maxHeight]).toEqual([455, 505]);
    const four = wallSystemById('KN-W628B-CW100-4');
    expect([four.defaultBoard, four.innerBoard, four.innerLayers, four.fire]).toEqual(['KN-F13', 'KN-F15', 2, 'EI 120']);
  });
  it('sufit D112 1×12,5: A13 z CD co 50 cm i wieszakami co 120 cm, płyty ogniowe co 40 cm', () => {
    const s = ceilingSystemById('KN-D112-1');
    expect([s.secondarySpacing, s.hangerSpacing, s.kind]).toEqual([50, 120, 'two-level']);
    const f13 = s.variants!.find((v) => v.board === 'KN-F13')!;
    expect(f13.fire).toBe(15);
    expect(f13.label).toMatch(/co 40 cm/);
  });
  it('poddasze D612 na wieszakach ES do krokwi', () => {
    const s = ceilingSystemById('KN-D612-1');
    expect([s.kind, s.hangerType, s.attic]).toEqual(['direct', 'es', true]);
    expect(s.variants!.some((v) => v.board === 'KN-F15' && v.fire === 30)).toBe(true);
  });
});

describe('katalog Knauf – zeszyt techniczny W11.pl (W115W, W114)', () => {
  it('W115W CW 75: płyta pośrednia między rusztami, wartości z tabeli wariantów i wysokości', () => {
    const s = wallSystemById('KN-W115W-CW75');
    expect([s.frame, s.category, s.midBoard, s.midBoardFromFace]).toEqual(['double', 'podwójna', 'KN-F13', true]);
    expect(s.source.url).toMatch(/systemy-scian-szkieletowych-na-konstrukcji-metalowej$/);
    expect(s.maxHeight).toEqual({ 30: 780, 40: 660, 60: 600 });
    const akup = s.variants!.find((v) => v.board === 'KN-AKUP' && v.studSpacing === 60)!;
    expect(akup).toMatchObject({ fire: 60, rw: 80, ra1: 73, thickness: 215, mass: 62 });
    const cw100 = wallSystemById('KN-W115W-CW100');
    expect(cw100.variants!.find((v) => v.board === 'KN-AKUP')).toMatchObject({ rw: 84, ra1: 80, thickness: 265 });
    expect(cw100.maxHeight).toEqual({ 30: 845, 40: 680, 60: 650 });
    // 2×CW75 + 5 mm + płyta pośrednia 12,5 + 2×2×12,5 = 217,5 mm (karta: 215 mm)
    expect(wallFrameDepth(s) + 2 * boardStackMm(s, s.defaultBoard)).toBeCloseTo(217.5);
  });
  it('W115W: płyta pośrednia tego samego rodzaju co poszycie – 5 m² płyt na m² ściany', () => {
    const s = wallSystemById('KN-W115W-CW75');
    expect(q(wallConsumption(s), 'board:KN-F13')).toBeCloseTo(5);
    const c = wallConsumption({ ...s, defaultBoard: 'KN-AKUP' });
    expect(q(c, 'board:KN-AKUP')).toBeCloseTo(5);
    expect(q(c, 'board:KN-F13')).toBe(0);
    // W115 bez płyty pośredniej: 4 m²
    expect(q(wallConsumption(wallSystemById('KN-W115-CW75-2')), 'board:KN-A13')).toBeCloseTo(4);
  });
  it('W114 (dawniej W113+ z Systemfindera): EI 240, płyty Diamant i Silentboard, stare id prowadzą do W114', () => {
    const s = wallSystemById('KN-W114-CW100');
    expect([s.layers, s.fire, s.maxHeight]).toEqual([4, 'EI 240', { 30: 925, 40: 850, 60: 675 }]);
    expect(s.variants!.find((v) => v.board === 'KN-DIA13')).toMatchObject({ rw: 68, ra1: 63, mass: 106 });
    expect(s.variants!.find((v) => v.board === 'KN-SIL')).toMatchObject({ innerBoards: ['KN-DIA13'], rw: 71, mass: 126.5 });
    expect(wallSystemById('KN-W113P-CW100').id).toBe('KN-W114-CW100');
    expect(KNAUF_WALL_SYSTEMS.some((w) => w.name.includes('W113+'))).toBe(false);
  });
});

describe('katalog Knauf – W635 (szyb na słupkach 2×UW z płytą pośrednią)', () => {
  it('8 konstrukcji z Systemfindera: UW 75 do 4,5 m, UW 100 do 5,25 m, wartości z tabeli', () => {
    const ids = KNAUF_WALL_SYSTEMS.filter((s) => s.id.startsWith('KN-W635')).map((s) => s.id);
    expect(ids).toEqual([
      'KN-W635-UW75-2+1', 'KN-W635-UW75-2+2', 'KN-W635-UW75-3+2', 'KN-W635-UW75-4+1',
      'KN-W635-UW100-2+1', 'KN-W635-UW100-2+2', 'KN-W635-UW100-3+2', 'KN-W635-UW100-4+1',
    ]);
    const s = wallSystemById('KN-W635-UW75-2+1');
    expect([s.category, s.frame, s.sides, s.layers, s.studKind, s.defaultBoard, s.midBoard]).toEqual(['szacht', 'single', 1, 2, 'UW2', 'KN-F15', 'KN-F13']);
    expect(wallStudLabel(s)).toBe('2×UW 75');
    expect(s.maxHeight).toEqual({ 60: 450 });
    expect(s.variants![0]).toMatchObject({ fire: 60, rw: 52, ra1: 50, thickness: 105, mass: 40 });
    expect(wallSystemById('KN-W635-UW100-2+1').maxHeight).toEqual({ 60: 525 });
    const d = wallSystemById('KN-W635-UW75-2+2');
    expect([d.defaultBoard, d.midBoard, d.midLayers, d.fire]).toEqual(['KN-DIA13', 'KN-DIA13', 2, 'EI 30']);
    const f = wallSystemById('KN-W635-UW100-4+1');
    expect([f.defaultBoard, f.innerBoard, f.innerLayers, f.fire]).toEqual(['KN-F13', 'KN-F15', 2, 'EI 120']);
  });
  it('płyta pośrednia wg poszycia (F15 → F13, HF15 → HF13) i w głębokości profilu', () => {
    const s = wallSystemById('KN-W635-UW75-2+1');
    expect(wallMidBoard(s, 'KN-F15')).toBe('KN-F13');
    expect(wallMidBoard(s, 'KN-HF15')).toBe('KN-HF13');
    // grubość z karty: profil 75 + 2×15 = 105 mm (płyta pośrednia mieści się w profilu)
    expect(wallThicknessMm(s, 'KN-F15')).toBe(105);
    expect(wallThicknessMm(wallSystemById('KN-W635-UW100-3+2'), 'KN-DIA13')).toBe(137.5);
  });
  it('zużycie: 2 m² poszycia + płyta pośrednia, słupki z dwóch UW zamiast CW', () => {
    const s = wallSystemById('KN-W635-UW75-2+1');
    const c = wallConsumption(s);
    expect(q(c, 'board:KN-F15')).toBeCloseTo(2);
    expect(q(c, 'board:KN-F13')).toBeCloseTo(1);
    expect(q(c, 'CW75')).toBe(0);
    // dwa UW na słupek co 60 cm (≈ 3,3 mb/m²) + UW przy posadzce i stropie
    expect(q(c, 'UW75')).toBeGreaterThan(3.3);
    expect(q(wallConsumption({ ...s, defaultBoard: 'KN-HF15' }), 'board:KN-HF13')).toBeCloseTo(1);
    expect(q(wallConsumption(wallSystemById('KN-W635-UW75-2+2')), 'board:KN-DIA13')).toBeCloseTo(4);
  });
});

describe('katalog Knauf – silnik i dobór', () => {
  it('W112 CW 75, 2×12,5: 4 m² płyt A13 na m² ściany i słupki CW 75', () => {
    const c = wallConsumption(wallSystemById('KN-W112-CW75'));
    expect(q(c, 'board:KN-A13')).toBeCloseTo(4);
    expect(q(c, 'CW75')).toBeGreaterThan(1.6);
    expect(q(c, 'CW75')).toBeLessThan(2.1);
  });
  it('sufit D112 liczy wieszaki noniuszowe, poddasze D612 wieszaki ES', () => {
    expect(q(ceilingConsumption(ceilingSystemById('KN-D112-1')), 'WIESZAK_NONIUSZ')).toBeGreaterThan(0.5);
    const attic = ceilingConsumption(ceilingSystemById('KN-D612-1'));
    expect(q(attic, 'WIESZAK_ES')).toBeGreaterThan(1);
    expect(q(attic, 'WIESZAK_NONIUSZ')).toBe(0);
  });
  it('dobór z filtrem Knauf zwraca tylko systemy Knauf, także dla ściany 6 m i łazienki', () => {
    const tall = recommendWalls({ purpose: 'partition', heightCm: 600, room: 'dry', fire: 0, acoustic: 'any', maker: 'knauf' });
    expect(tall.length).toBeGreaterThan(0);
    for (const p of tall) {
      expect(p.system.maker).toBe('knauf');
      expect(p.maxHeight!).toBeGreaterThanOrEqual(600);
    }
    const wet = recommendWalls({ purpose: 'partition', heightCm: 260, room: 'wet', fire: 0, acoustic: 'any', maker: 'knauf' });
    expect(wet.length).toBeGreaterThan(0);
    for (const p of wet) expect(p.boardId).toBe('KN-AQ');
    const ceil = recommendCeilings({ mount: 'attic', room: 'dry', fire: 0, maker: 'knauf' });
    expect(ceil.map((p) => p.system.id)).toContain('KN-D612-1');
  });
});
