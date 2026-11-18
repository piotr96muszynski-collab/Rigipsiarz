import { useCallback, useEffect, useRef, useState } from 'react';
import { useBack } from './back';

/**
 * Tryb pełnoekranowy planera i widoku 3D: chowa nagłówek, podsumowanie i zakładki,
 * a gdzie się da, prosi też przeglądarkę o pełny ekran (Fullscreen API – znika pasek
 * stanu i nawigacji Androida). Bez Fullscreen API (np. iPhone) działa sam układ.
 * Wstecz wychodzi z trybu, tak jak systemowe wyjście z pełnego ekranu.
 */
export function useImmersive() {
  const [on, setOn] = useState(false);
  const usedApi = useRef(false);

  const exit = useCallback(() => {
    setOn(false);
    if (usedApi.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    usedApi.current = false;
  }, []);

  const enter = useCallback(() => {
    setOn(true);
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => (usedApi.current = true))
        .catch(() => {
          // brak zgody przeglądarki – zostaje sam układ pełnoekranowy
        });
    }
  }, []);

  // wyjście z pełnego ekranu gestem systemowym kończy też tryb w aplikacji
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && usedApi.current) {
        usedApi.current = false;
        setOn(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // zamknięcie widoku (np. powrót do listy projektów) zwalnia pełny ekran
  useEffect(
    () => () => {
      if (usedApi.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    },
    [],
  );

  useBack(on, exit);

  return { on, enter, exit, toggle: () => (on ? exit() : enter()) };
}

/** Ikony przycisku pełnego ekranu (ścieżki SVG 24×24) */
export const FULLSCREEN_ICON = 'M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5';
export const EXIT_FULLSCREEN_ICON = 'M20 10h-6V4M14 10l6.5-6.5M4 14h6v6M10 14l-6.5 6.5';
