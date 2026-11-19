import { STOCK_LENGTHS } from '../catalog/rigips';

/**
 * Długości handlowe profili, które można wybrać zamiast doboru automatycznego.
 * W sklepach nie zawsze są wszystkie długości z rozkroju (np. CW 3,5 m), więc dla każdego
 * profilu można wskazać jedną długość – rozkrój, przedłużenia i łączniki liczą się wtedy
 * z tej długości. Słupków UA się nie łączy, więc ich długości zostają automatyczne.
 */
export const PROFILE_FAMILIES = ['CW', 'UW', 'CD', 'UD'] as const;
export type ProfileFamily = (typeof PROFILE_FAMILIES)[number];
/** 'auto' = najkrótsza pasująca długość z katalogu (dawne zachowanie), liczba = długość w m */
export type ProfileLengthPref = 'auto' | number;
/** Ustawienie aplikacji: rodzina profili → długość */
export type AppProfileLengths = Partial<Record<ProfileFamily, ProfileLengthPref>>;
/** Ustawienie projektu: id profilu (np. CW75, UD30) → długość; brak = jak w aplikacji */
export type ProjectProfileLengths = Record<string, ProfileLengthPref>;

export const profileFamily = (productId: string): string =>
  productId.startsWith('CW')
    ? 'CW'
    : productId.startsWith('UW')
      ? 'UW'
      : productId.startsWith('UA')
        ? 'UA'
        : productId.startsWith('CD')
          ? 'CD'
          : productId.startsWith('UD')
            ? 'UD'
            : productId;

const isFamily = (f: string): f is ProfileFamily => (PROFILE_FAMILIES as readonly string[]).includes(f);

/** Długości do wyboru dla profilu (rosnąco), puste = profilu nie da się przestawić */
export function profileLengthChoices(productId: string): number[] {
  const f = profileFamily(productId);
  return isFamily(f) ? [...(STOCK_LENGTHS[f] ?? [])].sort((a, b) => a - b) : [];
}

export const isProfileLengthPref = (pid: string, v: unknown): v is ProfileLengthPref =>
  v === 'auto' || (typeof v === 'number' && profileLengthChoices(pid).includes(v));

let appPrefs: AppProfileLengths = {};
let projectPrefs: ProjectProfileLengths = {};

/** Ustawienie globalne aplikacji (IndexedDB, klucz `profileLengths`) */
export function setAppProfileLengths(p: AppProfileLengths | undefined) {
  const out: AppProfileLengths = {};
  for (const f of PROFILE_FAMILIES) if (p && isProfileLengthPref(f, p[f])) out[f] = p[f];
  appPrefs = out;
}
export const appProfileLengths = (): AppProfileLengths => appPrefs;
/** Nadpisanie w otwartym projekcie (`settings.profileLengths`) */
export function setProjectProfileLengths(p: ProjectProfileLengths | undefined) {
  const out: ProjectProfileLengths = {};
  for (const [k, v] of Object.entries(p ?? {})) if (isProfileLengthPref(k, v)) out[k] = v;
  projectPrefs = out;
}

/** Ustawienie z aplikacji dla profilu (bez nadpisania projektu) */
export function appProfileLength(productId: string): ProfileLengthPref {
  const f = profileFamily(productId);
  return (isFamily(f) && appPrefs[f]) || 'auto';
}
/** Obowiązująca długość profilu: projekt → aplikacja → auto */
export function activeProfileLength(productId: string): ProfileLengthPref {
  if (!profileLengthChoices(productId).length) return 'auto';
  return projectPrefs[productId] ?? appProfileLength(productId);
}

/** Długości handlowe, z których liczymy rozkrój profilu, m (pierwsza = domyślna dla krótkich elementów) */
export function profileStocks(productId: string, fallback = 3): number[] {
  const pref = activeProfileLength(productId);
  if (pref !== 'auto') return [pref];
  return STOCK_LENGTHS[profileFamily(productId)] ?? [fallback];
}

/** Najdłuższy dostępny profil, m – co tyle wypada przedłużenie (łącznik wzdłużny) */
export const profileMaxStock = (productId: string, fallback = 4): number => Math.max(...profileStocks(productId, fallback));

/**
 * Zakład przy przedłużaniu słupka CW, m: długość zakładu = szerokość profilu × 10
 * (CW 50 – 50 cm, CW 75 – 75 cm, CW 100 – 100 cm), profile skręcone wkrętami LN.
 * Profile UW/UD przykłada się na styk, CD łączy łącznikiem wzdłużnym – bez zakładu.
 */
export function profileOverlap(productId: string): number {
  if (profileFamily(productId) !== 'CW') return 0;
  const w = Number(/^CW(\d+)/.exec(productId)?.[1] ?? 0);
  return w > 0 ? w / 100 : 0;
}

/** Liczba przedłużeń elementu o długości `lenM` przy profilach `stockM` i zakładzie `overlapM` */
export function joinsFor(lenM: number, stockM: number, overlapM = 0): number {
  let rest = lenM;
  let n = 0;
  while (rest > stockM + 1e-9 && n < 100) {
    rest = rest - stockM + overlapM;
    n++;
  }
  return n;
}

export const profileLengthLabel = (p: ProfileLengthPref) => (p === 'auto' ? 'Auto' : `${p.toFixed(2).replace(/0$/, '').replace('.', ',')} m`);
