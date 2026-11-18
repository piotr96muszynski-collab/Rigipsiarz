import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Komunikat o nowej wersji aplikacji. Service worker sprawdza aktualizacje co godzinę i przy starcie. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh)
    return (
      <div className="toast" role="status">
        <span>Jest nowa wersja aplikacji.</span>
        <button className="btn primary small" onClick={() => updateServiceWorker(true)}>
          Odśwież
        </button>
        <button className="btn ghost small" onClick={() => setNeedRefresh(false)}>
          Później
        </button>
      </div>
    );
  if (offlineReady)
    return (
      <div className="toast" role="status">
        <span>Aplikacja działa już bez internetu.</span>
        <button className="btn ghost small" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    );
  return null;
}
