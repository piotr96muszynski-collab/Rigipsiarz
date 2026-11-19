// Katalog materiałów i systemów suchej zabudowy marki Rigips (oraz osobny system
// ATLAS M-SYSTEM 3G, dołączany z `atlas.ts`).
//
// Dane systemów pochodzą z kart systemowych Rigips Polska (Saint-Gobain), których
// adresy są podane w polu `source` każdego systemu. Tam, gdzie karta nie była
// dostępna, parametry są oznaczone jako orientacyjne (`source.approx = true`) –
// przyjęto typowe wartości z wytycznych montażowych. Przed zamówieniem do obiektów
// z wymaganiami ogniowymi lub akustycznymi zawsze sprawdź aktualną kartę systemu.

import { CORNER_STOCK_LENGTHS, FINISHING_PRODUCTS } from './finishing';
import { RIGIPS_WALLS } from './rigips.gen';
import { ATLAS_CEILING_SYSTEMS, ATLAS_PRODUCTS, ATLAS_WALL_SYSTEMS, type PointFixer } from './atlas';
import { NORGIPS_BOARDS, NORGIPS_CEILING_SYSTEMS, NORGIPS_WALL_SYSTEMS } from './norgips';

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
  ...CORNER_STOCK_LENGTHS,
};

// ---------------------------------------------------------------------------
// Źródła
// ---------------------------------------------------------------------------

export interface Source {
  label: string;
  url?: string;
  /** true = brak karty systemu w źródłach, wartości orientacyjne */
  approx?: boolean;
}

const card = (code: string, url: string): Source => ({ label: `Karta systemu Rigips ${code}`, url });
const APPROX: Source = {
  label: 'Wartości orientacyjne wg typowych wytycznych montażowych Rigips (brak karty w źródłach aplikacji)',
  approx: true,
};

export const SOURCES = {
  W_34001: card('3.40.01 (wariant 3.40.013)', 'https://www.rigips.pl/media/29587/file/download'),
  W_34005: card('3.40.05', 'https://www.rigips.pl/media/33916/file/download'),
  W_340051: card('3.40.051', 'https://www.rigips.pl/media/33917/file/download'),
  W_34101: card('3.41.01', 'https://www.rigips.pl/media/29738/file/download'),
  W_341011: card('3.41.011', 'https://www.rigips.pl/media/29740/file/download'),
  C_40583: card('4.05.83', 'https://www.rigips.pl/media/29491/file/download'),
  C_40523: card('4.05.23 AKU', 'https://www.rigips.pl/media/29226/file/download'),
  C_40571: card('4.05.71 AKU', 'https://www.rigips.pl/media/33475/file/download'),
  C_47003: card('4.70.03', 'https://www.rigips.pl/sites/default/files/media_assets/dokument/stiboprod/ORIGINAL/4.70.03.pdf'),
  C_47006: card('4.70.06', 'https://www.rigips.pl/sites/default/files/media_assets/dokument/stiboprod/ORIGINAL/4.70.06.pdf'),
  KSR_SUFITY: {
    label: 'Katalog Rozwiązań Systemowych Rigips 2019, rozdz. 7 Sufity podwieszane',
    url: 'https://www.rigips.pl/sites/default/files/2020-03/07_Sufity_podwieszane_KSR_2019.pdf',
  },
} satisfies Record<string, Source>;

/** Zużycie z karty systemu, na 1 m² (do porównania z wyliczeniem aplikacji) */
export interface RefLine {
  /** Id produktu z katalogu (gdy da się przypisać) */
  product?: string;
  label: string;
  qty: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Płyty
// ---------------------------------------------------------------------------

export type BoardKind = 'gips' | 'cement';

export interface Board {
  id: string;
  name: string;
  short: string;
  /** Oznaczenie wg PN-EN 520 / potoczne (GKB, GKF…) */
  type: string;
  thickness: number; // mm
  width: number; // cm
  lengths: number[]; // cm
  description: string;
  color: string;
  kind?: BoardKind;
  custom?: boolean;
  /** Producent (brak = Rigips) */
  maker?: Maker;
  /** Odporność na wilgoć: humid = pomieszczenia wilgotne (łazienka, kuchnia), wet = strefy mokre */
  moisture?: 'humid' | 'wet';
  /** Płyta o podwyższonej twardości – szafki i półki na samych wkrętach (Habito, Duraline) */
  hard?: boolean;
  /** Wkręty inne niż TN (wg kalkulatora Rigips): Habito, HartFix (Duraline, Aku), Rigidur, Glasroc F Ridurit, Aquaroc (X Ocean) */
  screws?: 'habito' | 'hartfix' | 'rigidur' | 'ridurit' | 'aquaroc';
}

export const BOARDS: Board[] = [
  {
    id: 'RB12.5',
    name: 'Rigips PRO 12,5 (GKB, typ A)',
    short: 'GKB',
    type: 'A (GKB)',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 275, 300],
    description: 'Płyta standardowa do pomieszczeń suchych',
    color: '#e8e4da',
  },
  {
    id: 'RB15',
    name: 'Rigips PRO 15 (GKB, typ A)',
    short: 'GKB 15',
    type: 'A (GKB)',
    thickness: 15,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta standardowa 15 mm – sztywniejsza, lepsza akustyka',
    color: '#ded9cc',
  },
  {
    id: 'RBI12.5',
    name: 'Rigips PRO Hydro 12,5 (GKBI, typ H2)',
    short: 'GKBI',
    type: 'H2 (GKBI)',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta impregnowana do łazienek i kuchni (wilgotność okresowo do 85%)',
    color: '#b9d8b0',
    moisture: 'humid',
  },
  {
    id: 'RF12.5',
    name: 'Rigips PRO Fire 12,5 (GKF, typ F)',
    short: 'GKF',
    type: 'F (GKF)',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta o zwiększonej odporności ogniowej',
    color: '#f2b8b0',
  },
  {
    id: 'RF15',
    name: 'Rigips PRO Fire 15 (GKF, typ F)',
    short: 'GKF 15',
    type: 'F (GKF)',
    thickness: 15,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta ogniochronna 15 mm do przegród o wyższej klasie EI',
    color: '#eaa79e',
  },
  {
    id: 'RFP12.5',
    name: 'Rigips PRO Fire+ 12,5 (typ DF)',
    short: 'Fire+',
    type: 'DF',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta ogniochronna o zwiększonej gęstości (ściany i sufity EI)',
    color: '#f5a3a3',
  },
  {
    id: 'RFI12.5',
    name: 'Rigips PRO Fire+ Hydro 12,5 (GKFI, typ DFH2)',
    short: 'GKFI',
    type: 'DFH2 (GKFI)',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta ogniochronna i impregnowana',
    color: '#e6c9a8',
    moisture: 'humid',
  },
  {
    id: 'AKU12.5',
    name: 'Rigips PRO Aku 12,5 (typ A, akustyczna)',
    short: 'Aku',
    type: 'A',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260, 300],
    description: 'Płyta o podwyższonej izolacyjności akustycznej',
    color: '#d8d0e8',
    screws: 'hartfix',
  },
  {
    id: 'HABITO12.5',
    name: 'Rigips Habito 12,5 (typ DEFIR)',
    short: 'Habito',
    type: 'DEFIR',
    thickness: 12.5,
    width: 120,
    lengths: [260, 300],
    description: 'Płyta o podwyższonej twardości, można wieszać szafki bez kołków',
    color: '#c9d4e6',
    hard: true,
    screws: 'habito',
  },
  {
    id: 'HABITOH12.5',
    name: 'Rigips Habito H 12,5 (typ DEFH1IR)',
    short: 'Habito H',
    type: 'DEFH1IR',
    thickness: 12.5,
    width: 120,
    lengths: [260, 300],
    description: 'Habito impregnowana – twarda płyta do łazienek i kuchni',
    color: '#a9c6d8',
    hard: true,
    screws: 'habito',
    moisture: 'humid',
  },
  {
    id: 'AQUAROC12.5',
    name: 'Rigips Aquaroc 12,5 (płyta cementowa)',
    short: 'Aquaroc',
    type: 'cementowa',
    thickness: 12.5,
    width: 120,
    lengths: [240],
    description: 'Płyta cementowa do stref mokrych (prysznice, pralnie). Format sprawdź w sklepie',
    color: '#bfc3c7',
    kind: 'cement',
    moisture: 'wet',
  },
  // --- płyty dodane z kalkulatora Rigips (formaty z nazw produktów na rigips.pl) ---
  {
    id: 'RFP15',
    name: 'Rigips PRO Fire+ 15 (typ DF)',
    short: 'Fire+ 15',
    type: 'DF',
    thickness: 15,
    width: 120,
    lengths: [200, 260],
    description: 'Płyta ogniochronna 15 mm – wyższe klasy EI przy jednej warstwie',
    color: '#ef8f8f',
  },
  {
    id: 'RFI15',
    name: 'Rigips PRO Fire+ Hydro 15 (GKFI, typ DFH2)',
    short: 'GKFI 15',
    type: 'DFH2 (GKFI)',
    thickness: 15,
    width: 120,
    lengths: [260],
    description: 'Płyta ogniochronna i impregnowana 15 mm',
    color: '#dcb890',
    moisture: 'humid',
  },
  {
    id: 'AKUF12.5',
    name: 'Rigips PRO Aku Fire+ Hydro 12,5 (typ DFH2)',
    short: 'Aku Fire+ H',
    type: 'DFH2',
    thickness: 12.5,
    width: 120,
    lengths: [200],
    description: 'Płyta akustyczna, ogniochronna i impregnowana',
    color: '#c4b8e0',
    moisture: 'humid',
    screws: 'hartfix',
  },
  {
    id: 'DURA12.5',
    name: 'Rigips PRO Duraline 12,5 (typ DFIREH1)',
    short: 'Duraline',
    type: 'DFIREH1',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260],
    description: 'Płyta o podwyższonej twardości i odporności na uderzenia, impregnowana, ogniochronna',
    color: '#b9c7a8',
    moisture: 'humid',
    hard: true,
    screws: 'hartfix',
  },
  {
    id: 'XOCEAN12.5',
    name: 'Rigips Glasroc X Ocean 12,5 (typ GM-FH1)',
    short: 'X Ocean',
    type: 'GM-FH1',
    thickness: 12.5,
    width: 120,
    lengths: [200, 260],
    description: 'Płyta gipsowa z matą szklaną do pomieszczeń mokrych (prysznice, pralnie, baseny)',
    color: '#8fc4d6',
    moisture: 'wet',
    screws: 'aquaroc',
  },
  {
    id: 'RIGIDUR10',
    name: 'Rigips Rigidur H 10 (płyta gipsowo-włóknowa)',
    short: 'Rigidur 10',
    type: 'GF-C1-I-W2',
    thickness: 10,
    width: 120,
    lengths: [250, 300],
    description: 'Płyta gipsowo-włóknowa o dużej twardości (arkusz 1195 mm szerokości)',
    color: '#cfc8b8',
    hard: true,
    screws: 'rigidur',
  },
  {
    id: 'RIGIDUR12.5',
    name: 'Rigips Rigidur H 12,5 (płyta gipsowo-włóknowa)',
    short: 'Rigidur',
    type: 'GF-C1-I-W2',
    thickness: 12.5,
    width: 120,
    lengths: [250, 260, 300],
    description: 'Płyta gipsowo-włóknowa o dużej twardości (arkusz 1195 mm szerokości)',
    color: '#c4bca8',
    hard: true,
    screws: 'rigidur',
  },
  {
    id: 'RIDURIT25',
    name: 'Rigips Glasroc F Ridurit 25 (typ GM-F)',
    short: 'Ridurit 25',
    type: 'GM-F',
    thickness: 25,
    width: 120,
    lengths: [200],
    description: 'Płyta ogniochronna z matą szklaną do obudów szachtów EI 120',
    color: '#e6d9c2',
    screws: 'ridurit',
  },
  ...NORGIPS_BOARDS,
];

// ---------------------------------------------------------------------------
// Produkty
// ---------------------------------------------------------------------------

export const PRODUCTS: Record<string, Product> = {
  // Profile ścienne
  CW50: { id: 'CW50', name: 'Profil Rigips CW 50', group: 'Profile', unit: 'szt.', length: 3 },
  CW75: { id: 'CW75', name: 'Profil Rigips CW 75', group: 'Profile', unit: 'szt.', length: 3 },
  CW100: { id: 'CW100', name: 'Profil Rigips CW 100', group: 'Profile', unit: 'szt.', length: 3 },
  CW75AKU: { id: 'CW75AKU', name: 'Profil Rigips CW 75 Aku (akustyczny)', group: 'Profile', unit: 'szt.', length: 3 },
  CW100AKU: { id: 'CW100AKU', name: 'Profil Rigips CW 100 Aku (akustyczny)', group: 'Profile', unit: 'szt.', length: 3 },
  UW50: { id: 'UW50', name: 'Profil Rigips UW 50', group: 'Profile', unit: 'szt.', length: 4 },
  UW75: { id: 'UW75', name: 'Profil Rigips UW 75', group: 'Profile', unit: 'szt.', length: 4 },
  UW100: { id: 'UW100', name: 'Profil Rigips UW 100', group: 'Profile', unit: 'szt.', length: 4 },
  UA50: { id: 'UA50', name: 'Profil usztywniający UA 50', group: 'Profile', unit: 'szt.', length: 3 },
  UA75: { id: 'UA75', name: 'Profil usztywniający UA 75', group: 'Profile', unit: 'szt.', length: 3 },
  UA100: { id: 'UA100', name: 'Profil usztywniający UA 100', group: 'Profile', unit: 'szt.', length: 3 },
  KATUA: { id: 'KATUA', name: 'Kątownik przyłączeniowy do UA', group: 'Mocowanie', unit: 'szt.' },
  // Profile sufitowe
  CD60: { id: 'CD60', name: 'Profil Rigips CD 60', group: 'Profile', unit: 'szt.', length: 4 },
  UD30: { id: 'UD30', name: 'Profil Rigips UD 30', group: 'Profile', unit: 'szt.', length: 3 },
  // Akcesoria sufitowe
  WIESZAK_NONIUSZ: {
    id: 'WIESZAK_NONIUSZ',
    name: 'Wieszak noniuszowy CD 60 (górny + dolny)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  ZAWLECZKA: { id: 'ZAWLECZKA', name: 'Klamra zabezpieczająca (zawleczka) do wieszaka noniuszowego', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_ES: { id: 'WIESZAK_ES', name: 'Wieszak (uchwyt) bezpośredni ES do CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  UCHWYT_ELAST: {
    id: 'UCHWYT_ELAST',
    name: 'Uchwyt elastyczny do CD 60 (poddasze)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
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
  LACZNIK_UA_CD: {
    id: 'LACZNIK_UA_CD',
    name: 'Łącznik krzyżowy CD 60 / UA 50',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  KATOWNIK_UA: {
    id: 'KATOWNIK_UA',
    name: 'Kątownik specjalny 85×40×2 do UA 50',
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
  TN55: { id: 'TN55', name: 'Wkręt do płyt TN 3,5×55', group: 'Mocowanie', unit: 'szt.', pack: 500, packUnit: 'opak.' },
  TN70: { id: 'TN70', name: 'Wkręt do płyt TN 3,9×70', group: 'Mocowanie', unit: 'szt.', pack: 250, packUnit: 'opak.' },
  AQ25: { id: 'AQ25', name: 'Wkręt Aquaroc Interior HB 25 mm', group: 'Mocowanie', unit: 'szt.', pack: 500, packUnit: 'opak.' },
  AQ35: { id: 'AQ35', name: 'Wkręt Aquaroc Interior HB 3,5×41', group: 'Mocowanie', unit: 'szt.', pack: 500, packUnit: 'opak.' },
  // wkręty do płyt specjalnych (nazwy i opakowania z kalkulatora Rigips)
  HABITO26: { id: 'HABITO26', name: 'Wkręt Habito 4,2×26', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  HABITO41: { id: 'HABITO41', name: 'Wkręt Habito 4,2×41', group: 'Mocowanie', unit: 'szt.', pack: 800, packUnit: 'opak.' },
  HARTFIX25: { id: 'HARTFIX25', name: 'Wkręt HartFix 3,9×25 (Duraline)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  HARTFIX35: { id: 'HARTFIX35', name: 'Wkręt HartFix 3,8×35 (Duraline)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  HARTFIX45: { id: 'HARTFIX45', name: 'Wkręt HartFix 3,8×45 (Duraline)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  RIGIDUR30: { id: 'RIGIDUR30', name: 'Wkręt Rigidur 3,5×30', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  RIGIDUR40: { id: 'RIGIDUR40', name: 'Wkręt Rigidur 3,5×40', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  RIDURIT40: { id: 'RIDURIT40', name: 'Wkręt Glasroc F (Ridurit) 3,5×40', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  RIDURIT50: { id: 'RIDURIT50', name: 'Wkręt Glasroc F (Ridurit) 3,5×50', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  RIDURIT70: { id: 'RIDURIT70', name: 'Wkręt Glasroc F (Ridurit) 3,5×70', group: 'Mocowanie', unit: 'szt.', pack: 500, packUnit: 'opak.' },
  LN9: { id: 'LN9', name: 'Wkręt do profili LN 3,5×9 (pchełka)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
  // Wykończenie
  TASMA_USZ50: { id: 'TASMA_USZ50', name: 'Taśma uszczelniająca 50 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ70: { id: 'TASMA_USZ70', name: 'Taśma uszczelniająca 70 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ95: { id: 'TASMA_USZ95', name: 'Taśma uszczelniająca 95 mm', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  TASMA_USZ30: { id: 'TASMA_USZ30', name: 'Taśma uszczelniająca 30 mm (pod UD)', group: 'Wykończenie', unit: 'mb', pack: 30, packUnit: 'rolka' },
  // gładź (Q2+) – poza zakresem wyliczeń (spoinowanie liczone do Q1), zostaje dla porównań z kartami
  MASA_WYK: { id: 'MASA_WYK', name: 'Masa szpachlowa wykończeniowa (gotowa)', group: 'Wykończenie', unit: 'kg', pack: 20, packUnit: 'opak.' },
  MASA_AQ: { id: 'MASA_AQ', name: 'Masa do spoinowania płyt Aquaroc', group: 'Wykończenie', unit: 'kg', pack: 20, packUnit: 'worek' },
  TASMA_AQ: { id: 'TASMA_AQ', name: 'Taśma z siatki do płyt Aquaroc', group: 'Wykończenie', unit: 'mb', pack: 50, packUnit: 'rolka' },
  KLEJ: { id: 'KLEJ', name: 'Klej gipsowy do płyt g-k', group: 'Mocowanie', unit: 'kg', pack: 25, packUnit: 'worek' },
  // Izolacja
  WELNA50: { id: 'WELNA50', name: 'Wełna mineralna 50 mm', group: 'Izolacja', unit: 'm²' },
  WELNA75: { id: 'WELNA75', name: 'Wełna mineralna 75 mm', group: 'Izolacja', unit: 'm²' },
  WELNA100: { id: 'WELNA100', name: 'Wełna mineralna 100 mm', group: 'Izolacja', unit: 'm²' },
  WELNA150: { id: 'WELNA150', name: 'Wełna mineralna 150 mm', group: 'Izolacja', unit: 'm²' },
  // masy, taśmy spoinowe, narożniki i materiały na styki – src/catalog/finishing.ts
  ...FINISHING_PRODUCTS,
  ...ATLAS_PRODUCTS,
};

/** Stare identyfikatory produktów (zapisane ceny i odhaczenia) → nowe */
export const PRODUCT_ALIASES: Record<string, string> = { UD27: 'UD30' };

// ---------------------------------------------------------------------------
// Systemy ścian
// ---------------------------------------------------------------------------

export type WallCategory = 'działowa' | 'podwójna' | 'instalacyjna' | 'okładzina' | 'szacht' | 'atlas';

/**
 * Rodzaj konstrukcji:
 * - single: jeden rząd słupków CW w UW
 * - double: dwa rzędy CW obok siebie (ściany międzylokalowe, akustyczne)
 * - separate: dwa rzędy CW rozsunięte, połączone paskami płyty (ściana instalacyjna)
 * - cd-lining: okładzina na profilach CD 60 i uchwytach ES mocowanych do ściany
 * - glued: płyta klejona do ściany na placki z kleju gipsowego (suchy tynk)
 * - point-fix: płyta na łącznikach talerzykowych ATLAS M-SYSTEM 3G (bez profili)
 */
export type WallFrame = 'single' | 'double' | 'separate' | 'cd-lining' | 'glued' | 'point-fix';

export const WALL_CATEGORY_LABEL: Record<WallCategory, string> = {
  działowa: 'Ściany działowe – pojedynczy ruszt',
  podwójna: 'Ściany na podwójnym ruszcie',
  instalacyjna: 'Ściany instalacyjne',
  okładzina: 'Okładziny ścian',
  szacht: 'Obudowy szachtów i instalacji',
  atlas: 'ATLAS M-System 3G – okładziny istniejących ścian na łącznikach (bez profili)',
};

export const WALL_FRAME_LABEL: Record<WallFrame, string> = {
  single: 'pojedynczy ruszt CW',
  double: 'podwójny ruszt CW',
  separate: 'podwójny ruszt rozsunięty (instalacyjny)',
  'cd-lining': 'ruszt CD 60 na uchwytach ES',
  glued: 'płyta klejona (bez rusztu)',
  'point-fix': 'łączniki ATLAS M-SYSTEM 3G (bez profili)',
};

export type StudSpacing = 60 | 40 | 30;

/** Producent systemu (brak pola = Rigips; systemy ATLAS mają kategorię „atlas”) */
export type Maker = 'rigips' | 'norgips' | 'knauf' | 'atlas';

export const MAKER_LABEL: Record<Maker, string> = { rigips: 'Rigips', norgips: 'Norgips', knauf: 'Knauf', atlas: 'ATLAS' };

/**
 * Odmiana systemu z karty producenta: ta sama konstrukcja z inną płytą (klasa EI, akustyka)
 * albo z gęstszymi / podwójnymi słupkami (większa wysokość). Wartości wyłącznie z karty –
 * pola, których karta nie podaje, zostają puste. Służy do doboru systemu po wymaganiach.
 */
export interface SystemVariant {
  /** Numer systemu producenta dla tej odmiany (np. 3.40.011) */
  code?: string;
  /** Opis poszycia z karty, np. „1×12,5 Fire+ typ DF” */
  label: string;
  /** Id płyty z BOARDS (warstwa zewnętrzna); brak = odmiana dotyczy każdej płyty systemu */
  board?: string;
  /** Płyty dopuszczone na warstwy wewnętrzne (systemy z dwoma rodzajami płyt), od najtańszej */
  innerBoards?: string[];
  /** Rozstaw słupków / profili, cm; brak = jak w systemie */
  studSpacing?: StudSpacing;
  /** Słupki podwójne (2×CW zespolone) */
  doubleStuds?: boolean;
  /** Maksymalna wysokość ściany, cm */
  maxHeight?: number;
  /** Klasa odporności ogniowej EI w minutach (brak = nieokreślona) */
  fire?: number;
  /** Izolacyjność akustyczna, dB */
  rw?: number;
  ra1?: number;
  /** Wymagana grubość wełny, mm (0 = bez wełny) */
  wool?: number;
  /** Grubość całej przegrody / zabudowy, mm */
  thickness?: number;
  /** Masa, kg/m² */
  mass?: number;
  /** Cena katalogowa producenta, zł/m² (orientacyjna, do porównywania odmian) */
  price?: number;
}

export interface WallSystem {
  id: string;
  /** Oznaczenie systemu Rigips (np. 3.40.05), jeśli jest */
  code?: string;
  name: string;
  category: WallCategory;
  frame: WallFrame;
  /** Szerokość profilu CW/UW, mm (dla CD i klejenia nieistotna) */
  profile: 50 | 75 | 100;
  /** Liczba warstw płyt na jednej stronie */
  layers: number;
  /** 2 = ściana działowa, 1 = obudowa / okładzina jednostronna */
  sides: 1 | 2;
  defaultBoard: string;
  /** Inna płyta na warstwach wewnętrznych (np. PRO pod Habito); liczba tych warstw w `innerLayers` */
  innerBoard?: string;
  innerLayers?: number;
  /** Słupki z profili akustycznych CW Aku */
  akuStuds?: boolean;
  /** Domyślny rozstaw słupków / profili CD, cm */
  studSpacing: StudSpacing;
  /** Maksymalna wysokość, cm, wg rozstawu słupków */
  maxHeight?: Partial<Record<StudSpacing, number>>;
  insulationDefault: boolean;
  /** Odporność ogniowa / izolacyjność akustyczna wg karty */
  fire?: string;
  acoustic?: string;
  /** Rozstaw uchwytów ES na profilu CD (okładziny), cm */
  bracketSpacing?: number;
  /** Szerokość przestrzeni między rusztami (ściana instalacyjna), cm */
  gap?: number;
  /** Mocowanie punktowe (ATLAS M-SYSTEM 3G): łącznik; rozstaw poziomy = studSpacing */
  fixer?: PointFixer;
  /** Rozstaw łączników w pionie (mocowanie punktowe), cm */
  pointSpacing?: number;
  info: string;
  source: Source;
  reference?: RefLine[];
  custom?: boolean;
  /** Producent (brak = Rigips) */
  maker?: Maker;
  /** true = system podstawowy (widoczny od razu); pozostałe są pod „Pozostałe systemy” */
  basic?: boolean;
  /** Odmiany z karty producenta (płyta, rozstaw, EI, akustyka, wysokość) */
  variants?: SystemVariant[];
}

/** Systemy opisane ręcznie: bez karty Rigips (wartości orientacyjne) oraz ATLAS M-System */
const HAND_WALLS: WallSystem[] = [
  // --- pojedynczy ruszt ---
  {
    id: 'W-CW75-1HAB',
    name: 'Ściana CW 75, 1×Habito 12,5 obustronnie',
    category: 'działowa',
    frame: 'single',
    profile: 75,
    layers: 1,
    sides: 2,
    defaultBoard: 'HABITO12.5',
    studSpacing: 60,
    maxHeight: { 60: 400 },
    insulationDefault: true,
    info: 'Twarda płyta – szafki i półki wiesza się wkrętami bez kołków',
    source: APPROX,
  },
  // --- podwójny ruszt ---
  // --- instalacyjne ---
  {
    id: 'W-INST-CW50-2',
    name: 'Ściana instalacyjna 2×CW 50 rozsunięte, 2×12,5',
    category: 'instalacyjna',
    frame: 'separate',
    profile: 50,
    layers: 2,
    sides: 2,
    defaultBoard: 'RBI12.5',
    studSpacing: 60,
    maxHeight: { 60: 400 },
    gap: 10,
    insulationDefault: false,
    info: 'Przestrzeń na rury między rusztami · rzędy CW łączone paskami płyty co ok. 1/3 wysokości',
    source: APPROX,
  },
  {
    id: 'W-INST-CW75-2',
    name: 'Ściana instalacyjna 2×CW 75 rozsunięte, 2×12,5',
    category: 'instalacyjna',
    frame: 'separate',
    profile: 75,
    layers: 2,
    sides: 2,
    defaultBoard: 'RBI12.5',
    studSpacing: 60,
    maxHeight: { 60: 500 },
    gap: 10,
    insulationDefault: false,
    info: 'Na stelaże podtynkowe i piony · rzędy CW łączone paskami płyty',
    source: APPROX,
  },
  // --- okładziny ---
  // --- szachty ---
  {
    id: 'SZ-CD-2F',
    name: 'Obudowa pionu na CD 60, 2×GKF 12,5',
    category: 'szacht',
    frame: 'cd-lining',
    profile: 50,
    layers: 2,
    sides: 1,
    defaultBoard: 'RF12.5',
    studSpacing: 60,
    bracketSpacing: 100,
    insulationDefault: false,
    info: 'Niewielkie obudowy rur w narożniku – profile CD z UD 30',
    source: APPROX,
  },
  ...ATLAS_WALL_SYSTEMS,
  ...NORGIPS_WALL_SYSTEMS,
];

/** Systemy podstawowe – widoczne od razu; reszta katalogu jest pod „Pozostałe systemy” i w wyszukiwarce */
const BASIC_WALLS = new Set([
  'W-CW50-1',
  'W-CW75-1',
  'W-CW75-2',
  'W-CW100-1',
  'W-CW100-2',
  'W-2CW50-2',
  'W-INST-CW50-2',
  'O-CW50-1',
  'O-CD-1',
  'O-KLEJ',
  'SZ-CW50-2',
  'A-W-L100',
]);

/** Identyfikatory z wcześniejszych wersji katalogu (zapisane projekty) → obecne systemy */
export const WALL_SYSTEM_ALIASES: Record<string, string> = {
  'W-CW50-1F': 'W-CW50-1',
  'W-CW75-2-40': 'W-CW75-2',
  'W-CW75-2RF': 'W-CW75-2',
  'W-CW75-2RBI': 'W-CW75-2',
  'W-CW75-1AQ': 'W-CW75-1AQUAROC',
  'SZ-CW50-2F': 'SZ-CW50-2',
  'SZ-CW75-2F': 'SZ-CW75-2',
};

const CATEGORY_ORDER: WallCategory[] = ['działowa', 'podwójna', 'instalacyjna', 'okładzina', 'szacht', 'atlas'];
/** Płyty standardowe PRO (A, Hydro, Fire, Fire+) – systemy z nimi stoją w katalogu przed specjalnymi */
const isStandardBoard = (id: string) => /^R(B|BI|F|FP|FI)\d/.test(id);
const MAKER_ORDER: Maker[] = ['rigips', 'norgips', 'knauf', 'atlas'];
/** Klucz kolejności: kategoria, producent, podstawowe, płyty standardowe, rodzaj rusztu, profil, liczba warstw */
const wallOrder = (s: WallSystem): number[] => [
  CATEGORY_ORDER.indexOf(s.category),
  MAKER_ORDER.indexOf(s.maker ?? 'rigips'),
  s.basic ? 0 : 1,
  isStandardBoard(s.defaultBoard) && !s.innerBoard && !s.akuStuds ? 0 : 1,
  s.frame === 'glued' ? 0 : s.frame === 'cd-lining' ? 1 : 2,
  s.profile,
  s.layers,
];
const byKey = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

/**
 * Katalog ścian: konstrukcje z kart Rigips (src/catalog/rigips.gen.ts – generowane z danych rigips.pl)
 * oraz systemy opisane ręcznie. Kolejność: kategoria, podstawowe, płyty standardowe, profil, liczba warstw.
 */
export const WALL_SYSTEMS: WallSystem[] = [...RIGIPS_WALLS, ...HAND_WALLS]
  .map((s) => (BASIC_WALLS.has(s.id) ? { ...s, basic: true } : s))
  .map((s, i) => ({ s, k: [...(s.maker && s.maker !== 'rigips' ? [CATEGORY_ORDER.indexOf(s.category), MAKER_ORDER.indexOf(s.maker)] : wallOrder(s)), i] }))
  .sort((a, b) => byKey(a.k, b.k))
  .map((x) => x.s);

// ---------------------------------------------------------------------------
// Systemy sufitów
// ---------------------------------------------------------------------------

/**
 * - two-level: ruszt krzyżowy dwupoziomowy CD 60 na wieszakach (noniusz)
 * - one-level: ruszt CD 60 jednopoziomowy (łączniki jednopoziomowe)
 * - direct: CD 60 na uchwytach bezpośrednich (ES, elastyczne) tuż pod stropem
 * - ua-span: sufit przęsłowy – UA 50 opartymi na ścianach + CD 60 (bez wieszaków)
 * - cw-span: sufit przęsłowy (samonośny) na CW/UW opartych na ścianach
 * - point-fix: płyta na łącznikach ATLAS M-SYSTEM 3G w siatce mainSpacing × secondarySpacing
 */
export type CeilingKind = 'two-level' | 'one-level' | 'direct' | 'ua-span' | 'cw-span' | 'point-fix';

export const CEILING_KIND_LABEL: Record<CeilingKind, string> = {
  'two-level': 'Sufity podwieszane CD 60 – ruszt dwupoziomowy',
  'one-level': 'Sufity podwieszane CD 60 – ruszt jednopoziomowy',
  direct: 'Okładziny sufitów na uchwytach bezpośrednich',
  'ua-span': 'Sufity przęsłowe na UA 50 (bez wieszaków)',
  'cw-span': 'Sufity przęsłowe na CW/UW (bez wieszaków)',
  'point-fix': 'ATLAS M-System 3G – sufity na łącznikach (bez profili)',
};

export type HangerType = 'noniusz' | 'es' | 'elastic';

export interface CeilingSystem {
  id: string;
  code?: string;
  name: string;
  kind: CeilingKind;
  layers: number;
  defaultBoard: string;
  /** Rozstaw profili nośnych (górnych / UA), cm */
  mainSpacing: number;
  /** Rozstaw profili montażowych (dolnych CD) lub CW w suficie przęsłowym, cm */
  secondarySpacing: number;
  /** Rozstaw wieszaków na profilu nośnym, cm */
  hangerSpacing: number;
  hangerType?: HangerType;
  /** Profil CW/UW sufitu przęsłowego */
  profile?: 50 | 75 | 100;
  /** Maksymalna rozpiętość sufitu przęsłowego, cm */
  maxSpan?: number;
  /** Mocowanie punktowe (ATLAS M-SYSTEM 3G) */
  fixer?: PointFixer;
  /** Wkręty na m²: warstwa zewnętrzna i każda wewnętrzna */
  screwsOuter: number;
  screwsInner: number;
  fire?: string;
  info: string;
  source: Source;
  reference?: RefLine[];
  custom?: boolean;
  /** Producent (brak = Rigips) */
  maker?: Maker;
  /** true = system podstawowy (widoczny od razu); pozostałe są pod „Pozostałe systemy” */
  basic?: boolean;
  /** Odmiany z karty producenta (płyta, EI, akustyka) */
  variants?: SystemVariant[];
  /** Zabudowa poddasza (skosy, jętki) – mocowanie do krokwi */
  attic?: boolean;
}

const ceilingRefCommon = (layers: number): RefLine[] => [
  { product: 'MASA', label: 'Masa konstrukcyjna', qty: 0.25 * layers, unit: 'kg' },
  { product: 'MASA_WYK', label: 'Masa wykończeniowa', qty: 0.1, unit: 'kg' },
];

/** Rozpiętości sufitu przęsłowego CW/UW wg karty 4.05.71 (bez dodatkowego obciążenia), cm */
export const CW_SPAN_TABLE: Record<50 | 75 | 100, Record<40 | 50, [number, number, number]>> = {
  50: { 40: [212, 182, 164], 50: [185, 159, 144] },
  75: { 40: [309, 266, 240], 50: [270, 232, 210] },
  100: { 40: [370, 318, 287], 50: [323, 278, 251] },
};

export function cwSpanLimit(profile: 50 | 75 | 100, spacing: number, layers: number): number {
  const row = CW_SPAN_TABLE[profile][spacing <= 40 ? 40 : 50];
  const base = row[Math.min(3, Math.max(1, layers)) - 1];
  // przy rozstawie > 50 cm karta nie podaje wartości – zmniejszamy proporcjonalnie
  return spacing > 50 ? Math.round((base * 50) / spacing) : base;
}

/** Rozpiętości sufitu przęsłowego UA 50 wg karty 4.05.83 (bez obciążenia), cm, wg liczby warstw */
export const UA_SPAN_BY_LAYERS: Record<number, number> = { 1: 229, 2: 193, 3: 190 };

const cwSpanSystem = (profile: 50 | 75 | 100, layers: number): CeilingSystem => ({
  id: `S-CW${profile}-${layers}`,
  code: '4.05.71',
  name: `Sufit przęsłowy CW ${profile}, ${layers}×12,5`,
  kind: 'cw-span',
  layers,
  defaultBoard: 'RB12.5',
  mainSpacing: 50,
  secondarySpacing: 50,
  hangerSpacing: 0,
  profile,
  maxSpan: cwSpanLimit(profile, 50, layers),
  screwsOuter: 14,
  screwsInner: 6,
  info: `CW ${profile} co 50 cm oparte na UW przy ścianach · bez wieszaków · rozpiętość do ${(cwSpanLimit(profile, 50, layers) / 100).toFixed(2).replace('.', ',')} m (przy rozstawie 40 cm: ${(cwSpanLimit(profile, 40, layers) / 100).toFixed(2).replace('.', ',')} m – ustaw w systemie własnym)`,
  source: SOURCES.C_40571,
  reference: [
    { label: 'Płyta', qty: layers, unit: 'm²' },
    { product: `CW${profile}`, label: `Profil CW ${profile}`, qty: 2, unit: 'mb' },
    { product: `UW${profile}`, label: `Profil UW ${profile}`, qty: 0.8, unit: 'mb' },
    { label: 'Wkręty zewn. warstwy', qty: 14, unit: 'szt.' },
    { product: 'LN9', label: 'Nit / wkręt „pchełka”', qty: 1.6, unit: 'szt.' },
    { label: 'Stalowe elementy mocujące', qty: 2, unit: 'szt.' },
    { label: 'Taśma uszczelniająca', qty: 0.8, unit: 'mb' },
    { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
    ...ceilingRefCommon(layers),
  ],
});

const cdRef = (o: {
  boards: number;
  cd: number;
  hangers: number;
  cross: number;
  crossLabel: string;
  crossProduct: string;
  long: number;
  tn25: number;
  tn35?: number;
  anchors: number;
  clips: number;
}): RefLine[] => [
  { label: 'Płyta', qty: o.boards, unit: 'm²' },
  { product: 'CD60', label: 'Profil CD 60', qty: o.cd, unit: 'mb' },
  { product: 'UD30', label: 'Profil UD 30', qty: 0.4, unit: 'mb' },
  { product: 'WIESZAK_NONIUSZ', label: 'Wieszak noniuszowy (dolny + część górna)', qty: o.hangers, unit: 'szt.' },
  { product: 'ZAWLECZKA', label: 'Klamra zabezpieczająca', qty: o.clips, unit: 'szt.' },
  { product: o.crossProduct, label: o.crossLabel, qty: o.cross, unit: 'szt.' },
  { product: 'LACZNIK_WZDL', label: 'Łącznik wzdłużny CD 60', qty: o.long, unit: 'szt.' },
  { product: 'TN25', label: o.tn35 ? 'Wkręt TN 25 (1. warstwa)' : 'Wkręt TN 25', qty: o.tn25, unit: 'szt.' },
  ...(o.tn35 ? [{ product: 'TN35', label: 'Wkręt TN 35 (2. warstwa)', qty: o.tn35, unit: 'szt.' }] : []),
  { label: 'Kołki, dyble (wieszaki + UD)', qty: o.anchors, unit: 'szt.' },
  { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 0.4, unit: 'mb' },
  { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
  ...ceilingRefCommon(o.boards),
];

const KRZ = { crossProduct: 'LACZNIK_KRZ', crossLabel: 'Łącznik krzyżowy CD 60' };
const POPR = { crossProduct: 'LACZNIK_JEDNO', crossLabel: 'Łącznik poprzeczny (jednopoziomowy) CD 60' };

export const CEILING_SYSTEMS: CeilingSystem[] = [
  {
    id: 'S-CD-2P-1',
    code: '4.05.24',
    name: 'Sufit podwieszany dwupoziomowy CD 60, 1×12,5',
    kind: 'two-level',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 100,
    secondarySpacing: 50,
    hangerSpacing: 90,
    hangerType: 'noniusz',
    screwsOuter: 14,
    screwsInner: 6.5,
    info: 'Ruszt krzyżowy: nośne CD co 100 cm, montażowe CD co 50 cm, wieszaki noniuszowe co 90 cm',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 1, cd: 3.2, hangers: 1.2, clips: 2.4, cross: 2.2, ...KRZ, long: 0.6, tn25: 13.8, anchors: 1.7 }),
  },
  {
    id: 'S-CD-2P-2',
    code: '4.05.24',
    name: 'Sufit podwieszany dwupoziomowy CD 60, 2×12,5',
    kind: 'two-level',
    layers: 2,
    defaultBoard: 'RB12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 75,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    info: 'Ruszt krzyżowy pod dwie warstwy: nośne co 100 cm, montażowe co 40 cm, wieszaki co 75 cm',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 2, cd: 3.7, hangers: 1.5, clips: 3, cross: 2.8, ...KRZ, long: 0.6, tn25: 6.5, tn35: 17, anchors: 2 }),
  },
  {
    id: 'S-CD-2P-1F',
    code: '4.10.13',
    name: 'Sufit ogniochronny dwupoziomowy CD 60, 1×GKF 12,5',
    kind: 'two-level',
    layers: 1,
    defaultBoard: 'RF12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 90,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 15',
    info: 'Nośne co 100 cm, montażowe co 40 cm, wieszaki co 90 cm · wkręty co 15 cm',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 1, cd: 3.7, hangers: 1.2, clips: 2.4, cross: 2.9, ...KRZ, long: 0.6, tn25: 17, anchors: 1.7 }),
  },
  {
    id: 'S-CD-2P-2F',
    code: '4.10.15',
    name: 'Sufit ogniochronny dwupoziomowy CD 60, 2×GKF 12,5',
    kind: 'two-level',
    layers: 2,
    defaultBoard: 'RF12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 70,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 30',
    info: 'Nośne co 100 cm, montażowe co 40 cm, wieszaki co 70 cm',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 2, cd: 3.7, hangers: 1.5, clips: 3, cross: 2.9, ...KRZ, long: 0.6, tn25: 6.5, tn35: 17, anchors: 2 }),
  },
  {
    id: 'S-CD-2P-2x15F',
    code: '4.10.17',
    name: 'Sufit ogniochronny dwupoziomowy CD 60, 2×GKF 15',
    kind: 'two-level',
    layers: 2,
    defaultBoard: 'RF15',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 70,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'wyższe klasy EI wg karty',
    info: 'Nośne co 100 cm, montażowe co 40 cm, wieszaki co 70 cm · wkręty 25 i 45 mm',
    source: SOURCES.KSR_SUFITY,
  },
  {
    id: 'S-CD-2P-3F',
    code: '4.10.19',
    name: 'Sufit ogniochronny dwupoziomowy CD 60, 3×GKF 12,5',
    kind: 'two-level',
    layers: 3,
    defaultBoard: 'RF12.5',
    mainSpacing: 75,
    secondarySpacing: 40,
    hangerSpacing: 60,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'wysokie klasy EI wg karty',
    info: 'Ciężki sufit: nośne co 75 cm, montażowe co 40 cm, wieszaki co 60 cm',
    source: SOURCES.KSR_SUFITY,
  },
  {
    id: 'S-CD-1P-1',
    code: '4.05.25',
    name: 'Sufit jednopoziomowy CD 60, 1×12,5',
    kind: 'one-level',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 120,
    secondarySpacing: 40,
    hangerSpacing: 90,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    info: 'Profile w jednej płaszczyźnie: nośne co 120 cm, montażowe co 40 cm, wieszaki co 90 cm · niższa zabudowa',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 1, cd: 3.4, hangers: 0.9, clips: 1.8, cross: 4.1, ...POPR, long: 0.15, tn25: 17, anchors: 1.4 }),
  },
  {
    id: 'S-CD-1P-2',
    code: '4.05.25',
    name: 'Sufit jednopoziomowy CD 60, 2×12,5',
    kind: 'one-level',
    layers: 2,
    defaultBoard: 'RB12.5',
    mainSpacing: 120,
    secondarySpacing: 40,
    hangerSpacing: 75,
    hangerType: 'noniusz',
    screwsOuter: 18,
    screwsInner: 6.5,
    info: 'Ruszt jednopoziomowy pod dwie warstwy: nośne co 120 cm, montażowe co 40 cm, wieszaki co 75 cm',
    source: SOURCES.KSR_SUFITY,
    reference: cdRef({ boards: 2, cd: 3.4, hangers: 1.1, clips: 2.1, cross: 4.1, ...POPR, long: 0.6, tn25: 6.5, tn35: 18, anchors: 1.5 }),
  },
  {
    id: 'S-CD-1P-1F',
    code: '4.10.14',
    name: 'Sufit ogniochronny jednopoziomowy CD 60, 1×GKF 12,5',
    kind: 'one-level',
    layers: 1,
    defaultBoard: 'RF12.5',
    mainSpacing: 120,
    secondarySpacing: 40,
    hangerSpacing: 90,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 15',
    info: 'Nośne co 120 cm, montażowe co 40 cm, wieszaki co 90 cm',
    source: SOURCES.KSR_SUFITY,
  },
  {
    id: 'S-CD-1P-2F',
    code: '4.10.16',
    name: 'Sufit ogniochronny jednopoziomowy CD 60, 2×GKF 12,5',
    kind: 'one-level',
    layers: 2,
    defaultBoard: 'RF12.5',
    mainSpacing: 120,
    secondarySpacing: 40,
    hangerSpacing: 70,
    hangerType: 'noniusz',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 30',
    info: 'Nośne co 120 cm, montażowe co 40 cm, wieszaki co 70 cm',
    source: SOURCES.KSR_SUFITY,
  },
  {
    id: 'S-ES-1',
    code: '4.05.23',
    name: 'Okładzina sufitu CD 60 na uchwytach ES, 1×12,5',
    kind: 'direct',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 40,
    secondarySpacing: 40,
    hangerSpacing: 100,
    hangerType: 'es',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 15 z płytą Fire+',
    info: 'Profile CD co 40 cm mocowane uchwytami ES co max 100 cm tuż pod stropem lub do belek',
    source: SOURCES.C_40523,
    reference: [
      { label: 'Płyta', qty: 1, unit: 'm²' },
      { product: 'CD60', label: 'Profil CD 60', qty: 2.5, unit: 'mb' },
      { product: 'UD30', label: 'Profil UD 30', qty: 0.4, unit: 'mb' },
      { product: 'WIESZAK_ES', label: 'Uchwyt ES', qty: 2.5, unit: 'szt.' },
      { product: 'LACZNIK_WZDL', label: 'Łącznik wzdłużny CD 60', qty: 0.6, unit: 'szt.' },
      { product: 'TN25', label: 'Wkręt 25 mm', qty: 17, unit: 'szt.' },
      { product: 'LN9', label: 'Wkręt „pchełka”', qty: 10, unit: 'szt.' },
      { label: 'Stalowe elementy mocujące', qty: 6.5, unit: 'szt.' },
      { product: 'TASMA_USZ30', label: 'Taśma uszczelniająca 30 mm', qty: 0.4, unit: 'mb' },
      { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
      ...ceilingRefCommon(1),
    ],
  },
  {
    id: 'S-ES-2',
    code: '4.05.23',
    name: 'Okładzina sufitu CD 60 na uchwytach ES, 2×12,5',
    kind: 'direct',
    layers: 2,
    defaultBoard: 'RFP12.5',
    mainSpacing: 40,
    secondarySpacing: 40,
    hangerSpacing: 100,
    hangerType: 'es',
    screwsOuter: 17,
    screwsInner: 6.5,
    fire: 'EI 30 z płytami Fire+',
    info: 'Uchwyty ES co max 100 cm, dwie warstwy płyt, profile CD co 40 cm',
    source: SOURCES.C_40523,
    reference: [
      { label: 'Płyta', qty: 2, unit: 'm²' },
      { product: 'CD60', label: 'Profil CD 60', qty: 2.5, unit: 'mb' },
      { product: 'WIESZAK_ES', label: 'Uchwyt ES', qty: 2.5, unit: 'szt.' },
      { product: 'TN25', label: 'Wkręt 25 mm (1. warstwa)', qty: 6.5, unit: 'szt.' },
      { product: 'TN35', label: 'Wkręt 35 mm (2. warstwa)', qty: 17, unit: 'szt.' },
      { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
      ...ceilingRefCommon(2),
    ],
  },
  {
    id: 'S-PODD-1',
    code: '4.70.06',
    name: 'Poddasze: CD 60 na uchwytach elastycznych, 1×12,5',
    kind: 'direct',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 40,
    secondarySpacing: 40,
    hangerSpacing: 60,
    hangerType: 'elastic',
    screwsOuter: 25,
    screwsInner: 10,
    fire: 'REI 60 w układzie z karty',
    info: 'Skosy i jętki: CD co 40 cm, uchwyty elastyczne do krokwi co ok. 60 cm (ok. 4 szt./m² wg karty)',
    source: SOURCES.C_47006,
    reference: [
      { label: 'Płyta', qty: 1, unit: 'm²' },
      { product: 'CD60', label: 'Profil CD 60', qty: 3.2, unit: 'mb' },
      { product: 'UD30', label: 'Profil UD 30', qty: 0.4, unit: 'mb' },
      { product: 'UCHWYT_ELAST', label: 'Uchwyt elastyczny', qty: 4, unit: 'szt.' },
      { product: 'TN25', label: 'Wkręt TN 25', qty: 25, unit: 'szt.' },
      { product: 'LN9', label: 'Wkręt „pchełka”', qty: 16, unit: 'szt.' },
      { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.4, unit: 'mb' },
      ...ceilingRefCommon(1),
    ],
  },
  {
    id: 'S-PODD-2',
    code: '4.70.06',
    name: 'Poddasze: CD 60 na uchwytach elastycznych, 2×12,5',
    kind: 'direct',
    layers: 2,
    defaultBoard: 'RF12.5',
    mainSpacing: 40,
    secondarySpacing: 40,
    hangerSpacing: 60,
    hangerType: 'elastic',
    screwsOuter: 25,
    screwsInner: 10,
    fire: 'REI 60 w układzie z karty',
    info: 'Skosy z dwiema warstwami płyt (np. GKF)',
    source: SOURCES.C_47006,
  },
  {
    id: 'S-UA-1',
    code: '4.05.83',
    name: 'Sufit przęsłowy UA 50 + CD 60, 1×12,5',
    kind: 'ua-span',
    layers: 1,
    defaultBoard: 'RB12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 0,
    maxSpan: UA_SPAN_BY_LAYERS[1],
    screwsOuter: 17,
    screwsInner: 6.5,
    info: 'UA 50 co 100 cm oparte na ścianach (kątowniki 85×40), CD 60 pod spodem · bez wieszaków · rozpiętość do 2,29 m',
    source: SOURCES.C_40583,
    reference: [
      { label: 'Płyta', qty: 1, unit: 'm²' },
      { product: 'CD60', label: 'Profil CD 60', qty: 3.2, unit: 'mb' },
      { product: 'UD30', label: 'Profil UD 30', qty: 0.4, unit: 'mb' },
      { product: 'UA50', label: 'Profil UA 50 (co 100 cm)', qty: 1.2, unit: 'mb' },
      { product: 'LACZNIK_UA_CD', label: 'Łącznik krzyżowy CD/UA', qty: 6.4, unit: 'szt.' },
      { product: 'TN25', label: 'Wkręt TN 25', qty: 17, unit: 'szt.' },
      { label: 'Stalowe elementy mocujące', qty: 5, unit: 'szt.' },
      { product: 'KATOWNIK_UA', label: 'Kątownik specjalny 85×40×2', qty: 0.2, unit: 'szt.' },
      { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
      ...ceilingRefCommon(1),
    ],
  },
  {
    id: 'S-UA-2',
    code: '4.05.83',
    name: 'Sufit przęsłowy UA 50 + CD 60, 2×12,5',
    kind: 'ua-span',
    layers: 2,
    defaultBoard: 'RB12.5',
    mainSpacing: 100,
    secondarySpacing: 40,
    hangerSpacing: 0,
    maxSpan: UA_SPAN_BY_LAYERS[2],
    screwsOuter: 17,
    screwsInner: 6.5,
    info: 'Jak wyżej, dwie warstwy płyt · rozpiętość do 1,93 m',
    source: SOURCES.C_40583,
  },
  cwSpanSystem(50, 1),
  cwSpanSystem(75, 1),
  cwSpanSystem(75, 2),
  cwSpanSystem(100, 1),
  cwSpanSystem(100, 2),
  ...ATLAS_CEILING_SYSTEMS,
  ...NORGIPS_CEILING_SYSTEMS,
];

// ---------------------------------------------------------------------------
// Systemy własne użytkownika (przechowywane lokalnie, wczytywane przy starcie)
// ---------------------------------------------------------------------------

export interface CustomCatalog {
  walls: WallSystem[];
  ceilings: CeilingSystem[];
}

let custom: CustomCatalog = { walls: [], ceilings: [] };

/** Podmienia listę systemów własnych (wywołuje App po wczytaniu/zmianie) */
export function setCustomSystems(c: CustomCatalog) {
  custom = {
    walls: c.walls.map((s) => ({ ...s, custom: true })),
    ceilings: c.ceilings.map((s) => ({ ...s, custom: true })),
  };
}
export const customSystems = (): CustomCatalog => custom;

export const allWallSystems = (): WallSystem[] => [...WALL_SYSTEMS, ...custom.walls];
export const allCeilingSystems = (): CeilingSystem[] => [...CEILING_SYSTEMS, ...custom.ceilings];

export const boardById = (id: string): Board => BOARDS.find((b) => b.id === id) ?? BOARDS[0];
const WALL_BY_ID = new Map(WALL_SYSTEMS.map((s) => [s.id, s]));
export const wallSystemById = (id: string): WallSystem =>
  WALL_BY_ID.get(id) ?? custom.walls.find((s) => s.id === id) ?? WALL_BY_ID.get(WALL_SYSTEM_ALIASES[id]) ?? WALL_BY_ID.get('W-CW75-1')!;
export const ceilingSystemById = (id: string): CeilingSystem =>
  CEILING_SYSTEMS.find((s) => s.id === id) ?? custom.ceilings.find((s) => s.id === id) ?? CEILING_SYSTEMS[0];

/**
 * Maksymalna wysokość ściany (cm) dla danego rozstawu słupków lub undefined, gdy brak danych.
 * Bez `opts`: wartość z tabeli systemu (płyta domyślna). Z płytą lub słupkami podwójnymi: największa
 * wysokość wśród odmian z karty z tą płytą, o rozstawie nie gęstszym niż wybrany.
 */
export function wallMaxHeight(sys: WallSystem, spacing: number, opts: { board?: string; doubleStuds?: boolean } = {}): number | undefined {
  if (sys.variants?.length && (opts.board || opts.doubleStuds)) {
    const board = opts.board ?? sys.defaultBoard;
    const forBoard = sys.variants.filter((v) => v.board === board);
    const pool = forBoard.length ? forBoard : sys.variants.filter((v) => !v.board || v.board === sys.defaultBoard);
    const ok = pool.filter((v) => v.maxHeight && (v.studSpacing ?? sys.studSpacing) >= spacing && !!v.doubleStuds === !!opts.doubleStuds);
    if (ok.length) return Math.max(...ok.map((v) => v.maxHeight!));
    // słupki podwójne bez osobnej odmiany w karcie → co najmniej tyle, co pojedyncze
    if (opts.doubleStuds) return wallMaxHeight(sys, spacing, { board: opts.board });
  }
  const mh = sys.maxHeight;
  if (!mh) return undefined;
  const exact = mh[spacing as StudSpacing];
  if (exact) return exact;
  // gęstszy rozstaw niż podany w karcie → co najmniej wartość dla rzadszego
  const known = (Object.entries(mh) as [string, number][])
    .map(([s, h]) => [Number(s), h] as const)
    .filter(([s]) => s >= spacing)
    .sort((a, b) => a[0] - b[0]);
  return known[0]?.[1];
}

/** Maksymalna rozpiętość sufitu przęsłowego (cm) */
export function ceilingMaxSpan(sys: CeilingSystem): number | undefined {
  if (sys.kind === 'cw-span' && sys.profile) return cwSpanLimit(sys.profile, sys.secondarySpacing, sys.layers);
  if (sys.kind === 'ua-span') return sys.maxSpan ?? UA_SPAN_BY_LAYERS[Math.min(3, sys.layers)];
  return undefined;
}

/** Okładzina istniejącej ściany (jednostronna, mocowana do muru): CD na ES, klej gipsowy, ATLAS M-System 3G */
export const isLiningSystem = (sys: WallSystem): boolean =>
  sys.sides === 1 && (sys.frame === 'cd-lining' || sys.frame === 'glued' || sys.frame === 'point-fix');

/** Grubość rusztu ściany, mm (bez płyt) */
export function wallFrameDepth(sys: WallSystem): number {
  switch (sys.frame) {
    case 'double':
      return sys.profile * 2 + 5;
    case 'separate':
      return sys.profile * 2 + (sys.gap ?? 10) * 10;
    case 'cd-lining':
      return 27 + 10;
    case 'glued':
      return 10;
    case 'point-fix':
      // średni odstęp płyty od podłoża dla wybranego łącznika
      return sys.fixer ? Math.round((sys.fixer.standoff[0] + sys.fixer.standoff[1]) / 2) : 30;
    default:
      return sys.profile;
  }
}
