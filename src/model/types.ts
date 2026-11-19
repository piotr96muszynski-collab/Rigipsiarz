// Wszystkie wymiary w modelu są w centymetrach.

import type { FinishingSettings } from '../catalog/finishing';
import type { BoardLengthPref } from '../calc/boardLength';
import type { WoolChoice } from '../catalog/insulation';

export type Id = string;

export interface Point {
  x: number;
  y: number;
}

export interface PlanNode extends Point {
  id: Id;
}

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: Id;
  kind: OpeningKind;
  /** Odległość lewej krawędzi otworu od początku ściany (węzeł a), cm */
  offset: number;
  width: number;
  height: number;
  /** Wysokość parapetu (dla okien), cm. Drzwi = 0 */
  sill: number;
  /** Ościeże wzmocnione profilami UA zamiast CW (ciężkie drzwi) */
  reinforced: boolean;
}

/** Jak zakończona jest ściana w węźle, który nie łączy się z inną ścianą */
export type FreeEndType = 'existing-wall' | 'free';

/**
 * Okładzina z płyt na istniejącej ścianie (klejona albo na ruszcie). Liczona jak ściana
 * z systemu kategorii „okładzina” o długości i wysokości ściany, z odjęciem jej otworów.
 */
export interface Lining {
  /** Strona ściany: 1 = po lewej patrząc od a do b (normalna (-dy, dx)), -1 = po prawej */
  side: 1 | -1;
  systemId: string;
  boardId: string;
  studSpacing: 60 | 40 | 30;
  /** Słupki podwójne (2×CW zespolone) – większa dopuszczalna wysokość */
  doubleStuds?: boolean;
  /** Płyta warstw wewnętrznych w systemach z dwoma rodzajami płyt (brak = wg systemu) */
  innerBoardId?: string;
  insulation: boolean;
}

/**
 * Rodzaj ściany: „new” – nowa ściana z płyt g-k (liczona w materiałach),
 * „existing” – istniejąca ściana (mur, obrys mieszkania), tylko tło planu i podkład pod okładziny.
 */
export type WallKind = 'new' | 'existing';

export interface Wall {
  id: Id;
  /** Brak = 'new' (projekty sprzed wprowadzenia obrysu) */
  kind?: WallKind;
  /** Grubość istniejącej ściany, cm (rysowana na zewnątrz od linii lica) */
  thickness?: number;
  /** Okładziny istniejącej ściany */
  linings?: Lining[];
  /**
   * Mur postawiony automatycznie za okładziną (ATLAS M-System, CD 60 na ES, klej), gdy ścianę
   * narysowano w systemie okładziny. Okładzina takiego muru obraca się do wnętrza obrysu.
   */
  backing?: boolean;
  a: Id;
  b: Id;
  height: number;
  systemId: string;
  boardId: string;
  /** Rozstaw słupków CW, cm */
  studSpacing: 60 | 40 | 30;
  /** Słupki podwójne (2×CW zespolone wkrętami) – większa dopuszczalna wysokość wg kart Rigips */
  doubleStuds?: boolean;
  /** Płyta warstw wewnętrznych w systemach z dwoma rodzajami płyt (brak = wg systemu) */
  innerBoardId?: string;
  insulation: boolean;
  /** Grubość wełny, mm (brak = pełna głębokość rusztu) */
  insulationThickness?: number;
  endA: FreeEndType;
  endB: FreeEndType;
  openings: Opening[];
}

export interface Ceiling {
  id: Id;
  points: Point[];
  systemId: string;
  boardId: string;
  insulation: boolean;
  /** Grubość wełny na suficie, mm (brak = 100 mm) */
  insulationThickness?: number;
  /** Kierunek profili nośnych: 0 = wzdłuż osi X, 90 = wzdłuż osi Y */
  direction: 0 | 90;
  /** Wysokość sufitu podwieszanego: spód płyt od posadzki, cm */
  height: number;
  /**
   * Spód istniejącego stropu od posadzki, cm. Brak = projekt sprzed zmiany: `height` było wtedy
   * wysokością pomieszczenia, a sufit wisi najbliżej stropu, jak pozwala system.
   */
  slabHeight?: number;
}

/**
 * Zabudowa poddasza opisana przekrojem poprzecznym: pomieszczenie prostokątne pod dachem
 * dwuspadowym albo jednospadowym. Wysokości mierzone od posadzki do spodu konstrukcji
 * (krokwi, jętek), szerokość między licami ścian okapowych.
 */
export interface Attic {
  id: Id;
  name?: string;
  /** gable = dwuspadowy (skosy z obu stron), mono = jednospadowy (skos rośnie od lewej ściany do prawej) */
  roof: 'gable' | 'mono';
  /** Szerokość pomieszczenia w poprzek kalenicy, między ścianami okapowymi, cm */
  width: number;
  /** Długość wzdłuż kalenicy, między ścianami szczytowymi, cm */
  length: number;
  /** Wysokość ścianki kolankowej: od posadzki do spodu krokwi przy licu ściany, cm (0 = skos od podłogi) */
  kneeLeft: number;
  /** Jak wyżej dla prawej strony (pomijane w dachu jednospadowym) */
  kneeRight: number;
  /** Kąt nachylenia połaci, stopnie */
  pitch: number;
  /** Spód jętek od posadzki, cm; brak = skosy do samej kalenicy (bez sufitu poziomego) */
  collarHeight?: number;
  /** Rozstaw osiowy krokwi, cm */
  rafterSpacing: number;
  /** Przekrój krokwi: szerokość i wysokość, cm */
  rafterWidth: number;
  rafterHeight: number;
  /** Oś pierwszej krokwi od lica ściany szczytowej, cm */
  firstRafter: number;
  systemId: string;
  boardId: string;
  /** Wełna między krokwiami, mm (0 = bez) */
  woolBetween: number;
  /** Wełna pod krokwiami (druga warstwa, w poprzek krokwi), mm (0 = bez) */
  woolUnder: number;
  /** Paroizolacja pod płytami (brak = wg systemu: w poddaszach włączona) */
  vaporBarrier?: boolean;
}

/** Domyślne parametry nowej ściany g-k (system jest w `defaultWallSystem`) */
export interface WallDefaults {
  boardId?: string;
  studSpacing?: 60 | 40 | 30;
  insulation?: boolean;
  /** Grubość wełny, mm (brak = pełna głębokość rusztu) */
  insulationThickness?: number;
}

export interface ProjectSettings {
  /** Czy doliczać naddatek na odpady */
  wasteEnabled: boolean;
  /** Naddatek na odpady, % */
  waste: number;
  /** Wysokość do stropu, cm: nowe ściany (dochodzą do stropu) i strop nad nowymi sufitami */
  defaultHeight: number;
  /** Wysokość nowych sufitów podwieszanych (spód płyt), cm; brak = najbliżej stropu wg systemu */
  ceilingHeight?: number;
  defaultWallSystem: string;
  /** Ustawienia nowych ścian rysowanych na planie (płyta, rozstaw, wełna); brak = wartości domyślne systemu */
  wallDefaults?: WallDefaults;
  defaultCeilingSystem: string;
  gridSnap: number;
  /** Wybrany produkt wełny dla każdej grubości (klucz = grubość w mm) */
  wool?: Record<string, WoolChoice>;
  /** Spoinowanie (Q1) i domyślne wykończenie narożników i styków; brak = wartości domyślne */
  finishing?: Partial<FinishingSettings>;
  /** Długość arkuszy płyt w tym projekcie, cm ('auto' = dopasowana do wysokości); brak = jak w ustawieniach aplikacji */
  boardLength?: BoardLengthPref;
}

/**
 * Wybór wykończenia dla jednego połączenia (klucz = id połączenia z `analyzeJoints`).
 * outer = krawędzie zewnętrzne, inner = kąty wewnętrzne i styki.
 */
export interface JointFinishOverride {
  outer?: string;
  inner?: string;
}

export interface Project {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: PlanNode[];
  walls: Wall[];
  ceilings: Ceiling[];
  /** Zabudowy poddaszy (brak = projekt sprzed ich wprowadzenia) */
  attics?: Attic[];
  settings: ProjectSettings;
  /** Lista zakupów: pozycje odhaczone jako kupione */
  bought: Record<string, boolean>;
  /** Wykończenie wybrane ręcznie dla połączeń (narożniki, trójniki, styki) */
  jointFinish?: Record<string, JointFinishOverride>;
}
