// Wykończenie suchej zabudowy: spoinowanie (poziom Q1), narożniki i styki z murem / stropem.
//
// Zakres aplikacji to poziom Q1 wg Rigips: wypełnienie spoin, zatopienie taśmy w masie
// i druga, szersza warstwa po związaniu pierwszej, plus szpachlowanie łbów wkrętów.
// Gładzie (Q2–Q4) nie są liczone.
//
// Źródła zużycia mas: karty techniczne Rigips VARIO (09.2025, ok. 0,25 kg/m²),
// Rifino Top (0,3 kg/m² spoiny), ProMix Mega (ok. 0,4 kg/m² spoinowanie) i Premium Light
// (09.2025, trzykrotne szpachlowanie ok. 0,40 kg/m²); Knauf Uniflott (K4604, 03.2026),
// Uniflott impregnowany (K4605) i G-K Start (K469a) – tabele zużycia wg liczby warstw płyt;
// Norgips Start i Start & Finish (norgips.pl, karty techniczne); Siniat Nida Start, Finish,
// Duo i Max (broszura „Gipsy” 02.2024, instrukcja „Spoinowanie krawędzi płyt g-k”).
// Zużycie przy narożnikach i stykach to wartości orientacyjne z praktyki montażowej.

import type { Board, Maker, Product } from './rigips';

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
  MASA_PREMIUM_LIGHT: {
    id: 'MASA_PREMIUM_LIGHT',
    name: 'Lekka masa gotowa Rigips Premium Light',
    group: 'Wykończenie',
    unit: 'kg',
    pack: 21,
    packUnit: 'opak.',
  },
  MASA_UNIFLOTT: { id: 'MASA_UNIFLOTT', name: 'Masa szpachlowa Knauf Uniflott', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_UNIFLOTT_IMP: {
    id: 'MASA_UNIFLOTT_IMP',
    name: 'Masa szpachlowa Knauf Uniflott impregnowany',
    group: 'Wykończenie',
    unit: 'kg',
    pack: 5,
    packUnit: 'worek',
  },
  MASA_GK_START: { id: 'MASA_GK_START', name: 'Masa szpachlowa Knauf G-K Start', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_NORGIPS_START: { id: 'MASA_NORGIPS_START', name: 'Masa szpachlowa Norgips Start', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_NORGIPS_SF: {
    id: 'MASA_NORGIPS_SF',
    name: 'Masa gotowa Norgips Start & Finish',
    group: 'Wykończenie',
    unit: 'kg',
    pack: 20,
    packUnit: 'opak.',
  },
  MASA_NIDA_START: { id: 'MASA_NIDA_START', name: 'Masa szpachlowa Siniat Nida Start', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_NIDA_FINISH: { id: 'MASA_NIDA_FINISH', name: 'Masa szpachlowa Siniat Nida Finish', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_NIDA_DUO: { id: 'MASA_NIDA_DUO', name: 'Masa szpachlowa Siniat Nida Duo', group: 'Wykończenie', unit: 'kg', pack: 25, packUnit: 'worek' },
  MASA_NIDA_MAX: { id: 'MASA_NIDA_MAX', name: 'Masa szpachlowa Siniat Nida Max', group: 'Wykończenie', unit: 'kg', pack: 20, packUnit: 'worek' },
  TASMA_SPOIN: { id: 'TASMA_SPOIN', name: 'Taśma spoinowa papierowa Rigips', group: 'Wykończenie', unit: 'mb', pack: 75, packUnit: 'rolka' },
  // Taśmy kompozytowe Tuff-Tape (Center-Flex): rolki 10 / 20 / 30 mb wersji czerwonej, 20 mb pozostałych
  // Długość rolki taśm Knauf i Siniat nie jest podana na stronach producentów – lista zakupów w mb
  TASMA_KURT: { id: 'TASMA_KURT', name: 'Taśma do spoinowania Knauf Kurt', group: 'Wykończenie', unit: 'mb' },
  TASMA_NIDA: { id: 'TASMA_NIDA', name: 'Taśma zbrojąca Siniat Nida', group: 'Wykończenie', unit: 'mb' },
  TASMA_NORGIPS_FIZ: {
    id: 'TASMA_NORGIPS_FIZ',
    name: 'Taśma fizelinowa Norgips 52 mm',
    group: 'Wykończenie',
    unit: 'mb',
    pack: 76,
    packUnit: 'rolka',
  },
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
  /** Producent – domyślnie masę dobiera się do producenta systemu */
  maker: Maker;
  product: string;
  name: string;
  /** Zużycie na spoinowanie (Q1), kg na m² płyty (warstwa zewnętrzna), wg karty technicznej */
  kgPerM2: number;
  /** Zużycie na każdą kolejną (wewnętrzną) warstwę płyt, kg/m²; brak = jak kgPerM2 */
  innerKgPerM2?: number;
  /** Druga masa systemu (warstwa wykończeniowa spoiny), tylko na warstwie zewnętrznej */
  finish?: { product: string; kgPerM2: number };
  /** Spoiny fabrycznych krawędzi bez taśmy (taśma tylko w kątach wewnętrznych) */
  noTape?: boolean;
  kind: 'sucha' | 'gotowa';
  info: string;
}

export const COMPOUNDS: JointCompound[] = [
  {
    id: 'vario',
    maker: 'rigips',
    product: 'MASA',
    name: 'Rigips Vario',
    kgPerM2: 0.25,
    kind: 'sucha',
    info: 'Masa gipsowa wzmocniona polimerami (EN 13963 4B), worki 5 / 12,5 / 25 kg, czas pracy ok. 60 min. Zużycie ok. 0,25 kg/m².',
  },
  {
    id: 'rifino',
    maker: 'rigips',
    product: 'MASA_RIFINO',
    name: 'Rigips Rifino Top',
    kgPerM2: 0.3,
    kind: 'sucha',
    info: 'Masa gipsowa (EN 13963 3B), worki 5 / 12,5 / 25 kg, czas pracy 45–60 min, zalecana też do narożników No-Coat. Zużycie 0,3 kg/m².',
  },
  {
    id: 'promix',
    maker: 'rigips',
    product: 'MASA_PROMIX',
    name: 'Rigips ProMix Mega',
    kgPerM2: 0.4,
    kind: 'gotowa',
    info: 'Masa gotowa do użycia (EN 13963 3A), wiadra 5 / 15 / 25 kg, schnie na powietrzu – każda warstwa musi wyschnąć. Zużycie ok. 0,4 kg/m².',
  },
  {
    id: 'premium-light',
    maker: 'rigips',
    product: 'MASA_PREMIUM_LIGHT',
    name: 'Rigips Premium Light',
    kgPerM2: 0.4,
    kind: 'gotowa',
    info: 'Lekka masa gotowa (EN 13963, typ 3A), wiadra 7 / 21 kg, do wstępnego i finiszowego szpachlowania spoin z taśmą papierową lub fizeliną, bardzo dobra do narożników Habito No-Coat. Warstwa do 2 mm, schnie ok. 12 h (20 °C), praca od +5 do +30 °C. Zużycie przy trzykrotnym szpachlowaniu spoin ok. 0,40 kg/m²; jako gładź ok. 1,2 kg/m² na 1 mm (gładź nie jest liczona).',
  },
  {
    id: 'uniflott',
    maker: 'knauf',
    product: 'MASA_UNIFLOTT',
    name: 'Knauf Uniflott',
    kgPerM2: 0.25,
    innerKgPerM2: 0.15,
    kind: 'sucha',
    info: 'Masa na bazie gipsu alfa (EN 13963 4B), worki 5 / 25 kg, czas obróbki ok. 45 min. Fabryczne krawędzie HRK / HRAK na ruszcie systemowym bez taśmy, krawędzie AK i cięte z taśmą Kurt. Karta K4604: płyta 12,5 mm ok. 0,25 kg/m² na stronę (sufit 0,3), 2 × 12,5 mm ok. 0,4 kg/m².',
  },
  {
    id: 'uniflott-imp',
    maker: 'knauf',
    product: 'MASA_UNIFLOTT_IMP',
    name: 'Knauf Uniflott impregnowany',
    kgPerM2: 0.25,
    innerKgPerM2: 0.15,
    kind: 'sucha',
    info: 'Hydrofobowa, zielona masa do płyt impregnowanych w pomieszczeniach wilgotnych, worki 5 kg. Zużycie jak Uniflott (karta K4605): ok. 0,25 kg/m² na stronę przy jednej płycie 12,5 mm, ok. 0,4 kg/m² przy dwóch.',
  },
  {
    id: 'gk-start',
    maker: 'knauf',
    product: 'MASA_GK_START',
    name: 'Knauf G-K Start',
    kgPerM2: 0.3,
    innerKgPerM2: 0.2,
    kind: 'sucha',
    info: 'Gipsowa masa do spoinowania z taśmą zbrojącą (EN 13963), worki 25 kg. Karta K469a: 1 warstwa płyty 0,3 kg/m², 2 warstwy 0,5 kg/m², 4 warstwy 1 kg/m².',
  },
  {
    id: 'norgips-start',
    maker: 'norgips',
    product: 'MASA_NORGIPS_START',
    name: 'Norgips Start',
    kgPerM2: 0.2,
    kind: 'sucha',
    info: 'Gipsowa masa konstrukcyjna (EN 13963 1B) do spoinowania z taśmą papierową lub fizelinową (Q1), także w przegrodach ogniochronnych, worki 25 kg, czas obróbki 60 min. Zużycie wg kalkulatora systemów Norgips 0,2 kg/m² na warstwę płyt (karta produktu: 0,15 kg/m² samej warstwy Q1).',
  },
  {
    id: 'norgips-sf',
    maker: 'norgips',
    product: 'MASA_NORGIPS_SF',
    name: 'Norgips Start & Finish',
    kgPerM2: 0.2,
    kind: 'gotowa',
    info: 'Masa gotowa dwufunkcyjna (EN 13963 3A), wiaderka 3,7 / 20 kg, warstwa do 3 mm. Kalkulator systemów Norgips: 0,2 kg/m² na warstwę płyt; karta: spoiny z taśmą (Q1) 0,15 kg/m², finisz spoin (Q2) 0,10 kg/m², cała powierzchnia 1,1 kg/m² na 1 mm (Q2–Q4 nie są liczone).',
  },
  {
    id: 'nida-start-finish',
    maker: 'siniat',
    product: 'MASA_NIDA_START',
    name: 'Siniat Nida Start + Nida Finish',
    kgPerM2: 0.3,
    finish: { product: 'MASA_NIDA_FINISH', kgPerM2: 0.1 },
    kind: 'sucha',
    info: 'System Siniat: Nida Start (worki 25 kg) do wypełnienia spoin i zatopienia taśmy zbrojącej, potem Nida Finish (worki 25 kg) na warstwę wykończeniową spoiny. Instrukcja Siniat na 1 m² płyty: Nida Start 0,3 kg, Nida Finish 0,1 kg, taśma 1,2 m.',
  },
  {
    id: 'nida-duo',
    maker: 'siniat',
    product: 'MASA_NIDA_DUO',
    name: 'Siniat Nida Duo',
    kgPerM2: 0.45,
    kind: 'sucha',
    info: 'Masa do spoinowania wstępnego i końcowego wszystkich typów płyt g-k z taśmą papierową lub z włókna szklanego, worki 5 / 25 kg. Zużycie ok. 0,30 kg/m² (wstępne) + 0,15 kg/m² (końcowe).',
  },
  {
    id: 'nida-max',
    maker: 'siniat',
    product: 'MASA_NIDA_MAX',
    name: 'Siniat Nida Max (bez taśmy)',
    kgPerM2: 0.2,
    noTape: true,
    kind: 'sucha',
    info: 'Masa do spoinowania fabrycznych krawędzi bez taśmy, worki 5 / 20 kg. Krawędzie cięte i spoiny narażone na naprężenia zbroić taśmą lub fizeliną. Zużycie ok. 0,20 kg/m².',
  },
];

export interface JointTape {
  id: string;
  /** Producent; brak = taśma uniwersalna */
  maker?: Maker;
  product: string;
  name: string;
  info: string;
}

export const TAPES: JointTape[] = [
  {
    id: 'paper',
    maker: 'rigips',
    product: 'TASMA_SPOIN',
    name: 'Taśma papierowa Rigips',
    info: 'Standard Rigips – zatapiana w świeżej masie, najwyższa wytrzymałość spoiny. Rolka 75 mb.',
  },
  {
    id: 'kurt',
    maker: 'knauf',
    product: 'TASMA_KURT',
    name: 'Taśma Knauf Kurt',
    info: 'Taśma zbrojąca do spoinowania z masą Uniflott (karta K4604): krawędzie AK, cięte i mieszane. Długości rolki nie podano – ilość w mb.',
  },
  {
    id: 'norgips-fleece',
    maker: 'norgips',
    product: 'TASMA_NORGIPS_FIZ',
    name: 'Taśma fizelinowa Norgips',
    info: 'Włóknina szklana 52 mm, rolka 76 mb – spoiny podłużne i poprzeczne, wtapiana w masę konstrukcyjną (np. Norgips Start).',
  },
  {
    id: 'nida',
    maker: 'siniat',
    product: 'TASMA_NIDA',
    name: 'Taśma zbrojąca Siniat Nida',
    info: 'Taśma zbrojąca do systemu Nida Start + Finish (ok. 1,2 m na 1 m² płyty wg instrukcji Siniat). Długości rolki nie podano – ilość w mb.',
  },
  {
    id: 'tuff',
    product: 'TASMA_TUFF',
    name: 'Tuff-Tape',
    info: 'Tuff-Tape czerwona Center-Flex 57 mm – taśma kompozytowa zamiast papierowej: nie marszczy się, odporna na wilgoć, dobra na spoiny poprzeczne i kąty wewnętrzne.',
  },
];

/** Wybór „wg producenta systemu” – masa i taśma producenta danej ściany, sufitu lub poddasza */
export const AUTO = 'auto';

/** Domyślna masa i taśma producenta (ATLAS nie ma tu własnych – jak Rigips) */
export const MAKER_FINISHING: Record<Maker, { compound: string; tape: string }> = {
  rigips: { compound: 'vario', tape: 'paper' },
  knauf: { compound: 'uniflott', tape: 'kurt' },
  norgips: { compound: 'norgips-start', tape: 'norgips-fleece' },
  siniat: { compound: 'nida-start-finish', tape: 'nida' },
  atlas: { compound: 'vario', tape: 'paper' },
};

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
  /** Masa do spoinowania; `auto` = wg producenta systemu */
  compound: string;
  /** Taśma spoinowa */
  tape: string;
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
  compound: AUTO,
  tape: AUTO,
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

/** Masa do spoinowania elementu danego producenta (brak producenta = Rigips) */
export const compoundFor = (f: Pick<FinishingSettings, 'compound'>, maker: Maker = 'rigips') =>
  compoundById(f.compound === AUTO ? MAKER_FINISHING[maker].compound : f.compound);

/** Taśma spoinowa elementu danego producenta */
export const tapeFor = (f: Pick<FinishingSettings, 'tape'>, maker: Maker = 'rigips') =>
  tapeById(f.tape === AUTO ? MAKER_FINISHING[maker].tape : f.tape);
