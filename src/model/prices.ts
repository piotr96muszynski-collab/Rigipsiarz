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

/** Przenosi ceny i odhaczenia zapisane pod starymi identyfikatorami produktów (np. UD 27 → UD 30) */
export function migrateKeys<T>(book: Record<string, T>, aliases: Record<string, string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(book)) {
    let key = k;
    for (const [from, to] of Object.entries(aliases)) key = key.replace(new RegExp(`(^|-)${from}(-|$)`), `$1${to}$2`);
    if (!(key in out) || key === k) out[key] = v;
  }
  return out;
}
