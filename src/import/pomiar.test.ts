import { describe, expect, it } from 'vitest';
import sample from './sample.pomiar.json';
import { atticFrom, importPomiar, parsePomiar, type PomiarFile, type PomiarRoom } from './pomiar';
import { existingRooms, interiorSide } from '../geometry/geometry';

// plik wygenerowany przez PomierzTu: salon 4 × 3 m (ściana zewnętrzna 38 cm z oknem, działówka 12 cm
// z drzwiami) i łazienka 2 × 3 m dobudowana za działówką
const file = () => JSON.parse(JSON.stringify(sample)) as PomiarFile;

describe('import pliku pomiaru', () => {
  it('rozpoznaje format i odrzuca inne pliki', () => {
    expect(parsePomiar(JSON.stringify(sample)).rooms).toHaveLength(2);
    expect(() => parsePomiar('{')).toThrow(/JSON/);
    expect(() => parsePomiar('{"app":"PomierzTu","project":{}}')).toThrow(/Pomiar dla Rigipsiarza/);
    expect(() => parsePomiar('{"format":"pomiar","version":99,"rooms":[]}')).toThrow(/nowszej/);
  });

  it('ściany pomieszczeń wchodzą jako obrys w cm, z grubością i wysokością', () => {
    const { project: p } = importPomiar(file());
    expect(p.name).toBe('Mieszkanie testowe');
    expect(p.walls).toHaveLength(8);
    expect(p.walls.every((w) => w.kind === 'existing')).toBe(true);
    const xs = p.nodes.map((n) => n.x).sort((a, b) => a - b);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(612);
    expect(p.walls[0].thickness).toBe(38);
    expect(p.walls[1].thickness).toBe(12);
    expect(p.walls[0].height).toBe(265);
    expect(p.walls[4].height).toBe(250);
  });

  it('węzły w narożnikach są wspólne, obrysy pomieszczeń zamknięte', () => {
    const { project: p } = importPomiar(file());
    expect(p.nodes).toHaveLength(8);
    // obrysy w obu orientacjach (tak liczy je plan): 2 pomieszczenia = 4
    expect(existingRooms(p)).toHaveLength(4);
    // mur rysuje się na zewnątrz obrysu: wnętrze po stronie pomieszczenia
    for (const w of p.walls) expect(interiorSide(p, w)).not.toBe(0);
  });

  it('otwory 1:1, a drzwi we wspólnej ścianie także od strony łazienki (lustrzanie)', () => {
    const { project: p } = importPomiar(file());
    const [win] = p.walls[0].openings;
    expect(win).toMatchObject({ kind: 'window', offset: 100, width: 150, height: 150, sill: 85 });
    const [door] = p.walls[1].openings;
    expect(door).toMatchObject({ kind: 'door', offset: 50, width: 90, height: 205, sill: 0 });
    // ściana b1 łazienki idzie w przeciwną stronę: 300 − 50 − 90 = 160
    expect(p.walls[4].openings).toHaveLength(1);
    expect(p.walls[4].openings[0]).toMatchObject({ kind: 'door', offset: 160, width: 90 });
    // grubość wspólnej ściany jak w salonie
    expect(p.walls[4].thickness).toBe(12);
  });

  it('strop = najwyższe pomieszczenie, z uwagą o różnych wysokościach', () => {
    const { project: p, warnings } = importPomiar(file());
    expect(p.settings.defaultHeight).toBe(265);
    expect(warnings.join(' ')).toMatch(/250, 265/);
  });

  it('wspólna ściana bez grubości nie dubluje się', () => {
    const f = file();
    for (const r of f.rooms) for (const w of r.walls) w.thickness = 0;
    // łazienka przyklejona bez muru: pierwsza ściana na linii działówki
    for (const w of f.rooms[1].walls) {
      for (const pt of [w.a, w.b]) if (pt.x === 4120) pt.x = 4000;
    }
    const { project: p } = importPomiar(f);
    expect(p.walls).toHaveLength(7);
    expect(p.walls[1].openings).toHaveLength(1);
  });
});

describe('poddasze ze skosów', () => {
  const room = (slopes: Record<number, { knee: number; angle: number }>, height = 2500): PomiarRoom => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    return {
      id: 'r',
      name: 'Sypialnia',
      height,
      outline: pts,
      walls: pts.map((a, i) => {
        const b = pts[(i + 1) % 4];
        return { id: `w${i}`, a, b, length: Math.hypot(b.x - a.x, b.y - a.y), thickness: 0, openings: [], ...(slopes[i] ? { slope: slopes[i] } : {}) };
      }),
    };
  };

  it('skosy nad przeciwległymi ścianami = dach dwuspadowy z jętką', () => {
    const a = atticFrom(room({ 0: { knee: 1000, angle: 45 }, 2: { knee: 1200, angle: 45 } }))!;
    expect(a).toMatchObject({ roof: 'gable', width: 400, length: 500, kneeLeft: 100, kneeRight: 120, pitch: 45, collarHeight: 250 });
  });

  it('skosy schodzą się pod stropem = bez jętki', () => {
    // 1,0 m + 2,0 m · tg 45° = 3,0 m – pomieszczenie mierzone do kalenicy
    const a = atticFrom(room({ 0: { knee: 1000, angle: 45 }, 2: { knee: 1000, angle: 45 } }, 3000))!;
    expect(a.collarHeight).toBeUndefined();
  });

  it('jeden skos = dach jednospadowy', () => {
    const a = atticFrom(room({ 1: { knee: 800, angle: 30 } }))!;
    expect(a).toMatchObject({ roof: 'mono', width: 500, length: 400, kneeLeft: 80, pitch: 30 });
  });

  it('skosy na sąsiednich ścianach – bez poddasza, z uwagą', () => {
    expect(atticFrom(room({ 0: { knee: 1000, angle: 45 }, 1: { knee: 1000, angle: 45 } }))).toBeNull();
    const f: PomiarFile = { format: 'pomiar', version: 1, units: 'mm', rooms: [room({ 0: { knee: 1000, angle: 45 }, 1: { knee: 1000, angle: 45 } })] };
    const { project, warnings } = importPomiar(f);
    expect(project.attics).toBeUndefined();
    expect(warnings[0]).toMatch(/Sypialnia/);
  });
});
