// Wszystkie wymiary w modelu są w centymetrach.

import type { WoolChoice } from '../catalog/insulation';

export type Id = string;

export interface Point {
  x: number;
  y: number;
}

export interface PlanNode extends Point {
  id: Id;
}

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: Id;
  kind: OpeningKind;
  /** Odległość lewej krawędzi otworu od początku ściany (węzeł a), cm */
  offset: number;
  width: number;
  height: number;
  /** Wysokość parapetu (dla okien), cm. Drzwi = 0 */
  sill: number;
  /** Ościeże wzmocnione profilami UA zamiast CW (ciężkie drzwi) */
  reinforced: boolean;
}

/** Jak zakończona jest ściana w węźle, który nie łączy się z inną ścianą */
export type FreeEndType = 'existing-wall' | 'free';

export interface Wall {
  id: Id;
  a: Id;
  b: Id;
  height: number;
  systemId: string;
  boardId: string;
  /** Rozstaw słupków CW, cm */
  studSpacing: 60 | 40 | 30;
  insulation: boolean;
  /** Grubość wełny, mm (brak = pełna głębokość rusztu) */
  insulationThickness?: number;
  endA: FreeEndType;
  endB: FreeEndType;
  openings: Opening[];
}

export interface Ceiling {
  id: Id;
  points: Point[];
  systemId: string;
  boardId: string;
  insulation: boolean;
  /** Grubość wełny na suficie, mm (brak = 100 mm) */
  insulationThickness?: number;
  /** Kierunek profili nośnych: 0 = wzdłuż osi X, 90 = wzdłuż osi Y */
  direction: 0 | 90;
  /** Wysokość sufitu od posadzki (do widoku 3D), cm */
  height: number;
}

export interface ProjectSettings {
  /** Czy doliczać naddatek na odpady */
  wasteEnabled: boolean;
  /** Naddatek na odpady, % */
  waste: number;
  defaultHeight: number;
  defaultWallSystem: string;
  defaultCeilingSystem: string;
  gridSnap: number;
  /** Wybrany produkt wełny dla każdej grubości (klucz = grubość w mm) */
  wool?: Record<string, WoolChoice>;
}

export interface Project {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: PlanNode[];
  walls: Wall[];
  ceilings: Ceiling[];
  settings: ProjectSettings;
  /** Lista zakupów: pozycje odhaczone jako kupione */
  bought: Record<string, boolean>;
}
