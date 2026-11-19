import { useState } from 'react';
import { BUILD_INFO, versionText } from '../app/version';

type Check = 'idle' | 'checking' | 'latest' | 'found' | 'offline';

/** Numer zainstalowanej wersji + ręczne sprawdzenie aktualizacji. */
export function AppVersion() {
  const [check, setCheck] = useState<Check>('idle');

  async function onCheck() {
    setCheck('checking');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return setCheck('latest');
      await reg.update();
      // Nowa wersja pobiera się w tle; gdy będzie gotowa, pojawi się komunikat z przyciskiem „Odśwież”.
      setCheck(reg.installing || reg.waiting ? 'found' : 'latest');
    } catch {
      setCheck('offline');
    }
  }

  return (
    <p className="app-version small muted">
      <span>{versionText(BUILD_INFO)}</span>
      <button className="link-btn" onClick={onCheck} disabled={check === 'checking'}>
        {check === 'checking' ? 'Sprawdzam…' : 'Sprawdź aktualizację'}
      </button>
      {check === 'latest' && <span>Masz najnowszą wersję.</span>}
      {check === 'found' && <span>Pobieram nową wersję…</span>}
      {check === 'offline' && <span>Brak połączenia – spróbuj później.</span>}
    </p>
  );
}
