/**
 * Numer wersji aplikacji. Wartości wstrzykuje Vite przy buildzie (vite.config.ts → `define`):
 * - numer wydania = liczba commitów na gałęzi (każde scalenie PR do main = +1),
 * - skrót commita i data commita.
 */
export interface BuildInfo {
  /** Numer wydania (liczba commitów), 0 gdy nieznany. */
  build: number;
  /** Krótki hash commita, '' gdy nieznany. */
  commit: string;
  /** Data commita ISO (RRRR-MM-DD), '' gdy nieznana. */
  date: string;
  /** true dla buildu z lokalnymi zmianami albo spoza main (wersja robocza). */
  dev: boolean;
}

/** Data ISO → „19.11.2026”. */
export function fmtBuildDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Krótki numer wersji, np. „1.69” albo „1.69-dev”. */
export function versionLabel(info: BuildInfo): string {
  if (!info.build) return 'wersja robocza';
  return `1.${info.build}${info.dev ? '-dev' : ''}`;
}

/** Pełny opis, np. „Wersja 1.69 · 19.11.2026 · 2ac7560”. */
export function versionText(info: BuildInfo): string {
  const parts = [info.build ? `Wersja ${versionLabel(info)}` : 'Wersja robocza'];
  const d = fmtBuildDate(info.date);
  if (d) parts.push(d);
  if (info.commit) parts.push(info.commit);
  return parts.join(' · ');
}

export const BUILD_INFO: BuildInfo = {
  build: typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0,
  commit: typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '',
  date: typeof __APP_DATE__ === 'string' ? __APP_DATE__ : '',
  dev: typeof __APP_DEV__ === 'boolean' ? __APP_DEV__ : true,
};
