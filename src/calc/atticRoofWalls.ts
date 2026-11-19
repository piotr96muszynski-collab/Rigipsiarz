// Ściany poddasza z narożnikami / koszami pod okładziny: z krawędzi „ściana” płaszczyzn lica zabudowy.
// Krawędzie na jednej prostej rzutu tworzą jedną ścianę: poziome – ścianka kolankowa (prostokąt),
// inne – ściana szczytowa (obrys do lica skosów i sufitu). Dalej jak w `atticWalls.ts`.

import type { Attic } from '../model/types';
import type { AtticRoofGrid, SecPt } from './attic';
import { zAt, type P2 } from './atticRoof';
import type { AtticWallFace } from './atticWalls';

const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) < eps;

export function atticRoofWallFaces(a: Attic, roof: AtticRoofGrid): AtticWallFace[] {
  // krawędzie przy ścianach pogrupowane po prostej (kierunek + odległość od początku układu)
  const groups = new Map<string, { dir: P2; segs: { x0: number; x1: number; z0: number; z1: number }[] }>();
  for (const f of roof.roof.faces)
    for (const e of f.edges) {
      if (e.kind !== 'wall') continue;
      let dx = e.q.u - e.p.u;
      let dy = e.q.v - e.p.v;
      const L = Math.hypot(dx, dy);
      if (L < 1) continue;
      dx /= L;
      dy /= L;
      // kierunek ujednolicony (u rosnące, a przy pionowej – v rosnące)
      if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) {
        dx = -dx;
        dy = -dy;
      }
      const off = -dy * e.p.u + dx * e.p.v;
      const key = `${dx.toFixed(3)}|${dy.toFixed(3)}|${Math.round(off)}`;
      const g = groups.get(key) ?? groups.set(key, { dir: { u: dx, v: dy }, segs: [] }).get(key)!;
      const xp = dx * e.p.u + dy * e.p.v;
      const xq = dx * e.q.u + dy * e.q.v;
      const zp = Math.max(0, zAt(f.plane, e.p));
      const zq = Math.max(0, zAt(f.plane, e.q));
      g.segs.push(xp <= xq ? { x0: xp, x1: xq, z0: zp, z1: zq } : { x0: xq, x1: xp, z0: zq, z1: zp });
    }

  const out: AtticWallFace[] = [];
  let gables = 0;
  for (const g of groups.values()) {
    const segs = g.segs.sort((p, q) => p.x0 - q.x0);
    // ciągłe odcinki ściany
    const runs: (typeof segs)[] = [];
    for (const s of segs) {
      const run = runs[runs.length - 1];
      if (run && near(run[run.length - 1].x1, s.x0, 1)) run.push(s);
      else runs.push([s]);
    }
    for (const run of runs) {
      const x0 = run[0].x0;
      const W = run[run.length - 1].x1 - x0;
      if (W < 5) continue;
      const flat = run.every((s) => near(s.z0, s.z1, 1) && near(s.z0, run[0].z0, 1));
      const H = Math.max(...run.flatMap((s) => [s.z0, s.z1]));
      if (H < 5) continue;
      if (flat) {
        if (!a.kneeLining) continue;
        out.push({
          id: 'knee-left',
          label: `Ścianka kolankowa ${(W / 100).toFixed(2).replace('.', ',')} m`,
          count: 1,
          poly: [
            { x: 0, z: 0 },
            { x: W, z: 0 },
            { x: W, z: H },
            { x: 0, z: H },
          ],
          width: W,
          height: H,
          lining: a.kneeLining,
        });
      } else {
        if (!a.gableLining) continue;
        const chain: SecPt[] = [];
        for (const s of run) for (const p of [{ x: s.x0 - x0, z: s.z0 }, { x: s.x1 - x0, z: s.z1 }]) {
          const last = chain[chain.length - 1];
          if (!last || !near(last.x, p.x) || !near(last.z, p.z)) chain.push(p);
        }
        const poly: SecPt[] = [{ x: 0, z: 0 }, { x: W, z: 0 }];
        for (const p of [...chain].reverse()) if (!(p.z < 0.5 && (near(p.x, 0) || near(p.x, W)))) poly.push(p);
        const dedup = poly.filter((p, i) => i === 0 || !near(p.x, poly[i - 1].x) || !near(p.z, poly[i - 1].z));
        gables++;
        out.push({ id: 'gable', label: `Ściana szczytowa ${gables}`, count: 1, poly: dedup, width: W, height: H, lining: a.gableLining });
      }
    }
  }
  return out;
}
