import { useState } from 'react';
import { describeLeica, isLeicaCharacteristic, LEICA_MEASURE } from '../device/leica';
import { ENABLE_SYNC, floatCandidates, fromHex, parseFrame, toHex } from '../device/bosch';
import { connectLaser, disconnectLaser, laser, type LogEntry, send } from '../device/laser';
import { getBluetooth } from '../device/webBluetooth';
import { DimInput } from './DimInput';
import { fmtMeters, useLaser, useLaserLog } from './useLaser';

const time = (t: number) => new Date(t).toLocaleTimeString('pl-PL', { hour12: false }) + '.' + String(t % 1000).padStart(3, '0');

function describe(bytes: Uint8Array, uuid?: string): string[] {
  const out: string[] = [];
  const leica = uuid ? describeLeica(uuid, bytes) : null;
  if (leica) out.push(leica);
  const f = uuid && isLeicaCharacteristic(uuid) ? null : parseFrame(bytes);
  if (f) {
    out.push(
      `ramka Bosch: polecenie 0x${f.cmd.toString(16).toUpperCase()}, ${f.payload.length} B danych, CRC ${f.crcOk ? 'OK' : 'niezgodne'}` +
        (f.mode !== undefined ? `, tryb 0x${f.mode.toString(16).toUpperCase()}` : '') +
        (f.meters !== undefined ? `, odległość ${f.meters.toFixed(4)} m` : ''),
    );
  }
  const c = floatCandidates(bytes);
  if (c.length) out.push('float32 LE: ' + c.map((x) => `[${x.offset}] ${x.meters} m`).join(', '));
  return out;
}

function entryText(e: LogEntry) {
  const dir = e.kind === 'in' ? '←' : e.kind === 'out' ? '→' : e.kind === 'error' ? '!' : '·';
  return `${time(e.at)} ${dir} ${e.char ? e.char + ' ' : ''}${e.bytes ? toHex(e.bytes) : (e.text ?? '')}`;
}

/** Ekran do sprawdzenia protokołu na konkretnym egzemplarzu dalmierza */
export function LaserDiagnostics({ onClose }: { onClose: () => void }) {
  const s = useLaser();
  const log = useLaserLog();
  const [hex, setHex] = useState(toHex(ENABLE_SYNC));
  const leica = s.brand === 'leica';
  const [extra, setExtra] = useState('');
  const [test, setTest] = useState(0);
  const [copied, setCopied] = useState(false);
  const supported = !!getBluetooth();
  const connected = s.status === 'connected';
  const bytes = fromHex(hex);
  const extraServices = extra
    .split(/[\s,]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const copy = async () => {
    const text = [`Rigipsiarz – dziennik dalmierza (${s.deviceName ?? 'brak nazwy'}, protokół: ${s.brand ?? 'nierozpoznany'})`, navigator.userAgent, ...log.map(entryText)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Skopiuj dziennik:', text);
    }
  };

  return (
    <div className="project diag">
      <header className="topbar">
        <button className="icon-btn" onClick={onClose} aria-label="Wróć">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="diag-title">Dalmierz – diagnostyka</h1>
      </header>

      <section className="card">
        <p className="small">
          Ten ekran pokazuje surowe dane z dalmierza Bluetooth: Bosch (PLR 30 C / 40 C / 50 C, GLM 50 C) albo Leica DISTO (D1, D110,
          D2, X3, X4, D510, D810 i inne z Bluetooth Smart). Tu sprawdzisz, czy Twój egzemplarz odpowiada tak, jak zakłada aplikacja.
          Obsługa Leica jest zbudowana z publicznego opisu protokołu i nie była jeszcze sprawdzona na prawdziwym dalmierzu – dziennik
          z pierwszego pomiaru bardzo pomoże.
        </p>
        {!supported && (
          <p className="error small">
            Ta przeglądarka nie obsługuje Web Bluetooth. Użyj Chrome na Androidzie (lub Chrome/Edge na komputerze), otwierając aplikację przez HTTPS.
          </p>
        )}
        <ol className="small diag-steps">
          <li>Włącz dalmierz i Bluetooth na nim (przycisk z ikoną BT, na ekranie pojawi się symbol).</li>
          <li>
            Zamknij aplikację producenta (Bosch MeasureOn, Leica DISTO Plan), jeśli jest otwarta – dalmierz łączy się tylko z jednym
            telefonem naraz.
          </li>
          <li>Naciśnij „Połącz” i wybierz dalmierz z listy.</li>
          <li>Dotknij pola testowego poniżej i wykonaj pomiar przyciskiem na dalmierzu.</li>
          <li>Jeśli wartość się nie wpisała, naciśnij „Kopiuj dziennik” i wklej go w rozmowie.</li>
        </ol>
        <div className="diag-status">
          Stan: <strong>{s.status === 'connected' ? `połączono – ${s.deviceName ?? 'bez nazwy'}` : s.status}</strong>
          {s.diagnostic && connected && ' (tryb diagnostyczny)'}
        </div>
        {s.error && <p className="error small">{s.error}</p>}
        <div className="laser-actions">
          <button className="btn primary" disabled={!supported || s.status === 'connecting'} onClick={() => connectLaser({ extraServices })}>
            Połącz (Bosch, Leica)
          </button>
          <button className="btn" disabled={!supported || s.status === 'connecting'} onClick={() => connectLaser({ diagnostic: true, extraServices })}>
            Połącz – wszystkie urządzenia
          </button>
          {(connected || s.status === 'reconnecting') && (
            <button className="btn ghost" onClick={disconnectLaser}>
              Rozłącz
            </button>
          )}
        </div>
        <small className="hint">
          Dalmierz, który udaje klawiaturę (tryb „klawiatura”/HID, np. Leica, Stabila, Hilti), nie potrzebuje łączenia tutaj: sparuj go
          w ustawieniach Bluetooth telefonu, dotknij pole wymiaru i zmierz – wynik wpisze się jak z klawiatury.
        </small>
        <small className="hint">
          „Wszystkie urządzenia” pokazuje każde urządzenie BLE w pobliżu i nasłuchuje wszystkich charakterystyk – przydatne, gdy dalmierza
          nie ma na liście z filtrem.
        </small>
      </section>

      <section className="card">
        <DimInput label="Pole testowe – dotknij, potem zmierz" value={test} onChange={setTest} min={0} unit="m" />
        {s.last && (
          <p className="small">
            Ostatni rozpoznany pomiar: <strong>{fmtMeters(s.last.cm)}</strong> o {time(s.last.at)}
          </p>
        )}
      </section>

      <section className="card">
        <div className="field">
          <label htmlFor="diag-hex">Wyślij bajty (hex)</label>
          <div className="diag-row">
            <input id="diag-hex" className="diag-input" value={hex} onChange={(e) => setHex(e.target.value)} spellCheck={false} autoCapitalize="characters" />
            <button className="btn" disabled={!connected || !bytes} onClick={() => bytes && send(bytes)}>
              Wyślij
            </button>
          </div>
          <small className="hint">
            Bosch: włączenie synchronizacji pomiarów (C0 55 02 01 00 1A), aplikacja wysyła je sama po połączeniu. Leica: 67 („g”) wyzwala
            pomiar z telefonu.
          </small>
          {leica && hex !== toHex(LEICA_MEASURE) && (
            <button className="btn ghost small" onClick={() => setHex(toHex(LEICA_MEASURE))}>
              Wstaw polecenie Leica „zmierz”
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="diag-svc">Dodatkowe usługi BLE (UUID, opcjonalnie)</label>
          <input id="diag-svc" className="diag-input" value={extra} onChange={(e) => setExtra(e.target.value)} spellCheck={false} placeholder="np. 0000fff0-0000-1000-8000-00805f9b34fb" />
          <small className="hint">Przeglądarka pokazuje tylko usługi zgłoszone przed połączeniem. Ustaw przed „Połącz”.</small>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Dziennik ({log.length})</h2>
          <div className="laser-actions">
            <button className="btn small" onClick={copy} disabled={!log.length}>
              {copied ? 'Skopiowano' : 'Kopiuj dziennik'}
            </button>
            <button className="btn ghost small" onClick={laser.clearLog} disabled={!log.length}>
              Wyczyść
            </button>
          </div>
        </div>
        {log.length === 0 ? (
          <p className="muted small">Brak danych. Połącz dalmierz i wykonaj pomiar.</p>
        ) : (
          <ol className="diag-log">
            {[...log].reverse().map((e) => (
              <li key={e.id} className={e.kind}>
                <code>{entryText(e)}</code>
                {e.kind === 'in' && e.bytes && describe(e.bytes, e.uuid).map((d, i) => <small key={i}>{d}</small>)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
