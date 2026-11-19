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
import { add, addBoardScrews, addJointing, addNote, addPiece, anchorsFor, emptyReq } from './materials';
import { joinsFor, profileMaxStock } from './profileLength';
import { ceilingVaporSpec, vaporBarrierLines, vaporBarrierOn } from './vaporBarrier';
import { boardById } from '../catalog/rigips';
import { addAtticWalls, atticWallLayout } from './atticWalls';
import { atticRoofWallFaces } from './atticRoofWalls';
import { addAtticWindows, atticWindowGeometry, cutoutM2, roofCdSegments, roofWindowHoles } from './atticWindows';
import { roofBoardLayout } from './atticRoofBoards';
import { zAt } from './atticRoof';

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

  const between = frame.mount === 'between';
  const carrier = grid.carrier;
  // więźba widoczna: elementy wzdłuż krokwi z profilu przyściennego (albo profilu rusztu), przykręcone co `sideFix`
  const sideProduct = frame.edge ?? grid.profile;
  const sideFixM = (frame.sideFix ?? 100) / 100;
  const side = (lenM: number) => {
    if (lenM <= 0.05) return;
    addPiece(req, sideProduct, lenM);
    add(req.counts, 'WKRET_DREWNO', anchorsFor(lenM, sideFixM) * frame.woodScrews);
  };
  const carrierPiece = (lenM: number) => {
    if (!carrier || lenM <= 0.02) return;
    addPiece(req, carrier.product, lenM);
    if (frame.joiner) add(req.counts, frame.joiner, joinsFor(lenM, profileMaxStock(carrier.product, 4)));
  };
  // ruszt krzyżowy: skrzyżowania profili pod płyty z nośnymi i końce profili przy narożnikach / koszach
  let crossings = 0;

  // okna dachowe w połaciach: otwory w płytach, przerwane linie rusztu (obramowanie liczy addAtticWindows)
  const wins = atticWindowGeometry(a, grid).list;

  for (const [fi, g] of roof.faces.entries()) {
    const { face, cd } = g;
    // płyty, wełna i folia po polu płyt (więźba widoczna: tylko pola między krokwiami) bez otworów okien
    const A = Math.max(0, g.boardAreaM2 - cutoutM2(wins, undefined, fi));
    areaM2 += A;
    for (const l of cd) {
      // linie przerwane oknem kończą się na bocznym obramowaniu otworu
      for (const [t0, t1] of roofCdSegments(l, fi, wins)) profile((t1 - t0) / 100);
      const corners = [l.end0, l.end1].filter((k) => k === 'hip' || k === 'valley').length;
      if (between) add(req.counts, 'WKRET_DREWNO', 2);
      else if (carrier) crossings += l.fix.length + corners;
      else {
        fixes(l.fix.length);
        joint(corners);
      }
    }
    for (const c of g.carriers ?? []) {
      carrierPiece((c.s1 - c.s0) / 100);
      fixes(c.fix.length);
    }
    for (const sd of g.sides ?? []) side((sd.s1 - sd.s0) / 100);
    for (const e of face.edges) {
      if (e.kind !== 'wall') continue;
      const m = e.len / 100;
      if (m <= 0.05) continue;
      if (between) {
        // więźba widoczna: element wzdłuż ściany szczytowej (skośnej krawędzi) jak przy skrajnym polu
        if (Math.abs(zAt(face.plane, e.p) - zAt(face.plane, e.q)) > 1) side(m);
        continue;
      }
      // profil przyścienny na ścianach szczytowych, ściankach kolankowych i ścianach dobudówek
      if (!frame.edge) continue;
      addPiece(req, frame.edge, m);
      add(req.counts, 'KOLEK', anchorsFor(m, 0.8));
      perimeterM += m;
    }
    if (timber) add(req.counts, 'TD35', A * sys.screwsOuter);
    else addBoardScrews(req, A, boards, sys.screwsOuter, sys.screwsInner);
    // więźba widoczna: płyty cięte na pasy między krokwiami – karty 4.71.11 i 4.71.12 podają 3 mb taśmy na m²
    addJointing(req, A, sys.layers, a.boardId, between ? 3 : 1.4, fin);
  }

  // płyty z rozkładu na połaciach (ten sam co na rysunkach i w 3D): elementy + resztki < 30 cm
  const layout = roofBoardLayout(a, sys, grid, roofWindowHoles(wins, roof));
  for (const u of layout.sheets) {
    const key = `${u.boardId}|${u.sheetLen}`;
    add(req.boardArea, key, u.netM2 + u.wasteM2);
    if (u.wasteM2 > 0) add((req.boardCutWaste ??= {}), key, u.wasteM2);
  }
  warnings.push(...layout.warnings);
  const ai = assumptions.findIndex((x) => x.startsWith('Płyty i wełna liczone'));
  const boardsNote =
    'Płyty i wełna liczone po licu zabudowy, bez otworów okien dachowych i ścian szczytowych. Płyty dłuższą krawędzią wzdłuż krokwi, w pasach szerokości arkusza wzdłuż profili; styki krótkich krawędzi na profilu, w sąsiednich pasach i warstwach przesunięte o min. 40 cm; przy narożnikach dachu i koszach docięte pod kątem.';
  if (ai >= 0) assumptions[ai] = boardsNote;
  else assumptions.push(boardsNote);
  assumptions.push('Rozkrój: z odciętego pod kątem kawałka arkusza wycina się sąsiedni element tej samej krawędzi (obrócony) – element cięty pod kątem liczony średnią długością; resztki krótsze niż 30 cm to odpad.');
  if (frame.edge && perimeterM > 0) add(req.meters, 'TASMA_USZ30', perimeterM);

  // wzdłuż krokwi narożnych i koszowych (po obu stronach linii)
  for (const lp of roof.lineProfiles) {
    const m = lp.line.len / 100;
    if (between) side(m);
    else if (carrier) {
      carrierPiece(m);
      fixes(lp.fix.length);
    } else {
      profile(m);
      fixes(lp.fix.length);
    }
  }
  if (carrier?.cross) add(req.counts, carrier.cross, crossings);
  if (carrier?.crossLn9) add(req.counts, 'LN9', crossings * carrier.crossLn9);

  // wykończenie: kosz = krawędź zewnętrzna, narożnik = kąt wewnętrzny, oba pod kątem rozwartym
  const lens = (kind: 'hip' | 'valley') => roof.roof.lines.filter((l) => l.kind === kind).map((l) => l.len / 100);
  const valleyType = cornerTypeById(fin.externalOdd);
  const hipType = cornerTypeById(fin.internalOdd);
  if (valleyType) addEdgeFinish(req, valleyType, lens('valley'), fin);
  if (hipType) addEdgeFinish(req, hipType, lens('hip'), fin);
  if (valleyType && !valleyType.anyAngle && lens('valley').length) warnings.push(`${valleyType.name} jest do kątów prostych – na koszach wybierz wykończenie do kątów dowolnych.`);
  if (hipType && !hipType.anyAngle && lens('hip').length) warnings.push(`${hipType.name} jest do kątów prostych – na narożnikach dachu wybierz wykończenie do kątów dowolnych.`);

  if (frame.hanger) {
    const gapMm = Math.max(0, grid.depthMm - boards.reduce((t, id) => t + boardById(id).thickness, 0) - grid.profileMm - (carrier?.mm ?? 0));
    addNote(req, frame.hanger, `poddasze: ${grid.hangerSize ? `dobrano ${grid.hangerSize.name}, ` : ''}${carrier ? carrier.label : frame.profileLabel} ok. ${Math.round(gapMm)} mm pod krokwią`);
  }

  if (a.woolBetween > 0) {
    const clear = Math.min(1, Math.max(0, (a.rafterSpacing - a.rafterWidth + 1.5) / a.rafterSpacing));
    // przy widocznej więźbie powierzchnia płyt jest już bez krokwi
    add(req.area, `WELNA${a.woolBetween}`, between ? areaM2 : areaM2 * clear);
  }
  if (a.woolUnder > 0 && !between) add(req.area, `WELNA${a.woolUnder}`, areaM2);
  const vapor = ceilingVaporSpec(sys);
  if (vaporBarrierOn(a.vaporBarrier, vapor)) vaporBarrierLines(req, areaM2, vapor);

  // okładziny ścianek kolankowych i ścian szczytowych (także dobudówek) – jak w zwykłym poddaszu
  const walls = atticRoofWallFaces(a, roof).map(atticWallLayout);
  const wallAreaM2 = addAtticWalls(req, walls, fin);
  for (const w of walls) warnings.push(...w.warnings);
  if (walls.length)
    assumptions.push(
      'Okładziny ścian poddasza: profile pionowe co rozstaw, docięte do lica skosu; profil przyścienny UD po obwodzie każdej ściany; płyty pionowo, docinane pod kątem skosu. Okładzina dochodzi do lica zabudowy skosów i sufitu.',
    );
  // okna dachowe: obramowanie otworu, glify, narożniki, kołnierz paroizolacyjny
  const windows = addAtticWindows(req, a, grid, { vapor: vaporBarrierOn(a.vaporBarrier, vapor), fin, sys });
  warnings.push(...windows.warnings);
  assumptions.push(...windows.assumptions);
  return { req, grid, boards: { surfaces: [], sheets: layout.sheets, warnings: layout.warnings, roof: layout }, areaM2, walls, wallAreaM2, perimeterM, hangers, warnings, assumptions, windows };
}
