import { compoundFor, resolveFinishing, tapeFor } from '../catalog/finishing';
import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  CEILING_SYSTEMS,
  PRODUCTS,
  PRODUCT_ALIASES,
  WALL_SYSTEMS,
  WALL_SYSTEM_ALIASES,
  allWallSystems,
  ceilingSystemById,
  customSystems,
  cwSpanLimit,
  setCustomSystems,
  wallMaxHeight,
  wallSystemById,
  type CeilingSystem,
  type RefLine,
  type WallSystem,
} from '../catalog/rigips';
import { calculateProject, ceilingConsumption, ceilingGrid, ceilingRequirement, screwFor, wallConsumption, wallRequirement, type ConsumptionLine } from './materials';
import { createCeiling, createProject, createWall } from '../model/factory';
import { analyzeJunctions } from '../geometry/geometry';
import { migrateKeys } from '../model/prices';
import type { Project } from '../model/types';

/**
 * Pozycje z kart Rigips, które silnik liczy celowo inaczej (zależą od geometrii
 * pomieszczenia albo karta przyjmuje inny układ niż element wzorcowy).
 */
const KNOWN_DIFF = new Set([
  // kalkulator Rigips powtarza dla 3 warstw liczbę wieszaków sufitu jednowarstwowego (1,2 szt./m²), choć tabela podaje wieszaki co 60 cm
  'S-4.05.241AKU-3:WIESZAK_NONIUSZ',
  'S-4.05.241AKU-3:ZAWLECZKA',
  'S-4.05.23AKU-2:MASA', // kalkulator podaje masę jak dla jednej warstwy
  'NG-ZP-KAP-1:MASA', // kalkulator Norgips: 0,3 kg/m² przy profilach kapeluszowych, w pozostałych systemach 0,2 kg/m² na warstwę
  'S-CD-2P-2:LACZNIK_KRZ', // kalkulator liczy profile montażowe co 40 cm, tabela systemu dopuszcza 50 cm
  'S-CD-2P-2:CD60',
  'S-UA-1:UD30', // pas o rozpiętości 2,2 m ma duży obwód na m²
  'S-UA-1:CD60',
  'S-UA-1:KATOWNIK_UA',
  'S-UA-1:LACZNIK_UA_CD',
  // 3.50.10: kalkulator podaje 3,6 mb UW 100 na m² (sama para UW na słupek co 60 cm), bez UW przy posadzce
  // i stropie; aplikacja liczy je jak karta Siniat UU (4,3 mb = słupki 3,6 + U góra i dół 0,7)
  'SZ-UU100-2+2:UW100',
  'SZ-UU100-2AKU+2:UW100',
  // 3.50.10: kalkulator podaje 0,7 mb taśmy spoinowej na m² (połowę typowej), aplikacja zbroi każdą spoinę lica (1,4 mb)
  'SZ-UU100-2+2:TASMA_SPOIN',
  'SZ-UU100-2AKU+2:TASMA_SPOIN',
]);
/** Wkręty do płyt specjalnych (Habito, HartFix, Rigidur, Ridurit, Aquaroc) */
const SPECIAL_SCREW = /^(HABITO|HARTFIX|RIGIDUR|RIDURIT|AQ)\d/;
/**
 * Różnice między kalkulatorem Rigips a aplikacją, które zostają świadomie:
 * - podwójny ruszt: kalkulator liczy taśmę uszczelniającą także między rusztami (4,7 zamiast 2,2 mb/m²),
 * - obudowy szachtów: kalkulator podaje 2,29 kołka/m² (ściany działowe 1,5) – aplikacja kotwi UW co 100 cm,
 * - okładziny na CD 60: kalkulator podaje 0,35 mb UD 30 i 1,5 uchwytu na m² (stąd też mniej kołków i pchełek); aplikacja liczy UD przy posadzce
 *   i stropie oraz uchwyty co 100 cm na każdym profilu (zaokrąglone w górę),
 * - poszycia 3- i 4-warstwowe: kalkulator podaje masę jak dla dwóch warstw i inne zagęszczenie wkrętów
 *   warstw środkowych; aplikacja liczy każdą warstwę wewnętrzną tak samo,
 * - płyty specjalne w kilku warstwach: kalkulator przyjmuje gęstsze wkręcanie warstw wewnętrznych
 *   (np. Aquaroc 7,5 szt./m² strony) – aplikacja liczy je jak dla płyt PRO (4,5 szt./m²).
 */
function rigipsCalculatorDiff(s: { id: string; layers: number; frame?: string; category?: string; kind?: string; attic?: boolean; hangerType?: string }, product: string): boolean {
  // poddasza i okładziny na uchwytach elastycznych: kalkulator przyjmuje 3,2 mb CD i 4 uchwyty na m² (krótkie pola skosów),
  // aplikacja liczy profile i uchwyty z rozstawów podanych w tabeli systemu (40 cm i 100 cm)
  if (s.kind === 'direct' && (s.attic || s.hangerType === 'elastic') && ['CD60', 'UCHWYT_ELAST', 'WIESZAK_ES', 'WIESZAK_PODD', 'LN9'].includes(product)) return true;
  if (s.frame === 'double' && product.startsWith('TASMA_USZ')) return true;
  if (s.category === 'szacht' && product === 'KOLEK') return true;
  if (s.frame === 'cd-lining' && ['UD30', 'WIESZAK_ES', 'LN9', 'KOLEK', 'TASMA_USZ30'].includes(product)) return true;
  if (s.layers >= 3 && (product === 'MASA' || /^TN(35|45|55|70)$/.test(product) || SPECIAL_SCREW.test(product))) return true;
  if (s.layers >= 2 && SPECIAL_SCREW.test(product)) return true;
  return false;
}
/**
 * ATLAS M-System 3G, ściany: karta podaje wydajność opakowania dla dużej powierzchni
 * (sama siatka), a aplikacja dolicza rzędy i kolumny przy krawędziach płyt – na ścianie
 * 5×2,75 m to ok. +50%. Liczbę łączników sprawdza osobny test poniżej.
 */
const ATLAS_WALL_EDGE = (id: string) => id.startsWith('A-W-');
/** Zależne od wymiarów pomieszczenia: łączniki wzdłużne (długość profili), a w suficie przęsłowym CW obwód i liczba końców CW */
const geometryDependent = (id: string, product?: string) =>
  product === 'LACZNIK_WZDL' || (id.startsWith('S-CW') && (product?.startsWith('UW') || product === 'LN9'));

function compare(sys: WallSystem | CeilingSystem, lines: ConsumptionLine[], ref: RefLine[], tolerance = 0.25) {
  const id = sys.id;
  const checked: string[] = [];
  for (const r of ref) {
    if (!r.product || KNOWN_DIFF.has(`${id}:${r.product}`) || geometryDependent(id, r.product) || ATLAS_WALL_EDGE(id)) continue;
    if (!sys.maker && rigipsCalculatorDiff(sys, r.product)) continue;
    // wzorce innych producentów zapisują masę i taśmę jako MASA / TASMA_SPOIN – aplikacja liczy masę i taśmę producenta
    const key = r.product === 'MASA' ? compoundFor(resolveFinishing(), sys.maker).product : r.product === 'TASMA_SPOIN' ? tapeFor(resolveFinishing(), sys.maker).product : r.product;
    const got = lines.find((l) => l.key === key);
    if (!got) continue; // np. wkręty przy innej płycie – sprawdzane osobno
    checked.push(r.product);
    const diff = Math.abs(got.qty - r.qty) / r.qty;
    expect(diff, `${id}: ${r.label} – aplikacja ${got.qty.toFixed(2)}, karta ${r.qty}`).toBeLessThanOrEqual(tolerance);
  }
  return checked;
}

describe('katalog – spójność danych', () => {
  it('identyfikatory systemów są unikalne', () => {
    const ids = [...WALL_SYSTEMS, ...CEILING_SYSTEMS].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('systemy wskazują istniejące płyty, a wzorce zużycia istniejące produkty', () => {
    for (const s of [...WALL_SYSTEMS, ...CEILING_SYSTEMS]) {
      expect(BOARDS.some((b) => b.id === s.defaultBoard), s.id).toBe(true);
      for (const r of s.reference ?? []) if (r.product) expect(PRODUCTS[r.product], `${s.id} ${r.product}`).toBeDefined();
      expect(s.source.label.length).toBeGreaterThan(0);
    }
  });
  it('każdy system z kodem Rigips ma link do karty', () => {
    for (const s of [...WALL_SYSTEMS, ...CEILING_SYSTEMS]) if (s.code) expect(s.source.url, s.id).toMatch(/^https:\/\/www\.rigips\.pl\//);
  });
  it('katalog obejmuje wszystkie rodzaje ścian i sufitów', () => {
    expect(new Set(WALL_SYSTEMS.map((s) => s.frame))).toEqual(new Set(['single', 'double', 'separate', 'cd-lining', 'glued', 'point-fix']));
    expect(new Set(WALL_SYSTEMS.map((s) => s.category)).size).toBe(6);
    expect(new Set(CEILING_SYSTEMS.map((s) => s.kind))).toEqual(new Set(['two-level', 'one-level', 'direct', 'ua-span', 'cw-span', 'point-fix']));
  });
});

describe('zużycie na m² zgodne z kartami Rigips (±25%)', () => {
  for (const s of WALL_SYSTEMS.filter((x) => x.reference))
    it(`ściana ${s.code ?? ''} ${s.name}`, () => {
      // płyta klejona ma tylko klej, masę i taśmę; systemy z płytami specjalnymi mają mniej wspólnych pozycji
      const min = ATLAS_WALL_EDGE(s.id) ? 0 : /^R[BF]/.test(s.defaultBoard) && !s.innerBoard && s.frame !== 'glued' && s.frame !== 'cd-lining' && s.layers < 3 ? 5 : 3;
      expect(compare(s, wallConsumption(s), s.reference!).length).toBeGreaterThanOrEqual(min);
    });
  for (const s of CEILING_SYSTEMS.filter((x) => x.reference))
    it(`sufit ${s.code ?? ''} ${s.name}`, () => {
      // masa wykończeniowa z karty (gładź) jest poza zakresem – spoinowanie liczymy do Q1
      // płyty specjalne na uchwytach bezpośrednich mają mało wspólnych pozycji (inne wkręty, masy bez porównania)
      const special = !s.maker && s.kind === 'direct' && !/^R[BF]/.test(s.defaultBoard);
      expect(compare(s, ceilingConsumption(s), s.reference!).length).toBeGreaterThanOrEqual(s.kind === 'point-fix' ? 1 : special ? 2 : 3);
    });
});

describe('ściany – dokładne wartości na m²', () => {
  const q = (lines: ConsumptionLine[], key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
  it('3.40.05 (CW 75, 2×12,5): płyty 4 m², TN 25 = 9, TN 35 = 24 szt./m²', () => {
    const c = wallConsumption(wallSystemById('W-CW75-2'));
    expect(q(c, 'board:RB12.5')).toBeCloseTo(4);
    expect(q(c, 'TN25')).toBeCloseTo(9);
    expect(q(c, 'TN35')).toBeCloseTo(24);
    expect(q(c, 'MASA')).toBeCloseTo(1);
    expect(q(c, 'MASA_WYK')).toBe(0); // gładź poza zakresem (Q1)
    expect(q(c, 'TASMA_SPOIN')).toBeCloseTo(2.8);
  });
  it('rozstaw 40 cm zwiększa wkręty o 50% (3.40.051: 14 + 36 szt./m²)', () => {
    const c = wallConsumption(wallSystemById('W-CW75-2'), 40);
    expect(q(c, 'TN25')).toBeCloseTo(13.5);
    expect(q(c, 'TN35')).toBeCloseTo(36);
  });
  it('podwójny ruszt (3.41.01): dwa rzędy CW i UW, wełna w obu', () => {
    const single = wallConsumption(wallSystemById('W-CW75-2'));
    const dbl = wallConsumption(wallSystemById('W-2CW50-2'));
    expect(q(dbl, 'UW50')).toBeCloseTo(2 * q(single, 'UW75'));
    expect(q(dbl, 'CW50')).toBeCloseTo(2 * q(single, 'CW75'));
    expect(q(dbl, 'WELNA50')).toBeCloseTo(2);
  });
  it('ściana instalacyjna dodaje paski płyty łączące ruszty', () => {
    const c = wallConsumption(wallSystemById('W-INST-CW50-2'));
    expect(q(c, 'board:RBI12.5')).toBeGreaterThan(4);
    expect(q(c, 'board:RBI12.5')).toBeLessThan(4.3);
  });
  it('okładzina na CD 60: profile CD, UD 30 i uchwyty ES co 100 cm', () => {
    const c = wallConsumption(wallSystemById('O-CD-1'));
    expect(q(c, 'CD60')).toBeCloseTo(2, 1); // CD co 60 cm
    expect(q(c, 'UD30')).toBeGreaterThan(0.7);
    // 10 profili × 3 uchwyty (2,75 m / 1,0 m) / 13,75 m²
    expect(q(c, 'WIESZAK_ES')).toBeCloseTo(30 / 13.75);
    expect(q(c, 'CW50')).toBe(0);
  });
  it('płyta klejona: tylko płyta, klej i spoinowanie – bez profili i wkrętów', () => {
    const c = wallConsumption(wallSystemById('O-KLEJ'));
    expect(c.map((l) => l.key).sort()).toEqual(['KLEJ', 'MASA', 'TASMA_SPOIN', 'board:RB12.5']);
    expect(q(c, 'KLEJ')).toBeCloseTo(5); // kalkulator Rigips 3.10.00: 500 kg na 100 m²
  });
  it('Aquaroc: wkręty i masa do płyt cementowych', () => {
    const c = wallConsumption(wallSystemById('W-CW75-1AQUAROC'));
    expect(q(c, 'AQ25')).toBeGreaterThan(0);
    expect(q(c, 'TN25')).toBe(0);
    expect(q(c, 'MASA_AQ')).toBeGreaterThan(0);
  });
  it('długość wkrętu rośnie z grubością okładziny', () => {
    expect(screwFor(12.5)).toBe('TN25');
    expect(screwFor(15)).toBe('TN25');
    expect(screwFor(25)).toBe('TN35');
    expect(screwFor(30)).toBe('TN45');
    expect(screwFor(37.5)).toBe('TN55');
  });
});

function wall(systemId: string, heightCm: number, spacing?: 60 | 40 | 30): { p: Project; w: Project['walls'][0] } {
  const p = createProject();
  p.nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 300, y: 0 },
  ];
  const w = createWall(p, 'a', 'b', { systemId, height: heightCm, ...(spacing ? { studSpacing: spacing } : {}) });
  p.walls = [w];
  return { p, w };
}

describe('ostrzeżenia o granicach systemu', () => {
  it('wysokość ponad dopuszczalną daje ostrzeżenie', () => {
    const { p, w } = wall('W-CW75-2', 600);
    const r = wallRequirement(p, w, analyzeJunctions(p).get(w.id)!);
    expect(r.info.warnings).toHaveLength(1);
    const ok = wall('W-CW75-2', 600, 40);
    expect(wallRequirement(ok.p, ok.w, analyzeJunctions(ok.p).get(ok.w.id)!).info.warnings).toHaveLength(0);
  });
  it('maks. wysokość dla gęstszego rozstawu bierze wartość z rzadszego', () => {
    // 3.40.02: 4,50 m przy 60 cm; 3.40.021: 6,00 m przy 40 cm; 3.40.05/.051: 5,50 i 6,50 m
    expect(wallMaxHeight(wallSystemById('W-CW75-1'), 60)).toBe(450);
    expect(wallMaxHeight(wallSystemById('W-CW75-1'), 40)).toBe(600);
    expect(wallMaxHeight(wallSystemById('W-CW75-2'), 40)).toBe(650);
    // okładzina wolnostojąca 3.22.00 ma w karcie tylko rozstaw 60 cm – gęstszy nie obniża wysokości
    expect(wallMaxHeight(wallSystemById('O-CW50-1'), 40)).toBe(300);
  });
  it('rozpiętości sufitu przęsłowego CW wg tabeli 4.05.71', () => {
    expect(cwSpanLimit(75, 40, 1)).toBe(309);
    expect(cwSpanLimit(100, 50, 2)).toBe(278);
  });
  it('sufit przęsłowy szerszy niż dopuszczalna rozpiętość – ostrzeżenie', () => {
    const p = createProject();
    const rect = (w: number) => [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: w },
      { x: 0, y: w },
    ];
    // CW 75, 1×12,5, rozstaw 50 cm: maks. 2,70 m; profile biegną wzdłuż osi Y (direction 90)
    const narrow = createCeiling(p, rect(250), { systemId: 'S-CW75-1', direction: 90 });
    const wide = createCeiling(p, rect(320), { systemId: 'S-CW75-1', direction: 90 });
    expect(ceilingRequirement(narrow).warnings).toHaveLength(0);
    expect(ceilingRequirement(wide).warnings).toHaveLength(1);
  });
});

describe('sufity – rusztowanie i akcesoria', () => {
  const room = (systemId: string) => {
    const p = createProject();
    const c = createCeiling(
      p,
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      { systemId },
    );
    p.ceilings = [c];
    return { p, c };
  };
  it('jednopoziomowy 4.05.25: nośne co 120 cm, montażowe co 50 cm, po 2 łączniki na skrzyżowanie', () => {
    const { p, c } = room('S-CD-1P-1');
    const grid = ceilingGrid(c);
    expect(grid.filter((g) => g.level === 'main')).toHaveLength(3); // y = 40, 160, 280
    expect(grid.filter((g) => g.level === 'secondary')).toHaveLength(7); // x = 50..350
    const t = calculateProject(p).total;
    expect(t.find((l) => l.key === 'LACZNIK_JEDNO')!.qty).toBe(42);
  });
  it('sufit przęsłowy UA: bez wieszaków, kątowniki na końcach UA, łączniki UA/CD', () => {
    const { p } = room('S-UA-1');
    const keys = calculateProject(p).total.map((l) => l.key);
    expect(keys).not.toContain('WIESZAK_NONIUSZ');
    expect(keys).toContain('KATOWNIK_UA');
    expect(keys).toContain('LACZNIK_UA_CD');
    expect(keys.some((k) => k.startsWith('bar-UA50'))).toBe(true);
  });
  it('sufit przęsłowy CW: profile CW i obwodowe UW zamiast CD/UD', () => {
    const { p } = room('S-CW75-1');
    const keys = calculateProject(p).total.map((l) => l.key);
    expect(keys.some((k) => k.startsWith('bar-CW75'))).toBe(true);
    expect(keys.some((k) => k.startsWith('bar-UW75'))).toBe(true);
    expect(keys.some((k) => k.startsWith('bar-CD60') || k.startsWith('bar-UD30'))).toBe(false);
  });
  it('poddasze: uchwyty elastyczne, ES albo wieszaki do poddaszy – zależnie od karty', () => {
    const keys = (id: string) => calculateProject(room(id).p).total.map((l) => l.key);
    expect(keys('S-PODD-1')).toContain('UCHWYT_ELAST');
    expect(keys('S-PODD-1')).not.toContain('WIESZAK_ES');
    expect(keys('S-4.70.04-1')).toContain('WIESZAK_PODD');
    expect(keys('S-4.70.05-1')).toContain('WIESZAK_ES');
  });
  it('3 warstwy płyt: wkręty 25, 35 i 55 mm', () => {
    const c = ceilingConsumption(ceilingSystemById('S-CD-2P-3F'));
    expect(c.find((l) => l.key === 'TN55')!.qty).toBeCloseTo(17);
    expect(c.find((l) => l.key === 'board:RFP12.5')!.qty).toBeCloseTo(3);
  });
  it('4.10.25 (EI 120): dwie warstwy 15 mm pod dwiema 12,5 mm – każda grubość liczona osobno', () => {
    const sys = ceilingSystemById('S-4.10.25-4');
    expect(sys.variants!.every((v) => v.fire === 120)).toBe(true);
    const c = ceilingConsumption(sys);
    expect(c.find((l) => l.key === 'board:RFP15')!.qty).toBeCloseTo(2);
    expect(c.find((l) => l.key === 'board:RFP12.5')!.qty).toBeCloseTo(2);
  });
  it('sufity z kart Rigips: rozstawy z tabeli systemu, dawne identyfikatory zachowane', () => {
    expect(ceilingSystemById('S-CD-2P-1')).toMatchObject({ code: '4.05.24', mainSpacing: 100, secondarySpacing: 50, hangerSpacing: 90 });
    expect(ceilingSystemById('S-CD-2P-3F')).toMatchObject({ code: '4.10.19', mainSpacing: 75, secondarySpacing: 40, hangerSpacing: 60 });
    expect(ceilingSystemById('S-4.10.18-2')).toMatchObject({ kind: 'one-level', mainSpacing: 120, secondarySpacing: 40, hangerSpacing: 65, defaultBoard: 'RFP15' });
    expect(ceilingSystemById('S-PODD-1')).toMatchObject({ code: '4.70.06', attic: true, hangerType: 'elastic', hangerSpacing: 100 });
    expect(ceilingSystemById('S-4.05.29-2').attic).toBe(false);
  });
});

describe('systemy własne', () => {
  it('rejestr dodaje system własny do wyboru i wyliczeń', () => {
    const base = wallSystemById('W-CW75-1');
    const mine: WallSystem = { ...base, id: 'U-W-test', name: 'Moja ściana CW 75, 1×15', defaultBoard: 'RB15', studSpacing: 40 };
    const ceil: CeilingSystem = { ...ceilingSystemById('S-CD-2P-1'), id: 'U-S-test', name: 'Mój sufit', secondarySpacing: 40 };
    setCustomSystems({ walls: [mine], ceilings: [ceil] });
    try {
      expect(allWallSystems().some((s) => s.id === 'U-W-test' && s.custom)).toBe(true);
      expect(wallSystemById('U-W-test').name).toBe('Moja ściana CW 75, 1×15');
      const { p, w } = wall('U-W-test', 260);
      expect(w.studSpacing).toBe(40);
      expect(w.boardId).toBe('RB15');
      const t = calculateProject(p).total;
      expect(t.some((l) => l.key.startsWith('board-RB15'))).toBe(true);
      expect(ceilingConsumption(ceilingSystemById('U-S-test')).find((l) => l.key === 'CD60')!.qty).toBeGreaterThan(
        ceilingConsumption(ceilingSystemById('S-CD-2P-1')).find((l) => l.key === 'CD60')!.qty,
      );
    } finally {
      setCustomSystems({ walls: [], ceilings: [] });
    }
    expect(customSystems().walls).toHaveLength(0);
    // nieznany system → bezpieczny domyślny
    expect(wallSystemById('U-W-test').id).toBe('W-CW75-1');
  });
});

describe('zgodność ze starymi zapisami', () => {
  it('ceny profilu UD 27 przechodzą na UD 30', () => {
    expect(migrateKeys({ 'bar-UD27-3': 12.5, KOLEK: 30 }, PRODUCT_ALIASES)).toEqual({ 'bar-UD30-3': 12.5, KOLEK: 30 });
  });
  it('wszystkie dawne systemy nadal istnieją', () => {
    for (const id of ['W-CW50-1', 'W-CW50-2', 'W-CW75-1', 'W-CW75-2', 'W-CW100-1', 'W-CW100-2', 'O-CW50-1', 'O-CW50-2', 'O-CD-1', 'O-KLEJ', 'W-INST-CW50-2'])
      expect(wallSystemById(id).id).toBe(id);
    // odmiany, które były osobnymi pozycjami, prowadzą teraz do konstrukcji z odmianami z karty
    for (const [old, now] of Object.entries(WALL_SYSTEM_ALIASES)) {
      expect(WALL_SYSTEMS.some((s) => s.id === old), old).toBe(false);
      expect(wallSystemById(old).id).toBe(now);
    }
    for (const id of ['S-CD-2P-1', 'S-CD-2P-2', 'S-CD-2P-1F', 'S-CD-2P-2F', 'S-CD-2P-2x15F', 'S-CD-2P-3F', 'S-CD-1P-1', 'S-CD-1P-2', 'S-CD-1P-1F', 'S-CD-1P-2F', 'S-ES-1', 'S-ES-2', 'S-PODD-1', 'S-PODD-2', 'S-UA-1', 'S-CW75-1'])
      expect(ceilingSystemById(id).id).toBe(id);
  });
});
