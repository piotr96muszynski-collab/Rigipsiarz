import {
  CEILING_KIND_LABEL,
  WALL_CATEGORY_LABEL,
  allCeilingSystems,
  allWallSystems,
  isLiningSystem,
  type CeilingKind,
  type WallCategory,
} from '../catalog/rigips';
import { Picker, type PickOption } from './Picker';

interface Props {
  id: string;
  value: string;
  onChange: (id: string) => void;
  /** Tytuł arkusza wyboru */
  label?: string;
}

type Sys = { id: string; name: string; code?: string; custom?: boolean; info?: string };

const option = (s: Sys, group: string): PickOption<string> => ({
  value: s.id,
  label: s.name,
  hint: [s.code, s.custom ? 'system własny' : ''].filter(Boolean).join(' · ') || undefined,
  group,
});

/** Lista systemów ścian pogrupowana wg rodzaju (z systemami własnymi na końcu) */
export function WallSystemSelect({ id, value, onChange, label = 'System ściany' }: Props) {
  const all = allWallSystems();
  const cats = Object.keys(WALL_CATEGORY_LABEL) as WallCategory[];
  const options = [
    ...cats.flatMap((c) => all.filter((s) => s.category === c && !s.custom).map((s) => option(s, WALL_CATEGORY_LABEL[c]))),
    ...all.filter((s) => s.custom).map((s) => option(s, 'Systemy własne')),
  ];
  return <Picker id={id} label={label} value={value} options={options} onChange={onChange} mode="sheet" />;
}

/**
 * Systemy okładzin istniejących ścian: jednostronne systemy mocowane do muru z katalogu
 * (Rigips: klej, CD na ES; ATLAS M-System 3G; systemy własne).
 */
export function LiningSystemSelect({ id, value, onChange, label = 'System okładziny' }: Props) {
  const all = allWallSystems().filter(isLiningSystem);
  const groups = new Map<string, typeof all>();
  for (const s of all) {
    const g = s.custom ? 'Systemy własne' : WALL_CATEGORY_LABEL[s.category];
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  const options = [...groups].flatMap(([g, list]) => list.map((s) => option(s, g)));
  return <Picker id={id} label={label} value={value} options={options} onChange={onChange} mode="sheet" />;
}

export function CeilingSystemSelect({ id, value, onChange, label = 'System sufitu' }: Props) {
  const all = allCeilingSystems();
  const kinds = Object.keys(CEILING_KIND_LABEL) as CeilingKind[];
  const options = [
    ...kinds.flatMap((k) => all.filter((s) => s.kind === k && !s.custom).map((s) => option(s, CEILING_KIND_LABEL[k]))),
    ...all.filter((s) => s.custom).map((s) => option(s, 'Systemy własne')),
  ];
  return <Picker id={id} label={label} value={value} options={options} onChange={onChange} mode="sheet" />;
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
