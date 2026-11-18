import { useEffect, useRef, useState } from 'react';
import { useBack } from './back';
import { connectLaser, disconnectLaser } from '../device/laser';
import { fmtMeters, useLaser } from './useLaser';

const STATUS: Record<string, string> = {
  idle: 'Dalmierz niepołączony',
  connecting: 'Łączenie z dalmierzem…',
  reconnecting: 'Ponowne łączenie…',
  connected: 'Dalmierz połączony',
};

/** Przycisk dalmierza w nagłówku: łączy, pokazuje stan i ostatni pomiar */
export function LaserButton() {
  const s = useLaser();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useBack(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (s.status === 'unsupported') return null;
  const busy = s.status === 'connecting' || s.status === 'reconnecting';

  return (
    <div className="laser" ref={box}>
      <button
        className={`icon-btn laser-btn ${s.status}`}
        aria-label={STATUS[s.status]}
        title={STATUS[s.status]}
        aria-expanded={open}
        // nie zabieraj fokusu polu wymiaru – dzięki temu pomiar trafi tam, gdzie użytkownik pisał
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => (s.status === 'idle' && !s.error ? connectLaser() : setOpen((o) => !o))}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="7" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 12h6M18 9.5l3 2.5-3 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="laser-dot" aria-hidden />
      </button>
      {open && (
        <div className="laser-pop card" role="dialog" aria-label="Dalmierz">
          <strong>{s.status === 'connected' ? (s.deviceName ?? 'Dalmierz') : STATUS[s.status]}</strong>
          {s.error && <p className="error small">{s.error}</p>}
          {s.status === 'connected' && (
            <p className="muted small">Dotknij pole wymiaru i naciśnij pomiar na dalmierzu. Wynik wpisze się sam.</p>
          )}
          {s.last && (
            <p className="small">
              Ostatni pomiar: <strong>{fmtMeters(s.last.cm)}</strong>
              {s.last.inserted ? ' (wpisany)' : ' (żadne pole nie było aktywne)'}
            </p>
          )}
          <div className="laser-actions">
            {s.status === 'connected' || busy ? (
              <button className="btn small" onClick={() => (disconnectLaser(), setOpen(false))}>
                Rozłącz
              </button>
            ) : (
              <button className="btn primary small" onClick={() => (setOpen(false), connectLaser())}>
                Połącz dalmierz
              </button>
            )}
            <a className="btn ghost small" href="#dalmierz" onClick={() => setOpen(false)}>
              Diagnostyka
            </a>
          </div>
        </div>
      )}
      <MeasureFlash />
    </div>
  );
}

/** Krótki komunikat po każdym pomiarze */
function MeasureFlash() {
  const { last } = useLaser();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!last) return;
    setShown(last.at);
    const t = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(t);
  }, [last]);
  if (!last || shown !== last.at) return null;
  return (
    <div className={`toast laser-flash ${last.inserted ? '' : 'warn'}`} role="status">
      {fmtMeters(last.cm)} {last.inserted ? '– wpisano' : '– najpierw dotknij pole wymiaru'}
    </div>
  );
}
