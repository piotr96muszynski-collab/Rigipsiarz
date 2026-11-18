import { describe, expect, it } from 'vitest';
import { awayFromFinger } from './labelPlace';

const size = { w: 400, h: 800 };
const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('etykieta wymiaru nie pod palcem', () => {
  it('zostaje w preferowanym miejscu, gdy jest daleko od palca', () => {
    expect(awayFromFinger({ x: 300, y: 600 }, { x: 150, y: 400 }, { x: 50, y: 300 }, size)).toEqual({ x: 150, y: 400 });
  });
  it('ucieka w stronę punktu początkowego, gdy cel jest przy palcu', () => {
    const finger = { x: 200, y: 500 };
    const p = awayFromFinger(finger, { x: 205, y: 495 }, { x: 200, y: 300 }, size);
    expect(far(p, finger)).toBeGreaterThanOrEqual(79);
    expect(p.y).toBeLessThan(finger.y);
  });
  it('przy krawędzi ekranu nadal nie trafia pod palec', () => {
    const finger = { x: 380, y: 130 };
    const p = awayFromFinger(finger, { x: 390, y: 125 }, { x: 390, y: 125 }, size);
    expect(far(p, finger)).toBeGreaterThanOrEqual(79);
  });
});
