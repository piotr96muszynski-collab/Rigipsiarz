import { useEffect, useId, useRef, useState } from 'react';
import { setActiveMeasureTarget } from './measure';

interface Props {
  label: string;
  /** wartość w cm */
  value: number;
  onChange: (cm: number) => void;
  min?: number;
  max?: number;
  unit?: 'cm' | 'm';
  hint?: string;
}

/**
 * Pole wymiaru. Przyjmuje „2,5”, „2.5 m”, „250” albo „250 cm”. W jednostce „m” wartości poniżej 20 traktuje jako metry.
 * Gdy pole ma fokus, może do niego trafić pomiar z dalmierza (zob. measure.ts).
 */
export function DimInput({ label, value, onChange, min = 1, max = 100000, unit = 'cm', hint }: Props) {
  const id = useId();
  const show = (cm: number) => (unit === 'm' ? String(+(cm / 100).toFixed(3)).replace('.', ',') : String(Math.round(cm * 10) / 10).replace('.', ','));
  const [text, setText] = useState(show(value));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const listener = useRef((cm: number) => {
    setText(show(cm));
    onChangeRef.current(cm);
  });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!focused.current) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit]);

  const parse = (s: string): number | null => {
    const m = s.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2] ?? (unit === 'm' ? (n < 20 ? 'm' : 'cm') : 'cm');
    return u === 'mm' ? n / 10 : u === 'm' ? n * 100 : n;
  };

  const commit = (s: string) => {
    const v = parse(s);
    if (v === null) {
      setError('Wpisz liczbę, np. 2,5 m albo 250');
      return;
    }
    if (v < min || v > max) {
      setError(`Dozwolony zakres: ${show(min)}–${show(max)} ${unit}`);
      return;
    }
    setError(null);
    onChange(v);
  };

  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            focused.current = true;
            setActiveMeasureTarget(listener.current);
            e.target.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit(text);
          }}
          onChange={(e) => {
            setText(e.target.value);
            const v = parse(e.target.value);
            if (v !== null && v >= min && v <= max) {
              setError(null);
              onChange(v);
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
        />
        <span className="unit">{unit}</span>
      </div>
      {(error || hint) && (
        <small id={`${id}-msg`} className={error ? 'error' : 'hint'}>
          {error ?? hint}
        </small>
      )}
    </div>
  );
}
