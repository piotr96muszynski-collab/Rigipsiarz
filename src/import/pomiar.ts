// Import pliku wymiany „.pomiar.json” (np. z aplikacji PomierzTu).
// Plik ma gotowe współrzędne w mm (x w prawo, y w dół); model Rigipsiarza jest w cm.
// Pomierzone ściany wchodzą jako obrys (ściany istniejące z grubością muru), otwory 1:1,
// pomieszczenia ze skosami na prostokątnym rzucie – jako zabudowy poddasza.

import { createAttic, createExistingWall, createOpening, createProject, uid } from '../model/factory';
import type { Attic, Opening, PlanNode, Project, Wall } from '../model/types';

export interface PomiarPoint {
  x: number;
  y: number;
}

export interface PomiarOpening {
  id: string;
  type: 'door' | 'window' | 'balcony-door' | 'passage' | 'other';
  offset: number;
  width: number;
  height: number;
  sill: number;
}

export interface PomiarWall {
  id: string;
  a: PomiarPoint;
  b: PomiarPoint;
  length: number;
  measured?: boolean;
  thickness: number;
  kind?: string | null;
  material?: string | null;
  shared?: { room: string; wall: string } | null;
  slope?: { knee: number; angle: number };
  openings: PomiarOpening[];
}

export interface PomiarRoom {
  id: string;
  name: string;
  height: number;
  heightMeasured?: boolean;
  area?: number;
  outline: PomiarPoint[];
  walls: PomiarWall[];
  /** Okna dachowe w skosie nad ścianą `wall`, mm (poddasze nie ma jeszcze okien dachowych – tylko uwaga) */
  skylights?: { id: string; wall: string; offset: number; width: number; length: number; mount?: number }[];
}

export interface PomiarFile {
  format: 'pomiar';
  version: number;
  units: 'mm';
  source?: { app?: string; release?: number };
  exported?: string;
  project?: { name?: string; address?: string; client?: string };
  rooms: PomiarRoom[];
}

export interface PomiarImport {
  project: Project;
  /** Uwagi dla użytkownika (np. poddasze, którego nie dało się opisać przekrojem) */
  warnings: string[];
}

export const POMIAR_VERSION = 1;

/** Rozpoznaje plik i zgłasza czytelny błąd, gdy to nie jest plik wymiany */
export function parsePomiar(text: string): PomiarFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Plik nie jest poprawnym plikiem JSON.');
  }
  const d = data as Partial<PomiarFile> & { app?: string };
  if (d?.app === 'PomierzTu')
    throw new Error('To kopia projektu PomierzTu. W PomierzTu wybierz Eksport → „Pomiar dla Rigipsiarza” i zaimportuj plik .pomiar.json.');
  if (d?.format !== 'pomiar' || !Array.isArray(d.rooms)) throw new Error('To nie jest plik pomiaru (.pomiar.json).');
  if ((d.version ?? 0) > POMIAR_VERSION)
    throw new Error('Plik pomiaru pochodzi z nowszej wersji. Zaktualizuj Rigipsiarza (Odśwież) i spróbuj ponownie.');
  return d as PomiarFile;
}

const cm = (mm: number) => Math.round(mm) / 10;

function openingFrom(o: PomiarOpening, offsetMm = o.offset): Opening {
  const door = o.type === 'door' || o.type === 'passage' || o.type === 'balcony-door';
  return createOpening(door ? 'door' : 'window', cm(offsetMm), {
    width: cm(o.width),
    height: cm(o.height),
    sill: door ? 0 : cm(o.sill),
    reinforced: false,
  });
}

/** Zamienia plik pomiaru na nowy projekt Rigipsiarza */
export function importPomiar(file: PomiarFile): PomiarImport {
  const warnings: string[] = [];
  const name = file.project?.name?.trim() || 'Pomiar';
  const p = createProject(name);
  const rooms = file.rooms.filter((r) => r.walls?.length >= 3);

  // węzły: ten sam punkt (±1 cm) w kilku pomieszczeniach = jeden węzeł
  const nodeAt = (pt: PomiarPoint): PlanNode => {
    const x = cm(pt.x);
    const y = cm(pt.y);
    const found = p.nodes.find((n) => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1);
    if (found) return found;
    const n = { id: uid(), x, y };
    p.nodes.push(n);
    return n;
  };

  const wallOf = new Map<string, { wall: Wall; src: PomiarWall }>();
  const findWall = (roomId: string, wallId: string) => wallOf.get(`${roomId}/${wallId}`);

  for (const r of rooms) {
    const height = cm(r.height);
    for (const w of r.walls) {
      const a = nodeAt(w.a);
      const b = nodeAt(w.b);
      if (a.id === b.id) continue;
      // ściana pokrywa się z już dodaną (wspólna ściana bez grubości) – dokładamy tylko otwory
      const same = p.walls.find((x) => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));
      if (same) {
        const flip = same.a !== a.id;
        const L = w.length;
        for (const o of w.openings) same.openings.push(openingFrom(o, flip ? L - o.offset - o.width : o.offset));
        same.height = Math.max(same.height, height);
        wallOf.set(`${r.id}/${w.id}`, { wall: same, src: w });
        continue;
      }
      // grubość wspólnej ściany bierzemy od pomieszczenia, do którego dobudowano
      const partner = w.shared ? findWall(w.shared.room, w.shared.wall) : undefined;
      const tMm = partner ? partner.src.thickness : w.thickness;
      const wall = createExistingWall(p, a.id, b.id, {
        height,
        ...(tMm > 0 ? { thickness: cm(tMm) } : {}),
        openings: w.openings.map((o) => openingFrom(o)),
      });
      p.walls.push(wall);
      wallOf.set(`${r.id}/${w.id}`, { wall, src: w });
    }
  }

  // wspólne ściany (dobudowa): otwór z jednej strony przechodzi na drugą (lico po drugiej stronie muru)
  for (const r of rooms)
    for (const w of r.walls) {
      if (!w.shared) continue;
      const mine = findWall(r.id, w.id);
      const other = findWall(w.shared.room, w.shared.wall);
      if (!mine || !other || mine.wall === other.wall) continue;
      const mirror = (from: PomiarWall, to: Wall) => {
        for (const o of from.openings) {
          const off = cm(from.length - o.offset - o.width);
          if (to.openings.some((x) => Math.abs(x.offset - off) < 2 && Math.abs(x.width - cm(o.width)) < 2)) continue;
          to.openings.push(openingFrom(o, from.length - o.offset - o.width));
        }
      };
      mirror(other.src, mine.wall);
      mirror(w, other.wall);
    }

  // poddasza
  const attics: Attic[] = [];
  for (const r of rooms) {
    if (!r.walls.some((w) => w.slope)) continue;
    const a = atticFrom(r);
    if (a) attics.push(a);
    else
      warnings.push(
        `„${r.name || 'Pomieszczenie'}”: skosy przeniesione tylko jako obrys – zabudowę poddasza dodaj ręcznie (rzut nie jest prostokątem ze skosami na przeciwległych ścianach).`,
      );
  }
  if (attics.length) p.attics = attics;

  // okna dachowe: zabudowa poddasza nie ma jeszcze otworów w skosie – podajemy wymiary do ręcznego uwzględnienia
  for (const r of rooms) {
    const sk = r.skylights ?? [];
    if (!sk.length) continue;
    const list = sk.map((s) => `${cm(s.width)}×${cm(s.length)} cm`).join(', ');
    warnings.push(
      `„${r.name || 'Pomieszczenie'}”: okna dachowe (${list}) nie są jeszcze przenoszone do zabudowy poddasza – uwzględnij je ręcznie (płyty i ruszt wokół okna).`,
    );
  }

  // strop: najwyższe z pomieszczeń bez skosów (nowe ściany i sufity dojdą do tej wysokości)
  const flat = rooms.filter((r) => !r.walls.some((w) => w.slope)).map((r) => cm(r.height));
  if (flat.length) {
    p.settings.defaultHeight = Math.round(Math.max(...flat));
    if (new Set(flat).size > 1)
      warnings.push(
        `Pomieszczenia mają różne wysokości (${[...new Set(flat)].sort((x, y) => x - y).join(', ')} cm). Strop ustawiony na ${p.settings.defaultHeight} cm – sprawdź wysokość nowych ścian i sufitów.`,
      );
  }
  return { project: p, warnings };
}

/**
 * Pomieszczenie prostokątne ze skosem nad jedną ścianą (dach jednospadowy) albo nad dwiema
 * przeciwległymi (dwuspadowy). Inne kształty zwracają null.
 */
export function atticFrom(r: PomiarRoom): Attic | null {
  if (r.walls.length !== 4) return null;
  const dir = r.walls.map((w) => Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x));
  for (let i = 0; i < 4; i++) {
    let d = Math.abs(dir[(i + 1) % 4] - dir[i]) % Math.PI;
    if (Math.abs(d - Math.PI / 2) > (1.5 * Math.PI) / 180) return null;
  }
  const sloped = r.walls.map((w, i) => (w.slope ? i : -1)).filter((i) => i >= 0);
  let left: number;
  let right: number | null;
  if (sloped.length === 1) [left, right] = [sloped[0], null];
  else if (sloped.length === 2 && (sloped[1] - sloped[0]) % 2 === 0) [left, right] = sloped;
  else return null;

  const L = r.walls[left];
  const R = right === null ? null : r.walls[right];
  const width = r.walls[(left + 1) % 4].length;
  const length = L.length;
  const H = r.height;
  const kL = L.slope!.knee;
  const kR = R ? R.slope!.knee : kL;
  const pitch = R ? (L.slope!.angle + R.slope!.angle) / 2 : L.slope!.angle;
  const tg = Math.tan((pitch * Math.PI) / 180);
  // wysokość, na której schodzą się skosy (dwuspadowy) albo skos dochodzi do ściany naprzeciw (jednospadowy)
  const top = R ? (kL + kR) / 2 + (width / 2) * tg : kL + width * tg;
  const collar = H < top - 10 ? cm(H) : undefined;
  return createAttic({
    name: r.name || undefined,
    roof: R ? 'gable' : 'mono',
    width: cm(width),
    length: cm(length),
    kneeLeft: cm(kL),
    kneeRight: cm(kR),
    pitch: Math.round(pitch * 10) / 10,
    collarHeight: collar,
  });
}
