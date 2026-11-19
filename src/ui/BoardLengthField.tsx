import { BOARD_LENGTH_CHOICES, boardLengthLabel, type BoardLengthPref } from '../calc/boardLength';

const OPTIONS: { value: BoardLengthPref; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  ...BOARD_LENGTH_CHOICES.map((l) => ({ value: l, label: boardLengthLabel(l) })),
];

/**
 * Wybór długości arkuszy płyt. `inherit` – dodatkowa opcja „Jak w aplikacji” (ustawienie projektu).
 */
export function BoardLengthField({
  label,
  value,
  onChange,
  inherit,
  hint,
}: {
  label: string;
  value: BoardLengthPref | undefined;
  onChange: (v: BoardLengthPref | undefined) => void;
  /** ustawienie aplikacji, gdy pole dotyczy projektu */
  inherit?: BoardLengthPref;
  hint?: string;
}) {
  const opts: { value: BoardLengthPref | undefined; label: string }[] =
    inherit !== undefined ? [{ value: undefined, label: `Jak w aplikacji (${inherit === 'auto' ? 'auto' : boardLengthLabel(inherit)})` }, ...OPTIONS] : OPTIONS;
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {opts.map((o) => (
          <button
            type="button"
            key={String(o.value)}
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}
