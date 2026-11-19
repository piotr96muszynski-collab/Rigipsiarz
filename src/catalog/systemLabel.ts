// Krótki, czytelny opis systemu (ruszt i płyty) zamiast samego numeru z katalogu producenta.

import { boardById, layerBoards, type WallSystem } from './rigips';

/** Grubość płyty w mm po polsku: 12.5 → „12,5” */
const mm = (t: number) => String(t).replace('.', ',');

/** Warstwy jednej strony zebrane w grupy kolejnych takich samych płyt, od rusztu */
export function boardGroups(s: Pick<WallSystem, 'layers' | 'innerBoard' | 'innerLayers' | 'baseBoard' | 'baseLayers' | 'defaultBoard'>, boardId?: string, innerBoardId?: string): { id: string; n: number }[] {
  const out: { id: string; n: number }[] = [];
  for (const id of layerBoards(s, boardId ?? s.defaultBoard, innerBoardId)) {
    const last = out[out.length - 1];
    if (last?.id === id) last.n++;
    else out.push({ id, n: 1 });
  }
  return out;
}

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
  // grupy o tej samej grubości łączymy („1×12,5 PRO + 1×12,5 Habito” → „2×12,5”)
  const byTh: { th: number; n: number }[] = [];
  for (const g of boardGroups(s, boardId)) {
    const th = boardById(g.id).thickness;
    const last = byTh[byTh.length - 1];
    if (last?.th === th) last.n += g.n;
    else byTh.push({ th, n: g.n });
  }
  const boards = byTh.map((g) => `${g.n}×${mm(g.th)}`).join(' + ');
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
