// Wykończenie suchej zabudowy: spoinowanie (poziom Q1), narożniki i styki z murem / stropem.
//
// Zakres aplikacji to poziom Q1 wg Rigips: wypełnienie spoin, zatopienie taśmy w masie
// i druga, szersza warstwa po związaniu pierwszej, plus szpachlowanie łbów wkrętów.
// Gładzie (Q2–Q4) nie są liczone.
//
// Źródła zużycia mas: karty techniczne Rigips VARIO (09.2025, ok. 0,25 kg/m²),
// Rifino Top (0,3 kg/m² spoiny) i ProMix Mega (ok. 0,4 kg/m² spoinowanie). Zużycie
// przy narożnikach i stykach to wartości orientacyjne z praktyki montażowej.

import type { Board, Product } from './rigips';

// ---------------------------------------------------------------------------
// Produkty
// ---------------------------------------------------------------------------

export const FINISHING_PRODUCTS: Record<string, Product> = {
  MASA: { id: 'MASA', name: 'Masa szpachlowa Rigips Vario', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_RIFINO: { id: 'MASA_RIFINO', name: 'Masa szpachlowa Rigips Rifino Top', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_PROMIX: {
    id: 'MASA_PROMIX',
    name: 'Masa gotowa Rigips ProMix Mega',
    group: 'Wykończenie',
    unit: 'kg',
    pack: 25,
    packUnit: 'opak.',
  },
  TASMA_SPOIN: { id: 'TASMA_SPOIN', name: 'Taśma spoinowa papierowa Rigips', group: 'Wykończenie', unit: 'mb', pack: 75, packUnit: 'rolka' },
  // Taśmy kompozytowe Tuff-Tape (Center-Flex): rolki 10 / 20 / 30 mb wersji czerwonej, 20 mb pozostałych
  TASMA_TUFF: {
    id: 'TASMA_TUFF',
    name: 'Tuff-Tape czerwona Center-Flex 57 mm (spoiny i kąty wewnętrzne)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 30,
    packUnit: 'rolka',
  },
  TUFF_MEDIUM: {
    id: 'TUFF_MEDIUM',
    name: 'Tuff-Tape Medium zielona 57 mm (kąty wewnętrzne i zewnętrzne)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 20,
    packUnit: 'rolka',
  },
  TUFF_UNO: {
    id: 'TUFF_UNO',
    name: 'Tuff-Tape Uno-Bead granatowa 57 mm (narożniki zewnętrzne)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 20,
    packUnit: 'rolka',
  },
  TUFF_ORIGINAL: {
    id: 'TUFF_ORIGINAL',
    name: 'Tuff-Tape Original pomarańczowa 61 mm (narożniki, kąty dowolne)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 20,
    packUnit: 'rolka',
  },
  NAROZNIK: { id: 'NAROZNIK', name: 'Narożnik aluminiowy perforowany', group: 'Wykończenie', unit: 'szt.', length: 3 },
  NAROZNIK_SIATKA: { id: 'NAROZNIK_SIATKA', name: 'Narożnik aluminiowy z siatką', group: 'Wykończenie', unit: 'szt.', length: 3 },
  NAROZNIK_LUK: {
    id: 'NAROZNIK_LUK',
    name: 'Narożnik elastyczny PCV (łuki, kąty nietypowe)',
    group: 'Wykończenie',
    unit: 'szt.',
    length: 3,
  },
  NAROZNIK_WEWN: { id: 'NAROZNIK_WEWN', name: 'Narożnik wewnętrzny PCV z siatką', group: 'Wykończenie', unit: 'szt.', length: 3 },
  TASMA_NAR_PAPMET: {
    id: 'TASMA_NAR_PAPMET',
    name: 'Taśma narożnikowa Rigips (papier z wkładką metalową)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 30,
    packUnit: 'rolka',
  },
  NOCOAT: {
    id: 'NOCOAT',
    name: 'Rigips Habito No-Coat – taśma narożnikowa (kąty dowolne)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 30.5,
    packUnit: 'rolka',
  },
  TASMA_ROZDZ: {
    id: 'TASMA_ROZDZ',
    name: 'Taśma Rigips PRO do połączeń ślizgowych (styk z murem i stropem)',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 50,
    packUnit: 'rolka',
  },
  AKRYL: { id: 'AKRYL', name: 'Akryl szpachlowy do spoin, 310 ml', group: 'Wykończenie', unit: 'szt.' },
};

/** Długości handlowe listew narożnikowych, m */
export const CORNER_STOCK_LENGTHS: Record<string, number[]> = {
  NAROZNIK: [3, 2.5],
  NAROZNIK_SIATKA: [3, 2.5],
  NAROZNIK_LUK: [3],
  NAROZNIK_WEWN: [3, 2.5],
};

// ---------------------------------------------------------------------------
// Krawędzie płyt
// ---------------------------------------------------------------------------

export type EdgeType = '4PRO' | 'KPOS' | 'KS' | 'KP';

export const EDGE_LABEL: Record<EdgeType, string> = {
  '4PRO': '4PRO – spłaszczone krawędzie podłużne i poprzeczne (Rigips PRO)',
  KPOS: 'KPOS – półokrągła spłaszczona',
  KS: 'KS – spłaszczona',
  KP: 'KP – prosta (płyta cementowa, krawędź cięta)',
};

/** Rodzaj krawędzi podłużnej płyty (domyślny wg rodziny płyt) */
export function boardEdge(b: Pick<Board, 'id' | 'name' | 'kind'>): EdgeType {
  if (b.kind === 'cement') return 'KP';
  if (/PRO/.test(b.name)) return '4PRO';
  if (/Habito/i.test(b.name)) return 'KPOS';
  return 'KS';
}

// ---------------------------------------------------------------------------
// Spoinowanie Q1: masa + taśma
// ---------------------------------------------------------------------------

export interface JointCompound {
  id: string;
  product: string;
  name: string;
  /** Zużycie na spoinowanie (Q1), kg na m² płyty, wg karty technicznej */
  kgPerM2: number;
  kind: 'sucha' | 'gotowa';
  info: string;
}

export const COMPOUNDS: JointCompound[] = [
  {
    id: 'vario',
    product: 'MASA',
    name: 'Rigips Vario',
    kgPerM2: 0.25,
    kind: 'sucha',
    info: 'Masa gipsowa wzmocniona polimerami (EN 13963 4B), worki 5 / 12,5 / 25 kg, czas pracy ok. 60 min. Zużycie ok. 0,25 kg/m².',
  },
  {
    id: 'rifino',
    product: 'MASA_RIFINO',
    name: 'Rigips Rifino Top',
    kgPerM2: 0.3,
    kind: 'sucha',
    info: 'Masa gipsowa (EN 13963 3B), worki 5 / 12,5 / 25 kg, czas pracy 45–60 min, zalecana też do narożników No-Coat. Zużycie 0,3 kg/m².',
  },
  {
    id: 'promix',
    product: 'MASA_PROMIX',
    name: 'Rigips ProMix Mega',
    kgPerM2: 0.4,
    kind: 'gotowa',
    info: 'Masa gotowa do użycia (EN 13963 3A), wiadra 5 / 15 / 25 kg, schnie na powietrzu – każda warstwa musi wyschnąć. Zużycie ok. 0,4 kg/m².',
  },
];

export interface JointTape {
  id: 'paper' | 'tuff';
  product: string;
  name: string;
  info: string;
}

export const TAPES: JointTape[] = [
  {
    id: 'paper',
    product: 'TASMA_SPOIN',
    name: 'Taśma papierowa',
    info: 'Standard Rigips – zatapiana w świeżej masie, najwyższa wytrzymałość spoiny.',
  },
  {
    id: 'tuff',
    product: 'TASMA_TUFF',
    name: 'Tuff-Tape',
    info: 'Tuff-Tape czerwona Center-Flex 57 mm – taśma kompozytowa zamiast papierowej: nie marszczy się, odporna na wilgoć, dobra na spoiny poprzeczne i kąty wewnętrzne.',
  },
];

/** Kroki technologii Q1 (do wyświetlenia) */
export const Q1_STEPS = [
  'Krawędzie cięte sfazować (ok. 1/3 grubości kartonu), spoiny odpylić.',
  'Wypełnić spoinę masą i od razu zatopić w niej taśmę, nadmiar ściągnąć szpachlą.',
  'Po związaniu pierwszej warstwy nałożyć drugą, szerszą warstwę na spoinę.',
  'Zaszpachlować łby wkrętów (dwukrotnie). W płytach wielowarstwowych warstwy wewnętrzne tylko wypełnić masą, bez taśmy.',
  'Narożniki zatopić w masie i pokryć cienką warstwą; styki z murem i stropem wykonać wg wybranego detalu.',
];

// ---------------------------------------------------------------------------
// Narożniki i styki
// ---------------------------------------------------------------------------

/** Gdzie dane wykończenie może być użyte */
export type EdgeUse = 'external' | 'internal' | 'contact';

export interface CornerType {
  id: string;
  name: string;
  uses: EdgeUse[];
  /** Produkt główny; brak = nic nie kupujemy */
  product?: string;
  /** Jak liczymy produkt: listwy (rozkrój), metry z rolki, tuby (akryl) */
  measure?: 'bar' | 'meter' | 'tube';
  /** Taśma spoinowa dodatkowo, mb na mb krawędzi (kąt wewnętrzny z taśmą) */
  tapePerM?: number;
  /** Masa spoinowa, kg na mb krawędzi */
  kgPerM: number;
  /** Nadaje się do kątów innych niż 90° */
  anyAngle?: boolean;
  info: string;
}

/** Wydajność tuby akrylu 310 ml przy spoinie ok. 5×6 mm, mb */
export const ACRYLIC_M_PER_TUBE = 10;

export const CORNER_TYPES: CornerType[] = [
  {
    id: 'alu-perf',
    name: 'Narożnik aluminiowy perforowany',
    uses: ['external'],
    product: 'NAROZNIK',
    measure: 'bar',
    kgPerM: 0.3,
    info: 'Klasyczna ochrona krawędzi 90°, zatapiany w masie.',
  },
  {
    id: 'alu-mesh',
    name: 'Narożnik aluminiowy z siatką',
    uses: ['external'],
    product: 'NAROZNIK_SIATKA',
    measure: 'bar',
    kgPerM: 0.35,
    info: 'Siatka po bokach lepiej wiąże się z masą – mniej rys na krawędzi.',
  },
  {
    id: 'paper-metal',
    name: 'Taśma narożnikowa Rigips (papier z wkładką metalową)',
    uses: ['external', 'internal'],
    product: 'TASMA_NAR_PAPMET',
    measure: 'meter',
    kgPerM: 0.25,
    anyAngle: true,
    info: 'Papier z dwiema wkładkami stalowymi, z rolki; kąty zewnętrzne i wewnętrzne, także nietypowe.',
  },
  {
    id: 'nocoat',
    name: 'Rigips Habito No-Coat',
    uses: ['external', 'internal'],
    product: 'NOCOAT',
    measure: 'meter',
    kgPerM: 0.3,
    anyAngle: true,
    info: 'Systemowa taśma narożnikowa Rigips z rdzeniem kopolimerowym – zamiast narożnika aluminiowego na krawędziach narażonych na uderzenia i zamiast taśmy w kątach wewnętrznych; dowolny kąt (skosy, kąty rozwarte). Zatapiana w masie, np. Rifino Top.',
  },
  {
    id: 'tuff-medium',
    name: 'Tuff-Tape Medium (zielona)',
    uses: ['external', 'internal'],
    product: 'TUFF_MEDIUM',
    measure: 'meter',
    kgPerM: 0.25,
    anyAngle: true,
    info: 'Taśma kompozytowa średniej sztywności – kąty wewnętrzne i zewnętrzne, także nietypowe.',
  },
  {
    id: 'tuff-uno',
    name: 'Tuff-Tape Uno-Bead (granatowa)',
    uses: ['external'],
    product: 'TUFF_UNO',
    measure: 'meter',
    kgPerM: 0.3,
    anyAngle: true,
    info: 'Narożnik zewnętrzny z rolki zamiast listwy aluminiowej.',
  },
  {
    id: 'tuff-original',
    name: 'Tuff-Tape Original (pomarańczowa)',
    uses: ['external', 'internal'],
    product: 'TUFF_ORIGINAL',
    measure: 'meter',
    kgPerM: 0.3,
    anyAngle: true,
    info: 'Najsztywniejsza taśma narożnikowa 61 mm – kąty zewnętrzne i wewnętrzne o dowolnym kącie, łuki.',
  },
  {
    id: 'pvc-flex',
    name: 'Narożnik elastyczny PCV (łukowy)',
    uses: ['external'],
    product: 'NAROZNIK_LUK',
    measure: 'bar',
    kgPerM: 0.35,
    anyAngle: true,
    info: 'Do łuków i kątów nietypowych na krawędziach zewnętrznych.',
  },
  {
    id: 'pvc-inner',
    name: 'Narożnik wewnętrzny PCV z siatką',
    uses: ['internal'],
    product: 'NAROZNIK_WEWN',
    measure: 'bar',
    kgPerM: 0.25,
    info: 'Prosty kąt wewnętrzny bez ręcznego formowania taśmy.',
  },
  {
    id: 'paper-tape',
    name: 'Taśma spoinowa zgięta w kąt',
    uses: ['internal'],
    tapePerM: 1,
    kgPerM: 0.2,
    info: 'Wybrana taśma spoinowa (papierowa lub Tuff-Tape) zgięta wzdłuż i zatopiona w masie – standard Rigips w kątach wewnętrznych.',
  },
  {
    id: 'separating',
    name: 'Taśma Rigips PRO do połączeń ślizgowych + masa',
    uses: ['contact', 'internal'],
    product: 'TASMA_ROZDZ',
    measure: 'meter',
    kgPerM: 0.1,
    info: 'Detal Rigips przy murze i stropie: taśma oddziela masę od muru, nadmiar odcina się po związaniu – styk może pracować bez rys na płycie.',
  },
  {
    id: 'elastic-tape',
    name: 'Tuff-Tape czerwona + masa',
    uses: ['contact', 'internal'],
    product: 'TASMA_TUFF',
    measure: 'meter',
    kgPerM: 0.2,
    anyAngle: true,
    info: 'Zbrojenie kąta przy murze lub stropie taśmą kompozytową.',
  },
  {
    id: 'acrylic',
    name: 'Akryl szpachlowy',
    uses: ['contact', 'internal'],
    product: 'AKRYL',
    measure: 'tube',
    kgPerM: 0,
    anyAngle: true,
    info: `Elastyczna spoina na styku – tuba 310 ml na ok. ${ACRYLIC_M_PER_TUBE} mb.`,
  },
  {
    id: 'none',
    name: 'Bez wykończenia',
    uses: ['external', 'internal', 'contact'],
    kgPerM: 0,
    anyAngle: true,
    info: 'Krawędź pominięta w wyliczeniach (np. zakryta okładziną).',
  },
];

export const cornerTypeById = (id: string | undefined): CornerType | undefined => CORNER_TYPES.find((c) => c.id === id);

export const cornerTypesFor = (use: EdgeUse) => CORNER_TYPES.filter((c) => c.uses.includes(use));

// ---------------------------------------------------------------------------
// Ustawienia projektu
// ---------------------------------------------------------------------------

export interface FinishingSettings {
  /** Masa do spoinowania */
  compound: string;
  /** Taśma spoinowa */
  tape: JointTape['id'];
  /** Domyślne wykończenie krawędzi */
  external: string;
  externalOdd: string;
  internal: string;
  internalOdd: string;
  opening: string;
  /** Styk ściany z istniejącym murem */
  masonry: string;
  /** Styk ściany ze stropem */
  slab: string;
  /** Obwód sufitu przy ścianach */
  ceilingEdge: string;
}

export const DEFAULT_FINISHING: FinishingSettings = {
  compound: 'vario',
  tape: 'paper',
  external: 'alu-perf',
  externalOdd: 'nocoat',
  internal: 'paper-tape',
  internalOdd: 'nocoat',
  opening: 'alu-perf',
  masonry: 'separating',
  slab: 'separating',
  ceilingEdge: 'separating',
};

export const resolveFinishing = (f?: Partial<FinishingSettings>): FinishingSettings => ({ ...DEFAULT_FINISHING, ...f });

export const compoundById = (id: string) => COMPOUNDS.find((c) => c.id === id) ?? COMPOUNDS[0];
export const tapeById = (id: string) => TAPES.find((t) => t.id === id) ?? TAPES[0];
