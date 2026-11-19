import { describe, expect, it } from 'vitest';
import { calculateProject } from '../calc/materials';
import { sampleProject } from '../model/factory';
import { buildModel3D, type BoxPart } from './model3d';
import { polygonArea, profileFor, profileOutline } from './profiles';

const inside = (pts: { x: number; y: number }[], A: number, B: number) =>
  pts.every((q) => Math.abs(q.x) <= A / 2 + 1e-9 && Math.abs(q.y) <= B / 2 + 1e-9);

describe('przekroje profili', () => {
  it('CW 50×75: profil C z zagięciami, pole = blacha na obwodzie', () => {
    const spec = profileFor('cw', 'up', 'a-')!;
    const pts = profileOutline(spec, 0.05, 0.075);
    expect(pts).toHaveLength(12);
    expect(inside(pts, 0.05, 0.075)).toBe(true);
    // środnik + 2 półki + 2 zagięcia, grubość t (narożniki liczone raz)
    const t = spec.t;
    const expected = t * 0.075 + 2 * t * (0.05 - t) + 2 * t * (spec.lip - t);
    expect(polygonArea(pts)).toBeCloseTo(expected, 9);
  });

  it('UW: profil U bez zagięć (8 wierzchołków)', () => {
    const spec = profileFor('uw', 'along', 'a-')!;
    const pts = profileOutline(spec, 0.04, 0.075);
    expect(pts).toHaveLength(8);
    expect(inside(pts, 0.04, 0.075)).toBe(true);
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
