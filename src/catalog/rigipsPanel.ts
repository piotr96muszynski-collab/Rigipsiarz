// Obudowy szybów instalacyjnych i windowych Rigips „na konstrukcji obwodowej z profili kątowych”:
// płyty bez słupków, kątownik 40×20×1 lub 40×40×1 po obwodzie szachtu (ruszt `panel`).
//
// Dane z kart systemów (PDF, rigips.pl/sites/default/files/media_assets/dokument/stiboprod/ORIGINAL/<kod>.pdf) i z kalkulatora
// rigips.pl (data/rigips-systemy.json – zużycie na 100 m²). Karta 3.50.22 nie ma tabeli odmian na stronie
// rigips.pl – parametry z PDF karty.
//
// Założenia aplikacji (karty ich nie rozstrzygają):
// - „po obwodzie szachtu” = kątownik przy obu ścianach oraz przy posadzce i stropie (1,5 mb/m² w karcie
//   odpowiada obudowie ok. 2,5 × 2,9 m),
// - płyty poziomo, w jednym kawałku od ściany do ściany (maks. szerokość z karty = długość arkusza),
// - kołki co 75 cm (karta: „maks. 750 mm”), na każdym odcinku kątownika także przy obu końcach.

import type { WallSystem } from './rigips';

const pdf = (code: string) => ({ label: `Karta systemu Rigips ${code}`, url: `https://www.rigips.pl/sites/default/files/media_assets/dokument/stiboprod/ORIGINAL/${code}.pdf` });

const INFO_EDGE = 'Kątownik 40×20×1 lub 40×40×1 po obwodzie szachtu, kołki stalowe min. Ø6×40 co maks. 75 cm, taśma uszczelniająca 30 mm';
const INFO_BOARDS = 'płyty poziomo, każda od ściany do ściany (szerokość szachtu do długości arkusza), warstwy skręcone ze sobą';

export const RIGIPS_PANEL_SHAFTS: WallSystem[] = [
  {
    id: 'SZ-PANEL-2RF12.5',
    code: '3.50.14',
    name: 'Obudowa szachtu bez słupków, kątownik po obwodzie, 2×12,5 Fire',
    category: 'szacht',
    frame: 'panel',
    profile: 50,
    layers: 2,
    sides: 1,
    defaultBoard: 'RF12.5',
    studSpacing: 60,
    insulationDefault: false,
    fire: 'EI 30',
    panel: {
      edge: 'KAT_SZYB',
      edgeSides: 'all',
      anchorSpacing: 75,
      maxWidth: 250,
      // karta: TB 3,5×25 co 400 mm – 2,5 szt./m², TB 3,5×35 co 200 mm – 5 szt./m²
      screws: [
        { product: 'TN25', perM2: 2.5 },
        { product: 'TN35', perM2: 5 },
      ],
    },
    info: `${INFO_EDGE} · ${INFO_BOARDS} · wysokość bez ograniczeń, szerokość do 2,5 m · EI 30 (LBO-089-KZ/21)`,
    source: pdf('3.50.14'),
    maker: 'rigips',
    reference: [
      { label: 'Płyty', qty: 2, unit: 'm²' },
      { product: 'KAT_SZYB', label: 'Kątownik ściany szybu 40×40×1 / 40×20×1', qty: 1.5, unit: 'mb' },
      { product: 'TN25', label: 'Wkręty TB 3,5×25', qty: 2.5, unit: 'szt.' },
      { product: 'TN35', label: 'Wkręty TB 3,5×35', qty: 5, unit: 'szt.' },
      { product: 'KOLEK', label: 'Kołki stalowe Ø6×40', qty: 2.29, unit: 'szt.' },
      { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 1.5, unit: 'mb' },
      { label: 'Taśma spoinowa', qty: 1.4, unit: 'mb' },
    ],
    variants: [
      { code: '3.50.14', label: '2×12,5 Fire (F)', board: 'RF12.5', fire: 30, thickness: 25, mass: 25, maxWidth: 250 },
      { code: '3.50.14', label: '2×12,5 Fire+ (DF)', board: 'RFP12.5', fire: 30, thickness: 25, mass: 25, maxWidth: 250 },
      { code: '3.50.14', label: '2×12,5 Fire+ Hydro (DFH2)', board: 'RFI12.5', fire: 30, thickness: 25, mass: 25, maxWidth: 250 },
    ],
  },
  {
    id: 'SZ-PANEL-3RF12.5',
    code: '3.50.19',
    name: 'Obudowa szachtu bez słupków, kątownik po obwodzie, 3×12,5 Fire',
    category: 'szacht',
    frame: 'panel',
    profile: 50,
    layers: 3,
    sides: 1,
    defaultBoard: 'RF12.5',
    studSpacing: 60,
    insulationDefault: false,
    fire: 'EI 60',
    panel: {
      edge: 'KAT_SZYB',
      edgeSides: 'all',
      anchorSpacing: 75,
      maxWidth: 250,
      // kalkulator rigips.pl: TB 3,5×25 i 3,5×35 po 2,5 szt./m², TB 3,5×55 5 szt./m²
      screws: [
        { product: 'TN25', perM2: 2.5 },
        { product: 'TN35', perM2: 2.5 },
        { product: 'TN55', perM2: 5 },
      ],
    },
    info: `${INFO_EDGE} · ${INFO_BOARDS} · wysokość bez ograniczeń, szerokość do 2,5 m · EI 60 (LBO-089-KZ/21)`,
    source: pdf('3.50.19'),
    maker: 'rigips',
    reference: [
      { label: 'Płyty', qty: 3, unit: 'm²' },
      { product: 'KAT_SZYB', label: 'Kątownik ściany szybu 40×40×1 / 40×20×1', qty: 1.5, unit: 'mb' },
      { product: 'TN25', label: 'Wkręty TB 3,5×25', qty: 2.5, unit: 'szt.' },
      { product: 'TN35', label: 'Wkręty TB 3,5×35', qty: 2.5, unit: 'szt.' },
      { product: 'TN55', label: 'Wkręty TB 3,5×55', qty: 5, unit: 'szt.' },
      { product: 'KOLEK', label: 'Kołki stalowe', qty: 2.29, unit: 'szt.' },
      { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 1.5, unit: 'mb' },
      { label: 'Taśma spoinowa', qty: 1.4, unit: 'mb' },
    ],
    variants: [
      { code: '3.50.19', label: '3×12,5 Fire (F)', board: 'RF12.5', fire: 60, thickness: 37.5, mass: 35, maxWidth: 250 },
      { code: '3.50.19', label: '3×12,5 Fire+ (DF)', board: 'RFP12.5', fire: 60, thickness: 37.5, mass: 35, maxWidth: 250 },
      { code: '3.50.19', label: '3×12,5 Fire+ Hydro (DFH2)', board: 'RFI12.5', fire: 60, thickness: 37.5, mass: 35, maxWidth: 250 },
    ],
  },
  {
    id: 'SZ-PANEL-2RF15',
    code: '3.50.22',
    name: 'Obudowa szachtu bez słupków, kątownik po obwodzie, 2×15 Fire',
    category: 'szacht',
    frame: 'panel',
    profile: 50,
    layers: 2,
    sides: 1,
    defaultBoard: 'RF15',
    studSpacing: 60,
    insulationDefault: false,
    fire: 'EI 60',
    panel: {
      edge: 'KAT_SZYB',
      edgeSides: 'all',
      anchorSpacing: 75,
      maxWidth: 250,
      // karta: TB 3,5×25 co 400 mm – 2,5 szt./m², TB 3,5×45 co 200 mm – 2,5 szt./m²
      screws: [
        { product: 'TN25', perM2: 2.5 },
        { product: 'TN45', perM2: 2.5 },
      ],
    },
    info: `${INFO_EDGE} · ${INFO_BOARDS} · wysokość bez ograniczeń, szerokość do 2,5 m · EI 60 (LBO-089-KZ/21) · w wykazie materiałów karty płyta opisana jako 12,5 mm – przyjęto 15 mm jak w tytule i tabeli`,
    source: pdf('3.50.22'),
    maker: 'rigips',
    reference: [
      { label: 'Płyty', qty: 2, unit: 'm²' },
      { product: 'KAT_SZYB', label: 'Kątownik ściany szybu 40×40×1 / 40×20×1', qty: 1.5, unit: 'mb' },
      { product: 'TN25', label: 'Wkręty TB 3,5×25', qty: 2.5, unit: 'szt.' },
      { product: 'TN45', label: 'Wkręty TB 3,5×45', qty: 2.5, unit: 'szt.' },
      { product: 'KOLEK', label: 'Kołki stalowe Ø6×40', qty: 2.3, unit: 'szt.' },
      { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 1.5, unit: 'mb' },
      { label: 'Taśma spoinowa', qty: 1.4, unit: 'mb' },
    ],
    variants: [
      { code: '3.50.22', label: '2×15 Fire (F)', board: 'RF15', fire: 60, thickness: 30, mass: 29, maxWidth: 250 },
      { code: '3.50.22', label: '2×15 Fire+ (DF)', board: 'RFP15', fire: 60, thickness: 30, mass: 29, maxWidth: 250 },
      { code: '3.50.22', label: '2×15 Fire+ Hydro (DFH2)', board: 'RFI15', fire: 60, thickness: 30, mass: 29, maxWidth: 250 },
    ],
  },
  {
    id: 'SZ-PANEL-2RIDURIT25',
    code: '3.80.15',
    name: 'Obudowa szachtu bez słupków, kątownik po obwodzie, 2×25 Glasroc F Ridurit',
    category: 'szacht',
    frame: 'panel',
    profile: 50,
    layers: 2,
    sides: 1,
    defaultBoard: 'RIDURIT25',
    studSpacing: 60,
    maxHeight: { 60: 500 },
    insulationDefault: false,
    fire: 'EI 120',
    panel: {
      edge: 'KAT_SZYB',
      edgeSides: 'all',
      anchorSpacing: 75,
      maxWidth: 200,
      // karta: wkręty Ridurit 3,5×50 w siatce 250×250 mm (druga warstwa do pierwszej) 27 szt./m²,
      // TB 3,5×35 co 400 mm 2,5 szt./m², TB 3,5×55 co 200 mm 5 szt./m²
      screws: [
        { product: 'RIDURIT50', perM2: 27 },
        { product: 'TN35', perM2: 2.5 },
        { product: 'TN55', perM2: 5 },
      ],
    },
    info: `${INFO_EDGE} · płyty gipsowe zbrojone włóknem szklanym, poziomo od ściany do ściany, druga warstwa przykręcona do pierwszej wkrętami Ridurit w siatce 25×25 cm · wysokość do 5 m (bez ograniczeń dla pojedynczej ściany szybu wg przypisu karty), szerokość do 2,0 m · EI 120`,
    source: pdf('3.80.15'),
    maker: 'rigips',
    reference: [
      { label: 'Płyty', qty: 2, unit: 'm²' },
      { product: 'KAT_SZYB', label: 'Kątownik ściany szybu 40×40×1 / 40×20×1', qty: 1.5, unit: 'mb' },
      { product: 'RIDURIT50', label: 'Wkręty Glasroc F (Ridurit) 3,5×50', qty: 27, unit: 'szt.' },
      { product: 'TN35', label: 'Wkręty TB 3,5×35', qty: 2.5, unit: 'szt.' },
      { product: 'TN55', label: 'Wkręty TB 3,5×55', qty: 5, unit: 'szt.' },
      { product: 'KOLEK', label: 'Kołki stalowe Ø6×40', qty: 2.29, unit: 'szt.' },
      { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 1.5, unit: 'mb' },
    ],
    variants: [{ code: '3.80.15', label: '2×25 Glasroc F (Ridurit) GM-F', board: 'RIDURIT25', fire: 120, thickness: 50, mass: 49, maxHeight: 500, maxWidth: 200 }],
  },
];
