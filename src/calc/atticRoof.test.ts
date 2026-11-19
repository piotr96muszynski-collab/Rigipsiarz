import { describe, expect, it } from 'vitest';
import { atticRequirement } from './atticMaterials';
import { allCeilingSystems } from '../catalog/rigips';
import { createAttic } from '../model/factory';
import { atticRoof, faceCdLines, hasRoofCorners } from './atticRoof';

const base = { width: 800, length: 1000, kneeLeft: 100, kneeRight: 100, pitch: 45, collarHeight: undefined };
const total = (r: ReturnType<typeof atticRoof>) => r.faces.reduce((s, f) => s + f.areaM2, 0);

describe('atticRoof – dach kopertowy', () => {
  const a = createAttic({ ...base, ends: ['hip', 'hip'] });
  const r = atticRoof(a);
  it('ma 4 połacie i 4 narożniki o długości z geometrii', () => {
    expect(hasRoofCorners(a)).toBe(true);
    expect(r.faces.map((f) => f.key).sort()).toEqual(['hip0', 'hip1', 'left', 'right']);
    const hips = r.lines.filter((l) => l.kind === 'hip');
    expect(hips).toHaveLength(4);
    // rzut 400·√2, wzniesienie 400
    for (const h of hips) expect(h.len).toBeCloseTo(Math.hypot(400 * Math.SQRT2, 400), 0);
  });
  it('pole = rzut / cos(kąt)', () => {
    expect(total(r)).toBeCloseTo(80 / Math.cos(Math.PI / 4), 1);
  });
  it('profile na połaci narożnej są skrócone, końce dochodzą do narożników', () => {
    const f = r.faces.find((x) => x.key === 'hip0')!;
    const lines = faceCdLines(f, 50, 10, 100, false);
    expect(lines.length).toBeGreaterThan(5);
    const top = lines[lines.length - 1];
    expect(top.t1 - top.t0).toBeLessThan(lines[0].t1 - lines[0].t0);
    expect(lines[0].end0).toBe('hip');
    expect(lines[0].end1).toBe('hip');
    // wieszaki tylko na krokwiach kulawych w zakresie odcinka
    for (const l of lines) for (const x of l.fix) expect(x > l.t0 && x < l.t1).toBe(true);
  });
});

describe('atticRoof – dobudówka z koszami (dach L)', () => {
  const a = createAttic({ ...base, wings: [{ id: 'w', side: 'left', at: 500, width: 600, length: 400, end: 'gable' }] });
  const r = atticRoof(a);
  it('dwa kosze od narożników ściany okapowej do kalenicy dobudówki', () => {
    const v = r.lines.filter((l) => l.kind === 'valley');
    expect(v).toHaveLength(2);
    for (const l of v) expect(l.len).toBeCloseTo(Math.hypot(300 * Math.SQRT2, 300), 0);
    expect(r.lines.filter((l) => l.kind === 'hip')).toHaveLength(0);
  });
  it('pole całości = (rzut główny + dobudówka) / cos', () => {
    expect(total(r)).toBeCloseTo((80 + 24) / Math.cos(Math.PI / 4), 1);
  });
  it('dobudówka z połacią narożną i sufitem pod jętkami', () => {
    const b = createAttic({ ...base, collarHeight: 300, ends: ['hip', 'gable'], wings: [{ id: 'w', side: 'right', at: 500, width: 600, length: 400, end: 'hip' }] });
    const rb = atticRoof(b);
    expect(rb.lines.filter((l) => l.kind === 'valley')).toHaveLength(2);
    expect(rb.lines.filter((l) => l.kind === 'hip').length).toBeGreaterThanOrEqual(4);
    expect(rb.faces.some((f) => f.kind === 'collar')).toBe(true);
    // sufit nie zmienia rzutu
    expect(rb.faces.reduce((s, f) => s + f.areaM2 * f.cos, 0)).toBeCloseTo(80 + 24, 1);
  });
});

describe('zestawienie poddasza z narożnikami i koszami', () => {
  it('dach kopertowy: płyty po polu połaci, profile krótsze niż w prostokącie, taśma na narożnikach', () => {
    const rect = atticRequirement(createAttic({ ...base }));
    const hip = atticRequirement(createAttic({ ...base, ends: ['hip', 'hip'] }));
    expect(hip.grid.roof).toBeDefined();
    expect(hip.areaM2).toBeCloseTo(80 / Math.cos(Math.PI / 4), 1);
    expect(hip.areaM2).toBeCloseTo(rect.areaM2, 0);
    const sum = (r: typeof rect) => (r.req.pieces.CD60 ?? []).reduce((s, x) => s + x, 0);
    // profile na połaciach narożnych są krótsze, ale dochodzą profile wzdłuż 4 narożników (po 2)
    const hipLen = Math.hypot(400 * Math.SQRT2, 400) / 100;
    expect(sum(hip)).toBeGreaterThan(8 * hipLen);
    // kąt wewnętrzny nietypowy domyślnie No-Coat: 4 narożniki
    expect(hip.req.meters.NOCOAT).toBeCloseTo(4 * hipLen, 1);
    // przy połaciach narożnych nie ma ścian szczytowych – UD tylko na ściankach kolankowych
    expect(hip.perimeterM).toBeCloseTo(2 * (10 + 8), 0);
    expect(hip.hangers).toBeGreaterThan(0);
  });
  it('dach L: kosze wykończone jak krawędź zewnętrzna pod kątem', () => {
    const r = atticRequirement(createAttic({ ...base, wings: [{ id: 'w', side: 'left', at: 500, width: 600, length: 400, end: 'gable' }] }));
    const v = Math.hypot(300 * Math.SQRT2, 300) / 100;
    expect(r.req.meters.NOCOAT).toBeCloseTo(2 * v, 1);
    expect(r.areaM2).toBeCloseTo(104 / Math.cos(Math.PI / 4), 1);
    expect(r.assumptions.some((x) => x.includes('kosz'))).toBe(true);
  });
  it('system z widoczną więźbą: narożniki pominięte z ostrzeżeniem', () => {
    const sys = allCeilingSystems().find((s) => s.atticFrame?.mount === 'between')!;
    const r = atticRequirement(createAttic({ ...base, ends: ['hip', 'gable'], systemId: sys.id, woolUnder: 0 }), sys);
    expect(r.grid.roof).toBeUndefined();
    expect(r.warnings.some((w) => w.startsWith('Narożniki dachu i kosze nie są liczone'))).toBe(true);
  });
});
