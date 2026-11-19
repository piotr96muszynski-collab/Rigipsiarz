import { boardById, boardStackMm, wallFrameDepth, wallSystemById } from '../catalog/rigips';
import type { Lining, Wall } from '../model/types';

/** Grubość ściany w cm (profil + płyty) */
export function wallThickness(w: Wall): number {
  if (w.kind === 'existing') return w.thickness ?? 25;
  const sys = wallSystemById(w.systemId);
  return (wallFrameDepth(sys) + sys.sides * boardStackMm(sys, w.boardId, w.innerBoardId)) / 10;
}

export const wallColor = (w: Wall) => boardById(w.boardId).color;

export const fmtCm = (cm: number) => `${Math.round(cm)} cm`;
export const fmtM = (cm: number) => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
export const fmtNum = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');

/** Grubość okładziny w cm (ruszt/klej + płyty) */
export function liningThickness(l: Lining): number {
  const sys = wallSystemById(l.systemId);
  return (wallFrameDepth(sys) + boardStackMm(sys, l.boardId, l.innerBoardId)) / 10;
}
