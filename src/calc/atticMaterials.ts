// Zapotrzebowanie materiałowe zabudowy poddasza (skosy + sufit pod jętkami) wg geometrii z `attic.ts`.
//
// Źródła: karty Rigips 4.70.03 / 4.70.04 / 4.70.06 (CD 60 co 40 cm wzdłuż płyt lub 50 cm w poprzek,
// wieszaki co max 100 cm, 2 wkręty do drewna na wieszak – 8 szt. na 4 wieszaki/m², taśma spoinowa
// 1,4 m/m², UD 30 z taśmą uszczelniającą), Knauf D612 i Norgips ZP (rozstawy w katalogu systemu).

import { boardById, ceilingSystemById, type CeilingSystem } from '../catalog/rigips';
import { resolveFinishing, type FinishingSettings } from '../catalog/finishing';
import type { Attic } from '../model/types';
import { atticFrameOf, atticGrid, type AtticGrid } from './attic';
import { atticBoardLayout, type AtticBoards } from './atticBoards';
import { layerBoards } from './ceilingLevels';
import { ceilingVaporSpec, vaporBarrierLines, vaporBarrierOn } from './vaporBarrier';
import { joinsFor, profileMaxStock } from './profileLength';
import { atticRoofRequirement } from './atticRoofMaterials';
import { add, addBoardScrews, addJointing, addNote, addPiece, anchorsFor, emptyReq, type Requirement } from './materials';

export interface AtticResult {
  req: Requirement;
  grid: AtticGrid;
  /** Rozkład płyt na płaszczyznach (rysunki, 3D, lista zakupów) */
  boards: AtticBoards;
  /** Powierzchnia zabudowy (skosy + sufit), m² */
  areaM2: number;
  /** Długość profilu przyściennego na ścianach, m */
  perimeterM: number;
  /** Liczba mocowań rusztu do krokwi (wieszaki albo punkty przykręcenia profilu / łaty) */
  hangers: number;
  warnings: string[];
  assumptions: string[];
}

/** Grubości wełny do wyboru między krokwiami i pod krokwiami, mm */
export const ATTIC_WOOL_BETWEEN = [0, 100, 150, 180, 200];
export const ATTIC_WOOL_UNDER = [0, 50, 75, 100, 150, 200];

export function atticRequirement(
  a: Attic,
  sys: CeilingSystem = ceilingSystemById(a.systemId),
  fin: FinishingSettings = resolveFinishing(),
): AtticResult {
  const req = emptyReq();
  const grid = atticGrid(a, sys);
  // dach z narożnikami lub koszami: płaszczyzny o dowolnym obrysie
  if (grid.roof) return atticRoofRequirement(a, sys, fin, { ...grid, roof: grid.roof });
  const warnings = [...grid.warnings];
  const assumptions = [...grid.assumptions];
  const L = a.length / 100;
  const frame = atticFrameOf(sys);
  const between = frame.mount === 'between';
  const sideProduct = frame.edge ?? grid.profile;
  const sideFixM = (frame.sideFix ?? 100) / 100;

  let areaM2 = 0;
  let hangers = 0;
  let perimeterM = 0;
  const edge = (lenM: number) => {
    if (!frame.edge || lenM <= 0.05) return;
    addPiece(req, frame.edge, lenM);
    add(req.counts, 'KOLEK', anchorsFor(lenM, 0.8));
    perimeterM += lenM;
  };
  const boards = layerBoards(sys, a.boardId);

  for (const g of grid.surfaces) {
    const A = g.areaM2;
    const run = g.surface.run / 100;
    areaM2 += A;
    if (between) {
      // więźba widoczna: w każdym polu dwa elementy wzdłuż krokwi i poprzeczki między nimi
      for (const bay of grid.bays) {
        for (let k = 0; k < 2; k++) {
          addPiece(req, sideProduct, run);
          add(req.counts, 'WKRET_DREWNO', anchorsFor(run, sideFixM) * frame.woodScrews);
        }
        for (let i = 0; i < g.cd.length; i++) addPiece(req, grid.profile, bay.w / 100);
        // każda poprzeczka mocowana na obu końcach
        add(req.counts, 'WKRET_DREWNO', g.cd.length * 2);
      }
    } else {
      // elementy rusztu wzdłuż kalenicy, na całej długości pomieszczenia
      for (let i = 0; i < g.cd.length; i++) {
        addPiece(req, grid.profile, L);
        if (frame.joiner) add(req.counts, frame.joiner, joinsFor(L, profileMaxStock(grid.profile, 4)));
      }
      const carrier = grid.carrier;
      if (carrier) {
        // ruszt krzyżowy: profil nośny pod każdą krokwią na całej długości płaszczyzny
        for (let i = 0; i < g.hangerU.length; i++) {
          addPiece(req, carrier.product, run);
          if (frame.joiner) add(req.counts, frame.joiner, Math.max(0, Math.ceil(run / 4 - 1e-9) - 1));
        }
        const crossings = g.cd.length * g.hangerU.length;
        if (carrier.cross) add(req.counts, carrier.cross, crossings);
        if (carrier.crossLn9) add(req.counts, 'LN9', crossings * carrier.crossLn9);
      }
      // wieszaki: na profilach nośnych (ruszt krzyżowy) albo na skrzyżowaniach profili z krokwiami
      const n = (carrier ? g.fixS.length : g.cd.length) * g.hangerU.length;
      hangers += n;
      if (frame.hanger) add(req.counts, frame.hanger, n);
      add(req.counts, 'WKRET_DREWNO', n * frame.woodScrews);
      if (frame.hanger && frame.hangerLn9) add(req.counts, 'LN9', n * frame.hangerLn9);
      // profil przyścienny na obu ścianach szczytowych wzdłuż tej płaszczyzny
      edge(run);
      edge(run);
    }

    // do łat drewnianych płyty kręci się wkrętami TD 3,5×35 (karty Rigips 4.70.01, 4.70.81, 4.71.11)
    if (grid.profile.startsWith('LATA')) add(req.counts, 'TD35', A * sys.screwsOuter);
    else addBoardScrews(req, A, boards, sys.screwsOuter, sys.screwsInner);
    // więźba widoczna: płyty cięte na pasy między krokwiami – karty 4.71.11 i 4.71.12 podają 3 mb taśmy na m²
    addJointing(req, A, sys.layers, a.boardId, between ? 3 : 1.4, fin);
  }

  // płyty z rozkładu (ten sam co na rysunku i w 3D): elementy + resztki, z których nic się już nie wytnie
  const layout = atticBoardLayout(a, sys, grid);
  for (const u of layout.sheets) {
    const key = `${u.boardId}|${u.sheetLen}`;
    add(req.boardArea, key, u.netM2 + u.wasteM2);
    if (u.wasteM2 > 0) add((req.boardCutWaste ??= {}), key, u.wasteM2);
  }
  warnings.push(...layout.warnings);
  assumptions.push(
    'Płyty dłuższą krawędzią w poprzek rusztu (wzdłuż krokwi), styki krótkich krawędzi na elemencie rusztu, w sąsiednich pasach i warstwach przesunięte o min. 40 cm; bez docinków węższych niż 30 cm.',
  );

  // profil przyścienny wzdłuż ścianek kolankowych i ściany wysokiej (dach jednospadowy)
  const slopes = grid.section.surfaces.filter((s) => s.kind === 'slope');
  if (!between && frame.edge) {
    for (const s of slopes) if (s.a.z > 1) edge(L);
    const collar = grid.section.surfaces.find((s) => s.kind === 'collar');
    if (a.roof === 'mono') edge(L);
    else if (collar && !slopes.some((s) => s.id === 'right')) edge(L);
    if (collar && !slopes.some((s) => s.id === 'left')) edge(L);
    add(req.meters, 'TASMA_USZ30', perimeterM);
    if (slopes.some((s) => s.a.z > 1)) assumptions.push('Profil przyścienny także wzdłuż ścianek kolankowych, pod dolną krawędzią skosu.');
  }

  if (frame.hanger) {
    const gapMm = Math.max(0, grid.depthMm - boards.reduce((t, id) => t + boardById(id).thickness, 0) - grid.profileMm - (grid.carrier?.mm ?? 0));
    addNote(req, frame.hanger, `poddasze: ${grid.hangerSize ? `dobrano ${grid.hangerSize.name}, ` : ''}${grid.carrier ? grid.carrier.label : frame.profileLabel} ok. ${Math.round(gapMm)} mm pod krokwią`);
  }

  // wełna: między krokwiami (pasy o 1–2 cm szersze niż światło – wytyczne Isover/Rigips) i pod krokwiami na całej powierzchni
  if (a.woolBetween > 0) {
    const clear = Math.min(1, Math.max(0, (a.rafterSpacing - a.rafterWidth + 1.5) / a.rafterSpacing));
    // przy widocznej więźbie powierzchnia płyt jest już bez krokwi
    add(req.area, `WELNA${a.woolBetween}`, between ? areaM2 : areaM2 * clear);
  }
  if (a.woolUnder > 0 && !between) add(req.area, `WELNA${a.woolUnder}`, areaM2);

  // paroizolacja pod płytami na całej zabudowie – wspólne wyliczenie folii i taśm
  const vapor = ceilingVaporSpec(sys);
  if (vaporBarrierOn(a.vaporBarrier, vapor)) vaporBarrierLines(req, areaM2, vapor);

  return { req, grid, boards: layout, areaM2, perimeterM, hangers, warnings, assumptions };
}
