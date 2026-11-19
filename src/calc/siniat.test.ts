import { describe, expect, it } from 'vitest';
import { BOARDS, CEILING_SYSTEMS, MAKER_LABEL, WALL_SYSTEMS, boardById, boardStackMm, ceilingSystemById, wallFrameDepth, wallMaxHeight, wallSystemById } from '../catalog/rigips';
import { ceilingDepth, ceilingLevels } from './ceilingLevels';
import { createCeiling, createProject } from '../model/factory';
import { ceilingRequirement } from './materials';
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
    expect(new Set(SINIAT_CEILING_SYSTEMS.map((s) => s.kind))).toEqual(new Set(['two-level', 'one-level', 'parallel', 'direct']));
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

describe('Siniat – systemy dodane po PR #55 (różne grubości płyt, płyta dosztywniająca, MF, WO/WON)', () => {
  it('nic nie jest już pomijane z powodu poszycia 12,5 + 15 mm ani płyty dosztywniającej', () => {
    expect(SINIAT_SKIPPED.some((x) => /różnej grubości/.test(x))).toBe(false);
    expect(SINIAT_SKIPPED.some((x) => /dosztywniając/.test(x))).toBe(false);
    expect(SINIAT_SKIPPED.join(', ')).not.toMatch(/(: |, )(DK\/MFC|WON\/CD60|WO\/CD60)-[\d,]+(, |$)/);
  });
  it('okładzina CD/ES-55 (2×12,5 + 2×15): dwie warstwy 12,5 od rusztu, dwie 15 na zewnątrz; odmiany Twarda i Hydro', () => {
    const s = wallSystemById('SN-O-CDES-4-IN12.5x2');
    expect([s.layers, s.innerLayers, s.innerBoard, s.defaultBoard]).toEqual([4, 2, 'SN-OP12.5', 'SN-OP15']);
    expect(boardStackMm(s, s.defaultBoard)).toBe(55);
    const tw = s.variants!.find((v) => v.board === 'SN-TW15')!;
    expect(tw.innerBoards).toEqual(['SN-TW12.5']);
    const c = wallConsumption(s);
    expect(q(c, 'board:SN-OP12.5')).toBeCloseTo(2);
    expect(q(c, 'board:SN-OP15')).toBeCloseTo(2);
  });
  it('sufit ES/CD60-40 (2×12,5 + 1×15): grubość płyt 40 mm, zabudowa z karty 70 mm', () => {
    const s = ceilingSystemById('SN-S-ES-3-IN12.5x2');
    expect([s.layers, s.innerLayers, s.innerBoard, s.defaultBoard]).toEqual([3, 2, 'SN-OP12.5', 'SN-OP15']);
    expect(boardStackMm(s, 'SN-OP15')).toBe(40);
    expect(ceilingDepth(s, 'SN-OP15').minMm).toBe(70);
    const c = ceilingConsumption(s);
    expect(q(c, 'board:SN-OP12.5')).toBeCloseTo(2);
    expect(q(c, 'board:SN-OP15')).toBeCloseTo(1);
  });
  it('ściana 168B50 z płytą dosztywniającą: grubość 168 mm, 1 m² płyty Ogień+ między rzędami na m² ściany', () => {
    const s = wallSystemById('SN-W-B50-PD-2-EXP');
    expect([s.frame, s.midBoard, s.innerBoard, s.defaultBoard]).toEqual(['double', 'SN-OP12.5', 'SN-EXP12.5', 'SN-CICHAA12.5']);
    // 2×C50 + 5 mm + płyta 12,5 + 2×2×12,5 = 167,5 ≈ 168 mm z karty
    expect(wallFrameDepth(s) + 2 * boardStackMm(s, s.defaultBoard)).toBeCloseTo(167.5);
    const c = wallConsumption(s);
    expect(q(c, 'board:SN-OP12.5')).toBeCloseTo(1);
    expect(q(c, 'board:SN-EXP12.5')).toBeCloseTo(2);
    expect(q(c, 'board:SN-CICHAA12.5')).toBeCloseTo(2);
    expect(wallSystemById('SN-W-B100-PD-2').variants!.some((v) => v.fire === 120)).toBe(true);
  });
  it('sufit DK/MFC: profile MF zamiast CD 60, zawiesia z kątownika MFC2330, bez łączników krzyżowych', () => {
    const s = ceilingSystemById('SN-S-DKMFC-1');
    expect([s.kind, s.mainSpacing, s.secondarySpacing, s.hangerSpacing]).toEqual(['two-level', 120, 40, 120]);
    expect(s.profiles).toMatchObject({ main: 'MFCP44', secondary: 'MFCC50', edge: 'MFCE26', hangerAngle: 'MFC2330_MB' });
    const c = ceilingConsumption(s);
    // karta s. 31: MFCP44 1,0 mb, MFCC50 2,8 mb, MFCE26 0,6 mb na m² (ruszt wzorcowy ±25%)
    expect(q(c, 'MFCP44')).toBeGreaterThan(0.75);
    expect(q(c, 'MFCP44')).toBeLessThan(1.25);
    expect(q(c, 'MFCC50')).toBeGreaterThan(2.1);
    expect(q(c, 'MFCC50')).toBeLessThan(3.5);
    expect(q(c, 'MFCE26')).toBeGreaterThan(0);
    expect(q(c, 'MFC2330_MB')).toBeGreaterThan(0);
    for (const k of ['CD60', 'UD30', 'LACZNIK_KRZ', 'WIESZAK_NONIUSZ', 'LACZNIK_WZDL']) expect(q(c, k), k).toBe(0);
    expect(q(c, 'WKRET_FLAT13')).toBeGreaterThan(4);
    expect(ceilingDepth(s, 'SN-EXP12.5').minMm).toBe(83); // 82,5 mm z karty, zaokrąglone
  });
  it('MF: kątownik zawiesia rośnie ze zwieszeniem sufitu', () => {
    const s = ceilingSystemById('SN-S-DKMFC-1');
    const at = (slab: number) => {
      const p = createProject();
      const c = createCeiling(p, [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }], { systemId: s.id, boardId: s.defaultBoard });
      c.slabHeight = slab;
      c.height = 250;
      return { m: ceilingRequirement(c, s).req.meters.MFC2330_MB, gap: ceilingLevels(c, s).hangerGap };
    };
    const low = at(260);
    const high = at(300);
    expect(high.gap - low.gap).toBeCloseTo(40);
    expect(high.m).toBeGreaterThan(low.m);
  });
  it('sufit WON/CD60: profile CD równolegle na wieszakach noniuszowych, bez profili głównych i łączników krzyżowych', () => {
    const s = ceilingSystemById('SN-S-WON-1');
    expect([s.kind, s.hangerType, s.secondarySpacing, s.hangerSpacing]).toEqual(['parallel', 'noniusz', 40, 120]);
    const c = ceilingConsumption(s);
    expect(q(c, 'WIESZAK_NONIUSZ')).toBeGreaterThan(1.5);
    expect(q(c, 'CD60')).toBeGreaterThan(2);
    expect(q(c, 'CD60')).toBeLessThan(3.2);
    expect(q(c, 'LACZNIK_KRZ') + q(c, 'LACZNIK_JEDNO') + q(c, 'WIESZAK_ES')).toBe(0);
    // podwieszony: brak górnej granicy zwieszenia (w przeciwieństwie do uchwytów ES)
    expect(ceilingDepth(s).maxMm).toBeUndefined();
    expect(ceilingSystemById('SN-S-WO-1').info).toMatch(/WO60/);
  });
  it('dobór „podwieszany” obejmuje sufity równoległe na wieszakach', () => {
    const r = recommendCeilings({ mount: 'suspended', room: 'dry', fire: 0, maker: 'siniat' });
    expect(r.some((p) => p.system.kind === 'parallel')).toBe(true);
  });
});

describe('grubość poszycia z płyt różnej grubości w geometrii', () => {
  it('okładzina 2×12,5 + 2×15 na CD 60: lico 37 + 55 mm od muru (nie 4×15)', async () => {
    const { liningThickness } = await import('../geometry/contacts');
    const l = { side: 1 as const, systemId: 'SN-O-CDES-4-IN12.5x2', boardId: 'SN-OP15', studSpacing: 60 as const, insulation: false };
    expect(liningThickness(l)).toBeCloseTo((37 + 55) / 1000);
  });
});

describe('Siniat – ściany wysokie SW / BS i wykończenie Q', () => {
  it('SW150 (C100, 2×12,5 Ogień+): co 30 cm do 9 m, zdwojone SWSW do 11 m', () => {
    const s = wallSystemById('SN-W-SW100-2');
    expect([s.frame, s.profile, s.studSpacing, s.maxHeight?.[30]]).toEqual(['single', 100, 30, 900]);
    expect(Math.max(...s.variants!.filter((v) => v.doubleStuds).map((v) => v.maxHeight ?? 0))).toBe(1100);
    expect(s.info).toMatch(/U100 specjalny/);
  });
  it('255BB100 (BS): wysokość 12 m tylko w odmianach na słupkach zdwojonych', () => {
    const s = wallSystemById('SN-W-B100-BS-2');
    expect(s.maxHeight).toBeUndefined();
    expect(s.variants!.every((v) => v.doubleStuds && v.maxHeight === 1200)).toBe(true);
    expect(s.info).toMatch(/przewiązki z blachy stalowej/);
  });
  it('125A75 Expert-Q: odmiana ściany 2×12,5 z wykończeniem Q3/Q4', () => {
    const q = wallSystemById('SN-W-A75-2').variants!.filter((v) => v.code === '125A75-Q');
    expect(q.map((v) => v.board)).toEqual(['SN-EXP12.5', 'SN-WODA12.5']);
    expect(q[0].label).toMatch(/Q3\/Q4/);
  });
});
