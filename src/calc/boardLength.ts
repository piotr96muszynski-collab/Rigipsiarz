import { boardById } from '../catalog/rigips';

/** Długości arkuszy do wyboru w aplikacji, cm */
export const BOARD_LENGTH_CHOICES = [200, 260, 300] as const;
/** 'auto' = najkrótszy arkusz nie niższy od ściany (dawne zachowanie) */
export type BoardLengthPref = 'auto' | (typeof BOARD_LENGTH_CHOICES)[number];

/** Najwęższa dostawka, której jeszcze nie skracamy kosztem pełnego arkusza, m */
export const MIN_STRIP_M = 0.3;

/** Długość arkusza wybrana dla jednej płyty na liście zakupów: 'auto' albo długość z katalogu tej płyty, cm */
export type BoardSheetPref = 'auto' | number;
/** Ustawienie projektu: id płyty (RB12.5, RF12.5…) → długość arkusza; brak = jak w projekcie / aplikacji */
export type ProjectBoardLengths = Record<string, BoardSheetPref>;

let appPref: BoardLengthPref = 'auto';
let projectPref: BoardLengthPref | undefined;
let perBoard: ProjectBoardLengths = {};

/** Ustawienie globalne aplikacji (zapisywane w IndexedDB, klucz `boardLength`) */
export function setAppBoardLength(p: BoardLengthPref | undefined) {
  appPref = isBoardLengthPref(p) ? p : 'auto';
}
export const appBoardLength = () => appPref;
/** Nadpisanie w otwartym projekcie; brak = jak w aplikacji */
export function setProjectBoardLength(p: BoardLengthPref | undefined) {
  projectPref = isBoardLengthPref(p) ? p : undefined;
}
/** Długość wspólna dla wszystkich płyt projektu (bez wyboru pojedynczej płyty) */
export const baseBoardLength = (): BoardLengthPref => projectPref ?? appPref;

/** Długości arkuszy, które można kupić dla tej płyty (rosnąco, z katalogu) */
export function boardLengthChoices(boardId: string): number[] {
  return [...boardById(boardId).lengths].sort((a, b) => a - b);
}
export const isBoardSheetPref = (boardId: string, v: unknown): v is BoardSheetPref =>
  v === 'auto' || (typeof v === 'number' && boardLengthChoices(boardId).includes(v));

/** Wybory długości pojedynczych płyt w otwartym projekcie (`settings.boardLengths`, lista zakupów) */
export function setProjectBoardLengths(p: ProjectBoardLengths | undefined) {
  const out: ProjectBoardLengths = {};
  for (const [k, v] of Object.entries(p ?? {})) if (isBoardSheetPref(k, v)) out[k] = v;
  perBoard = out;
}

/** Obowiązująca długość arkusza: wybór tej płyty → projekt → aplikacja */
export const activeBoardLength = (boardId?: string): BoardSheetPref =>
  (boardId !== undefined ? perBoard[boardId] : undefined) ?? baseBoardLength();

export const isBoardLengthPref = (v: unknown): v is BoardLengthPref =>
  v === 'auto' || (BOARD_LENGTH_CHOICES as readonly unknown[]).includes(v);

export const boardLengthLabel = (p: BoardSheetPref) =>
  p === 'auto' ? 'dopasowana do wysokości' : `${(p / 100).toFixed(1).replace('.', ',')} m`;

/**
 * Długość arkusza, cm. Przy 'auto' najkrótszy ≥ potrzebnej długości, inaczej najdłuższy (z dostawką).
 * Przy wybranej długości: ta długość, a gdy płyty w niej nie ma – najbliższa krótsza z katalogu
 * (dłuższej nie wniesiesz, skoro wybrano krótszą), w ostateczności najkrótsza dostępna.
 */
export function pickBoardLengthCm(boardId: string, needCm: number, pref: BoardSheetPref = activeBoardLength(boardId)): number {
  const lens = [...boardById(boardId).lengths].sort((a, b) => a - b);
  if (pref === 'auto') return lens.find((l) => l >= needCm) ?? lens[lens.length - 1];
  if (lens.includes(pref)) return pref;
  const shorter = lens.filter((l) => l <= pref);
  return shorter.length ? shorter[shorter.length - 1] : lens[0];
}

/**
 * Podział wysokości H na arkusze długości `sheet` (m): pełne arkusze + dostawka u dołu
 * (`restFirst`) albo u góry. Gdy dostawka wyszłaby węższa niż MIN_STRIP_M, sąsiedni pełny arkusz
 * jest skracany – zamiast paska kilku centymetrów jest dłuższa dostawka i krótszy arkusz.
 * Zwraca granice [y0, y1] od dołu.
 */
export function rowSegments(H: number, sheet: number, restFirst: boolean, minStrip = MIN_STRIP_M): [number, number][] {
  if (H <= sheet + 1e-3) return [[0, H]];
  const n = Math.floor(H / sheet + 1e-9);
  let rest = H - n * sheet;
  const heights: number[] = Array(n).fill(sheet);
  if (rest > 1e-3 && rest < minStrip - 1e-9) {
    // skróć pełny arkusz przy dostawce (dla bardzo krótkiego arkusza – po równo)
    const strip = Math.min(minStrip, (sheet + rest) / 2);
    heights[n - 1] = sheet + rest - strip;
    rest = strip;
  }
  if (rest > 1e-3) {
    if (restFirst) heights.unshift(rest);
    else heights.push(rest);
  }
  // przy dostawce u dołu skrócony arkusz ląduje tuż nad nią
  if (restFirst && rest > 1e-3 && heights.length > 2) {
    const short = heights.pop()!;
    heights.splice(1, 0, short);
  }
  const out: [number, number][] = [];
  let y = 0;
  for (const h of heights) {
    const y1 = Math.min(H, y + h);
    out.push([round3(y), round3(y1)]);
    y = y1;
  }
  out[out.length - 1][1] = H;
  return out;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
