import { describe, expect, it } from 'vitest';
import { calculateProject } from '../calc/materials';
import { sampleProject } from '../model/factory';
import { buildModel3D, type BoxPart } from './model3d';
import { polygonArea, polylineLength, profileCenterline, profileFor, profileOutline } from './profiles';

const inside = (pts: { x: number; y: number }[], A: number, B: number) =>
  pts.every((q) => Math.abs(q.x) <= A / 2 + 1e-9 && Math.abs(q.y) <= B / 2 + 1e-9);

describe('przekroje profili', () => {
  it('CW 50×75 uproszczony: profil C z zagięciami, pole = blacha na obwodzie', () => {
    const spec = profileFor('cw', 'up', 'a-')!;
    const pts = profileOutline(spec, 0.05, 0.075, false);
    expect(pts).toHaveLength(12);
    expect(inside(pts, 0.05, 0.075)).toBe(true);
    // środnik + 2 półki + 2 zagięcia, grubość t (narożniki liczone raz)
    const t = spec.t;
    const expected = t * 0.075 + 2 * t * (0.05 - t) + 2 * t * (spec.lip - t);
    expect(polygonArea(pts)).toBeCloseTo(expected, 9);
  });

  it('UW uproszczony: profil U bez zagięć (8 wierzchołków)', () => {
    const spec = profileFor('uw', 'along', 'a-')!;
    const pts = profileOutline(spec, 0.04, 0.075, false);
    expect(pts).toHaveLength(8);
    expect(inside(pts, 0.04, 0.075)).toBe(true);
  });

  it('CD 60×27 pełny: blacha 0,6 mm, ranty do środka, przetłoczenia środnika i półek', () => {
    const spec = profileFor('cdMain', 'along', 'a-')!;
    expect(spec.t).toBeCloseTo(0.0006, 9);
    // w suficie: a = wysokość 27 mm, b = szerokość 60 mm
    const line = profileCenterline(spec, 0.027, 0.06);
    // 2 ranty + 2 półki + środnik = 6 punktów, po 4 na każdy z 4 rowków (2 w środniku, po 1 w półce)
    expect(line).toHaveLength(6 + 4 * 4);
    const pts = profileOutline(spec, 0.027, 0.06);
    expect(pts).toHaveLength(2 * line.length);
    expect(inside(pts, 0.027, 0.06)).toBe(true);
    // pole = grubość × długość rozwinięcia blachy (ścięte narożniki się znoszą)
    expect(polygonArea(pts)).toBeCloseTo(spec.t * polylineLength(line), 10);
    // rozwinięcie dłuższe niż profil bez przetłoczeń (60 + 2×27 + 2×6 mm minus grubości)
    const flat = polylineLength(profileCenterline(spec, 0.027, 0.06, false));
    expect(flat).toBeCloseTo(0.06 + 2 * 0.027 + 2 * 0.006 - 4 * spec.t, 6);
    expect(polylineLength(line)).toBeGreaterThan(flat + 0.002);
    // przetłoczenia środnika wciśnięte do wnętrza (w stronę półek), po obu stronach osi
    const web = line.filter((q) => q[0] > -0.0135 + 0.0003 + 1e-6 && q[0] < -0.01);
    expect(web.length).toBe(4);
    expect(web.some((q) => q[1] < 0) && web.some((q) => q[1] > 0)).toBe(true);
  });

  it('pełne przekroje innych profili mieszczą się w obrysie i mają pole = t × rozwinięcie', () => {
    for (const [mat, A, B] of [
      ['cw', 0.05, 0.075],
      ['uw', 0.04, 0.1],
      ['ud', 0.027, 0.028],
      ['ua', 0.04, 0.05],
    ] as const) {
      for (const web of ['a-', 'a+', 'b-', 'b+'] as const) {
        const spec = profileFor(mat, 'along', web)!;
        const pts = profileOutline(spec, A, B);
        expect(inside(pts, A, B)).toBe(true);
        expect(polygonArea(pts)).toBeCloseTo(spec.t * polylineLength(profileCenterline(spec, A, B)), 10);
      }
    }
  });

  it('środnik po wskazanej stronie', () => {
    const spec = profileFor('cdMain', 'along', 'b-')!;
    // CD 60×27 w suficie: a = wysokość 27 mm, b = szerokość 60 mm
    const pts = profileOutline(spec, 0.027, 0.06);
    expect(inside(pts, 0.027, 0.06)).toBe(true);
    // przy b = -B/2 cała wysokość (środnik), przy b = +B/2 tylko końce półek
    const atWeb = pts.filter((q) => Math.abs(q.y + 0.03) < 1e-9).map((q) => q.x);
    expect(Math.max(...atWeb) - Math.min(...atWeb)).toBeCloseTo(0.027);
  });

  it('wieszak nie jest profilem', () => {
    expect(profileFor('hanger', 'along', 'a-')).toBeUndefined();
  });
});

describe('profile w modelu 3D', () => {
  const p = sampleProject();
  const parts = buildModel3D(p, calculateProject(p)).parts.filter((x): x is BoxPart => x.type === 'box');

  it('słupki CW są pionowymi profilami C, prowadnice UW poziomymi U', () => {
    const cw = parts.filter((x) => x.mat === 'cw');
    const uw = parts.filter((x) => x.mat === 'uw');
    expect(cw.length).toBeGreaterThan(0);
    expect(uw.length).toBeGreaterThan(0);
    expect(cw.every((x) => x.profile?.axis === 'up' && x.profile.lip > 0)).toBe(true);
    expect(uw.every((x) => x.profile?.axis === 'along' && x.profile.lip === 0)).toBe(true);
  });

  it('CD sufitu: środnik od spodu, UD przy ścianie', () => {
    const cd = parts.filter((x) => x.mat === 'cdMain' || x.mat === 'cdSec');
    expect(cd.length).toBeGreaterThan(0);
    expect(cd.every((x) => x.profile?.web === 'a-')).toBe(true);
    const ud = parts.filter((x) => x.mat === 'ud');
    expect(ud.length).toBe(4);
    expect(new Set(ud.map((x) => x.profile?.web)).size).toBe(1);
  });

  it('wieszaki i płyty zostają bryłami', () => {
    expect(parts.filter((x) => x.mat === 'hanger').every((x) => !x.profile)).toBe(true);
    expect(parts.filter((x) => x.mat.startsWith('board:')).every((x) => !x.profile)).toBe(true);
  });
});
