import { describe, expect, it } from 'vitest';
import { atticRequirement } from './atticMaterials';
import { allCeilingSystems } from '../catalog/rigips';
import { createAttic, createLining } from '../model/factory';
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
});

describe('ruszt krzyżowy przy narożnikach i koszach', () => {
  const sys = allCeilingSystems().find((s) => s.atticFrame?.carrier?.cross)!;
  const carrier = sys.atticFrame!.carrier!;
  const wing = { id: 'w', side: 'left' as const, at: 500, width: 600, length: 400, end: 'gable' as const };
  const r = atticRequirement(createAttic({ ...base, ends: ['hip', 'gable'], wings: [wing], systemId: sys.id, woolUnder: 0 }), sys);
  const roof = r.grid.roof!;
  it('liczy dach z koszami zamiast ostrzeżenia', () => {
    expect(roof).toBeDefined();
    expect(r.warnings.some((w) => w.startsWith('Narożniki dachu i kosze nie są liczone'))).toBe(false);
    expect(r.assumptions.some((x) => x.startsWith('Ruszt krzyżowy przy narożnikach'))).toBe(true);
  });
  it('profil nośny pod każdą krokwią kulawą, skrócony do narożnika / kosza', () => {
    const hip = roof.faces.find((g) => g.face.key === 'hip0')!;
    expect(hip.carriers!.length).toBe(hip.face.rafters.length);
    const lens = hip.carriers!.map((c) => c.s1 - c.s0);
    // krokiew środkowa w osi kalenicy najdłuższa, skrajne krótsze
    expect(Math.max(...lens)).toBeGreaterThan(lens[0] + 50);
    for (const c of hip.carriers!) {
      expect(c.fix.length).toBeGreaterThanOrEqual(1);
      for (const x of c.fix) expect(x >= c.s0 - 0.1 && x <= c.s1 + 0.1).toBe(true);
    }
  });
  it('ilości: nośne, wieszaki tylko na nośnych, łącznik na skrzyżowaniach i końcach', () => {
    const carriers = roof.faces.flatMap((g) => g.carriers ?? []);
    const lines = roof.lineProfiles;
    const cdM = roof.faces.flatMap((g) => g.cd).reduce((s, l) => s + l.t1 - l.t0, 0) / 100;
    const same = carrier.product === r.grid.profile;
    const carrierM = carriers.reduce((s, c) => s + (c.s1 - c.s0), 0) / 100 + lines.reduce((s, l) => s + l.line.len, 0) / 100 + (same ? cdM : 0);
    const got = (r.req.pieces[carrier.product] ?? []).reduce((s, x) => s + x, 0);
    expect(got).toBeCloseTo(carrierM, 1);
    const hangers = carriers.reduce((s, c) => s + c.fix.length, 0) + lines.reduce((s, l) => s + l.fix.length, 0);
    expect(r.hangers).toBe(hangers);
    const cd = roof.faces.flatMap((g) => g.cd);
    const crossings = cd.reduce((s, l) => s + l.fix.length + [l.end0, l.end1].filter((k) => k === 'hip' || k === 'valley').length, 0);
    expect(r.req.counts[carrier.cross!]).toBe(crossings);
    // profile pod płyty krzyżują się z każdą krokwią w swoim zakresie
    for (const g of roof.faces) for (const l of g.cd) expect(l.fix.length).toBe(g.face.rafters.filter((t) => t > l.t0 + 1 && t < l.t1 - 1).length);
  });
});

describe('więźba widoczna przy narożnikach i koszach', () => {
  const sys = allCeilingSystems().find((s) => s.atticFrame?.mount === 'between')!;
  const a = createAttic({ ...base, ends: ['hip', 'hip'], systemId: sys.id, woolUnder: 0, woolBetween: 0 });
  const r = atticRequirement(a, sys);
  const roof = r.grid.roof!;
  it('płyty tylko w polach między krokwiami', () => {
    expect(roof).toBeDefined();
    expect(r.warnings.some((w) => w.startsWith('Narożniki dachu i kosze nie są liczone'))).toBe(false);
    const face = roof.faces.reduce((s, g) => s + g.face.areaM2, 0);
    expect(r.areaM2).toBeLessThan(face * (1 - (a.rafterWidth - 1) / a.rafterSpacing));
    expect(r.areaM2).toBeGreaterThan(face * 0.75);
    for (const g of roof.faces) expect(g.boardPieces!.length).toBeGreaterThanOrEqual(g.face.rafters.length);
  });
  it('poprzeczki w polach bez mocowań pośrednich, elementy wzdłuż obu boków krokwi', () => {
    for (const g of roof.faces) {
      expect(g.sides!.length).toBe(2 * g.face.rafters.length);
      for (const l of g.cd) {
        expect(l.fix).toEqual([]);
        // żadna poprzeczka nie przechodzi przez krokiew
        for (const t of g.face.rafters) expect(l.t1 <= t - a.rafterWidth / 2 + 0.5 || l.t0 >= t + a.rafterWidth / 2 - 0.5).toBe(true);
      }
    }
    expect(roof.lineProfiles.every((l) => l.fix.length === 0)).toBe(true);
    expect(r.hangers).toBe(0);
  });
});

describe('okładziny ścian poddasza z narożnikami i koszami', () => {
  it('kolankowe przerwane dobudówką, szczyt tylko przy końcu bez połaci narożnej', () => {
    const a = createAttic({
      ...base,
      ends: ['hip', 'gable'],
      kneeLining: createLining(1, 'O-CD-1'),
      gableLining: createLining(1, 'O-CD-1'),
      wings: [{ id: 'w', side: 'left', at: 500, width: 600, length: 400, end: 'gable' }],
    });
    const r = atticRequirement(a);
    const gables = r.walls.filter((w) => w.face.id === 'gable');
    // szczyt główny przy 2. końcu + szczyt dobudówki
    expect(gables).toHaveLength(2);
    const knees = r.walls.filter((w) => w.face.id !== 'gable');
    // lewa: 2 odcinki obok dobudówki, prawa: cała, połać narożna: 1, dobudówka: 2 boki
    expect(knees.length).toBe(6);
    expect(r.wallAreaM2).toBeGreaterThan(0);
  });
});
