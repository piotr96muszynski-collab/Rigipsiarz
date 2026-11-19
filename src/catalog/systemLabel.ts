// Krótki, czytelny opis systemu (ruszt i płyty) zamiast samego numeru z katalogu producenta.

import { boardById, type WallSystem } from './rigips';

/** Grubość płyty w mm po polsku: 12.5 → „12,5” */
const mm = (t: number) => String(t).replace('.', ',');

/** Ruszt ściany: „CW 50”, „2×CW 75”, „CD 60”… */
function wallFrameLabel(s: WallSystem): string {
  switch (s.frame) {
    case 'single':
      return `${s.category === 'szacht' ? 'Szacht ' : ''}CW ${s.profile}${s.akuStuds ? ' Aku' : ''}`;
    case 'double':
      return `2×CW ${s.profile}${s.akuStuds ? ' Aku' : ''}`;
    case 'separate':
      return `2×CW ${s.profile} rozsunięte`;
    case 'cd-lining':
      return 'Okładzina CD 60';
    case 'glued':
      return 'Okładzina na klej';
    case 'point-fix':
      return 'ATLAS 3G';
  }
}

/**
 * Krótki opis systemu ściany, np. „CW 50, 1×12,5” albo „2×CW 75, 2×12,5”.
 * Płyty jak w kartach producentów: najpierw warstwy wewnętrzne (od rusztu), potem zewnętrzne.
 * `boardId` – płyta wybrana przez użytkownika (zastępuje płytę zewnętrzną systemu).
 */
export function wallSystemShort(s: WallSystem, boardId?: string): string {
  const outer = boardById(boardId ?? s.defaultBoard).thickness;
  const innerN = s.innerBoard ? Math.min(s.innerLayers ?? 0, s.layers) : 0;
  const inner = s.innerBoard ? boardById(s.innerBoard).thickness : outer;
  const boards =
    innerN > 0 && inner !== outer
      ? `${innerN}×${mm(inner)} + ${s.layers - innerN}×${mm(outer)}`
      : `${s.layers}×${mm(outer)}`;
  return `${wallFrameLabel(s)}, ${boards}`;
}
