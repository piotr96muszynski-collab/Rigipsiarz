import { useId, useState, type ReactNode } from 'react';

/**
 * Mały przycisk „i” obok etykiety. Opis pokazuje się dopiero po dotknięciu, pod etykietą,
 * żeby długie objaśnienia nie wydłużały strony. Drugie dotknięcie chowa opis.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={`info-tip${open ? ' on' : ''}`}
        aria-label={`Opis: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open && (
        <div id={id} className="info-tip-text" role="note">
          {children}
        </div>
      )}
    </>
  );
}
