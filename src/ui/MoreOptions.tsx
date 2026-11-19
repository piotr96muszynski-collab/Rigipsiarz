import { useId, useState, type ReactNode } from 'react';

const KEY = 'rigipsiarz.moreOptions';

function readOpen(kind: string): boolean {
  try {
    return !!JSON.parse(localStorage.getItem(KEY) ?? '{}')?.[kind];
  } catch {
    return false;
  }
}
function writeOpen(kind: string, open: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
    all[kind] = open;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* brak dostępu do pamięci – sekcja po prostu startuje zwinięta */
  }
}

/**
 * Zwinięta sekcja rzadziej zmienianych pól. Zwinięta pokazuje podsumowanie w etykietach,
 * żeby było widać ustawienia bez rozwijania. Stan (rozwinięta / zwinięta) pamiętamy osobno
 * dla ścian i sufitów, żeby przy przechodzeniu między elementami nie trzeba było klikać od nowa.
 */
export function MoreOptions({ kind, summary, children }: { kind: 'wall' | 'ceiling'; summary: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(() => readOpen(kind));
  const body = useId();
  const toggle = () => {
    setOpen(!open);
    writeOpen(kind, !open);
  };
  return (
    <section className={`more-options ${open ? 'open' : ''}`}>
      <button type="button" className="more-head" aria-expanded={open} aria-controls={body} onClick={toggle}>
        <span>Więcej opcji</span>
        <svg viewBox="0 0 24 24" className="more-caret" aria-hidden>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!open && (
        <button type="button" className="more-summary" onClick={toggle} tabIndex={-1} aria-hidden>
          {summary.map((s) => (
            <span key={s} className="more-tag">
              {s}
            </span>
          ))}
        </button>
      )}
      {open && (
        <div id={body} className="more-body">
          {children}
        </div>
      )}
    </section>
  );
}

/** Krótka linia z przyciskiem „i”, który rozwija dłuższy opis (zamiast stałych akapitów pod polami) */
export function InfoLine({ children, more }: { children?: ReactNode; more: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="info-line">
      <div className="info-short">
        <div className="info-main">{children}</div>
        <button type="button" className="info-btn" aria-expanded={open} aria-label={open ? 'Ukryj opis' : 'Pokaż opis'} onClick={() => setOpen(!open)}>
          i
        </button>
      </div>
      {open && <small className="hint info-more">{more}</small>}
    </div>
  );
}
