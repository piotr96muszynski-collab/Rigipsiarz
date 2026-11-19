// Zapotrzebowanie materiałowe zabudowy poddasza (skosy + sufit pod jętkami) wg geometrii z `attic.ts`.
//
// Źródła: karty Rigips 4.70.03 / 4.70.04 / 4.70.06 (CD 60 co 40 cm wzdłuż płyt lub 50 cm w poprzek,
// wieszaki co max 100 cm, 2 wkręty do drewna na wieszak – 8 szt. na 4 wieszaki/m², taśma spoinowa
// 1,4 m/m², UD 30 z taśmą uszczelniającą), Knauf D612 i Norgips ZP (rozstawy w katalogu systemu).

import { boardById, ceilingSystemById, type CeilingSystem } from '../catalog/rigips';
import { resolveFinishing, type FinishingSettings } from '../catalog/finishing';
import type { Attic } from '../model/types';
import { atticGrid, type AtticGrid } from './attic';
import { layerBoards } from './ceilingLevels';
import { add, addBoardScrews, addJointing, addNote, addPiece, anchorsFor, emptyReq, pickBoardLength, type Requirement } from './materials';

export interface AtticResult {
  req: Requirement;
  grid: AtticGrid;
  /** Powierzchnia zabudowy (skosy + sufit), m² */
  areaM2: number;
  /** Długość UD 30 na ścianach, m */
  perimeterM: number;
  /** Liczba wieszaków */
  hangers: number;
  warnings: string[];
  assumptions: string[];
}

/** Grubości wełny do wyboru między krokwiami i pod krokwiami, mm */
export const ATTIC_WOOL_BETWEEN = [0, 100, 150, 180, 200];
export const ATTIC_WOOL_UNDER = [0, 50, 75, 100, 150];

const HANGER_PRODUCT: Record<string, string> = { es: 'WIESZAK_ES', elastic: 'UCHWYT_ELAST', attic: 'WIESZAK_PODD' };
/** Wkręty „pchełki” łączące wieszak z profilem CD (wieszak do poddaszy zatrzaskuje się na profilu – karta 4.70.04 ich nie podaje) */
const HANGER_LN9: Record<string, number> = { es: 4, elastic: 4, attic: 0 };
/** Wkręty do drewna na jeden wieszak (karty Rigips 4.70: 8 szt. na 4 wieszaki; Norgips ZP: 6 szt. na 3 wieszaki) */
const WOOD_SCREWS_PER_HANGER = 2;

export function atticRequirement(
  a: Attic,
  sys: CeilingSystem = ceilingSystemById(a.systemId),
  fin: FinishingSettings = resolveFinishing(),
): AtticResult {
  const req = emptyReq();
  const grid = atticGrid(a, sys);
  const warnings = [...grid.warnings];
  const assumptions = [...grid.assumptions];
  const L = a.length / 100;
  const hangerType = sys.hangerType ?? 'es';
  const hangerPid = HANGER_PRODUCT[hangerType] ?? 'WIESZAK_ES';

  let areaM2 = 0;
  let hangers = 0;
  let perimeterM = 0;
  const ud = (lenM: number) => {
    if (lenM <= 0.05) return;
    addPiece(req, 'UD30', lenM);
    add(req.counts, 'KOLEK', anchorsFor(lenM, 0.8));
    perimeterM += lenM;
  };
  const boards = layerBoards(sys, a.boardId);

  for (const g of grid.surfaces) {
    const A = g.areaM2;
    areaM2 += A;
    // profile CD wzdłuż kalenicy, na całej długości pomieszczenia
    for (let i = 0; i < g.cd.length; i++) {
      addPiece(req, 'CD60', L);
      add(req.counts, 'LACZNIK_WZDL', Math.max(0, Math.ceil(L / 4 - 1e-9) - 1));
    }
    const n = g.cd.length * g.hangerU.length;
    hangers += n;
    add(req.counts, hangerPid, n);
    add(req.counts, 'WKRET_DREWNO', n * WOOD_SCREWS_PER_HANGER);
    add(req.counts, 'LN9', n * (HANGER_LN9[hangerType] ?? 4));
    // UD 30 na obu ścianach szczytowych wzdłuż tej płaszczyzny
    ud(g.surface.run / 100);
    ud(g.surface.run / 100);

    const sheetLen = pickBoardLength(a.boardId, Math.min(Math.max(g.surface.run, 200), 300));
    for (const id of boards) add(req.boardArea, `${id}|${id === a.boardId ? sheetLen : pickBoardLength(id, 300)}`, A);
    addBoardScrews(req, A, boards, sys.screwsOuter, sys.screwsInner);
    addJointing(req, A, sys.layers, a.boardId, 1.4, fin);
  }

  // UD 30 wzdłuż ścianek kolankowych i ściany wysokiej (dach jednospadowy)
  const slopes = grid.section.surfaces.filter((s) => s.kind === 'slope');
  for (const s of slopes) if (s.a.z > 1) ud(L);
  const collar = grid.section.surfaces.find((s) => s.kind === 'collar');
  if (a.roof === 'mono') ud(L);
  else if (collar && !slopes.some((s) => s.id === 'right')) ud(L);
  if (collar && !slopes.some((s) => s.id === 'left')) ud(L);
  add(req.meters, 'TASMA_USZ30', perimeterM);
  if (slopes.some((s) => s.a.z > 1)) assumptions.push('UD 30 także wzdłuż ścianek kolankowych, pod dolną krawędzią skosu.');

  const gapMm = Math.max(0, grid.depthMm - boards.reduce((t, id) => t + boardById(id).thickness, 0) - 27);
  addNote(req, hangerPid, `poddasze: profil CD ok. ${Math.round(gapMm)} mm pod krokwią`);

  // wełna: między krokwiami (pasy o 1–2 cm szersze niż światło – wytyczne Isover/Rigips) i pod krokwiami na całej powierzchni
  if (a.woolBetween > 0) {
    const clear = Math.min(1, Math.max(0, (a.rafterSpacing - a.rafterWidth + 1.5) / a.rafterSpacing));
    add(req.area, `WELNA${a.woolBetween}`, areaM2 * clear);
  }
  if (a.woolUnder > 0) add(req.area, `WELNA${a.woolUnder}`, areaM2);

  return { req, grid, areaM2, perimeterM, hangers, warnings, assumptions };
}
