// Katalog materiałów i systemów suchej zabudowy marki Rigips (oraz osobny system
// ATLAS M-SYSTEM 3G, dołączany z `atlas.ts`).
//
// Dane systemów pochodzą z kart systemowych Rigips Polska (Saint-Gobain), których
// adresy są podane w polu `source` każdego systemu. Tam, gdzie karta nie była
// dostępna, parametry są oznaczone jako orientacyjne (`source.approx = true`) –
// przyjęto typowe wartości z wytycznych montażowych. Przed zamówieniem do obiektów
// z wymaganiami ogniowymi lub akustycznymi zawsze sprawdź aktualną kartę systemu.

import { CORNER_STOCK_LENGTHS, FINISHING_PRODUCTS } from './finishing';
import { VAPOR_PRODUCTS } from './vaporBarrier';
import { RIGIPS_CEILINGS, RIGIPS_WALLS } from './rigips.gen';
import { ATLAS_CEILING_SYSTEMS, ATLAS_PRODUCTS, ATLAS_WALL_SYSTEMS, type PointFixer } from './atlas';
import { NORGIPS_BOARDS, NORGIPS_CEILING_SYSTEMS, NORGIPS_WALL_SYSTEMS } from './norgips';
import { KNAUF_BOARDS, KNAUF_CEILING_SYSTEMS, KNAUF_WALL_SYSTEMS } from './knauf';
import { SINIAT_BOARDS, SINIAT_CEILING_SYSTEMS, SINIAT_WALL_SYSTEMS } from './siniat';

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
  // UA: długości handlowe z kalkulatora Rigips (UA 50 do 4,5 m, UA 75/100 do 6,8 m) – słupków UA się nie łączy
  UA: [3, 2.6, 3.5, 4, 4.5, 5, 5.5, 6, 6.4, 6.8],
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
  ...KNAUF_BOARDS,
  ...SINIAT_BOARDS,
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
  SRUBA_M8: { id: 'SRUBA_M8', name: 'Śruba M8 z nakrętką (do profili UA)', group: 'Mocowanie', unit: 'szt.' },
  PWA: { id: 'PWA', name: 'Przewiązka wibroakustyczna (Nida PWA) do kotwienia słupków do ściany', group: 'Mocowanie', unit: 'szt.' },
  // Profile sufitowe
  CD60: { id: 'CD60', name: 'Profil Rigips CD 60', group: 'Profile', unit: 'szt.', length: 4 },
  UD30: { id: 'UD30', name: 'Profil Rigips UD 30', group: 'Profile', unit: 'szt.', length: 3 },
  // Ruszty zabudowy poddaszy inne niż CD 60 (karty Rigips 4.70.01–4.71.12, Norgips ZP)
  KAPELUSZ: { id: 'KAPELUSZ', name: 'Profil kapeluszowy 15/48 mm', group: 'Profile', unit: 'szt.', length: 4 },
  C_RIGISTIL: { id: 'C_RIGISTIL', name: 'Profil C RIGISTIL (główny sufitowy)', group: 'Profile', unit: 'szt.', length: 4 },
  U_RIGISTIL: { id: 'U_RIGISTIL', name: 'Profil U RIGISTIL (przyścienny)', group: 'Profile', unit: 'szt.', length: 4 },
  LATA5030: { id: 'LATA5030', name: 'Łata drewniana 50×30 mm', group: 'Profile', unit: 'szt.', length: 4 },
  LATA6040: { id: 'LATA6040', name: 'Łata drewniana 60×40 mm', group: 'Profile', unit: 'szt.', length: 4 },
  LATA6050: { id: 'LATA6050', name: 'Łata drewniana 60×50 mm', group: 'Profile', unit: 'szt.', length: 4 },
  // Akcesoria sufitowe
  WIESZAK_KLICK: { id: 'WIESZAK_KLICK', name: 'Wieszak bezpośredni „Klick-Fix” do CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_RIGISTIL: {
    id: 'WIESZAK_RIGISTIL',
    name: 'Wieszak RIGISTIL do profili C RIGISTIL – do konstrukcji drewnianej (170 lub 300 mm)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  UCHWYT_GL: { id: 'UCHWYT_GL', name: 'Uchwyt bezpośredni GL 2 (75 mm) / GL 9 (125 mm) do profili C RIGISTIL', group: 'Akcesoria do sufitów', unit: 'szt.' },
  LACZNIK_GL3: { id: 'LACZNIK_GL3', name: 'Łącznik wzdłużny GL 3 do profili C RIGISTIL', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_PLASKI: {
    id: 'WIESZAK_PLASKI',
    name: 'Wieszak płaski L-180 / L-270 lub wieszak do poddaszy L-350 do CD 60 (Norgips)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  WIESZAK_NONIUSZ: {
    id: 'WIESZAK_NONIUSZ',
    name: 'Wieszak noniuszowy CD 60 (górny + dolny)',
    group: 'Akcesoria do sufitów',
    unit: 'szt.',
  },
  ZAWLECZKA: { id: 'ZAWLECZKA', name: 'Klamra zabezpieczająca (zawleczka) do wieszaka noniuszowego', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_ES: { id: 'WIESZAK_ES', name: 'Wieszak (uchwyt) bezpośredni ES do CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WIESZAK_PODD: { id: 'WIESZAK_PODD', name: 'Wieszak do poddaszy do CD 60', group: 'Akcesoria do sufitów', unit: 'szt.' },
  WKRET_DREWNO: {
    id: 'WKRET_DREWNO',
    name: 'Wkręt do drewna do mocowania rusztu i wieszaków do krokwi (min. ø 5,5 mm wg kart Rigips 4.70)',
    group: 'Mocowanie',
    unit: 'szt.',
    pack: 100,
    packUnit: 'opak.',
  },
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
  TD35: { id: 'TD35', name: 'Wkręt do płyt TD 3,5×35 (do łat drewnianych)', group: 'Mocowanie', unit: 'szt.', pack: 1000, packUnit: 'opak.' },
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
  ...VAPOR_PRODUCTS,
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
export type Maker = 'rigips' | 'norgips' | 'knauf' | 'siniat' | 'atlas';

export const MAKER_LABEL: Record<Maker, string> = { rigips: 'Rigips', norgips: 'Norgips', knauf: 'Knauf', siniat: 'Siniat', atlas: 'ATLAS' };

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

/**
 * Kotwienie słupków okładziny do ściany co `spacing` cm w pionie:
 * - angle: kątownik stalowy przy posadzce, przy stropie i co `spacing` (karta Siniat C100/L:
 *   0,8 szt./m² przy 10 m i 12 m wysokości = ⌈H/rozstaw⌉ + 1 na słupek),
 * - pwa: przewiązka wibroakustyczna tylko między U (karta Siniat C/PWA: 1,1 szt./m² przy 2,8 m
 *   i rozstawie 100 cm = ⌈H/rozstaw⌉ − 1 na słupek).
 */
export interface WallTie {
  kind: 'angle' | 'pwa';
  spacing: number;
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
  /**
   * Słupki z innych profili niż CW (ruszt `single`):
   * - UA: profile usztywniające UA (blacha 2 mm), na każdym końcu kątownik UA ze śrubami M8;
   *   słupki podwójne = dwa UA skręcone śrubami M8 (Siniat UAR/UARUAR),
   * - UU: para profili U (UW) skręconych w skrzynkę z parą UD 30 trzymającą płytę rdzeniową
   *   (obudowy szybów typu ShaftWall – Siniat UU, Rigips 3.50.10).
   */
  studKind?: 'UA' | 'UU';
  /** Kotwienie słupków do ściany w pionie: kątowniki (Siniat C100/L) albo przewiązki PWA; rozstaw, cm */
  wallTie?: WallTie;
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
  ...KNAUF_WALL_SYSTEMS,
  ...SINIAT_WALL_SYSTEMS,
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
const MAKER_ORDER: Maker[] = ['rigips', 'norgips', 'knauf', 'siniat', 'atlas'];
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

/** Wieszaki noniuszowe (sufit podwieszany) albo mocowanie bezpośrednie: uchwyt ES, uchwyt elastyczny, wieszak do poddaszy */
export type HangerType = 'noniusz' | 'es' | 'elastic' | 'attic';

/**
 * Ruszt zabudowy poddasza inny niż profile CD 60 na uchwytach ES / elastycznych / wieszakach do poddaszy.
 * Systemy z tym polem służą tylko do poddaszy (mocowanie do krokwi).
 */
export interface AtticFrame {
  /** direct = profil lub łata przykręcone wprost do krokwi; hanger = profil na wieszakach; between = ruszt między krokwiami (więźba widoczna) */
  mount: 'direct' | 'hanger' | 'between';
  /** Produkt elementu, do którego przykręca się płyty */
  profile: string;
  /** Nazwa elementu w opisach: „profil kapeluszowy”, „łata drewniana” */
  profileLabel: string;
  /** Wysokość elementu pod płytami, mm */
  profileMm: number;
  /** Profil przyścienny; brak = bez profilu przy ścianach */
  edge?: string;
  /** Produkt wieszaka i jego nazwa w opisach */
  hanger?: string;
  hangerLabel?: string;
  /** Wkręty „pchełki” na jeden wieszak */
  hangerLn9?: number;
  /** Łącznik wzdłużny elementów rusztu */
  joiner?: string;
  /** Wkręty do drewna na jedno mocowanie do krokwi */
  woodScrews: number;
  /** Największa zabudowa pod krokwią (zasięg wieszaka), mm, i skąd ta wartość */
  maxUnderMm?: number;
  maxUnderWhy?: string;
  /** Przekroje łat z największym rozstawem mocowania (krokwi) z karty, cm */
  battens?: { product: string; size: string; mm: number; maxFix: number }[];
  /** Największy rozstaw mocowania elementów wzdłuż krokwi (ruszt między krokwiami), cm */
  sideFix?: number;
}

export interface CeilingSystem {
  id: string;
  code?: string;
  name: string;
  kind: CeilingKind;
  layers: number;
  defaultBoard: string;
  /** Płyta warstw wewnętrznych, gdy karta łączy dwie grubości (np. 2×15 + 2×12,5) */
  innerBoard?: string;
  /** Liczba warstw z płyty wewnętrznej */
  innerLayers?: number;
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
  /** Zabudowa poddasza (skosy, jętki) – mocowanie do krokwi; false = okładzina sufitu mimo uchwytów elastycznych */
  attic?: boolean;
  /** Ruszt poddasza inny niż CD 60 na wieszakach – system tylko do zabudowy poddasza */
  atticFrame?: AtticFrame;
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

const CEILING_LIST: CeilingSystem[] = [
  ...RIGIPS_CEILINGS,
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
  ...KNAUF_CEILING_SYSTEMS,
  ...SINIAT_CEILING_SYSTEMS,
];

/** Sufity podstawowe – widoczne od razu; reszta pod „Pozostałe systemy” */
const BASIC_CEILINGS = new Set(['S-CD-2P-1', 'S-CD-1P-1', 'S-ES-1', 'S-PODD-1', 'S-UA-1', 'S-CW75-1', 'A-S-L100']);

const CEILING_KIND_ORDER: CeilingKind[] = ['two-level', 'one-level', 'direct', 'ua-span', 'cw-span', 'point-fix'];
const stdBoard = (id: string) => (/^R(B|BI|F|FP|FI)\d/.test(id) ? 0 : 1);

/**
 * Katalog sufitów: systemy na CD 60 z kart Rigips (src/catalog/rigips.gen.ts), sufity bez wieszaków
 * i systemy innych producentów. Kolejność: rodzaj, producent, podstawowe, poddasza na końcu grupy,
 * płyty zwykłe przed specjalnymi, liczba warstw.
 */
export const CEILING_SYSTEMS: CeilingSystem[] = CEILING_LIST.map((s) => (BASIC_CEILINGS.has(s.id) ? { ...s, basic: true } : s))
  .map((s, i) => ({ s, i }))
  .sort(
    (a, b) =>
      CEILING_KIND_ORDER.indexOf(a.s.kind) - CEILING_KIND_ORDER.indexOf(b.s.kind) ||
      MAKER_ORDER.indexOf(a.s.maker ?? 'rigips') - MAKER_ORDER.indexOf(b.s.maker ?? 'rigips') ||
      Number(!!b.s.basic) - Number(!!a.s.basic) ||
      (a.s.maker ? a.i - b.i : Number(!!a.s.attic) - Number(!!b.s.attic) || stdBoard(a.s.defaultBoard) - stdBoard(b.s.defaultBoard) || a.s.layers - b.s.layers || a.i - b.i),
  )
  .map((x) => x.s);

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

/** Nazwa słupka ściany do opisów i rysunków, np. „CW 75”, „UA 50”, „2×U 75 (UU)” */
export function wallStudLabel(sys: WallSystem): string {
  if (sys.frame === 'cd-lining') return 'CD 60';
  if (sys.studKind === 'UA') return `UA ${sys.profile}`;
  if (sys.studKind === 'UU') return `2×U ${sys.profile} (UU)`;
  return `CW ${sys.profile}`;
}

/** Liczba kotew (kątowników / przewiązek) na słupku o długości `len` m */
export function wallTieCount(tie: WallTie, len: number): number {
  const n = Math.ceil(len / (tie.spacing / 100) - 1e-9);
  return tie.kind === 'angle' ? n + 1 : Math.max(0, n - 1);
}

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
