import { PROFILE_FAMILIES, profileLengthChoices, profileLengthLabel, type AppProfileLengths, type ProfileLengthPref } from '../calc/profileLength';

/**
 * Domyślne długości profili w aplikacji (CW, UW, CD, UD). W projekcie każdą pozycję
 * można przestawić osobno na liście zakupów.
 */
export function ProfileLengthsField({
  value,
  onChange,
  label = 'Długość profili',
}: {
  value: AppProfileLengths;
  onChange: (v: AppProfileLengths) => void;
  label?: string;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {PROFILE_FAMILIES.map((f) => {
        const cur: ProfileLengthPref = value[f] ?? 'auto';
        const opts: ProfileLengthPref[] = ['auto', ...profileLengthChoices(f)];
        return (
          <div key={f} className="profile-len-row">
            <span className="muted small profile-len-name">{f}</span>
            <div className="seg" role="radiogroup" aria-label={`Długość profili ${f}`}>
              {opts.map((o) => (
                <button
                  type="button"
                  key={String(o)}
                  role="radio"
                  aria-checked={cur === o}
                  className={cur === o ? 'on' : ''}
                  onClick={() => {
                    const next = { ...value };
                    if (o === 'auto') delete next[f];
                    else next[f] = o;
                    onChange(next);
                  }}
                >
                  {profileLengthLabel(o)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <small className="hint">
        Auto – najkrótsza pasująca długość z katalogu. Wybrana długość: rozkrój, przedłużenia (CW na zakład, CD łącznikiem wzdłużnym) i ścinki
        liczone z tej długości. W projekcie możesz zmienić długość każdego profilu na liście zakupów.
      </small>
    </div>
  );
}
