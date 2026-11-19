import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { connectLaser } from '../device/laser';
import { useBack } from './back';
import { DimInput } from './DimInput';
import { isActiveMeasureTarget, setActiveMeasureTarget } from './measure';
import { fmtMeters, useLaser } from './useLaser';

interface Props {
  title: string;
  /** obecna długość w cm */
  value: number;
  min?: number;
  /** zapis nowej długości (cm); fromLaser = wartość przyszła z dalmierza */
  onSave: (cm: number, fromLaser: boolean) => void;
  onClose: () => void;
}

/**
 * Uproszczone okno zmiany wymiaru otwierane dotknięciem opisu na planie.
 * Od razu czeka na pomiar z dalmierza: pomiar zapisuje się sam i zamyka okno (Cofnij przywraca poprzednią wartość).
 * Bez dalmierza wpisuje się wartość ręcznie i zatwierdza „Zapisz”.
 */
export function LengthSheet({ title, value, min = 10, onSave, onClose }: Props) {
  const titleId = useId();
  const laser = useLaser();
  const [draft, setDraft] = useState(value);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useBack(true, onClose);
  // „duch” kliknięcia z dotknięcia, które otworzyło okno, nie może go od razu zamknąć
  const openedAt = useRef(Date.now());

  // okno samo jest odbiorcą pomiaru (bez fokusu w polu – nie wyskakuje klawiatura)
  const listener = useRef((cm: number) => {
    if (cm >= min) saveRef.current(cm, true);
  });
  useEffect(() => {
    const l = listener.current;
    setActiveMeasureTarget(l);
    return () => {
      if (isActiveMeasureTarget(l)) setActiveMeasureTarget(null);
    };
  }, []);

  const connected = laser.status === 'connected';
  const busy = laser.status === 'connecting' || laser.status === 'reconnecting';

  return createPortal(
    <div
      className="picker-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        if (Date.now() - openedAt.current > 400) onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="picker-sheet length-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <span className="picker-grab" aria-hidden />
        <header className="picker-head">
          <strong id={titleId}>{title}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {/* po wyjściu z pola pomiar znów zapisuje się od razu */}
        <div className="length-body" onBlur={() => setActiveMeasureTarget(listener.current)}>
          {laser.status !== 'unsupported' && (
            <div className={`length-laser ${laser.status}`}>
              <span className="laser-dot" aria-hidden />
              {connected ? (
                <span>Zmierz dalmierzem – wynik zapisze się sam.</span>
              ) : busy ? (
                <span>Łączenie z dalmierzem…</span>
              ) : (
                <>
                  <span>Dalmierz niepołączony</span>
                  <button type="button" className="btn small" onClick={() => connectLaser()}>
                    Połącz
                  </button>
                </>
              )}
            </div>
          )}
          <DimInput label="Długość" unit="m" value={draft} min={min} onChange={setDraft} hint={`Teraz: ${fmtMeters(value)}`} />
          <div className="length-actions">
            <button type="button" className="btn" onClick={onClose}>
              Anuluj
            </button>
            <button type="button" className="btn primary" disabled={Math.abs(draft - value) < 0.05} onClick={() => onSave(draft, false)}>
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
