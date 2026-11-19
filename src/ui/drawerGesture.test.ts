import { describe, expect, it } from 'vitest';
import { dragProgress, inEdgeZone, settleOpen } from './drawerGesture';

describe('gest bocznego menu', () => {
  it('startuje tylko przy lewej krawędzi w dolnej połowie ekranu', () => {
    expect(inEdgeZone(5, 700, 800)).toBe(true);
    expect(inEdgeZone(5, 400, 800)).toBe(true);
    expect(inEdgeZone(5, 399, 800)).toBe(false);
    expect(inEdgeZone(40, 700, 800)).toBe(false);
  });

  it('śledzi palec przy otwieraniu i zamykaniu', () => {
    expect(dragProgress(0, 300, false)).toBe(0);
    expect(dragProgress(150, 300, false)).toBe(0.5);
    expect(dragProgress(500, 300, false)).toBe(1);
    expect(dragProgress(-100, 300, false)).toBe(0);
    expect(dragProgress(0, 300, true)).toBe(1);
    expect(dragProgress(-75, 300, true)).toBe(0.75);
    expect(dragProgress(-400, 300, true)).toBe(0);
  });

  it('po puszczeniu decyduje szybkość, a potem połowa szerokości', () => {
    expect(settleOpen(0.2, 0.8)).toBe(true);
    expect(settleOpen(0.9, -0.8)).toBe(false);
    expect(settleOpen(0.6, 0)).toBe(true);
    expect(settleOpen(0.4, 0.1)).toBe(false);
  });
});
