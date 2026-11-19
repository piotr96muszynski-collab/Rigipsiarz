import type { CeilingSystem, WallSystem } from '../catalog/rigips';
import { VAPOR_RATES } from '../catalog/vaporBarrier';
import { isAtticSystem } from './recommend';

/**
 * Paroizolacja w systemie:
 * - 'system' – element systemu na karcie producenta (poddasza), domyślnie włączona,
 * - 'optional' – karta dopuszcza ją „w razie potrzeby” / po analizie cieplno-wilgotnościowej, domyślnie wyłączona,
 * - 'none' – brak miejsca na folię (płyta klejona, ATLAS M-System).
 */
export type VaporMode = 'system' | 'optional' | 'none';

export interface VaporBarrierSpec {
  mode: VaporMode;
  /** Folia m² na m² zabudowy */
  foil: number;
  /** Taśma do zakładów mb na m² */
  overlapTape: number;
  /** Taśma dwustronna (mocowanie do rusztu) mb na m² */
  doubleTape: number;
  /** Skąd wartości – do opisu w zestawieniu i na rysunku */
  source: string;
  /** true = wartości przyjęte, nie z karty tego producenta */
  assumed: boolean;
}

const NONE: VaporBarrierSpec = { mode: 'none', foil: 0, overlapTape: 0, doubleTape: 0, source: '', assumed: false };

/** Zużycie paroizolacji dla dowolnej powierzchni – wspólne dla sufitów, okładzin i poddaszy */
function spec(mode: VaporMode, source: string, assumed: boolean): VaporBarrierSpec {
  return { mode, ...VAPOR_RATES, source, assumed };
}

export function ceilingVaporSpec(sys: CeilingSystem): VaporBarrierSpec {
  if (sys.kind === 'point-fix') return NONE;
  const maker = sys.maker ?? 'rigips';
  if (isAtticSystem(sys)) {
    if (maker === 'rigips') return spec('system', `karta Rigips ${sys.code ?? '4.70.0x'}`, false);
    if (maker === 'norgips') return spec('system', 'Norgips ZP (folia w systemie; zakłady i taśmy wg kart Rigips)', true);
    return spec('system', 'założenie wg kart Rigips 4.70.0x (Knauf nie podaje folii)', true);
  }
  return spec('optional', 'w razie potrzeby wg analizy cieplno-wilgotnościowej; zużycie wg kart Rigips 4.70.0x', true);
}

export function wallVaporSpec(sys: WallSystem): VaporBarrierSpec {
  if (sys.frame === 'glued' || sys.frame === 'point-fix') return NONE;
  return spec('optional', 'w razie potrzeby wg analizy cieplno-wilgotnościowej; zużycie wg kart Rigips 4.70.0x', true);
}

/** Czy paroizolacja jest liczona: wybór użytkownika, a bez wyboru – domyślnie wg systemu */
export function vaporBarrierOn(choice: boolean | undefined, s: VaporBarrierSpec): boolean {
  if (s.mode === 'none') return false;
  return choice ?? s.mode === 'system';
}

/** Minimalny kształt zapotrzebowania, żeby funkcja nie zależała od materials.ts */
interface VaporReq {
  area: Record<string, number>;
  meters: Record<string, number>;
  notes?: Record<string, string[]>;
}

const add = (rec: Record<string, number>, key: string, v: number) => {
  if (v > 0) rec[key] = (rec[key] ?? 0) + v;
};

/**
 * Dodaje folię paroizolacyjną i taśmy dla powierzchni `areaM2` (netto, m²).
 * Używana przez sufity, okładziny ścian i poddasza (skosy, jętka, ścianka kolankowa).
 */
export function vaporBarrierLines(req: VaporReq, areaM2: number, s: VaporBarrierSpec): void {
  if (s.mode === 'none' || areaM2 <= 0) return;
  add(req.area, 'FOLIA_PAROIZ', areaM2 * s.foil);
  add(req.meters, 'TASMA_PAROIZ', areaM2 * s.overlapTape);
  add(req.meters, 'TASMA_DWUSTR', areaM2 * s.doubleTape);
  const notes = (req.notes ??= {});
  const note = (pid: string, t: string) => {
    const list = (notes[pid] ??= []);
    if (!list.includes(t)) list.push(t);
  };
  note('FOLIA_PAROIZ', `${s.foil.toFixed(2).replace('.', ',')} m²/m² z zakładami ok. 10 cm (${s.source})`);
  note('TASMA_PAROIZ', 'zakłady folii; przy ścianach i przejściach dodatkowo uszczelniacz (np. Vario DoubleFit+) w razie potrzeby');
}
