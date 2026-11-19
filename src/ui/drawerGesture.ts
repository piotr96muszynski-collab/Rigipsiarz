/**
 * Logika gestu wysuwania bocznego menu – bez Reacta, żeby dało się ją przetestować.
 *
 * Gest zaczyna się tylko przy lewej krawędzi i tylko w dolnej połowie ekranu, dzięki czemu
 * górna część krawędzi zostaje dla rysowania i przewijania. Menu jest nakładką: śledzenie palca
 * zmienia jedynie przesunięcie panelu, nigdy układu strony pod spodem.
 */

/** Szerokość pasa przy krawędzi, z którego można wyciągnąć menu (px) */
export const EDGE_ZONE_PX = 24;

/** Ruch palca (px), po którym uznajemy, że to gest menu, a nie dotknięcie */
export const DRAG_SLOP_PX = 8;

/** Czy dotknięcie w punkcie (x, y) może rozpocząć wysuwanie menu */
export function inEdgeZone(x: number, y: number, viewportH: number, edge = EDGE_ZONE_PX) {
  return x >= 0 && x <= edge && y >= viewportH / 2;
}

/**
 * Jak bardzo menu jest wysunięte (0 – schowane, 1 – całe) w trakcie przeciągania.
 * `startOpen` – czy gest zaczął się przy otwartym menu (zamykanie przeciągnięciem w lewo).
 */
export function dragProgress(dx: number, width: number, startOpen: boolean) {
  if (width <= 0) return startOpen ? 1 : 0;
  const p = (startOpen ? width + dx : dx) / width;
  return Math.max(0, Math.min(1, p));
}

/**
 * Decyzja po puszczeniu palca: otworzyć czy schować.
 * Szybki ruch (px/ms) wygrywa z położeniem, inaczej decyduje połowa szerokości.
 */
export function settleOpen(progress: number, velocityX: number) {
  if (velocityX > 0.4) return true;
  if (velocityX < -0.4) return false;
  return progress >= 0.5;
}
