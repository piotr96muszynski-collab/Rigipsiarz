import type { Product } from './rigips';

/**
 * Paroizolacja (folia paroizolacyjna) i taśmy do niej.
 *
 * Źródła (sprawdzone 2026-11-19):
 * - Rigips 4.70.01, 4.70.03, 4.70.06 (karty PDF) i kalkulator rigips.pl dla poddaszy 4.70.0x / 4.71.xx:
 *   „Paroizolacja np. ISOVER Vario KM Duplex UV lub Stopair 1104” 1,18 m²/m², taśma Vario KB1
 *   do łączenia na zakład 0,98 mb/m², taśma dwustronna 0,50 mb/m², Vario DoubleFit+ opcjonalnie.
 * - Rigips 4.05.13, 4.05.23 (okładziny sufitów): paroizolacja „w razie potrzeby”, 1,0 m²/m².
 * - Norgips ZP (poddasza): „Folia paroizolacyjna” element 9 systemu, kalkulator 1,0 m²/m²;
 *   sufity SP i okładziny ścian na CD 60 – folia po analizie cieplno-wilgotnościowej.
 * - Knauf D612 (Systemfinder): brak listy materiałów i wzmianki o folii – przyjęto jak Rigips.
 */
export const VAPOR_PRODUCTS: Record<string, Product> = {
  FOLIA_PAROIZ: {
    id: 'FOLIA_PAROIZ',
    name: 'Folia paroizolacyjna (np. Isover Stopair 1104 / Vario KM Duplex UV), rolka 1,5 × 45 m',
    group: 'Izolacja',
    unit: 'm²',
    pack: 67.5,
    packUnit: 'rolka',
  },
  TASMA_PAROIZ: {
    id: 'TASMA_PAROIZ',
    name: 'Taśma do łączenia paroizolacji na zakład (np. Isover Vario KB1), 60 mm',
    group: 'Izolacja',
    unit: 'mb',
    pack: 40,
    packUnit: 'rolka',
  },
  TASMA_DWUSTR: {
    id: 'TASMA_DWUSTR',
    name: 'Taśma dwustronna do mocowania paroizolacji do rusztu',
    group: 'Izolacja',
    unit: 'mb',
    pack: 50,
    packUnit: 'rolka',
  },
  // okna dachowe: fabryczny kołnierz z folii łączony z ościeżnicą i paroizolacją dachu (VELUX BBX, FAKRO XDS),
  // dobierany do rozmiaru okna – rozmiar w uwadze pozycji
  KOLNIERZ_PARO: {
    id: 'KOLNIERZ_PARO',
    name: 'Kołnierz paroizolacyjny okna dachowego (np. VELUX BBX, FAKRO XDS) – w rozmiarze okna',
    group: 'Izolacja',
    unit: 'szt.',
  },
};

/** Zużycie na 1 m² zabudowy wg kart Rigips 4.70.0x (folia z zakładami ok. 10 cm i wywinięciem na ściany) */
export const VAPOR_RATES = {
  foil: 1.18,
  overlapTape: 0.98,
  doubleTape: 0.5,
} as const;

/** Zakład arkuszy folii, cm (typowy, karty nie podają liczby) */
export const VAPOR_OVERLAP_CM = 10;
