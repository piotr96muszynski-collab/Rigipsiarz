import { boardById, wallSystemById } from '../catalog/rigips';
import type { Wall } from '../model/types';

/** Grubość ściany w cm (profil + płyty) */
export function wallThickness(w: Wall): number {
  const sys = wallSystemById(w.systemId);
  const board = boardById(w.boardId);
  return (sys.profile + sys.layers * sys.sides * board.thickness) / 10;
}

export const wallColor = (w: Wall) => boardById(w.boardId).color;

export const fmtCm = (cm: number) => `${Math.round(cm)} cm`;
export const fmtM = (cm: number) => `${(cm / 100).toFixed(2).replace('.', ',')} m`;
export const fmtNum = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');
