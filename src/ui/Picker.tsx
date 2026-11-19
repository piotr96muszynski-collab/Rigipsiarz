import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBack } from './back';

/**
 * Wybór z listy wygodny na telefonie (zamiast natywnego <select>):
 * - kilka krótkich opcji → przyciski segmentowe, wszystko widać od razu, jedno dotknięcie,
 * - dłuższa lista → przycisk z bieżącą wartością, który otwiera arkusz u dołu ekranu
 *   z dużymi opcjami, grupami i opisami (na komputerze okno na środku).
 * Wstecz i Esc zamykają arkusz.
 */

export interface PickOption<T extends string | number> {
  value: T;
  label: string;
  /** Krótsza nazwa na przycisku zamkniętej listy / w segmentach */
  short?: string;
  /** Opis pod nazwą w arkuszu */
  hint?: string;
  /** Nagłówek grupy w arkuszu (kolejne opcje z tą samą grupą trafiają pod jeden nagłówek) */
  group?: string;
}

export interface PickerProps<T extends string | number> {
  id?: string;
  /** Nazwa pola: tytuł arkusza i etykieta dla czytników ekranu */
  label: string;
  value: T;
  options: PickOption<T>[];
  onChange: (value: T) => void;
  /** auto: segmenty dla 2–3 krótkich opcji, w pozostałych przypadkach arkusz */
  mode?: 'auto' | 'segments' | 'sheet';
  className?: string;
}

/** Czy opcje zmieszczą się jako segmenty w jednym rzędzie na telefonie */
export function fitsSegments(options: PickOption<string | number>[]) {
  if (options.length < 2 || options.length > 3 || options.some((o) => o.group)) return false;
  return options.reduce((n, o) => n + (o.short ?? o.label).length, 0) <= 28;
}

export function Picker<T extends string | number>({ id, label, value, options, onChange, mode = 'auto', className = '' }: PickerProps<T>) {
  const segments = mode === 'segments' || (mode === 'auto' && fitsSegments(options));
  if (segments) {
    return (
      <div id={id} className={`seg picker-seg ${className}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'on' : ''}
            title={o.hint}
            onClick={() => onChange(o.value)}
          >
            {o.short ?? o.label}
          </button>
        ))}
      </div>
    );
  }
  return <SheetPicker id={id} label={label} value={value} options={options} onChange={onChange} className={className} />;
}

function SheetPicker<T extends string | number>({ id, label, value, options, onChange, className }: Omit<PickerProps<T>, 'mode'>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    btn.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`picker-btn ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="picker-value">{current ? (current.short ?? current.label) : 'Wybierz…'}</span>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <PickerSheet
          label={label}
          value={value}
          options={options}
          onPick={(v) => {
            close();
            if (v !== value) onChange(v);
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function PickerSheet<T extends string | number>({
  label,
  value,
  options,
  onPick,
  onClose,
}: {
  label: string;
  value: T;
  options: PickOption<T>[];
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const list = useRef<HTMLDivElement>(null);
  useBack(true, onClose);

  useEffect(() => {
    // bieżąca opcja widoczna i z fokusem (klawiatura: strzałki/Tab, Enter wybiera)
    const on = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? list.current?.querySelector('button');
    on?.scrollIntoView({ block: 'center' });
    on?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const btns = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      const next = btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    };
    // capture: arkusz zatrzymuje propagację klawiszy (żeby nie trafiały do planu), więc nasłuch musi być przed nim
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let lastGroup: string | undefined;
  return createPortal(
    <div
      className="picker-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="picker-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <span className="picker-grab" aria-hidden />
        <header className="picker-head">
          <strong id={titleId}>{label}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="picker-list" ref={list} role="listbox" aria-labelledby={titleId}>
          {options.map((o) => {
            const head = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const on = o.value === value;
            return (
              <div key={String(o.value)} role="presentation">
                {head && <div className="picker-group">{head}</div>}
                <button type="button" role="option" aria-selected={on} className={`picker-opt ${on ? 'on' : ''}`} onClick={() => onPick(o.value)}>
                  <span>
                    <span className="picker-label">{o.label}</span>
                    {o.hint && <small>{o.hint}</small>}
                  </span>
                  {on && (
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
