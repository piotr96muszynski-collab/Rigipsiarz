// Zestawienie materiałów poddasza z narożnikami dachu i koszami – płaszczyzny o dowolnym obrysie
// z `atticRoof.ts`, ruszt z `atticGrid(...).roof`. Te same zasady co w `atticMaterials.ts` (karty
// systemu: rozstawy, wieszaki, wkręty, taśma 1,4 m/m²), plus założenia dla narożników i koszy.

import { cornerTypeById, type FinishingSettings } from '../catalog/finishing';
import type { CeilingSystem } from '../catalog/rigips';
import type { Attic } from '../model/types';
import type { AtticGrid, AtticRoofGrid } from './attic';
import type { AtticResult } from './atticMaterials';
import { layerBoards } from './ceilingLevels';
import { addEdgeFinish } from './joints';
import { add, addBoardScrews, addJointing, addNote, addPiece, anchorsFor, emptyReq, pickBoardLength } from './materials';
import { joinsFor, profileMaxStock } from './profileLength';
import { ceilingVaporSpec, vaporBarrierLines, vaporBarrierOn } from './vaporBarrier';
import { boardById } from '../catalog/rigips';
import { addAtticWalls, atticWallLayout } from './atticWalls';
import { atticRoofWallFaces } from './atticRoofWalls';
import { atticWindowGeometry } from './atticWindows';

export function atticRoofRequirement(a: Attic, sys: CeilingSystem, fin: FinishingSettings, grid: AtticGrid & { roof: AtticRoofGrid }): AtticResult {
  const req = emptyReq();
  const warnings = [...grid.warnings];
  const assumptions = [...grid.assumptions];
  const frame = grid.frame;
  const roof = grid.roof;
  const timber = grid.profile.startsWith('LATA');
  const stock = profileMaxStock(grid.profile, 4);
  const boards = layerBoards(sys, a.boardId);
  let areaM2 = 0;
  let hangers = 0;
  let perimeterM = 0;

  const profile = (lenM: number) => {
    if (lenM <= 0.02) return;
    addPiece(req, grid.profile, lenM);
    if (frame.joiner && !timber) add(req.counts, frame.joiner, joinsFor(lenM, stock));
  };
  const fixes = (n: number) => {
    hangers += n;
    if (frame.hanger) add(req.counts, frame.hanger, n);
    add(req.counts, 'WKRET_DREWNO', n * frame.woodScrews);
    if (frame.hanger && frame.hangerLn9) add(req.counts, 'LN9', n * frame.hangerLn9);
  };
  /** Koniec przyciętego profilu przykręcony do profilu wzdłuż krokwi narożnej / koszowej */
  const joint = (n: number) => add(req.counts, timber ? 'WKRET_DREWNO' : 'LN9', 2 * n);

  for (const { face, cd } of roof.faces) {
    areaM2 += face.areaM2;
    for (const l of cd) {
      profile((l.t1 - l.t0) / 100);
      fixes(l.fix.length);
      joint([l.end0, l.end1].filter((k) => k === 'hip' || k === 'valley').length);
    }
    // profil przyścienny na ścianach szczytowych, ściankach kolankowych i ścianach dobudówek
    if (frame.edge)
      for (const e of face.edges) {
        if (e.kind !== 'wall') continue;
        const m = e.len / 100;
        if (m <= 0.05) continue;
        addPiece(req, frame.edge, m);
        add(req.counts, 'KOLEK', anchorsFor(m, 0.8));
        perimeterM += m;
      }
    const sheetLen = pickBoardLength(a.boardId, Math.min(Math.max(face.run, 200), 300));
    for (const id of boards) add(req.boardArea, `${id}|${id === a.boardId ? sheetLen : pickBoardLength(id, 300)}`, face.areaM2);
    if (timber) add(req.counts, 'TD35', face.areaM2 * sys.screwsOuter);
    else addBoardScrews(req, face.areaM2, boards, sys.screwsOuter, sys.screwsInner);
    addJointing(req, face.areaM2, sys.layers, a.boardId, 1.4, fin);
  }
  if (frame.edge && perimeterM > 0) add(req.meters, 'TASMA_USZ30', perimeterM);

  // profile wzdłuż krokwi narożnych i koszowych (po obu stronach linii)
  for (const lp of roof.lineProfiles) {
    profile(lp.line.len / 100);
    fixes(lp.fix.length);
  }

  // wykończenie: kosz = krawędź zewnętrzna, narożnik = kąt wewnętrzny, oba pod kątem rozwartym
  const lens = (kind: 'hip' | 'valley') => roof.roof.lines.filter((l) => l.kind === kind).map((l) => l.len / 100);
  const valleyType = cornerTypeById(fin.externalOdd);
  const hipType = cornerTypeById(fin.internalOdd);
  if (valleyType) addEdgeFinish(req, valleyType, lens('valley'), fin);
  if (hipType) addEdgeFinish(req, hipType, lens('hip'), fin);
  if (valleyType && !valleyType.anyAngle && lens('valley').length) warnings.push(`${valleyType.name} jest do kątów prostych – na koszach wybierz wykończenie do kątów dowolnych.`);
  if (hipType && !hipType.anyAngle && lens('hip').length) warnings.push(`${hipType.name} jest do kątów prostych – na narożnikach dachu wybierz wykończenie do kątów dowolnych.`);

  if (frame.hanger) {
    const gapMm = Math.max(0, grid.depthMm - boards.reduce((t, id) => t + boardById(id).thickness, 0) - grid.profileMm);
    addNote(req, frame.hanger, `poddasze: ${grid.hangerSize ? `dobrano ${grid.hangerSize.name}, ` : ''}${frame.profileLabel} ok. ${Math.round(gapMm)} mm pod krokwią`);
  }

  if (a.woolBetween > 0) {
    const clear = Math.min(1, Math.max(0, (a.rafterSpacing - a.rafterWidth + 1.5) / a.rafterSpacing));
    add(req.area, `WELNA${a.woolBetween}`, areaM2 * clear);
  }
  if (a.woolUnder > 0) add(req.area, `WELNA${a.woolUnder}`, areaM2);
  const vapor = ceilingVaporSpec(sys);
  if (vaporBarrierOn(a.vaporBarrier, vapor)) vaporBarrierLines(req, areaM2, vapor);

  // rozkład płyt na płaszczyznach o dowolnym obrysie jeszcze nie jest liczony – płyty po polu z naddatkiem
  // okładziny ścianek kolankowych i ścian szczytowych (także dobudówek) – jak w zwykłym poddaszu
  const walls = atticRoofWallFaces(a, roof).map(atticWallLayout);
  const wallAreaM2 = addAtticWalls(req, walls, fin);
  for (const w of walls) warnings.push(...w.warnings);
  if (walls.length)
    assumptions.push(
      'Okładziny ścian poddasza: profile pionowe co rozstaw, docięte do lica skosu; profil przyścienny UD po obwodzie każdej ściany; płyty pionowo, docinane pod kątem skosu. Przy dachu z narożnikami i koszami okładziny są w zestawieniu i na rysunkach, w widoku 3D jeszcze ich nie ma.',
    );
  // okna dachowe w połaciach z narożnikami i koszami jeszcze nie są liczone – tylko ostrzeżenie
  const win = atticWindowGeometry(a, grid);
  warnings.push(...win.warnings);
  const windows = { list: win.list, cutM2: 0, revealM2: 0, warnings: win.warnings, assumptions: [] };
  return { req, grid, boards: { surfaces: [], sheets: [], warnings: [] }, areaM2, walls, wallAreaM2, perimeterM, hangers, warnings, assumptions, windows };
}
