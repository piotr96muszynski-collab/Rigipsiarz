/**
 * Podsumowanie zwiniętej sekcji „Więcej opcji” w edytorze ściany i sufitu:
 * krótkie etykiety, żeby bez rozwijania było widać, co jest ustawione.
 */

export interface WallMoreState {
  /** Rozstaw słupków / łączników, cm (brak = system bez rusztu, np. obudowa z samych płyt) */
  spacing?: number;
  /** Ruszt z łącznikami punktowymi (np. ATLAS M-System) zamiast słupków CW */
  pointFix?: boolean;
  /** Czy system ma słupki CW (wtedy pokazujemy pojedyncze / podwójne) */
  cw: boolean;
  doubleStuds?: boolean;
  /** Grubość wełny, mm; undefined = system bez wełny */
  wool?: { on: boolean; mm: number };
  /** undefined = system bez folii */
  vapor?: boolean;
  /** Opisy końców A i B */
  ends?: [string, string];
}

export function wallMoreSummary(s: WallMoreState): string[] {
  const out = s.spacing === undefined ? [] : [s.pointFix ? `łączniki co ${s.spacing} cm` : `rozstaw ${s.spacing} cm`];
  if (s.wool) out.push(s.wool.on ? `wełna ${s.wool.mm} mm` : 'bez wełny');
  if (s.vapor !== undefined) out.push(s.vapor ? 'folia' : 'bez folii');
  if (s.cw) out.push(s.doubleStuds ? 'słupki podwójne' : 'słupki pojedyncze');
  if (s.ends) out.push(s.ends[0] === s.ends[1] ? `końce: ${s.ends[0]}` : `końce: ${s.ends[0]} / ${s.ends[1]}`);
  return out;
}

export interface CeilingMoreState {
  /** Opis kierunku profili, np. „wzdłuż długości” */
  direction: string;
  wool?: { on: boolean; mm: number };
  vapor?: boolean;
}

export function ceilingMoreSummary(s: CeilingMoreState): string[] {
  const out = [`profile ${s.direction}`];
  if (s.wool) out.push(s.wool.on ? `wełna ${s.wool.mm} mm` : 'bez wełny');
  if (s.vapor !== undefined) out.push(s.vapor ? 'folia' : 'bez folii');
  return out;
}

/** Jedna linia opisu otworu w zwiniętej liście: „Drzwi 1: 90×205 cm · 100 cm od początku” */
export function openingSummary(o: { kind: 'door' | 'window'; width: number; height: number; sill: number; offset: number }, name: string) {
  const r = (v: number) => Math.round(v);
  return `${name}: ${r(o.width)}×${r(o.height)} cm${o.kind === 'window' ? ` · parapet ${r(o.sill)} cm` : ''} · ${r(o.offset)} cm od początku`;
}
