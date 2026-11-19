import { useState, type ReactNode } from 'react';

/** Okrągły przycisk „?” – otwiera i zamyka objaśnienie */
export function HelpButton({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`chip help-chip ${open ? 'on' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      title={label}
    >
      ?
    </button>
  );
}

/** Tekst objaśnienia pod przyciskiem „?” */
export function HelpText({ children }: { children: ReactNode }) {
  return (
    <p className="help-text muted small" role="note">
      {children}
    </p>
  );
}

/**
 * Przycisk „?” z objaśnieniem zwiniętym domyślnie – opisy nie zajmują ekranu,
 * dopóki ktoś o nie nie poprosi.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HelpButton open={open} onToggle={() => setOpen((x) => !x)} label={label} />
      {open && <HelpText>{children}</HelpText>}
    </>
  );
}
