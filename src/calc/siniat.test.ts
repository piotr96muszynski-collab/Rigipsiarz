import { describe, expect, it } from 'vitest';
import { BOARDS, CEILING_SYSTEMS, MAKER_LABEL, WALL_SYSTEMS, boardById, ceilingSystemById, wallMaxHeight, wallSystemById } from '../catalog/rigips';
import { SINIAT_BOARDS, SINIAT_CEILING_SYSTEMS, SINIAT_SKIPPED, SINIAT_WALL_SYSTEMS } from '../catalog/siniat';
import { ceilingConsumption, wallConsumption, type ConsumptionLine } from './materials';
import { recommendCeilings, recommendWalls } from './recommend';

const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
const all = [...SINIAT_WALL_SYSTEMS, ...SINIAT_CEILING_SYSTEMS];

describe('katalog Siniat – spójność', () => {
  it('systemy i płyty Siniat są dołączone do wspólnego katalogu', () => {
    expect(MAKER_LABEL.siniat).toBe('Siniat');
    for (const s of SINIAT_WALL_SYSTEMS) expect(WALL_SYSTEMS).toContain(s);
    for (const s of SINIAT_CEILING_SYSTEMS) expect(CEILING_SYSTEMS).toContain(s);
    for (const b of SINIAT_BOARDS) expect(BOARDS).toContain(b);
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });
  it('każdy system ma producenta, źródło Siniat i płyty Siniat; odmiany z kart', () => {
    for (const s of all) {
      expect(s.maker, s.id).toBe('siniat');
      expect(s.code, s.id).toBeUndefined();
      expect(s.source.url, s.id).toMatch(/^https:\/\/www\.siniat\.pl\//);
      expect(s.source.approx, s.id).toBeFalsy();
      expect(boardById(s.defaultBoard).maker, s.id).toBe('siniat');
      if (s.id === 'SN-O-FIX') continue; // suchy tynk: karta bez tabeli odmian
      expect(s.variants?.length, s.id).toBeGreaterThan(0);
      for (const v of s.variants!) {
        if (!v.board) continue; // tablice doboru wysokości – dowolna płyta
        expect(boardById(v.board).id, `${s.id}: ${v.label}`).toBe(v.board);
        expect(boardById(v.board).maker).toBe('siniat');
        for (const id of v.innerBoards ?? []) expect(boardById(id).maker).toBe('siniat');
      }
    }
  });
  it('obejmuje ściany, okładziny, szachty, sufity i poddasza, z systemami podstawowymi w każdej grupie', () => {
    const wallCats = new Set(SINIAT_WALL_SYSTEMS.map((s) => s.category));
    expect(wallCats).toEqual(new Set(['działowa', 'podwójna', 'instalacyjna', 'okładzina', 'szacht']));
    for (const c of wallCats) expect(SINIAT_WALL_SYSTEMS.some((s) => s.category === c && s.basic), c).toBe(true);
    expect(new Set(SINIAT_CEILING_SYSTEMS.map((s) => s.kind))).toEqual(new Set(['two-level', 'one-level', 'direct']));
    expect(SINIAT_CEILING_SYSTEMS.some((s) => s.attic && s.basic)).toBe(true);
    expect(all.filter((s) => s.basic).length).toBeLessThan(all.length / 2);
    expect(SINIAT_SKIPPED.length).toBeGreaterThan(0);
  });
  it('wysokość systemu przy rozstawie 60 cm = wysokość z karty dla płyty domyślnej', () => {
    for (const s of SINIAT_WALL_SYSTEMS) {
      const h = s.maxHeight?.[60];
      if (!h || !s.variants) continue;
      const v = s.variants.find((x) => x.board === s.defaultBoard && !x.doubleStuds && x.studSpacing === 60);
      expect(v?.maxHeight, s.id).toBe(h);
    }
  });
  it('odmiany jednego systemu różnią się opisem', () => {
    for (const s of all) {
      const labels = (s.variants ?? []).map((v) => `${v.board}|${v.label}`);
      expect(new Set(labels).size, s.id).toBe(labels.length);
    }
  });
});

describe('katalog Siniat – wartości z kart', () => {
  it('ściana 100A75 (C75, 1×12,5): Expert do 4,5 m, EI 15, Rw 37 dB; tablice doboru 6 m co 40 cm, 7 m co 30 cm', () => {
    const s = wallSystemById('SN-W-A75-1');
    expect(s.maxHeight).toEqual({ 30: 700, 40: 600, 60: 450 });
    expect(wallMaxHeight(s, 40)).toBe(600);
    const exp = s.variants!.find((v) => v.board === 'SN-EXP12.5' && v.wool === 0)!;
    expect(exp).toMatchObject({ code: '100A75', fire: 15, rw: 37, ra1: 34, thickness: 100, mass: 19, maxHeight: 450 });
    const op = s.variants!.filter((v) => v.board === 'SN-OP12.5' && !v.doubleStuds).map((v) => v.fire);
    expect(op).toEqual([30, 45, 60]);
  });
  it('płyta Cementex 10 i 12 mm w ścianach 95A75 / 99A75', () => {
    const s = wallSystemById('SN-W-A75-1');
    expect(s.variants!.some((v) => v.board === 'SN-CEM10' && v.code === '95A75')).toBe(true);
    expect(s.variants!.some((v) => v.board === 'SN-CEM12' && v.code === '99A75')).toBe(true);
  });
  it('ściana z przewiązkami PWA ma osobną pozycję z uwagą o przewiązkach', () => {
    const s = wallSystemById('SN-W-B75-PWA-2');
    expect(s.frame).toBe('double');
    expect(s.info).toMatch(/PWA/);
  });
  it('sufit DK/ES/CD60 1×12,5: główne co 120 cm, nośne co 40 cm, uchwyty co 100 cm; Ogień+ ciaśniej i EI 20', () => {
    const s = ceilingSystemById('SN-S-DKES-1');
    expect([s.kind, s.mainSpacing, s.secondarySpacing, s.hangerSpacing, s.hangerType]).toEqual(['two-level', 120, 40, 100, 'es']);
    const op = s.variants!.find((v) => v.board === 'SN-OP12.5')!;
    expect(op.fire).toBe(20);
    expect(op.label).toMatch(/główne CD co 100 cm/);
    expect(op.label).toMatch(/uchwyty co 90 cm/);
  });
  it('poddasza Nida Dach: WP60 na wieszakach do poddaszy, PK48 i łaty z ramą przykręcaną do krokwi', () => {
    const wp = ceilingSystemById('SN-P-WP-2');
    expect([wp.kind, wp.hangerType, wp.attic]).toEqual(['direct', 'attic', true]);
    expect(wp.variants!.find((v) => v.board === 'SN-OP12.5')?.fire).toBe(45);
    expect(ceilingSystemById('SN-P-PK-1').atticFrame).toMatchObject({ mount: 'direct', profile: 'KAPELUSZ' });
    expect(ceilingSystemById('SN-P-LD-1').atticFrame).toMatchObject({ mount: 'direct', profile: 'LATA5030' });
    expect(ceilingSystemById('SN-P-EL-1').hangerType).toBe('elastic');
  });
});

describe('katalog Siniat – silnik i dobór', () => {
  it('ściana 125A75 (C75, 2×12,5): 4 m² płyt Expert na m² ściany', () => {
    const c = wallConsumption(wallSystemById('SN-W-A75-2'));
    expect(q(c, 'board:SN-EXP12.5')).toBeCloseTo(4);
  });
  it('sufit DK/WON liczy wieszaki noniuszowe, poddasze ES/CD60 uchwyty ES', () => {
    expect(q(ceilingConsumption(ceilingSystemById('SN-S-DKWON-1')), 'WIESZAK_NONIUSZ')).toBeGreaterThan(0.5);
    const attic = ceilingConsumption(ceilingSystemById('SN-P-ES-1'));
    expect(q(attic, 'WIESZAK_ES')).toBeGreaterThan(1);
    expect(q(attic, 'WIESZAK_NONIUSZ')).toBe(0);
  });
  it('dobór z filtrem Siniat zwraca tylko systemy Siniat, także dla ściany 6 m i łazienki', () => {
    const tall = recommendWalls({ purpose: 'partition', heightCm: 600, room: 'dry', fire: 0, acoustic: 'any', maker: 'siniat' });
    expect(tall.length).toBeGreaterThan(0);
    for (const p of tall) {
      expect(p.system.maker).toBe('siniat');
      expect(p.maxHeight!).toBeGreaterThanOrEqual(600);
    }
    const wet = recommendWalls({ purpose: 'partition', heightCm: 260, room: 'wet', fire: 0, acoustic: 'any', maker: 'siniat' });
    expect(wet.length).toBeGreaterThan(0);
    for (const p of wet) expect(boardById(p.boardId).moisture).toBe('wet');
    const ceil = recommendCeilings({ mount: 'attic', room: 'dry', fire: 0, maker: 'siniat' });
    expect(ceil.some((p) => p.system.id.startsWith('SN-P-'))).toBe(true);
  });
});
