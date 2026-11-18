// Katalog materiałów i systemów suchej zabudowy marki Rigips.
// Parametry (rozstawy, zużycia) to typowe wartości z wytycznych montażowych systemów
// ścian działowych i sufitów podwieszanych. Przed zamówieniem warto porównać je
// z aktualną kartą techniczną systemu (np. wymagania ogniowe i akustyczne).

export type Unit = 'szt.' | 'mb' | 'm²' | 'kg' | 'opak.' | 'rolka' | 'worek';

export interface Product {
  id: string;
  name: string;
  group: ProductGroup;
  unit: Unit;
  /** Długość handlowa (profile, narożniki), m */
  length?: number;
  /** Ilość w opakowaniu handlowym (wkręty, kołki, taśmy w mb) */
  pack?: number;
  packUnit?: Unit;
}

export type ProductGroup =
  | 'Płyty'
  | 'Profile'
  | 'Akcesoria do sufitów'
  | 'Mocowanie'
  | 'Wykończenie'
  | 'Izolacja';

/** Długości handlowe profili, m (pierwsza = domyślna do docinania krótkich elementów) */
export const STOCK_LENGTHS: Record<string, number[]> = {
  CW: [3, 2.6, 2.75, 3.5, 4],
  UW: [4, 3],
  UA: [3, 2.6, 4],
  CD: [4, 3],
  UD: [3, 4],
  NAROZNIK: [3, 2.5],
};

export interface Board {
  id: string;
  name: string;
  short: string;
  thickness: number; // mm
  width: number; // cm
  lengths: number[]; // cm
  description: string;
  color: string;
}

export const BOARDS: Board[] = [
  {
    id: 'RB12.5',
    name: 'Rigips RB 12,5 (typ A)',
    short: 'RB',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 275, 300],
    description: 'Płyta standardowa do pomieszczeń suchych',
    color: '#e8e4da',
  },
  {
    id: 'RBI12.5',
    name: 'Rigips RBI 12,5 (typ H2)',
    short: 'RBI',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta impregnowana do łazienek i kuchni',
    color: '#b9d8b0',
  },
  {
    id: 'RF12.5',
    name: 'Rigips RF 12,5 (typ F)',
    short: 'RF',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta o zwiększonej odporności ogniowej',
    color: '#f2b8b0',
  },
  {
    id: 'RFI12.5',
    name: 'Rigips RFI 12,5 (typ DFH2)',
    short: 'RFI',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta ogniochronna i impregnowana',
    color: '#e6c9a8',
  },
  {
    id: 'HABITO12.5',
    name: 'Rigips Habito 12,5 (typ DEFIR)',
    short: 'Habito',
    thickness: 12.5,
    width: 120,
    lengths: [260, 300],
    description: 'Płyta o podwyższonej twardości, można wieszać szafki',
    color: '#c9d4e6',
  },
];

export const PRODUCTS: Record<string, Product> = {
  // Profile ścienne
  CW50: { id: 'CW50', name: 'Profil Rigips CW 50', group: 'Profile', unit: 'szt.', length: 3 },
  CW75: { id: 'CW75', name: 'Profil Rigips CW 75', group: 'Profile', unit: 'szt.', length: 3 },
  CW100: { id: 'CW100', name: 'Profil Rigips CW 100', group: 'Profile', unit: 'szt.', length: 3 },
  UW50: { id: 'UW50', name: 'Profil Rigips UW 50', group: 'Profile', unit: 'szt.', length: 4 },
  UW75: { id: 'UW75', name: 'Profil Rigips UW 75', group: 'Profile', unit: 'szt.', length: 4 },
  UW100: { id: 'UW100', name: 'Profil Rigips UW 100', group: 'Profile', unit: 'szt.', length: 4 },
  UA50: { id: 'UA50', name: 'Profil ościeżnicowy UA 50', group: 'Profile', unit: 'szt.', length: 3 },
  UA75: { id: 'UA75', name: 'Profil ościeżnicowy UA 75', group: 'Profile', unit: 'szt.', length: 3 },
  UA100: { id: 'UA100', name: 'Profil ościeżnicowy UA 100', group: 'Profile', unit: 'szt.', length: 3 },
  KATUA: { id: 'KATUA', name: 'Kątownik przyłączeniowy do UA', group: 'Mocowanie', unit: 'szt.' },
  // Profile sufitowe
  CD60: { id: 'CD60', name: 'Profil Rigips CD 60', group: 'Profile', unit: 'szt.', length: 4 },
  UD27: { id: 'UD27', name: 'Profil Rigips UD 27', group: 'Profile', unit: 'szt.', length: 3 },
  // Akcesoria sufitowe
  WIESZAK_NONIUSZ: {
    id: 'WIESZAK_NONIUSZ',
    name: 'Wieszak noniuszowy CD 60 (górny + dolny)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  ZAWLECZKA: { id: 'ZAWLECZKA', name: 'Zawleczka do wieszaka noniuszowego', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_ES: { id: 'WIESZAK_ES', name: 'Wieszak bezpośredni ES do CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  LACZNIK_KRZ: {
    id: 'LACZNIK_KRZ',
    name: 'Łącznik krzyżowy CD 60 (dwupoziomowy)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  LACZNIK_JEDNO: {
    id: 'LACZNIK_JEDNO',
    name: 'Łącznik krzyżowy jednopoziomowy CD 60',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  LACZNIK_WZDL: { id: 'LACZNIK_WZDL', name: 'Łącznik wzdłużny CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  // Mocowanie
  KOTWA: { id: 'KOTWA', name: 'Kotwa stropowa metalowa 6 mm', group: 'Mocowanie', unit: 'szt.', pack: 100, packUnit: 'opak.' },
  KOLEK: {
    id: 'KOLEK',
    name: 'Kołek szybkiego montażu 6×40',
    group: 'Mocowanie',
    unit: 'szt.',
    pack: 100,
    packUnit: 'opak.',
  },
  TN25: { id: 'TN25', name: 'Wkręt do płyt TN 3,5×25', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  TN35: { id: 'TN35', name: 'Wkręt do płyt TN 3,5×35', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  TN45: { id: 'TN45', name: 'Wkręt do płyt TN 3,5×45', group: 'Mocowanie', unit: 'szt.', pack: 500, packUnit: 'opak.' },
  LN9: { id: 'LN9', name: 'Wkręt do profili LN 3,5×9 (pchełka)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  // Wykończenie
  TASMA_USZ50: { id: 'TASMA_USZ50', name: 'Taśma uszczelniająca 50 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ70: { id: 'TASMA_USZ70', name: 'Taśma uszczelniająca 70 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ95: { id: 'TASMA_USZ95', name: 'Taśma uszczelniająca 95 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ30: { id: 'TASMA_USZ30', name: 'Taśma uszczelniająca 30 mm (pod UD)', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_SPOIN: {
    id: 'TASMA_SPOIN',
    name: 'Taśma spoinowa z włókna szklanego',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 90,
    packUnit: 'rolka',
  },
  MASA: { id: 'MASA', name: 'Masa szpachlowa Rigips Vario', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  NAROZNIK: { id: 'NAROZNIK', name: 'Narożnik ochronny aluminiowy', group: 'Wykończenie', unit: 'szt.', length: 3 },
  // Izolacja
  WELNA50: { id: 'WELNA50', name: 'Wełna mineralna 50 mm', group: 'Izolacja', unit: 'm²' },
  WELNA75: { id: 'WELNA75', name: 'Wełna mineralna 75 mm', group: 'Izolacja', unit: 'm²' },
  WELNA100: { id: 'WELNA100', name: 'Wełna mineralna 100 mm', group: 'Izolacja', unit: 'm²' },
};

export interface WallSystem {
  id: string;
  name: string;
  /** Szerokość profilu CW/UW, mm */
  profile: 50 | 75 | 100;
  /** Liczba warstw płyt na jednej stronie */
  layers: 1 | 2;
  /** 2 = ściana działowa, 1 = obudowa / okładzina jednostronna */
  sides: 1 | 2;
  defaultBoard: string;
  insulationDefault: boolean;
  /** Orientacyjne parametry z dokumentacji systemowej */
  info: string;
}

export const WALL_SYSTEMS: WallSystem[] = [
  {
    id: 'W-CW50-1',
    name: 'Ściana CW 50, 1×12,5 obustronnie',
    profile: 50,
    layers: 1,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 75 mm · do ok. 3,0 m wysokości przy rozstawie 60 cm',
  },
  {
    id: 'W-CW50-2',
    name: 'Ściana CW 50, 2×12,5 obustronnie',
    profile: 50,
    layers: 2,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 100 mm · do ok. 4,0 m wysokości',
  },
  {
    id: 'W-CW75-1',
    name: 'Ściana CW 75, 1×12,5 obustronnie',
    profile: 75,
    layers: 1,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 100 mm · do ok. 4,0 m wysokości',
  },
  {
    id: 'W-CW75-2',
    name: 'Ściana CW 75, 2×12,5 obustronnie',
    profile: 75,
    layers: 2,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 125 mm · do ok. 5,0 m · lepsza akustyka',
  },
  {
    id: 'W-CW100-1',
    name: 'Ściana CW 100, 1×12,5 obustronnie',
    profile: 100,
    layers: 1,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 125 mm · do ok. 5,0 m wysokości',
  },
  {
    id: 'W-CW100-2',
    name: 'Ściana CW 100, 2×12,5 obustronnie',
    profile: 100,
    layers: 2,
    sides: 2,
    defaultBoard: 'RB12.5',
    insulationDefault: true,
    info: 'Grubość 150 mm · do ok. 6,5 m · wysoka izolacyjność',
  },
  {
    id: 'W-CW75-2RF',
    name: 'Ściana ogniochronna CW 75, 2×RF 12,5',
    profile: 75,
    layers: 2,
    sides: 2,
    defaultBoard: 'RF12.5',
    insulationDefault: true,
    info: 'Grubość 125 mm · klasa EI 60 przy wypełnieniu wełną wg karty systemu',
  },
  {
    id: 'W-CW75-2RBI',
    name: 'Ściana do łazienki CW 75, 2×RBI 12,5',
    profile: 75,
    layers: 2,
    sides: 2,
    defaultBoard: 'RBI12.5',
    insulationDefault: true,
    info: 'Pod płytki ceramiczne · zalecany rozstaw 40 cm',
  },
  {
    id: 'O-CW50-1',
    name: 'Obudowa jednostronna CW 50, 1×12,5',
    profile: 50,
    layers: 1,
    sides: 1,
    defaultBoard: 'RB12.5',
    insulationDefault: false,
    info: 'Okładzina ściany lub obudowa instalacji, płyta z jednej strony',
  },
  {
    id: 'O-CW50-2',
    name: 'Obudowa jednostronna CW 50, 2×12,5',
    profile: 50,
    layers: 2,
    sides: 1,
    defaultBoard: 'RB12.5',
    insulationDefault: false,
    info: 'Okładzina ściany, dwie warstwy płyt z jednej strony',
  },
];

export type CeilingKind = 'two-level' | 'one-level' | 'direct';

export interface CeilingSystem {
  id: string;
  name: string;
  kind: CeilingKind;
  layers: 1 | 2;
  defaultBoard: string;
  /** Rozstaw profili nośnych (górnych), cm */
  mainSpacing: number;
  /** Rozstaw profili montażowych (dolnych), cm */
  secondarySpacing: number;
  /** Rozstaw wieszaków na profilu nośnym, cm */
  hangerSpacing: number;
  info: string;
}

export const CEILING_SYSTEMS: CeilingSystem[] = [
  {
    id: 'S-CD-2P-1',
    name: 'Sufit podwieszany dwupoziomowy CD 60, 1×12,5',
    kind: 'two-level',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 100,
    secondarySpacing: 50,
    hangerSpacing: 90,
    info: 'Ruszt krzyżowy: profile nośne co 100 cm, montażowe co 50 cm, wieszaki co 90 cm',
  },
  {
    id: 'S-CD-2P-2',
    name: 'Sufit podwieszany dwupoziomowy CD 60, 2×12,5',
    kind: 'two-level',
    layers: 2,
    defaultBoard: 'RF12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 75,
    info: 'Ruszt krzyżowy pod dwie warstwy płyt: montażowe co 40 cm, wieszaki co 75 cm',
  },
  {
    id: 'S-CD-1P-1',
    name: 'Sufit jednopoziomowy CD 60, 1×12,5',
    kind: 'one-level',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 120,
    secondarySpacing: 50,
    hangerSpacing: 90,
    info: 'Profile w jednej płaszczyźnie, łączniki jednopoziomowe · mniejsza utrata wysokości',
  },
  {
    id: 'S-ES-1',
    name: 'Sufit na wieszakach bezpośrednich ES, 1×12,5',
    kind: 'direct',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 50,
    secondarySpacing: 50,
    hangerSpacing: 90,
    info: 'Profile CD mocowane wieszakami ES tuż pod stropem lub do belek',
  },
  {
    id: 'S-ES-2',
    name: 'Sufit na wieszakach bezpośrednich ES, 2×12,5',
    kind: 'direct',
    layers: 2,
    defaultBoard: 'RB12.5',
    mainSpacing: 40,
    secondarySpacing: 40,
    hangerSpacing: 75,
    info: 'Wieszaki ES, dwie warstwy płyt, profile CD co 40 cm',
  },
];

export const boardById = (id: string): Board => BOARDS.find((b) => b.id === id) ?? BOARDS[0];
export const wallSystemById = (id: string): WallSystem =>
  WALL_SYSTEMS.find((s) => s.id === id) ?? WALL_SYSTEMS[2];
export const ceilingSystemById = (id: string): CeilingSystem =>
  CEILING_SYSTEMS.find((s) => s.id === id) ?? CEILING_SYSTEMS[0];
