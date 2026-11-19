import { isNewWall } from '../geometry/geometry';
import type { Point, Project } from '../model/types';
import type { Selection } from './PlanCanvas';

/**
 * Menu kontekstowe planu: prawy przycisk myszy na komputerze, przytrzymanie palca na telefonie.
 * Tylko najczęstsze czynności dla elementu pod kursorem – skraca drogę, nie dokłada nowych opcji.
 */

export type MenuAction =
  | 'edit'
  | 'length'
  | 'split'
  | 'door'
  | 'window'
  | 'multi'
  | 'kind'
  | 'rotate'
  | 'delete'
  | 'ceiling-here'
  | 'select-all'
  | 'fit'
  | 'deselect';

export interface MenuItem {
  action: MenuAction;
  label: string;
  danger?: boolean;
}

/** Gdzie otwarto menu: element pod kursorem, punkt na planie (cm) i na ekranie (px w obszarze planu) */
export interface MenuRequest {
  target: Selection;
  world: Point;
  screen: Point;
}

export interface MenuContext {
  /** Dotknięte miejsce leży w zamkniętym pomieszczeniu bez sufitu */
  roomWithoutCeiling?: boolean;
}

/** Nagłówek menu (nazwa elementu) */
export function menuTitle(p: Project, t: Selection): string {
  if (!t) return 'Plan';
  if (t.type === 'walls') return `Zaznaczone ściany (${t.ids.length})`;
  if (t.type === 'ceiling') return `Sufit ${p.ceilings.findIndex((c) => c.id === t.id) + 1}`;
  if (t.type === 'attic') return `Poddasze ${(p.attics ?? []).findIndex((a) => a.id === t.id) + 1}`;
  const w = p.walls.find((x) => x.id === t.id);
  if (!w) return 'Plan';
  const nw = isNewWall(w);
  const name = `${nw ? 'Ściana' : 'Mur'} ${p.walls.filter((x) => isNewWall(x) === nw).indexOf(w) + 1}`;
  const op = t.openingId ? w.openings.find((o) => o.id === t.openingId) : undefined;
  if (op) return `${op.kind === 'door' ? 'Drzwi' : 'Okno'} · ${name.toLowerCase()}`;
  return name;
}

export function menuItems(p: Project, t: Selection, ctx: MenuContext = {}): MenuItem[] {
  if (!t) {
    const out: MenuItem[] = [];
    if (ctx.roomWithoutCeiling) out.push({ action: 'ceiling-here', label: 'Dodaj sufit w tym pomieszczeniu' });
    if (p.walls.length) out.push({ action: 'select-all', label: 'Zaznacz wszystkie ściany' });
    out.push({ action: 'fit', label: 'Pokaż cały plan' });
    return out;
  }
  if (t.type === 'walls')
    return [
      { action: 'edit', label: 'Edytuj zaznaczone' },
      { action: 'deselect', label: 'Odznacz' },
      { action: 'delete', label: `Usuń zaznaczone (${t.ids.length})`, danger: true },
    ];
  if (t.type === 'ceiling')
    return [
      { action: 'edit', label: 'Edytuj sufit' },
      { action: 'delete', label: 'Usuń sufit', danger: true },
    ];
  if (t.type === 'attic')
    return [
      { action: 'edit', label: 'Edytuj poddasze' },
      { action: 'rotate', label: 'Obróć o 90°' },
      { action: 'delete', label: 'Usuń poddasze', danger: true },
    ];
  const w = p.walls.find((x) => x.id === t.id);
  if (!w) return [];
  const op = t.openingId ? w.openings.find((o) => o.id === t.openingId) : undefined;
  if (op)
    return [
      { action: 'edit', label: op.kind === 'door' ? 'Edytuj drzwi' : 'Edytuj okno' },
      { action: 'kind', label: op.kind === 'door' ? 'Zamień na okno' : 'Zamień na drzwi' },
      { action: 'delete', label: op.kind === 'door' ? 'Usuń drzwi' : 'Usuń okno', danger: true },
    ];
  const nw = isNewWall(w);
  return [
    { action: 'edit', label: nw ? 'Edytuj ścianę' : 'Edytuj mur i okładzinę' },
    { action: 'length', label: 'Zmień długość' },
    { action: 'door', label: 'Wstaw drzwi tutaj' },
    { action: 'window', label: 'Wstaw okno tutaj' },
    { action: 'split', label: 'Podziel ścianę tutaj' },
    { action: 'multi', label: 'Zaznacz kilka, od tej' },
    { action: 'delete', label: nw ? 'Usuń ścianę' : 'Usuń mur', danger: true },
  ];
}

/** Położenie menu w obszarze planu: obok palca/kursora, w całości na ekranie */
export function placeMenu(at: Point, menu: { w: number; h: number }, area: { w: number; h: number }, touch: boolean): Point {
  const pad = 8;
  // na telefonie menu nad palcem (palec nie zasłania pozycji), na komputerze pod kursorem
  let x = touch ? at.x - menu.w / 2 : at.x + 2;
  let y = touch ? at.y - menu.h - 24 : at.y + 2;
  if (touch && y < pad) y = at.y + 24;
  if (!touch && y + menu.h > area.h - pad) y = at.y - menu.h - 2;
  if (!touch && x + menu.w > area.w - pad) x = at.x - menu.w - 2;
  x = Math.max(pad, Math.min(area.w - menu.w - pad, x));
  y = Math.max(pad, Math.min(area.h - menu.h - pad, y));
  return { x, y };
}
