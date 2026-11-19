// PLIK GENEROWANY – nie edytuj ręcznie. Generator: node scripts/gen-hat.mjs
// Okładziny ścian i sufitów na profilach kapeluszowych 15/48 (Siniat PK48) mocowanych wprost do podłoża:
// Rigips 3.21.30, 3.29.20, 4.05.21 · Norgips OS i OSF „KAP” · Siniat Nida Tynk PK48 i Nida Sufit PK48.
// Kołki / dyble w dwóch rzędach (na obu półkach profilu) – `bracketSpacing` / `hangerSpacing` to rozstaw w jednym rzędzie.
// Knauf Polska nie ma takich systemów.
import type { CeilingSystem, WallSystem } from './rigips';

/** Okładziny ścian na profilach kapeluszowych (frame 'hat-lining') */
export const HAT_WALL_SYSTEMS: WallSystem[] = [
  {
    "id": "R-HAT-W-1",
    "code": "3.21.30",
    "name": "Okładzina ściany na profilach kapeluszowych (do muru i betonu), 1×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 1,
    "sides": 1,
    "defaultBoard": "RB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 152",
    "info": "Profile kapeluszowe 15/48 pionowo co max. 60 cm (poziomo co 50 cm), kołki rozporowe max. co 100 cm · bez UD i bez uchwytów – płyta 15 mm od ściany · wysokość bez ograniczeń · ściana musi być równa (profil nie ma regulacji)",
    "source": {
      "label": "Rigips 3.21.30 – strona systemu i kalkulator zużycia, karta systemu (PDF)",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_21_30"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Kołki rozporowe max. co 1000 mm",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Wkręt TN 3,5×25",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 0.25,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.21.30",
        "label": "1×12,5 PRO typ A",
        "board": "RB12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.21.30",
        "label": "1×12,5 PRO Hydro H2",
        "board": "RBI12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.21.30",
        "label": "1×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 152,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.21.30",
        "label": "1×12,5 PRO Fire+ DF",
        "board": "RFP12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.21.30",
        "label": "1×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 152,
        "thickness": 28,
        "mass": 12
      }
    ]
  },
  {
    "id": "R-HAT-W-2",
    "code": "3.21.30",
    "name": "Okładzina ściany na profilach kapeluszowych (do muru i betonu), 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 2,
    "sides": 1,
    "defaultBoard": "RB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 302 – EI 602",
    "info": "Profile kapeluszowe 15/48 pionowo co max. 60 cm (poziomo co 50 cm), kołki rozporowe max. co 100 cm · bez UD i bez uchwytów – płyta 15 mm od ściany · wysokość bez ograniczeń · ściana musi być równa (profil nie ma regulacji)",
    "source": {
      "label": "Rigips 3.21.30 – strona systemu i kalkulator zużycia, karta systemu (PDF)",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_21_30"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Kołki rozporowe max. co 1000 mm",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Wkręt TN 3,5×25",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN35",
        "label": "Wkręt TN 3,5×35",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 0.5,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.21.30",
        "label": "2×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 302,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "3.21.30",
        "label": "2×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 302,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "3.21.30",
        "label": "2×15 PRO Fire+ DF 15",
        "board": "RFP15",
        "fire": 602,
        "thickness": 46,
        "mass": 29
      },
      {
        "code": "3.21.30",
        "label": "2×15 PRO Fire+ Hydro DFH2 15",
        "board": "RFI15",
        "fire": 602,
        "thickness": 46,
        "mass": 29
      },
      {
        "code": "3.21.30",
        "label": "2×12,5 PRO typ A",
        "board": "RB12.5",
        "thickness": 41,
        "mass": 21
      },
      {
        "code": "3.21.30",
        "label": "2×12,5 PRO Hydro H2",
        "board": "RBI12.5",
        "thickness": 41,
        "mass": 21
      }
    ]
  },
  {
    "id": "R-HAT-W-3",
    "code": "3.21.30",
    "name": "Okładzina ściany na profilach kapeluszowych (do muru i betonu), 3×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 3,
    "sides": 1,
    "defaultBoard": "RF12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 602",
    "info": "Profile kapeluszowe 15/48 pionowo co max. 60 cm (poziomo co 50 cm), kołki rozporowe max. co 100 cm · bez UD i bez uchwytów – płyta 15 mm od ściany · wysokość bez ograniczeń · ściana musi być równa (profil nie ma regulacji)",
    "source": {
      "label": "Rigips 3.21.30 – strona systemu i kalkulator zużycia, karta systemu (PDF)",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_21_30"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Kołki rozporowe max. co 1000 mm",
        "qty": 5,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.21.30",
        "label": "3×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 602,
        "thickness": 53,
        "mass": 32
      },
      {
        "code": "3.21.30",
        "label": "3×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 602,
        "thickness": 53,
        "mass": 32
      }
    ]
  },
  {
    "id": "R-HAT-W-4",
    "code": "3.21.30",
    "name": "Okładzina ściany na profilach kapeluszowych (do muru i betonu), 2×15 + 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 4,
    "sides": 1,
    "defaultBoard": "RFP12.5",
    "innerBoard": "RFP15",
    "innerLayers": 2,
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 1202",
    "info": "Profile kapeluszowe 15/48 pionowo co max. 60 cm (poziomo co 50 cm), kołki rozporowe max. co 100 cm · bez UD i bez uchwytów – płyta 15 mm od ściany · wysokość bez ograniczeń · ściana musi być równa (profil nie ma regulacji)",
    "source": {
      "label": "Rigips 3.21.30 – strona systemu i kalkulator zużycia, karta systemu (PDF)",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_21_30"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Kołki rozporowe max. co 1000 mm",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Wkręt TN 3,5×25",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN45",
        "label": "Wkręt TN 3,5×45",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN55",
        "label": "Wkręt TN 3,5×55",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN70",
        "label": "Wkręt TN 3,5×70",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 1,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.21.30",
        "label": "2×15 + 2×12,5 PRO Fire+ DF (2 wewnętrzne warstwy Fire+ DF 15)",
        "board": "RFP12.5",
        "innerBoards": [
          "RFP15"
        ],
        "fire": 1202,
        "thickness": 71,
        "mass": 49
      },
      {
        "code": "3.21.30",
        "label": "2×15 + 2×12,5 PRO Fire+ Hydro DFH2 (2 wewnętrzne warstwy Fire+ DF 15)",
        "board": "RFI12.5",
        "innerBoards": [
          "RFP15"
        ],
        "fire": 1202,
        "thickness": 71,
        "mass": 49
      }
    ]
  },
  {
    "id": "R-HAT-WD-1",
    "code": "3.29.20",
    "name": "Okładzina ściany na profilach kapeluszowych do konstrukcji drewnianej, 1×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 1,
    "sides": 1,
    "defaultBoard": "RB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "WKRET_DREWNO",
    "insulationDefault": false,
    "fire": "EI 152",
    "info": "Profile kapeluszowe 15/48 przykręcone wkrętami do drewna (kalkulator Rigips: 5 szt./m²) · strona nie podaje rozstawów – przyjęto jak w 3.21.30: profile pionowo co 60 cm, mocowanie max. co 100 cm · wysokość bez ograniczeń",
    "source": {
      "label": "Rigips 3.29.20 – strona systemu i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_29_20"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "WKRET_DREWNO",
        "label": "Wkręt do drewna",
        "qty": 5,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 0.25,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.29.20",
        "label": "1×12,5 PRO typ A",
        "board": "RB12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.29.20",
        "label": "1×12,5 PRO Hydro H2",
        "board": "RBI12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.29.20",
        "label": "1×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 152,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.29.20",
        "label": "1×12,5 PRO Fire+ DF",
        "board": "RFP12.5",
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "3.29.20",
        "label": "1×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 152,
        "thickness": 28,
        "mass": 12
      }
    ]
  },
  {
    "id": "R-HAT-WD-2",
    "code": "3.29.20",
    "name": "Okładzina ściany na profilach kapeluszowych do konstrukcji drewnianej, 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 2,
    "sides": 1,
    "defaultBoard": "RB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "WKRET_DREWNO",
    "insulationDefault": false,
    "fire": "EI 302 – EI 602",
    "info": "Profile kapeluszowe 15/48 przykręcone wkrętami do drewna (kalkulator Rigips: 5 szt./m²) · strona nie podaje rozstawów – przyjęto jak w 3.21.30: profile pionowo co 60 cm, mocowanie max. co 100 cm · wysokość bez ograniczeń",
    "source": {
      "label": "Rigips 3.29.20 – strona systemu i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_29_20"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "WKRET_DREWNO",
        "label": "Wkręt do drewna",
        "qty": 5,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 0.5,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.29.20",
        "label": "2×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 302,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "3.29.20",
        "label": "2×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 302,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "3.29.20",
        "label": "2×15 PRO Fire+ DF 15",
        "board": "RFP15",
        "fire": 602,
        "thickness": 46,
        "mass": 29
      },
      {
        "code": "3.29.20",
        "label": "2×15 PRO Fire+ Hydro DFH2 15",
        "board": "RFI15",
        "fire": 602,
        "thickness": 46,
        "mass": 29
      },
      {
        "code": "3.29.20",
        "label": "2×12,5 PRO typ A",
        "board": "RB12.5",
        "thickness": 44,
        "mass": 21
      },
      {
        "code": "3.29.20",
        "label": "2×12,5 PRO Hydro H2",
        "board": "RBI12.5",
        "thickness": 44,
        "mass": 21
      }
    ]
  },
  {
    "id": "R-HAT-WD-3",
    "code": "3.29.20",
    "name": "Okładzina ściany na profilach kapeluszowych do konstrukcji drewnianej, 3×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 3,
    "sides": 1,
    "defaultBoard": "RF12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "WKRET_DREWNO",
    "insulationDefault": false,
    "fire": "EI 602",
    "info": "Profile kapeluszowe 15/48 przykręcone wkrętami do drewna (kalkulator Rigips: 5 szt./m²) · strona nie podaje rozstawów – przyjęto jak w 3.21.30: profile pionowo co 60 cm, mocowanie max. co 100 cm · wysokość bez ograniczeń",
    "source": {
      "label": "Rigips 3.29.20 – strona systemu i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_29_20"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "WKRET_DREWNO",
        "label": "Wkręt do drewna",
        "qty": 5,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.29.20",
        "label": "3×12,5 PRO Fire F",
        "board": "RF12.5",
        "fire": 602,
        "thickness": 53,
        "mass": 32
      },
      {
        "code": "3.29.20",
        "label": "3×12,5 PRO Fire+ Hydro DFH2",
        "board": "RFI12.5",
        "fire": 602,
        "thickness": 53,
        "mass": 32
      }
    ]
  },
  {
    "id": "R-HAT-WD-4",
    "code": "3.29.20",
    "name": "Okładzina ściany na profilach kapeluszowych do konstrukcji drewnianej, 2×15 + 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 4,
    "sides": 1,
    "defaultBoard": "RFP12.5",
    "innerBoard": "RFP15",
    "innerLayers": 2,
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "WKRET_DREWNO",
    "insulationDefault": false,
    "fire": "EI 1202",
    "info": "Profile kapeluszowe 15/48 przykręcone wkrętami do drewna (kalkulator Rigips: 5 szt./m²) · strona nie podaje rozstawów – przyjęto jak w 3.21.30: profile pionowo co 60 cm, mocowanie max. co 100 cm · wysokość bez ograniczeń",
    "source": {
      "label": "Rigips 3.29.20 – strona systemu i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-scienne/3_29_20"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)",
        "qty": 2.1,
        "unit": "mb"
      },
      {
        "product": "WKRET_DREWNO",
        "label": "Wkręt do drewna",
        "qty": 5,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "MASA",
        "label": "Masa konstrukcyjna",
        "qty": 1,
        "unit": "kg"
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "3.29.20",
        "label": "2×15 + 2×12,5 PRO Fire+ DF (2 wewnętrzne warstwy Fire+ DF 15)",
        "board": "RFP12.5",
        "innerBoards": [
          "RFP15"
        ],
        "fire": 1202,
        "thickness": 71,
        "mass": 49
      },
      {
        "code": "3.29.20",
        "label": "2×15 + 2×12,5 PRO Fire+ Hydro DFH2 (2 wewnętrzne warstwy Fire+ DF 15)",
        "board": "RFI12.5",
        "innerBoards": [
          "RFP15"
        ],
        "fire": 1202,
        "thickness": 71,
        "mass": 49
      }
    ]
  },
  {
    "id": "NG-OS-KAP-1",
    "name": "Okładzina ścienna OS na profilach kapeluszowych, 1×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 1,
    "sides": 1,
    "defaultBoard": "NG-GKB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOTWA",
    "insulationDefault": false,
    "fire": "EI 15",
    "info": "Profile kapeluszowe pionowo co max. 60 cm, dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyta 15 mm od ściany · do 12 m wysokości · taśma uszczelniająca 75 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny ścienne OS na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-scienne/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Kołki rozporowe / dyble 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Blachowkręt 3,5×25",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maxHeight": {
      "60": 1200
    },
    "maker": "norgips",
    "variants": [
      {
        "label": "1×12,5 GKB (A) · profile kapeluszowe co 60 cm",
        "board": "NG-GKB12.5",
        "thickness": 28,
        "mass": 10
      },
      {
        "label": "1×12,5 GKBI (H2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKBI12.5",
        "thickness": 28,
        "mass": 10
      },
      {
        "label": "1×12,5 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 13
      },
      {
        "label": "1×15 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF15",
        "fire": 15,
        "thickness": 30,
        "mass": 15
      },
      {
        "label": "1×12,5 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 13
      },
      {
        "label": "1×15 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI15",
        "fire": 15,
        "thickness": 30,
        "mass": 15
      },
      {
        "label": "1×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 60 cm",
        "board": "NG-AS12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 14
      }
    ]
  },
  {
    "id": "NG-OS-KAP-2",
    "name": "Okładzina ścienna OS na profilach kapeluszowych, 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 2,
    "sides": 1,
    "defaultBoard": "NG-GKB12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOTWA",
    "insulationDefault": false,
    "fire": "EI 30 – EI 60",
    "info": "Profile kapeluszowe pionowo co max. 60 cm, dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyta 15 mm od ściany · do 12 m wysokości · taśma uszczelniająca 75 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny ścienne OS na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-scienne/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Kołki rozporowe / dyble 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Blachowkręt 3,5×25",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN35",
        "label": "Blachowkręt 3,5×35",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maxHeight": {
      "60": 1200
    },
    "maker": "norgips",
    "variants": [
      {
        "label": "2×12,5 GKB (A) · profile kapeluszowe co 60 cm",
        "board": "NG-GKB12.5",
        "thickness": 40,
        "mass": 17
      },
      {
        "label": "2×12,5 GKBI (H2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKBI12.5",
        "thickness": 40,
        "mass": 18
      },
      {
        "label": "2×12,5 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF12.5",
        "fire": 30,
        "thickness": 40,
        "mass": 23
      },
      {
        "label": "2×15 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF15",
        "fire": 60,
        "thickness": 45,
        "mass": 28
      },
      {
        "label": "2×12,5 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI12.5",
        "fire": 30,
        "thickness": 40,
        "mass": 23
      },
      {
        "label": "2×15 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI15",
        "fire": 60,
        "thickness": 45,
        "mass": 28
      },
      {
        "label": "2×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 60 cm",
        "board": "NG-AS12.5",
        "fire": 30,
        "thickness": 40,
        "mass": 25
      },
      {
        "label": "2×12,5 GKB (A) + Acoustic Comfort (A) · profile kapeluszowe co 60 cm · ΔRw 12 dB",
        "board": "NG-AC12.5",
        "innerBoards": [
          "NG-GKB12.5"
        ],
        "thickness": 40,
        "mass": 19
      },
      {
        "label": "2×12,5 GKB (A) + Acoustic Super (DFH2IRE) · profile kapeluszowe co 60 cm · ΔRw 12 dB",
        "board": "NG-AS12.5",
        "innerBoards": [
          "NG-GKB12.5"
        ],
        "thickness": 40,
        "mass": 21
      }
    ]
  },
  {
    "id": "NG-OS-KAP-3",
    "name": "Okładzina ścienna OS na profilach kapeluszowych, 3×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 3,
    "sides": 1,
    "defaultBoard": "NG-GKF12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOTWA",
    "insulationDefault": false,
    "fire": "EI 60 – EI 90",
    "info": "Profile kapeluszowe pionowo co max. 60 cm, dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyta 15 mm od ściany · do 12 m wysokości · taśma uszczelniająca 75 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny ścienne OS na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-scienne/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Kołki rozporowe / dyble 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Blachowkręt 3,5×25",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN35",
        "label": "Blachowkręt 3,5×35",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN55",
        "label": "Blachowkręt 3,5×55",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maxHeight": {
      "60": 1200
    },
    "maker": "norgips",
    "variants": [
      {
        "label": "3×12,5 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 34
      },
      {
        "label": "1×15 + 2×12,5 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF12.5",
        "innerBoards": [
          "NG-GKF15"
        ],
        "fire": 90,
        "thickness": 55,
        "mass": 15
      },
      {
        "label": "3×12,5 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 34
      },
      {
        "label": "1×15 + 2×12,5 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI12.5",
        "innerBoards": [
          "NG-GKFI15"
        ],
        "fire": 90,
        "thickness": 55,
        "mass": 15
      },
      {
        "label": "3×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 60 cm",
        "board": "NG-AS12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 37
      }
    ]
  },
  {
    "id": "NG-OS-KAP-4",
    "name": "Okładzina ścienna OS na profilach kapeluszowych, 2×15 + 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 4,
    "sides": 1,
    "defaultBoard": "NG-GKF12.5",
    "innerBoard": "NG-GKF15",
    "innerLayers": 2,
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOTWA",
    "insulationDefault": false,
    "fire": "EI 120",
    "info": "Profile kapeluszowe pionowo co max. 60 cm, dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyta 15 mm od ściany · do 12 m wysokości · taśma uszczelniająca 75 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny ścienne OS na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-scienne/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Kołki rozporowe / dyble 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN25",
        "label": "Blachowkręt 3,5×25",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN45",
        "label": "Blachowkręt 3,5×45",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN55",
        "label": "Blachowkręt 3,5×55",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TN70",
        "label": "Blachowkręt 3,5×70",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maxHeight": {
      "60": 1200
    },
    "maker": "norgips",
    "variants": [
      {
        "label": "2×15 + 2×12,5 GKF (DF) · profile kapeluszowe co 60 cm",
        "board": "NG-GKF12.5",
        "innerBoards": [
          "NG-GKF15"
        ],
        "fire": 120,
        "thickness": 70,
        "mass": 49
      },
      {
        "label": "2×15 + 2×12,5 GKFI (DFH2) · profile kapeluszowe co 60 cm",
        "board": "NG-GKFI12.5",
        "innerBoards": [
          "NG-GKFI15"
        ],
        "fire": 120,
        "thickness": 70,
        "mass": 49
      }
    ]
  },
  {
    "id": "SN-O-PK48-1",
    "name": "Nida Tynk – okładzina kotwiona na profilach kapeluszowych PK48, 1×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 1,
    "sides": 1,
    "defaultBoard": "SN-EXP12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 15 – EI 30",
    "info": "Profile PK48 pionowo co 60 cm, elementy kotwiące co 100 cm (płyty Ogień typ F i 12,5 + 15 – co 125 cm) · bez UD – płyta 15 mm od ściany · wysokość bez ograniczeń · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 2 Okładziny kotwione Nida Tynk, karty s. 21",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Element kotwiący",
        "qty": 3.8,
        "unit": "szt."
      },
      {
        "label": "Blachowkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Expert · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-EXP12.5",
        "mass": 10
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Woda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WODA12.5",
        "mass": 10
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP12.5",
        "fire": 15,
        "mass": 12
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Woda Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WOP12.5",
        "fire": 15,
        "mass": 12
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Cicha · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-CICHA12.5",
        "fire": 15,
        "mass": 14
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW12.5",
        "fire": 15,
        "mass": 14
      },
      {
        "code": "PK48-12,5",
        "label": "1×12,5 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO12.5",
        "fire": 15,
        "mass": 12
      },
      {
        "code": "PK48-18",
        "label": "1×18 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP18",
        "fire": 30,
        "mass": 15
      }
    ]
  },
  {
    "id": "SN-O-PK48-2",
    "name": "Nida Tynk – okładzina kotwiona na profilach kapeluszowych PK48, 2×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 2,
    "sides": 1,
    "defaultBoard": "SN-EXP12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 30 – EI 60",
    "info": "Profile PK48 pionowo co 60 cm, elementy kotwiące co 100 cm (płyty Ogień typ F i 12,5 + 15 – co 125 cm) · bez UD – płyta 15 mm od ściany · wysokość bez ograniczeń · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 2 Okładziny kotwione Nida Tynk, karty s. 22",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Element kotwiący",
        "qty": 3.8,
        "unit": "szt."
      },
      {
        "label": "Blachowkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Expert · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-EXP12.5",
        "mass": 18
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Woda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WODA12.5",
        "mass": 18
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Ogień Typ F · PK48 co 60 cm · elementy kotwiące co 125 cm",
        "board": "SN-OTF12.5",
        "fire": 30,
        "mass": 19
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP12.5",
        "fire": 30,
        "mass": 22
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Woda Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WOP12.5",
        "fire": 30,
        "mass": 22
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Cicha · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-CICHA12.5",
        "fire": 30,
        "mass": 27
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW12.5",
        "fire": 30,
        "mass": 27
      },
      {
        "code": "PK48-25",
        "label": "2×12,5 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO12.5",
        "fire": 30,
        "mass": 23
      },
      {
        "code": "PK48-27,5",
        "label": "1×12,5 + 1×15 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 125 cm",
        "board": "SN-OP15",
        "innerBoards": [
          "SN-OP12.5"
        ],
        "fire": 60,
        "mass": 26
      },
      {
        "code": "PK48-30",
        "label": "2×15 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP15",
        "fire": 60,
        "mass": 29
      },
      {
        "code": "PK48-30",
        "label": "2×15 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW15",
        "fire": 60,
        "mass": 33
      },
      {
        "code": "PK48-30",
        "label": "2×15 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO15",
        "fire": 60,
        "mass": 29
      }
    ]
  },
  {
    "id": "SN-O-PK48-3",
    "name": "Nida Tynk – okładzina kotwiona na profilach kapeluszowych PK48, 3×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 3,
    "sides": 1,
    "defaultBoard": "SN-OP12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 60 – EI 120",
    "info": "Profile PK48 pionowo co 60 cm, elementy kotwiące co 100 cm (płyty Ogień typ F i 12,5 + 15 – co 125 cm) · bez UD – płyta 15 mm od ściany · wysokość bez ograniczeń · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 2 Okładziny kotwione Nida Tynk, karty s. 23",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Element kotwiący",
        "qty": 3.8,
        "unit": "szt."
      },
      {
        "label": "Blachowkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48-37,5",
        "label": "3×12,5 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP12.5",
        "fire": 60,
        "mass": 32
      },
      {
        "code": "PK48-37,5",
        "label": "3×12,5 Nida Woda Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WOP12.5",
        "fire": 60,
        "mass": 32
      },
      {
        "code": "PK48-37,5",
        "label": "3×12,5 Nida Cicha · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-CICHA12.5",
        "fire": 60,
        "mass": 41
      },
      {
        "code": "PK48-37,5",
        "label": "3×12,5 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW12.5",
        "fire": 60,
        "mass": 41
      },
      {
        "code": "PK48-37,5",
        "label": "3×12,5 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO12.5",
        "fire": 60,
        "mass": 35
      },
      {
        "code": "PK48-45",
        "label": "3×15 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP15",
        "fire": 120,
        "mass": 43
      },
      {
        "code": "PK48-45",
        "label": "3×15 Nida Woda Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WOP15",
        "fire": 120,
        "mass": 43
      }
    ]
  },
  {
    "id": "SN-O-PK48-4",
    "name": "Nida Tynk – okładzina kotwiona na profilach kapeluszowych PK48, 4×12,5",
    "category": "okładzina",
    "frame": "hat-lining",
    "profile": 50,
    "layers": 4,
    "sides": 1,
    "defaultBoard": "SN-OP12.5",
    "studSpacing": 60,
    "bracketSpacing": 100,
    "anchor": "KOLEK",
    "insulationDefault": false,
    "fire": "EI 90 – EI 120",
    "info": "Profile PK48 pionowo co 60 cm, elementy kotwiące co 100 cm (płyty Ogień typ F i 12,5 + 15 – co 125 cm) · bez UD – płyta 15 mm od ściany · wysokość bez ograniczeń · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 2 Okładziny kotwione Nida Tynk, karty s. 24",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 1.8,
        "unit": "mb"
      },
      {
        "product": "KOLEK",
        "label": "Element kotwiący",
        "qty": 3.8,
        "unit": "szt."
      },
      {
        "label": "Blachowkręty zewn. warstwy",
        "qty": 12,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48-50",
        "label": "4×12,5 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP12.5",
        "fire": 90,
        "mass": 42
      },
      {
        "code": "PK48-50",
        "label": "4×12,5 Nida Woda Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-WOP12.5",
        "fire": 90,
        "mass": 42
      },
      {
        "code": "PK48-50",
        "label": "4×12,5 Nida Cicha · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-CICHA12.5",
        "fire": 90,
        "mass": 54
      },
      {
        "code": "PK48-50",
        "label": "4×12,5 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW12.5",
        "fire": 90,
        "mass": 54
      },
      {
        "code": "PK48-50",
        "label": "4×12,5 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO12.5",
        "fire": 90,
        "mass": 46
      },
      {
        "code": "PK48-55",
        "label": "2×12,5 + 2×15 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP15",
        "innerBoards": [
          "SN-OP12.5"
        ],
        "fire": 120,
        "mass": 50
      },
      {
        "code": "PK48-55",
        "label": "2×12,5 + 2×15 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW15",
        "innerBoards": [
          "SN-TW12.5"
        ],
        "fire": 120,
        "mass": 59
      },
      {
        "code": "PK48-55",
        "label": "2×12,5 + 2×15 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO15",
        "innerBoards": [
          "SN-HYDRO12.5"
        ],
        "fire": 120,
        "mass": 51
      },
      {
        "code": "PK48-60",
        "label": "4×15 Nida Ogień Plus · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-OP15",
        "fire": 120,
        "mass": 56
      },
      {
        "code": "PK48-60",
        "label": "4×15 Nida Twarda · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-TW15",
        "fire": 120,
        "mass": 64
      },
      {
        "code": "PK48-60",
        "label": "4×15 Nida Hydro · PK48 co 60 cm · elementy kotwiące co 100 cm",
        "board": "SN-HYDRO15",
        "fire": 120,
        "mass": 56
      }
    ]
  }
];

/** Okładziny sufitów na profilach kapeluszowych (kind 'direct', hangerType 'hat') */
export const HAT_CEILING_SYSTEMS: CeilingSystem[] = [
  {
    "id": "R-HAT-S-1",
    "code": "4.05.21",
    "name": "Okładzina sufitu na profilach kapeluszowych, 1×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 1,
    "defaultBoard": "RB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 100,
    "screwsOuter": 17,
    "screwsInner": 6.5,
    "info": "Profile kapeluszowe co max. 50 cm (płyty w poprzek profili; wzdłuż – co 40 cm), stalowe elementy mocujące max. co 100 cm (całkowita masa ≤ 30 kg/m²) · bez wieszaków i bez UD – płyty 15 mm pod stropem · strop musi być równy",
    "source": {
      "label": "Rigips 4.05.21 – karta systemu (PDF) i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-sufitowe/4_05_21"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowe elementy mocujące (dybel sufitowy 6×40)",
        "qty": 6,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 17,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.2,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO typ A · masa ≤ 30 kg/m²",
        "board": "RB12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Hydro H2 · masa ≤ 30 kg/m²",
        "board": "RBI12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire F · masa ≤ 30 kg/m²",
        "board": "RF12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire+ DF · masa ≤ 30 kg/m²",
        "board": "RFP12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire+ Hydro DFH2 · masa ≤ 30 kg/m²",
        "board": "RFI12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      }
    ]
  },
  {
    "id": "R-HAT-S-2",
    "code": "4.05.21",
    "name": "Okładzina sufitu na profilach kapeluszowych, 2×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 2,
    "defaultBoard": "RB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 100,
    "screwsOuter": 17,
    "screwsInner": 6.5,
    "info": "Profile kapeluszowe co max. 50 cm (płyty w poprzek profili; wzdłuż – co 40 cm), stalowe elementy mocujące max. co 100 cm (całkowita masa ≤ 30 kg/m²) · bez wieszaków i bez UD – płyty 15 mm pod stropem · strop musi być równy",
    "source": {
      "label": "Rigips 4.05.21 – karta systemu (PDF) i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-sufitowe/4_05_21"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowe elementy mocujące (dybel sufitowy 6×40)",
        "qty": 6,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 17,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.2,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO typ A · masa ≤ 30 kg/m²",
        "board": "RB12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Hydro H2 · masa ≤ 30 kg/m²",
        "board": "RBI12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire F · masa ≤ 30 kg/m²",
        "board": "RF12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire+ DF · masa ≤ 30 kg/m²",
        "board": "RFP12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire+ Hydro DFH2 · masa ≤ 30 kg/m²",
        "board": "RFI12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      }
    ]
  },
  {
    "id": "R-HAT-S-1-50",
    "code": "4.05.21",
    "name": "Okładzina sufitu na profilach kapeluszowych, 1×12,5 – z obciążeniem dodatkowym (do 50 kg/m²)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 1,
    "defaultBoard": "RB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 75,
    "screwsOuter": 17,
    "screwsInner": 6.5,
    "info": "Profile kapeluszowe co max. 50 cm (płyty w poprzek profili; wzdłuż – co 40 cm), stalowe elementy mocujące max. co 75 cm (z obciążeniem dodatkowym, całkowita masa ≤ 50 kg/m²) · bez wieszaków i bez UD – płyty 15 mm pod stropem · strop musi być równy",
    "source": {
      "label": "Rigips 4.05.21 – karta systemu (PDF) i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-sufitowe/4_05_21"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowe elementy mocujące (dybel sufitowy 6×40)",
        "qty": 6,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 17,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.2,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO typ A · całkowita masa ≤ 50 kg/m²",
        "board": "RB12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Hydro H2 · całkowita masa ≤ 50 kg/m²",
        "board": "RBI12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire F · całkowita masa ≤ 50 kg/m²",
        "board": "RF12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire+ DF · całkowita masa ≤ 50 kg/m²",
        "board": "RFP12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      },
      {
        "code": "4.05.21",
        "label": "1×12,5 PRO Fire+ Hydro DFH2 · całkowita masa ≤ 50 kg/m²",
        "board": "RFI12.5",
        "rw": 27,
        "thickness": 28,
        "mass": 12
      }
    ]
  },
  {
    "id": "R-HAT-S-2-50",
    "code": "4.05.21",
    "name": "Okładzina sufitu na profilach kapeluszowych, 2×12,5 – z obciążeniem dodatkowym (do 50 kg/m²)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 2,
    "defaultBoard": "RB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 75,
    "screwsOuter": 17,
    "screwsInner": 6.5,
    "info": "Profile kapeluszowe co max. 50 cm (płyty w poprzek profili; wzdłuż – co 40 cm), stalowe elementy mocujące max. co 75 cm (z obciążeniem dodatkowym, całkowita masa ≤ 50 kg/m²) · bez wieszaków i bez UD – płyty 15 mm pod stropem · strop musi być równy",
    "source": {
      "label": "Rigips 4.05.21 – karta systemu (PDF) i kalkulator zużycia",
      "url": "https://www.rigips.pl/system/okladziny-sufitowe/4_05_21"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowe elementy mocujące (dybel sufitowy 6×40)",
        "qty": 6,
        "unit": "szt."
      },
      {
        "label": "Wkręty zewn. warstwy",
        "qty": 17,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma spoinowa",
        "qty": 1.2,
        "unit": "mb"
      }
    ],
    "variants": [
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO typ A · całkowita masa ≤ 50 kg/m²",
        "board": "RB12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Hydro H2 · całkowita masa ≤ 50 kg/m²",
        "board": "RBI12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire F · całkowita masa ≤ 50 kg/m²",
        "board": "RF12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire+ DF · całkowita masa ≤ 50 kg/m²",
        "board": "RFP12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      },
      {
        "code": "4.05.21",
        "label": "2×12,5 PRO Fire+ Hydro DFH2 · całkowita masa ≤ 50 kg/m²",
        "board": "RFI12.5",
        "rw": 30,
        "thickness": 41,
        "mass": 22
      }
    ]
  },
  {
    "id": "NG-OSF-KAP-1",
    "name": "Okładzina sufitowa OSF na profilach kapeluszowych, 1×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 1,
    "defaultBoard": "NG-GKB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 100,
    "screwsOuter": 25,
    "screwsInner": 0,
    "fire": "EI 15",
    "info": "Profile kapeluszowe co max. 50 cm (płyty ogniochronne co 40 cm), dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyty 15 mm pod stropem · taśma uszczelniająca 30 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny sufitowe OSF na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-sufitowe/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 2.2,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Dyble stalowe 6×40",
        "qty": 4,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maker": "norgips",
    "variants": [
      {
        "label": "1×9,5 GKB (A) · profile kapeluszowe co 50 cm",
        "board": "NG-GKB9.5",
        "thickness": 25,
        "mass": 9
      },
      {
        "label": "1×12,5 GKB (A) · profile kapeluszowe co 50 cm",
        "board": "NG-GKB12.5",
        "thickness": 28,
        "mass": 10
      },
      {
        "label": "1×12,5 GKBI (H2) · profile kapeluszowe co 50 cm",
        "board": "NG-GKBI12.5",
        "thickness": 28,
        "mass": 11
      },
      {
        "label": "1×12,5 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 13
      },
      {
        "label": "1×15 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF15",
        "fire": 15,
        "thickness": 30,
        "mass": 16
      },
      {
        "label": "1×12,5 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 13
      },
      {
        "label": "1×15 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI15",
        "fire": 15,
        "thickness": 30,
        "mass": 16
      },
      {
        "label": "1×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 40 cm",
        "board": "NG-AS12.5",
        "fire": 15,
        "thickness": 28,
        "mass": 14
      }
    ]
  },
  {
    "id": "NG-OSF-KAP-2",
    "name": "Okładzina sufitowa OSF na profilach kapeluszowych, 2×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 2,
    "defaultBoard": "NG-GKB12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 100,
    "screwsOuter": 25,
    "screwsInner": 10,
    "fire": "EI 30 – EI 60",
    "info": "Profile kapeluszowe co max. 50 cm (płyty ogniochronne co 40 cm), dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyty 15 mm pod stropem · taśma uszczelniająca 30 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny sufitowe OSF na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-sufitowe/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 2.2,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Dyble stalowe 6×40",
        "qty": 4,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maker": "norgips",
    "variants": [
      {
        "label": "2×12,5 GKB (A) · profile kapeluszowe co 50 cm",
        "board": "NG-GKB12.5",
        "thickness": 40,
        "mass": 18
      },
      {
        "label": "2×12,5 GKBI (H2) · profile kapeluszowe co 50 cm",
        "board": "NG-GKBI12.5",
        "thickness": 40,
        "mass": 19
      },
      {
        "label": "2×12,5 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "fire": 45,
        "thickness": 40,
        "mass": 24
      },
      {
        "label": "2×15 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF15",
        "fire": 60,
        "thickness": 45,
        "mass": 29
      },
      {
        "label": "2×12,5 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "fire": 45,
        "thickness": 40,
        "mass": 24
      },
      {
        "label": "2×15 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI15",
        "fire": 60,
        "thickness": 45,
        "mass": 29
      },
      {
        "label": "2×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 40 cm",
        "board": "NG-AS12.5",
        "fire": 45,
        "thickness": 40,
        "mass": 26
      },
      {
        "label": "2×12,5 GKB (A) + GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "innerBoards": [
          "NG-GKB12.5"
        ],
        "fire": 30,
        "thickness": 40,
        "mass": 24
      },
      {
        "label": "2×12,5 GKB (A) + Acoustic Super (DFH2IRE) · profile kapeluszowe co 40 cm",
        "board": "NG-AS12.5",
        "innerBoards": [
          "NG-GKB12.5"
        ],
        "fire": 30,
        "thickness": 40,
        "mass": 26
      },
      {
        "label": "2×12,5 GKBI (H2) + GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "innerBoards": [
          "NG-GKBI12.5"
        ],
        "fire": 30,
        "thickness": 40,
        "mass": 24
      }
    ]
  },
  {
    "id": "NG-OSF-KAP-3",
    "name": "Okładzina sufitowa OSF na profilach kapeluszowych, 3×12,5 / 15 + 2×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 3,
    "defaultBoard": "NG-GKF12.5",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 100,
    "screwsOuter": 25,
    "screwsInner": 10,
    "fire": "EI 60 – EI 90",
    "info": "Profile kapeluszowe co max. 40 cm (płyty ogniochronne co 40 cm), dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyty 15 mm pod stropem · taśma uszczelniająca 30 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny sufitowe OSF na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-sufitowe/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 2.7,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Dyble stalowe 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maker": "norgips",
    "variants": [
      {
        "label": "3×12,5 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 34
      },
      {
        "label": "1×15 + 2×12,5 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "innerBoards": [
          "NG-GKF15"
        ],
        "fire": 90,
        "thickness": 55,
        "mass": 37
      },
      {
        "label": "3×12,5 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 34
      },
      {
        "label": "1×15 + 2×12,5 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "innerBoards": [
          "NG-GKFI15"
        ],
        "fire": 90,
        "thickness": 55,
        "mass": 37
      },
      {
        "label": "3×12,5 Acoustic Super (DFH2IRE) · profile kapeluszowe co 40 cm",
        "board": "NG-AS12.5",
        "fire": 60,
        "thickness": 53,
        "mass": 37
      }
    ]
  },
  {
    "id": "NG-OSF-KAP-4",
    "name": "Okładzina sufitowa OSF na profilach kapeluszowych, 2×15 + 2×12,5",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 4,
    "defaultBoard": "NG-GKF12.5",
    "innerBoard": "NG-GKF15",
    "innerLayers": 2,
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 100,
    "screwsOuter": 25,
    "screwsInner": 10,
    "fire": "EI 120",
    "info": "Profile kapeluszowe co max. 40 cm (płyty ogniochronne co 40 cm), dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyty 15 mm pod stropem · taśma uszczelniająca 30 mm opcjonalnie",
    "source": {
      "label": "Norgips – okładziny sufitowe OSF na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)",
      "url": "https://norgips.pl/rozwiazania/okladziny-sufitowe/"
    },
    "reference": [
      {
        "label": "Płyta g-k",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil kapeluszowy 0,6 mm",
        "qty": 2.7,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Dyble stalowe 6×40",
        "qty": 5,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca",
        "qty": 1.3,
        "unit": "mb"
      }
    ],
    "maker": "norgips",
    "variants": [
      {
        "label": "2×15 + 2×12,5 GKF (DF) · profile kapeluszowe co 40 cm",
        "board": "NG-GKF12.5",
        "innerBoards": [
          "NG-GKF15"
        ],
        "fire": 120,
        "thickness": 70,
        "mass": 50
      },
      {
        "label": "2×15 + 2×12,5 GKFI (DFH2) · profile kapeluszowe co 40 cm",
        "board": "NG-GKFI12.5",
        "innerBoards": [
          "NG-GKFI15"
        ],
        "fire": 120,
        "thickness": 70,
        "mass": 50
      }
    ]
  },
  {
    "id": "SN-S-PK48-1-120",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 1×12,5 (Expert, Woda)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 1,
    "defaultBoard": "SN-EXP12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 120,
    "screwsOuter": 18,
    "screwsInner": 6,
    "info": "Profile PK48 co 40–50 cm, stalowe elementy kotwiące co 120 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 7",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/12,5",
        "label": "1×12,5 Nida Expert · PK48 co 4 / 5 cm · kotwy co 120 cm",
        "board": "SN-EXP12.5",
        "rw": 30,
        "thickness": 27.5,
        "mass": 10
      },
      {
        "code": "PK48/12,5",
        "label": "1×12,5 Nida Woda · PK48 co 4 / 5 cm · kotwy co 120 cm",
        "board": "SN-WODA12.5",
        "rw": 30,
        "thickness": 27.5,
        "mass": 10
      }
    ]
  },
  {
    "id": "SN-S-PK48-1-90",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 1×12,5 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 1,
    "defaultBoard": "SN-OP12.5",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 90,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 20 – EI 30",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 90 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 7",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 1,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/12,5",
        "label": "1×12,5 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP12.5",
        "fire": 20,
        "rw": 66,
        "thickness": 27.5,
        "mass": 12
      },
      {
        "code": "PK48/15",
        "label": "1×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP15",
        "fire": 20,
        "rw": 66,
        "thickness": 30,
        "mass": 15
      },
      {
        "code": "PK48/18",
        "label": "1×18 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP18",
        "fire": 30,
        "rw": 66,
        "thickness": 33,
        "mass": 16
      }
    ]
  },
  {
    "id": "SN-S-PK48-2-120",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 2×12,5 (Expert, Woda)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 2,
    "defaultBoard": "SN-EXP12.5",
    "mainSpacing": 50,
    "secondarySpacing": 50,
    "hangerSpacing": 120,
    "screwsOuter": 18,
    "screwsInner": 6,
    "info": "Profile PK48 co 40–50 cm, stalowe elementy kotwiące co 120 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 8",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/25",
        "label": "2×12,5 Nida Expert · PK48 co 4 / 5 cm · kotwy co 120 cm",
        "board": "SN-EXP12.5",
        "rw": 33,
        "thickness": 40,
        "mass": 18
      },
      {
        "code": "PK48/25",
        "label": "2×12,5 Nida Woda · PK48 co 4 / 5 cm · kotwy co 120 cm",
        "board": "SN-WODA12.5",
        "rw": 33,
        "thickness": 40,
        "mass": 18
      }
    ]
  },
  {
    "id": "SN-S-PK48-2-90",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 2×12,5 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 2,
    "defaultBoard": "SN-OP12.5",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 90,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 45 – EI 60",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 90 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 8",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 2,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/25",
        "label": "2×12,5 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP12.5",
        "fire": 45,
        "rw": 72,
        "thickness": 40,
        "mass": 22
      },
      {
        "code": "PK48/27,5",
        "label": "1×12,5 + 1×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP15",
        "innerBoards": [
          "SN-OP12.5"
        ],
        "fire": 60,
        "rw": 72,
        "thickness": 42.5,
        "mass": 26
      },
      {
        "code": "PK48/30",
        "label": "2×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP15",
        "fire": 60,
        "rw": 72,
        "thickness": 45,
        "mass": 29
      }
    ]
  },
  {
    "id": "SN-S-PK48-3-90",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 3×12,5 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 3,
    "defaultBoard": "SN-OP12.5",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 90,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 60",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 90 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 9",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/37,5",
        "label": "3×12,5 Nida Ogień Plus · PK48 co 4 cm · kotwy co 90 cm",
        "board": "SN-OP12.5",
        "fire": 60,
        "rw": 88,
        "thickness": 52.5,
        "mass": 33
      }
    ]
  },
  {
    "id": "SN-S-PK48-3-85",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 2×12,5 + 1×15 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 3,
    "defaultBoard": "SN-OP15",
    "innerBoard": "SN-OP12.5",
    "innerLayers": 2,
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 85,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 90",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 85 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 9",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/40",
        "label": "2×12,5 + 1×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 85 cm",
        "board": "SN-OP15",
        "innerBoards": [
          "SN-OP12.5"
        ],
        "fire": 90,
        "rw": 93,
        "thickness": 55,
        "mass": 36
      }
    ]
  },
  {
    "id": "SN-S-PK48-3-75",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 3×15 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 3,
    "defaultBoard": "SN-OP15",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 75,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 120",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 75 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 9",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 3,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/45",
        "label": "3×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 75 cm",
        "board": "SN-OP15",
        "fire": 120,
        "rw": 100,
        "thickness": 60,
        "mass": 43
      }
    ]
  },
  {
    "id": "SN-S-PK48-4-75",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 2×12,5 + 2×15 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 4,
    "defaultBoard": "SN-OP15",
    "innerBoard": "SN-OP12.5",
    "innerLayers": 2,
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 75,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 120",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 75 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 9",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 4,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/55",
        "label": "2×12,5 + 2×15 Nida Ogień Plus · PK48 co 4 cm · kotwy co 75 cm",
        "board": "SN-OP15",
        "innerBoards": [
          "SN-OP12.5"
        ],
        "fire": 120,
        "rw": 100,
        "thickness": 70,
        "mass": 50
      }
    ]
  },
  {
    "id": "SN-S-PK48-5-75",
    "name": "Nida Sufit – okładzina na profilach kapeluszowych PK48, 5×12,5 (Ogień Plus)",
    "kind": "direct",
    "hangerType": "hat",
    "layers": 5,
    "defaultBoard": "SN-OP12.5",
    "mainSpacing": 40,
    "secondarySpacing": 40,
    "hangerSpacing": 75,
    "screwsOuter": 18,
    "screwsInner": 6,
    "fire": "EI 120",
    "info": "Profile PK48 co 40 cm, stalowe elementy kotwiące co 75 cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48",
    "source": {
      "label": "Siniat – Katalog techniczny, rozdz. 6 Sufity podwieszane Nida Sufit, karty s. 9",
      "url": "https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue"
    },
    "reference": [
      {
        "label": "Płyta",
        "qty": 5,
        "unit": "m²"
      },
      {
        "product": "KAPELUSZ",
        "label": "Profil Nida PK48",
        "qty": 2.5,
        "unit": "mb"
      },
      {
        "product": "KOTWA",
        "label": "Stalowy element kotwiący",
        "qty": 6,
        "unit": "szt."
      },
      {
        "product": "TASMA_SPOIN",
        "label": "Taśma zbrojąca Nida",
        "qty": 1.4,
        "unit": "mb"
      }
    ],
    "maker": "siniat",
    "variants": [
      {
        "code": "PK48/62,5",
        "label": "5×12,5 Nida Ogień Plus · PK48 co 4 cm · kotwy co 75 cm",
        "board": "SN-OP12.5",
        "fire": 120,
        "rw": 100,
        "thickness": 77.5,
        "mass": 54
      }
    ]
  }
];
