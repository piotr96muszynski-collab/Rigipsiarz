import type { MaterialLine } from '../calc/materials';

/** Ceny wpisane przez użytkownika: klucz pozycji → cena brutto (zł) za sztukę lub opakowanie */
export type PriceBook = Record<string, number>;

export interface PricedLine extends MaterialLine {
  /** Ilość do kupienia w jednostce, w której podana jest cena */
  buyQty: number;
  buyUnit: string;
  price?: number;
  total?: number;
}

export function priceLines(lines: MaterialLine[], prices: PriceBook): PricedLine[] {
  return lines.map((l) => {
    const buyQty = l.packs ?? l.qty;
    const buyUnit = l.packs ? (l.packUnit ?? l.unit) : l.unit;
    const price = prices[l.key];
    return { ...l, buyQty, buyUnit, price, total: price !== undefined ? price * buyQty : undefined };
  });
}

/** Wyszukiwanie produktu w sklepie Bricoman (otwiera się w przeglądarce, gdy jest internet) */
export function storeSearchUrl(name: string): string {
  const q = name
    .replace(/, dł\..*$/, '')
    .replace(/\(.*?\)/g, '')
    .replace(/, \d+×\d+ cm$/, '')
    .trim();
  return `https://www.bricoman.pl/search?q=${encodeURIComponent(q)}`;
}

export const formatPLN = (v: number) =>
  v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
