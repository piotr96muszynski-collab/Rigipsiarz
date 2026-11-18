// Wełna mineralna: produkty handlowe i dobór grubości do rusztu.
//
// Opakowania wg oferty Bricoman (stan 18.11.2026) i karty produktu Rockwool Rockmin Plus
// (wersja 09/2023). Zawartość paczki bywa zmieniana przez producentów – w ustawieniach
// projektu można wpisać własną liczbę m² w opakowaniu.

import type { Unit } from './rigips';

export interface WoolProduct {
  id: string;
  brand: 'Isover' | 'Rockwool' | 'URSA' | 'Knauf';
  name: string;
  material: 'szklana' | 'skalna';
  form: 'płyta' | 'mata';
  /** Grubość, mm */
  thickness: number;
  /** m² w opakowaniu handlowym */
  packM2: number;
  /** Liczba płyt w paczce (jeśli znana) */
  pieces?: number;
  /** Wymiary płyty, cm */
  sizeCm?: [number, number];
  lambda: number;
  source: string;
}

const BRICOMAN = 'Bricoman – kategoria „Wełna mineralna na ścianki działowe”, 18.11.2026';
const ROCKMIN_CARD = 'Rockwool – karta produktu Rockmin Plus (09/2023)';

export const WOOL_PRODUCTS: WoolProduct[] = [
  // Isover Aku-Płyta – płyty 60×120 cm do ścian działowych (szerokość pod rozstaw 60 cm)
  { id: 'ISO-AKU-50', brand: 'Isover', name: 'Isover Aku-Płyta', material: 'szklana', form: 'płyta', thickness: 50, packM2: 14.4, pieces: 20, sizeCm: [60, 120], lambda: 0.037, source: BRICOMAN },
  { id: 'ISO-AKU-75', brand: 'Isover', name: 'Isover Aku-Płyta', material: 'szklana', form: 'płyta', thickness: 75, packM2: 8.64, pieces: 12, sizeCm: [60, 120], lambda: 0.037, source: BRICOMAN },
  { id: 'ISO-AKU-100', brand: 'Isover', name: 'Isover Aku-Płyta', material: 'szklana', form: 'płyta', thickness: 100, packM2: 7.2, pieces: 10, sizeCm: [60, 120], lambda: 0.037, source: BRICOMAN },
  // Isover wełna szklana λ 0,044 – tańsza mata/rolka (na sufity, poddasza)
  { id: 'ISO-044-50', brand: 'Isover', name: 'Isover mata λ 0,044', material: 'szklana', form: 'mata', thickness: 50, packM2: 19.2, lambda: 0.044, source: BRICOMAN },
  { id: 'ISO-044-100', brand: 'Isover', name: 'Isover mata λ 0,044', material: 'szklana', form: 'mata', thickness: 100, packM2: 9.6, lambda: 0.044, source: BRICOMAN },
  { id: 'ISO-044-150', brand: 'Isover', name: 'Isover mata λ 0,044', material: 'szklana', form: 'mata', thickness: 150, packM2: 7.2, lambda: 0.044, source: BRICOMAN },
  // Rockwool Rockmin Plus – płyty skalne 61×100 cm (wg karty: sprzedaż na palety)
  { id: 'RW-ROCKMIN-50', brand: 'Rockwool', name: 'Rockwool Rockmin Plus', material: 'skalna', form: 'płyta', thickness: 50, packM2: 10.98, pieces: 18, sizeCm: [61, 100], lambda: 0.037, source: ROCKMIN_CARD },
  { id: 'RW-ROCKMIN-75', brand: 'Rockwool', name: 'Rockwool Rockmin Plus', material: 'skalna', form: 'płyta', thickness: 75, packM2: 7.32, pieces: 12, sizeCm: [61, 100], lambda: 0.037, source: ROCKMIN_CARD },
  { id: 'RW-ROCKMIN-100', brand: 'Rockwool', name: 'Rockwool Rockmin Plus', material: 'skalna', form: 'płyta', thickness: 100, packM2: 6.1, pieces: 10, sizeCm: [61, 100], lambda: 0.037, source: ROCKMIN_CARD },
  { id: 'RW-ROCKMIN-150', brand: 'Rockwool', name: 'Rockwool Rockmin Plus', material: 'skalna', form: 'płyta', thickness: 150, packM2: 3.66, pieces: 6, sizeCm: [61, 100], lambda: 0.037, source: ROCKMIN_CARD },
  // Rockwool Rockslab Sonic – akustyczna płyta skalna (70 mm do profili 75)
  { id: 'RW-SONIC-50', brand: 'Rockwool', name: 'Rockwool Rockslab Sonic', material: 'skalna', form: 'płyta', thickness: 50, packM2: 4.88, pieces: 8, sizeCm: [61, 100], lambda: 0.036, source: BRICOMAN },
  { id: 'RW-SONIC-70', brand: 'Rockwool', name: 'Rockwool Rockslab Sonic', material: 'skalna', form: 'płyta', thickness: 70, packM2: 3.66, pieces: 6, sizeCm: [61, 100], lambda: 0.036, source: BRICOMAN },
  { id: 'RW-SONIC-100', brand: 'Rockwool', name: 'Rockwool Rockslab Sonic', material: 'skalna', form: 'płyta', thickness: 100, packM2: 2.44, pieces: 4, sizeCm: [61, 100], lambda: 0.036, source: BRICOMAN },
  // Rockwool Toproll Super – mata skalna w rolce
  { id: 'RW-TOPROLL-100', brand: 'Rockwool', name: 'Rockwool Toproll Super', material: 'skalna', form: 'mata', thickness: 100, packM2: 5, lambda: 0.036, source: BRICOMAN },
  { id: 'RW-TOPROLL-150', brand: 'Rockwool', name: 'Rockwool Toproll Super', material: 'skalna', form: 'mata', thickness: 150, packM2: 3.5, lambda: 0.036, source: BRICOMAN },
];

/** Grubości wełny obsługiwane w projekcie, mm */
export const WOOL_THICKNESSES = [50, 75, 100, 150] as const;
export type WoolThickness = (typeof WOOL_THICKNESSES)[number];

/** Domyślny produkt dla grubości – płyty Isover do ścian, mata do 150 mm */
export const DEFAULT_WOOL: Record<WoolThickness, string> = {
  50: 'ISO-AKU-50',
  75: 'ISO-AKU-75',
  100: 'ISO-AKU-100',
  150: 'ISO-044-150',
};

/**
 * Produkty pasujące do grubości „gniazda”: nie grubsze niż gniazdo i najwyżej 10 mm cieńsze
 * (np. Rockslab Sonic 70 mm do profilu 75 mm).
 */
export const woolProductsFor = (thickness: number) =>
  WOOL_PRODUCTS.filter((p) => p.thickness <= thickness && p.thickness >= thickness - 10);

export const woolProductById = (id: string) => WOOL_PRODUCTS.find((p) => p.id === id);

/** Wybór produktu wełny w projekcie: id produktu albo własne opakowanie (m² w paczce) */
export interface WoolChoice {
  productId?: string;
  /** Własne opakowanie: m² w paczce (np. produkt URSA spoza listy) */
  customM2?: number;
}

export interface ResolvedWool {
  thickness: number;
  name: string;
  packM2: number;
  packUnit: Unit;
  /** Klucz pozycji na liście zakupów (ceny, odhaczenia) */
  key: string;
  pieces?: number;
  sizeCm?: [number, number];
}

export function resolveWool(thickness: number, choice?: WoolChoice): ResolvedWool {
  if (choice?.customM2 && choice.customM2 > 0)
    return {
      thickness,
      name: `Wełna mineralna ${thickness} mm (własne opakowanie)`,
      packM2: choice.customM2,
      packUnit: 'opak.',
      key: `wool-custom-${thickness}`,
    };
  const product =
    woolProductById(choice?.productId ?? '') ??
    woolProductById(DEFAULT_WOOL[thickness as WoolThickness] ?? '') ??
    woolProductsFor(thickness)[0];
  if (!product)
    return { thickness, name: `Wełna mineralna ${thickness} mm`, packM2: 0, packUnit: 'opak.', key: `wool-${thickness}` };
  return {
    thickness,
    name: `${product.name} ${product.thickness} mm`,
    packM2: product.packM2,
    packUnit: product.form === 'mata' ? 'rolka' : 'opak.',
    key: `wool-${product.id}`,
    pieces: product.pieces,
    sizeCm: product.sizeCm,
  };
}

/** Grubość wełny z identyfikatora pozycji zapotrzebowania (WELNA75 → 75) */
export const woolThicknessOf = (pid: string) => Number(pid.replace('WELNA', ''));
