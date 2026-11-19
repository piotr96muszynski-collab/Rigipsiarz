import { describe, expect, it } from 'vitest';
import { boardById, isLiningSystem, wallSystemById } from '../catalog/rigips';
import { ACOUSTIC_MIN_RA1, featureNeeds, hasStudProfile, makerOf, profileWidths, recommendCeilings, recommendWalls, variantForHeight, type WallNeeds } from './recommend';

const base: WallNeeds = { purpose: 'partition', heightCm: 260, room: 'dry', fire: 0, acoustic: 'any', maker: 'rigips' };

describe('dobór ściany po wymaganiach', () => {
  it('zwykła ściana 2,60 m w suchym pokoju → najprostsza konstrukcja: CW 50, 1×12,5 typ A, słupki co 60 cm', () => {
    const [first] = recommendWalls(base);
    expect(first.system.id).toBe('W-CW50-1');
    expect(first.boardId).toBe('RB12.5');
    expect(first.studSpacing).toBe(60);
    expect(first.doubleStuds).toBe(false);
    expect(first.approx).toBe(false);
    expect(first.variant?.code).toBe('3.40.01');
  });
  it('każdy wynik to inna konstrukcja i mieści wysokość ściany', () => {
    const picks = recommendWalls({ ...base, heightCm: 420 });
    expect(new Set(picks.map((p) => p.system.id)).size).toBe(picks.length);
    for (const p of picks) if (p.maxHeight) expect(p.maxHeight).toBeGreaterThanOrEqual(420);
    // CW 50 z jedną warstwą sięga 4,20 m dopiero przy zagęszczonych słupkach (3.40.011: 4,25 m co 40 cm)
    const cw50 = picks.find((p) => p.system.id === 'W-CW50-1')!;
    expect(cw50.studSpacing).toBe(40);
    expect(cw50.variant?.code).toBe('3.40.011');
  });
  it('wymaganie EI 60: tylko odmiany z klasą z karty, płyta ogniochronna', () => {
    const picks = recommendWalls({ ...base, fire: 60 });
    expect(picks.length).toBeGreaterThan(3);
    for (const p of picks) expect(p.fire).toBeGreaterThanOrEqual(60);
    expect(picks.every((p) => !p.approx)).toBe(true);
    const cw50 = picks.find((p) => p.system.id === 'W-CW50-1')!;
    expect(cw50.boardId).toBe('RFP12.5'); // 3.40.01: 1×12,5 Fire+ typ DF = EI 60
  });
  it('łazienka → płyta impregnowana, strefa mokra → płyta do pomieszczeń mokrych', () => {
    const humid = recommendWalls({ ...base, room: 'humid' });
    expect(humid[0].boardId).toBe('RBI12.5');
    for (const p of humid) expect(boardById(p.boardId).moisture).toBeDefined();
    const wet = recommendWalls({ ...base, room: 'wet' });
    expect(wet.length).toBeGreaterThan(0);
    for (const p of wet) expect(boardById(p.boardId).moisture).toBe('wet');
  });
  it('szafki bez kołków → płyty o podwyższonej twardości; warstwa wewnętrzna z odmiany', () => {
    const picks = recommendWalls({ ...base, hang: true });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(boardById(p.boardId).hard).toBe(true);
    const habito = picks.find((p) => p.system.id === 'W-CW75-1+1HABITO')!;
    expect(habito.innerBoardId).toBe('RB12.5');
    const humid = recommendWalls({ ...base, hang: true, room: 'humid' });
    for (const p of humid) if (p.innerBoardId) expect(boardById(p.innerBoardId).moisture).toBeDefined();
  });
  it('ściana między mieszkaniami: RA1 z karty co najmniej 53 dB', () => {
    const picks = recommendWalls({ ...base, acoustic: 'flat' });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(p.ra1).toBeGreaterThanOrEqual(ACOUSTIC_MIN_RA1.flat);
  });
  it('okładzina istniejącej ściany: tylko systemy mocowane do muru, suchy tynk pierwszy', () => {
    const picks = recommendWalls({ ...base, purpose: 'lining', liningOnly: true, maker: undefined });
    expect(picks[0].system.id).toBe('O-KLEJ');
    for (const p of picks) expect(isLiningSystem(p.system)).toBe(true);
    expect(picks.some((p) => makerOf(p.system) === 'atlas')).toBe(true);
  });
  it('limit grubości odrzuca grubsze ściany', () => {
    const picks = recommendWalls({ ...base, maxThickness: 100 });
    for (const p of picks) expect(p.thickness).toBeLessThanOrEqual(100);
  });
  it('system bez karty jest oznaczony jako orientacyjny i nie spełnia wymagania EI', () => {
    const inst = recommendWalls({ ...base, purpose: 'installation' });
    expect(inst.length).toBeGreaterThan(0);
    expect(inst.every((p) => p.approx)).toBe(true);
    expect(recommendWalls({ ...base, purpose: 'installation', fire: 30 })).toHaveLength(0);
  });
  it('filtr producenta', () => {
    for (const p of recommendWalls({ ...base, maker: 'norgips' })) expect(p.system.maker).toBe('norgips');
  });
});

describe('odmiana z karty dla wysokości ściany', () => {
  const sys = wallSystemById('W-CW50-1');
  it('3.40.01: do 3,25 m co 60 cm, wyżej gęstsze słupki, a potem podwójne', () => {
    expect(variantForHeight(sys, 300)).toMatchObject({ studSpacing: 60, doubleStuds: false });
    expect(variantForHeight(sys, 340)).toMatchObject({ studSpacing: 40, doubleStuds: false });
    expect(variantForHeight(sys, 480)).toMatchObject({ studSpacing: 30, doubleStuds: false });
    expect(variantForHeight(sys, 560)).toMatchObject({ studSpacing: 30, doubleStuds: true });
    expect(variantForHeight(sys, 700)).toBeUndefined();
  });
  it('zachowuje wybraną płytę', () => {
    expect(variantForHeight(sys, 340, 'RFP12.5')?.boardId).toBe('RFP12.5');
  });
});

describe('dobór sufitu', () => {
  it('podwieszany w suchym pokoju → sufity na ruszcie CD; poddasze → uchwyty do krokwi', () => {
    const susp = recommendCeilings({ mount: 'suspended', room: 'dry', fire: 0, maker: 'rigips' });
    expect(susp.length).toBeGreaterThan(0);
    for (const p of susp) expect(['two-level', 'one-level']).toContain(p.system.kind);
    const attic = recommendCeilings({ mount: 'attic', room: 'dry', fire: 0, maker: 'rigips' });
    expect(attic.map((p) => p.system.id)).toContain('S-PODD-1');
  });
  it('sufit przęsłowy: rozpiętość pomieszczenia ogranicza wybór', () => {
    const narrow = recommendCeilings({ mount: 'span', room: 'dry', fire: 0, spanCm: 200, maker: 'rigips' });
    const wide = recommendCeilings({ mount: 'span', room: 'dry', fire: 0, spanCm: 320, maker: 'rigips' });
    expect(narrow.length).toBeGreaterThan(wide.length);
  });
});

describe('dobór ściany: szerokość profilu, płytowanie i cechy', () => {
  it('szerokość profilu zawęża wyniki do rusztu z tym profilem', () => {
    const picks = recommendWalls({ ...base, profile: 75 });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.system.profile === 75 && hasStudProfile(p.system))).toBe(true);
    expect(picks[0].system.id).toBe('W-CW75-1');
  });
  it('płytowanie pojedyncze i podwójne zawęża liczbę warstw z jednej strony', () => {
    for (const layers of [1, 2] as const) {
      const picks = recommendWalls({ ...base, layers });
      expect(picks.length).toBeGreaterThan(0);
      expect(picks.every((p) => p.system.layers === layers)).toBe(true);
    }
    expect(recommendWalls({ ...base, profile: 100, layers: 2 })[0].system.id).toBe('W-CW100-2');
  });
  it('przy wybranym profilu okładziny bez słupków CW (klej, CD 60) odpadają', () => {
    const lining = { ...base, purpose: 'lining' as const };
    expect(recommendWalls(lining).some((p) => !hasStudProfile(p.system))).toBe(true);
    const picks = recommendWalls({ ...lining, profile: 50 });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => hasStudProfile(p.system) && p.system.profile === 50)).toBe(true);
  });
  it('lista szerokości profili pochodzi z katalogu', () => {
    const widths = profileWidths('partition');
    for (const w of [50, 75, 100]) expect(widths).toContain(w);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
  });
  it('cechy zamieniają się na wymagania: ogień = EI 30 lub więcej, akustyka = RA1 ≥ 45 dB', () => {
    expect(featureNeeds([])).toEqual({ room: 'dry', fire: 0, acoustic: 'any', hang: false });
    expect(featureNeeds(['fire', 'acoustic', 'humid', 'hang'])).toEqual({ room: 'humid', fire: 30, acoustic: 'better', hang: true });
    expect(featureNeeds(['humid', 'wet']).room).toBe('wet');
    const picks = recommendWalls({ ...base, ...featureNeeds(['fire', 'acoustic']), profile: 75 });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect(p.fire).toBeGreaterThanOrEqual(30);
      expect(p.ra1).toBeGreaterThanOrEqual(ACOUSTIC_MIN_RA1.better);
      expect(p.approx).toBe(false);
    }
  });
});
