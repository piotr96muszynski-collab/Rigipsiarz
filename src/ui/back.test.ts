import { describe, expect, it } from 'vitest';
import { BackController, EXIT_WINDOW_MS } from './back';

/** Prosta historia przeglądarki: stos wpisów i wskaźnik bieżącego */
function fakeHistory() {
  const entries: unknown[] = [null];
  let i = 0;
  return {
    get state() {
      return entries[i];
    },
    pushState(data: unknown) {
      entries.splice(i + 1);
      entries.push(data);
      i++;
    },
    /** Systemowe Wstecz: false, gdy nie ma dokąd – aplikacja się zamyka */
    back(c: BackController) {
      if (i === 0) return false;
      i--;
      c.onPopState();
      return true;
    },
    get length() {
      return entries.length;
    },
  };
}

function setup() {
  const h = fakeHistory();
  let t = 0;
  const hints: boolean[] = [];
  const timers: { at: number; fn: () => void }[] = [];
  const c = new BackController({
    history: h,
    onExitHint: (v) => hints.push(v),
    now: () => t,
    setTimer: (fn, ms) => {
      const timer = { at: t + ms, fn };
      timers.push(timer);
      return timer;
    },
    clearTimer: (id) => {
      const k = timers.indexOf(id as (typeof timers)[number]);
      if (k >= 0) timers.splice(k, 1);
    },
  });
  const advance = (ms: number) => {
    t += ms;
    for (const timer of [...timers]) if (timer.at <= t) (timers.splice(timers.indexOf(timer), 1), timer.fn());
  };
  c.ensureGuard();
  return { h, c, hints, advance };
}

describe('przycisk Wstecz', () => {
  it('zamyka warstwy od ostatnio otwartej i nie wychodzi z aplikacji', () => {
    const { h, c } = setup();
    const closed: string[] = [];
    const offProject = c.push(() => (closed.push('projekt'), offProject()));
    const offSheet = c.push(() => (closed.push('arkusz'), offSheet()));
    expect(h.back(c)).toBe(true);
    expect(closed).toEqual(['arkusz']);
    expect(c.guarded).toBe(true);
    h.back(c);
    expect(closed).toEqual(['arkusz', 'projekt']);
    expect(c.guarded).toBe(true);
  });

  it('na ekranie głównym pokazuje komunikat, a drugie Wstecz wychodzi', () => {
    const { h, c, hints } = setup();
    expect(h.back(c)).toBe(true);
    expect(hints).toEqual([true]);
    expect(c.guarded).toBe(false);
    // brak strażnika – system zamyka aplikację
    expect(h.back(c)).toBe(false);
  });

  it('po upływie czasu komunikat znika i strażnik wraca', () => {
    const { h, c, hints, advance } = setup();
    h.back(c);
    advance(EXIT_WINDOW_MS);
    expect(hints).toEqual([true, false]);
    expect(c.guarded).toBe(true);
    // znów pierwszy krok – tylko komunikat
    expect(h.back(c)).toBe(true);
    expect(hints).toEqual([true, false, true]);
  });

  it('dotknięcie ekranu po komunikacie anuluje wyjście', () => {
    const { h, c, hints } = setup();
    h.back(c);
    c.onUserActivity();
    expect(hints).toEqual([true, false]);
    expect(c.guarded).toBe(true);
  });

  it('ignoruje powrót na strażnika ze zwykłego wpisu (np. #dalmierz z linku)', () => {
    const { h, c } = setup();
    let closed = 0;
    c.push(() => closed++);
    h.pushState(null); // nawigacja linkiem
    h.back(c);
    expect(closed).toBe(0);
    expect(c.guarded).toBe(true);
  });

  it('wyrejestrowana warstwa nie jest już zamykana', () => {
    const { h, c, hints } = setup();
    let closed = 0;
    const off = c.push(() => closed++);
    off();
    expect(c.depth).toBe(0);
    h.back(c);
    expect(closed).toBe(0);
    expect(hints).toEqual([true]);
  });
});
