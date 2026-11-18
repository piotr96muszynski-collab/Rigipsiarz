import {
  CEILING_KIND_LABEL,
  WALL_CATEGORY_LABEL,
  allCeilingSystems,
  allWallSystems,
  isLiningSystem,
  type CeilingKind,
  type WallCategory,
} from '../catalog/rigips';

interface Props {
  id: string;
  value: string;
  onChange: (id: string) => void;
}

const label = (s: { name: string; code?: string; custom?: boolean }) =>
  `${s.name}${s.code ? ` · ${s.code}` : ''}${s.custom ? ' (własny)' : ''}`;

/** Lista systemów ścian pogrupowana wg rodzaju (z systemami własnymi na końcu) */
export function WallSystemSelect({ id, value, onChange }: Props) {
  const all = allWallSystems();
  const cats = Object.keys(WALL_CATEGORY_LABEL) as WallCategory[];
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {cats.map((c) => {
        const list = all.filter((s) => s.category === c && !s.custom);
        return list.length ? (
          <optgroup key={c} label={WALL_CATEGORY_LABEL[c]}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
      {all.some((s) => s.custom) && (
        <optgroup label="Systemy własne">
          {all
            .filter((s) => s.custom)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
        </optgroup>
      )}
    </select>
  );
}

/**
 * Systemy okładzin istniejących ścian: jednostronne systemy mocowane do muru z katalogu
 * (Rigips: klej, CD na ES; ATLAS M-System 3G; systemy własne).
 */
export function LiningSystemSelect({ id, value, onChange }: Props) {
  const all = allWallSystems().filter(isLiningSystem);
  const groups = new Map<string, typeof all>();
  for (const s of all) {
    const g = s.custom ? 'Systemy własne' : WALL_CATEGORY_LABEL[s.category];
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {[...groups].map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {label(s)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function CeilingSystemSelect({ id, value, onChange }: Props) {
  const all = allCeilingSystems();
  const kinds = Object.keys(CEILING_KIND_LABEL) as CeilingKind[];
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {kinds.map((k) => {
        const list = all.filter((s) => s.kind === k && !s.custom);
        return list.length ? (
          <optgroup key={k} label={CEILING_KIND_LABEL[k]}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
      {all.some((s) => s.custom) && (
        <optgroup label="Systemy własne">
          {all
            .filter((s) => s.custom)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
        </optgroup>
      )}
    </select>
  );
}

/** Ostrzeżenia z wyliczeń (np. przekroczona wysokość lub rozpiętość) */
export function Warnings({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="warnings" role="status">
      {items.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}
