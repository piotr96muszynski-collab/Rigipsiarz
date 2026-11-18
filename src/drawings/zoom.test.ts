import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, clampView, fitView, panBy, zoomAt, zoomLevel } from './zoom';

describe('podgląd powiększenia rysunku', () => {
  it('cały rysunek mieści się w oknie telefonu (dopełnienie w pionie)', () => {
    const v = fitView([0, 0, 600, 300], 360, 640);
    expect(v.w).toBe(600);
    expect(v.h).toBeCloseTo((600 * 640) / 360);
    // rysunek wyśrodkowany w pionie
    expect(v.y + v.h / 2).toBeCloseTo(150);
  });

  it('wysoki rysunek w szerokim oknie dopełnia się w poziomie', () => {
    const v = fitView([0, 0, 100, 400], 800, 400);
    expect(v.h).toBe(400);
    expect(v.w).toBe(800);
    expect(v.x + v.w / 2).toBeCloseTo(50);
  });

  it('punkt pod palcem zostaje w miejscu przy powiększaniu', () => {
    const base = fitView([0, 0, 1000, 1000], 500, 500);
    const v = zoomAt(base, base, 100, 250, 2, 500);
    // punkt ekranu 100 px = 200 jednostek rysunku przed i po powiększeniu
    expect(v.x + 100 * (v.w / 500)).toBeCloseTo(200);
    expect(v.y + 250 * (v.w / 500)).toBeCloseTo(500);
    expect(zoomLevel(v, base)).toBeCloseTo(2);
  });

  it('nie da się pomniejszyć poniżej całego rysunku ani powiększyć ponad limit', () => {
    const base = fitView([0, 0, 1000, 500], 500, 250);
    expect(zoomAt(base, base, 0, 0, 0.2, 500)).toEqual(base);
    const far = zoomAt(base, base, 250, 125, 1000, 500);
    expect(zoomLevel(far, base)).toBeCloseTo(MAX_ZOOM);
  });

  it('przesuwanie zatrzymuje się na krawędzi arkusza', () => {
    const base = fitView([0, 0, 1000, 1000], 500, 500);
    const v = zoomAt(base, base, 250, 250, 4, 500);
    const moved = panBy(v, base, 10_000, 10_000, 500);
    expect(moved.x).toBeCloseTo(0);
    expect(moved.y).toBeCloseTo(0);
    const back = panBy(v, base, -10_000, -10_000, 500);
    expect(back.x + back.w).toBeCloseTo(1000);
  });

  it('przy całym rysunku nie ma czego przesuwać', () => {
    const base = fitView([0, 0, 1000, 1000], 500, 500);
    expect(clampView({ ...base, x: 300 }, base)).toEqual(base);
  });
});
