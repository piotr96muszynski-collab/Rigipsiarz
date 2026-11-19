import { useEffect, useState } from 'react';
import { versionLabel, type BuildInfo } from '../app/version';
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

  // Numer nowej wersji (version.json nie jest w pamięci offline, więc idzie z sieci).
  const [next, setNext] = useState('');
  useEffect(() => {
    if (!needRefresh) return;
    fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<BuildInfo>) : null))
      .then((info) => info?.build && setNext(versionLabel(info)))
      .catch(() => {});
  }, [needRefresh]);

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh)
    return (
      <div className="toast" role="status">
        <span>Jest nowa wersja aplikacji{next ? ` (${next})` : ''}.</span>
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
