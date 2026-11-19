// Krótki, czytelny opis systemu (ruszt i płyty) zamiast samego numeru z katalogu producenta.

import { boardById, layerBoards, type WallSystem } from './rigips';

/** Grubość płyty w mm po polsku: 12.5 → „12,5” */
const mm = (t: number) => String(t).replace('.', ',');

/** Ruszt ściany: „CW 50”, „2×CW 75”, „CD 60”… */
function wallFrameLabel(s: WallSystem): string {
  switch (s.frame) {
    case 'single':
      return `${s.category === 'szacht' ? 'Szacht ' : ''}CW ${s.profile}${s.akuStuds ? ' Aku' : ''}${s.ls ? ' + łączniki LS' : ''}`;
    case 'double':
      return `2×CW ${s.profile}${s.akuStuds ? ' Aku' : ''}`;
    case 'separate':
      return `2×CW ${s.profile} rozsunięte`;
    case 'cd-lining':
      return 'Okładzina CD 60';
    case 'hat-lining':
      return 'Kapelusz 15/48';
    case 'glued':
      return 'Okładzina na klej';
    case 'point-fix':
      return 'ATLAS 3G';
    case 'panel':
      return 'Szacht bez słupków';
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
  const full = `${wallFrameLabel(s)}, ${boards}${sideBShort(s)}`;
  if (full.length <= 36 || !s.sideB?.length) return full;
  // za długi opis przy różnym poszyciu stron: liczba warstw i zakres grubości
  const all = [...layerBoards(s, boardId ?? s.defaultBoard), ...s.sideB].map((id) => boardById(id).thickness);
  return `${wallFrameLabel(s)}, ${Math.max(s.layers, s.sideB.length)}×${mm(Math.min(...all))}–${mm(Math.max(...all))}`;
}

/** Inne poszycie strony B: „ / 1×12,5” albo „ / 1×15 + 2×18” (strona A / strona B, warstwy od rusztu) */
function sideBShort(s: WallSystem): string {
  if (!s.sideB?.length || s.sides < 2) return '';
  const groups: { t: number; n: number }[] = [];
  for (const t of s.sideB.map((id) => boardById(id).thickness)) {
    const last = groups[groups.length - 1];
    if (last && last.t === t) last.n++;
    else groups.push({ t, n: 1 });
  }
  return ' / ' + groups.map((g) => `${g.n}×${mm(g.t)}`).join(' + ');
}
