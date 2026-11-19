// Katalog systemów suchej zabudowy Norgips (norgips.pl) – ściany, szachty, okładziny,
// sufity podwieszane, okładziny sufitowe i zabudowa poddasza.
//
// Źródło: tabele systemów na https://norgips.pl/rozwiazania/<kategoria>/ (płyta, grubość,
// masa, EI, Rw, RA1, wełna, maksymalna wysokość przy CW co 600 mm z blachy 0,6 mm) oraz
// zużycie materiałów na 1 m² z kalkulatora na stronie każdego systemu (stan 19.11.2026).
// Jedna pozycja katalogu = jedna konstrukcja (profil × liczba warstw × ruszt); różne płyty
// i słupki podwójne są odmianami (`variants`). Systemy Norgips nie mają pola `code` – nazwy
// systemów (SD, SO, SP…) są w nazwie pozycji. Okładziny ścian i sufitów na profilach
// kapeluszowych (KAP) generuje scripts/gen-hat.mjs (src/catalog/hat.gen.ts). Nie ujęto suchego
// jastrychu (SJ) – aplikacja jeszcze go nie liczy.
//
// Plik generowany: node scripts/gen-norgips.mjs (dane w data/norgips); importuje z `rigips.ts` wyłącznie typy.

import type { Board, CeilingSystem, Source, WallSystem } from './rigips';

const KAT: Record<string, string> = {
  'sciany-dzialowe': 'ściany działowe',
  'sciany-wysokie': 'ściany wysokie',
  'sciany-oslonowe': 'ściany osłonowe',
  'sufity-podwieszane': 'sufity podwieszane',
  'okladziny-sufitowe': 'okładziny sufitowe',
  'zabudowa-poddasza': 'zabudowa poddasza',
  'suchy-tynk': 'suchy tynk',
  'okladziny-scienne': 'okładziny ścienne',
};

const src = (kat: string): Source => ({
  label: `Norgips – rozwiązania systemowe: ${KAT[kat]} (tabela systemów i kalkulator zużycia)`,
  url: `https://norgips.pl/rozwiazania/${kat}/`,
});

