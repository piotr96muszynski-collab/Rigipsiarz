import { useEffect, useRef, useState } from 'react';

/**
 * Systemowy przycisk Wstecz (Android, zainstalowana PWA) cofa nawigację wewnątrz aplikacji.
 *
 * Na szczycie historii przeglądarki trzymamy jeden wpis-strażnik. Wstecz zdejmuje strażnika
 * (zdarzenie popstate), my zamykamy ostatnio otwartą warstwę (arkusz, formularz, zakładkę,
 * projekt) i odkładamy strażnika z powrotem. Gdy nie ma już czego zamknąć, pokazujemy
 * komunikat i przez chwilę nie odkładamy strażnika – kolejne Wstecz wychodzi z aplikacji.
 */

/** Czas na drugie Wstecz, które wychodzi z aplikacji */
export const EXIT_WINDOW_MS = 2000;

const GUARD = '__rigipsiarzBack';

export interface HistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url?: string | null): void;
}

export interface BackOptions {
  history: HistoryLike;
  /** Pokazuje lub chowa komunikat „Cofnij jeszcze raz, aby wyjść” */
  onExitHint: (show: boolean) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

interface Layer {
  id: number;
  onBack: () => void;
}

export class BackController {
  private layers: Layer[] = [];
  private seq = 0;
  private hintUntil = 0;
  private timer: unknown = null;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(private readonly opts: BackOptions) {
    this.now = opts.now ?? Date.now;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  /** Czy bieżący wpis historii to nasz strażnik */
  get guarded() {
    const s = this.opts.history.state;
    return !!s && typeof s === 'object' && (s as Record<string, unknown>)[GUARD] === true;
  }

  /** Odkłada strażnika, jeśli go brakuje (start aplikacji, dotknięcie ekranu po komunikacie) */
  ensureGuard() {
    if (this.guarded || this.hintActive()) return;
    this.opts.history.pushState({ [GUARD]: true }, '');
  }

  /** Rejestruje otwartą warstwę; zwraca funkcję wyrejestrowania. Ostatnio otwarta zamyka się pierwsza. */
  push(onBack: () => void) {
    const layer = { id: ++this.seq, onBack };
    this.layers.push(layer);
    return () => void (this.layers = this.layers.filter((l) => l.id !== layer.id));
  }

  get depth() {
    return this.layers.length;
  }

  /** Obsługa popstate. Zwraca, co się stało – przydaje się w testach. */
  onPopState(): 'ignored' | 'layer' | 'hint' | 'exit' {
    // Powrót na strażnika = cofnięcie zwykłego wpisu (np. #dalmierz otwarty linkiem) – przeglądarka zrobiła już swoje
    if (this.guarded) return 'ignored';
    const top = this.layers[this.layers.length - 1];
    if (top) {
      this.hideHint();
      top.onBack();
      this.opts.history.pushState({ [GUARD]: true }, '');
      return 'layer';
    }
    if (this.hintActive()) return 'exit';
    // nic do zamknięcia: strażnika nie odkładamy, więc następne Wstecz zamknie aplikację
    this.hintUntil = this.now() + EXIT_WINDOW_MS;
    this.opts.onExitHint(true);
    this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      this.hideHint();
      this.ensureGuard();
    }, EXIT_WINDOW_MS);
    return 'hint';
  }

  private hintActive() {
    return this.hintUntil > this.now();
  }

  private hideHint() {
    if (!this.hintUntil) return;
    this.hintUntil = 0;
    this.clearTimer(this.timer);
    this.timer = null;
    this.opts.onExitHint(false);
  }

  /** Każde dotknięcie po komunikacie oznacza, że użytkownik jednak zostaje */
  onUserActivity() {
    if (this.hintActive()) this.hideHint();
    this.ensureGuard();
  }
}

let controller: BackController | null = null;
const hintListeners = new Set<(v: boolean) => void>();

function getController() {
  if (!controller && typeof window !== 'undefined') {
    controller = new BackController({ history: window.history, onExitHint: (v) => hintListeners.forEach((fn) => fn(v)) });
    const c = controller;
    window.addEventListener('popstate', () => c.onPopState());
    // Chrome pomija przy Wstecz wpisy dodane bez interakcji – strażnika odkładamy też po dotknięciu
    window.addEventListener('pointerdown', () => c.onUserActivity(), { capture: true });
    window.addEventListener('keydown', () => c.onUserActivity(), { capture: true });
    c.ensureGuard();
  }
  return controller;
}

/**
 * Gdy `active`, przycisk Wstecz wywołuje `onBack` zamiast wychodzić z aplikacji.
 * Kolejność: warstwa włączona później zamyka się wcześniej.
 */
export function useBack(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const c = getController();
    if (!c) return;
    return c.push(() => ref.current());
  }, [active]);
}

/** Komunikat przy ostatnim cofnięciu */
export function useExitHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    getController();
    hintListeners.add(setShow);
    return () => void hintListeners.delete(setShow);
  }, []);
  return show;
}
