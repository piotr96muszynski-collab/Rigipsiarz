// Katalog systemu ATLAS M-SYSTEM 3G – okładziny ścian i sufitów z płyt g-k mocowanych
// punktowo łącznikami talerzykowymi (bez profili stalowych).
//
// Źródła: karta charakterystyki zestawu ATLAS M-SYSTEM 3G (Krajowa Ocena Techniczna
// ITB KOT-2020/1421) oraz strona produktu ATLAS. Zakresy odstępu płyty od podłoża
// podano dla podłoża betonowego / murowego (tuleja L50 ø10 BX). Dla podłoża
// drewnianego zakresy są inne – patrz karta.
//
// Plik importuje z `rigips.ts` wyłącznie typy, więc nie tworzy cyklicznej zależności.

import type { CeilingSystem, Product, Source, WallSystem } from './rigips';

export const ATLAS_SOURCES = {
  KARTA_3G: {
    label: 'Karta charakterystyki ATLAS M-SYSTEM 3G (ITB KOT-2020/1421)',
    url: 'https://pliki.grupapsb.com.pl/files/InfoverProduct/st/gkvvs0l2r8jm/Files/gvd2ras0m4k7k0_zestaw-m-system-l50-sciana-atlas-karta-charakterystyki.pdf',
  },
  PRODUKT: {
    label: 'ATLAS M-SYSTEM 3G – strona produktu',
    url: 'https://www.atlas.com.pl/en/product/atlas-m-system-3g/',
  },
} satisfies Record<string, Source>;

/** Liczba łączników w opakowaniu (21 talerzyków KT 3G 120 PP + łączniki 3GL + tuleje + 84 wkręty) */
export const ATLAS_PACK = 21;

/**
 * Łącznik systemu punktowego: produkt (zestaw), opcjonalna przedłużka (tylko sufity)
 * i zakres odstępu płyty od podłoża, mm.
 */
export interface PointFixer {
  product: string;
  extension?: string;
  /** Zakres odstępu płyty od podłoża (beton / mur), mm */
  standoff: [number, number];
}

const kit = (len: number): Product => ({
  id: `ATLAS_3G_L${len}`,
  name: `ATLAS M-SYSTEM 3G L${len} – łącznik z talerzykiem, kołkiem i 4 wkrętami`,
  group: 'Mocowanie',
  unit: 'szt.',
  pack: ATLAS_PACK,
  packUnit: 'opak.',
});

export const ATLAS_PRODUCTS: Record<string, Product> = {
  ATLAS_3G_L100: kit(100),
  ATLAS_3G_L150: kit(150),
  ATLAS_3G_L200: kit(200),
  ATLAS_3G_L250: kit(250),
  ATLAS_PLUS_L200: { id: 'ATLAS_PLUS_L200', name: 'ATLAS 3GL PLUS M6 L200 – przedłużka łącznika (sufity)', group: 'Mocowanie', unit: 'szt.' },
  ATLAS_PLUS_L300: { id: 'ATLAS_PLUS_L300', name: 'ATLAS 3GL PLUS M6 L300 – przedłużka łącznika (sufity)', group: 'Mocowanie', unit: 'szt.' },
  ATLAS_STONER: { id: 'ATLAS_STONER', name: 'ATLAS STONER – gips szpachlowy do spoinowania', group: 'Wykończenie', unit: 'kg', pack: 20, packUnit: 'worek' },
  ATLAS_GTA: { id: 'ATLAS_GTA', name: 'ATLAS GTA – gładź polimerowa (wykończenie spoin)', group: 'Wykończenie', unit: 'kg', pack: 18, packUnit: 'opak.' },
};

export const FIXERS: Record<'L100' | 'L150' | 'L200' | 'L250' | 'L150_PLUS200' | 'L250_PLUS300', PointFixer> = {
  L100: { product: 'ATLAS_3G_L100', standoff: [14, 50] },
  L150: { product: 'ATLAS_3G_L150', standoff: [50, 100] },
  L200: { product: 'ATLAS_3G_L200', standoff: [100, 150] },
  L250: { product: 'ATLAS_3G_L250', standoff: [150, 200] },
  L150_PLUS200: { product: 'ATLAS_3G_L150', extension: 'ATLAS_PLUS_L200', standoff: [250, 300] },
  L250_PLUS300: { product: 'ATLAS_3G_L250', extension: 'ATLAS_PLUS_L300', standoff: [450, 500] },
};

const range = (f: PointFixer) => `${f.standoff[0]}–${f.standoff[1]} mm`;

// ---------------------------------------------------------------------------
// Okładziny ścian (jednostronne). studSpacing = rozstaw łączników w poziomie,
// pointSpacing = rozstaw w pionie. Karta: 60×50 → ok. 6 m²/opak., 60×40 → 5 m²,
// 40×50 → 4 m²; dwie warstwy płyt tylko na ścianach, siatka 60×60.
// ---------------------------------------------------------------------------

const wall = (o: { id: string; fixer: PointFixer; layers?: 1 | 2; note?: string }): WallSystem => {
  const layers = o.layers ?? 1;
  const vertical = layers === 2 ? 60 : 50;
  return {
    id: o.id,
    name: `Okładzina ATLAS M-System 3G, ${layers}×12,5, łącznik ${o.fixer.product.replace('ATLAS_3G_', '')} (odstęp ${range(o.fixer)})`,
    category: 'atlas',
    frame: 'point-fix',
    profile: 50,
    layers,
    sides: 1,
    defaultBoard: 'RB12.5',
    studSpacing: 60,
    pointSpacing: vertical,
    fixer: o.fixer,
    insulationDefault: false,
    info:
      `Płyty przykręcane do talerzyków łączników kotwionych w ścianie, bez profili · siatka 60×${vertical} cm · odstęp płyty od ściany ${range(o.fixer)} (beton, mur)` +
      (o.note ? ` · ${o.note}` : ''),
    source: ATLAS_SOURCES.KARTA_3G,
    reference: [
      { label: 'Płyta g-k', qty: layers, unit: 'm²' },
      { product: o.fixer.product, label: `Łącznik ATLAS M-SYSTEM 3G (siatka 60×${vertical} cm)`, qty: 10000 / (60 * vertical), unit: 'szt.' },
    ],
  };
};

export const ATLAS_WALL_SYSTEMS: WallSystem[] = [
  wall({ id: 'A-W-L100', fixer: FIXERS.L100, note: 'najczęstszy wariant: krzywe ściany, stare tynki' }),
  wall({ id: 'A-W-L150', fixer: FIXERS.L150 }),
  wall({ id: 'A-W-L200', fixer: FIXERS.L200, note: 'miejsce na instalacje za okładziną' }),
  wall({ id: 'A-W-L100-2', fixer: FIXERS.L100, layers: 2, note: 'dwie warstwy płyt (dopuszczalne tylko na ścianach)' }),
];

// ---------------------------------------------------------------------------
// Sufity. mainSpacing × secondarySpacing = siatka łączników, cm.
// Karta: 40×40 → ok. 3,5 m²/opak., 40×50 → 4 m², 40×60 → 5 m². Tylko jedna warstwa płyt.
// ---------------------------------------------------------------------------

const ceiling = (o: { id: string; fixer: PointFixer; note?: string }): CeilingSystem => ({
  id: o.id,
  name: `Sufit ATLAS M-System 3G, 1×12,5, łącznik ${o.fixer.product.replace('ATLAS_3G_', '')}${o.fixer.extension ? ` + przedłużka ${o.fixer.extension.replace('ATLAS_PLUS_', '')}` : ''} (odstęp ${range(o.fixer)})`,
  kind: 'point-fix',
  layers: 1,
  defaultBoard: 'RB12.5',
  mainSpacing: 40,
  secondarySpacing: 50,
  hangerSpacing: 0,
  fixer: o.fixer,
  screwsOuter: 0,
  screwsInner: 0,
  info:
    `Płyta przykręcana do talerzyków łączników kotwionych w stropie, bez profili CD/UD · siatka 40×50 cm · odstęp płyty od stropu ${range(o.fixer)} (beton, mur)` +
    (o.note ? ` · ${o.note}` : ''),
  source: ATLAS_SOURCES.KARTA_3G,
  reference: [
    { label: 'Płyta g-k', qty: 1, unit: 'm²' },
    { product: o.fixer.product, label: 'Łącznik ATLAS M-SYSTEM 3G (21 szt. na ok. 4 m²)', qty: ATLAS_PACK / 4, unit: 'szt.' },
  ],
});

export const ATLAS_CEILING_SYSTEMS: CeilingSystem[] = [
  ceiling({ id: 'A-S-L100', fixer: FIXERS.L100, note: 'wyrównanie krzywego stropu' }),
  ceiling({ id: 'A-S-L150', fixer: FIXERS.L150 }),
  ceiling({ id: 'A-S-L200', fixer: FIXERS.L200 }),
  ceiling({ id: 'A-S-L250', fixer: FIXERS.L250, note: 'obniżenie na oświetlenie / instalacje' }),
  ceiling({ id: 'A-S-L150-P200', fixer: FIXERS.L150_PLUS200, note: 'łącznik z gwintem M6 + przedłużka' }),
  ceiling({ id: 'A-S-L250-P300', fixer: FIXERS.L250_PLUS300, note: 'maks. obniżenie wg karty' }),
];
