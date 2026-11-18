# Rigipsiarz

Planer suchej zabudowy działający w przeglądarce i bez internetu (PWA). Liczy materiały na ściany
działowe, obudowy i sufity podwieszane w systemach Rigips, a projekty trzyma tylko na urządzeniu.

## Co już działa

- **Szybkie wyliczenie** – wpisujesz wymiary ściany, pomieszczenia albo sufitu (w metrach lub centymetrach)
  i od razu dostajesz listę materiałów.
- **Katalog Rigips** – 10 systemów ścian (CW 50/75/100, 1× i 2× płyta, ogniochronna RF, łazienkowa RBI,
  obudowy jednostronne), 5 systemów sufitów (dwupoziomowy i jednopoziomowy CD 60, wieszaki ES), płyty
  RB, RBI, RF, RFI, Habito.
- **Silnik ilości** – słupki CW wg rozstawu, ościeża UA, nadproża i podokienniki z UW, dodatkowe słupki
  w narożnikach i trójnikach, rozkrój profili na długości handlowe, ruszt sufitowy liczony z obrysu
  (także pomieszczenia w kształcie L), wieszaki, łączniki krzyżowe i wzdłużne, kotwy, kołki, wkręty,
  taśmy, masa, narożniki ochronne, wełna.
- **Lista zakupów** – odhaczanie kupionych pozycji, opcjonalny zapas na odpady, opcjonalne ceny,
  eksport CSV, udostępnianie, druk do PDF.
- **Rysunki montażowe** (zakładka *Rysunki*) – widok każdej ściany z osiami słupków, ościeżami,
  nadprożami i łańcuchami wymiarów; rozkład płyt na każdej okładzinie i warstwie (styki mijankowo,
  ostrzeżenie o styku w linii ościeża); rzut rusztu sufitu z rozstawami profili, wieszakami
  i łącznikami; rozkład płyt sufitowych; przekroje użytych systemów; detale narożnika, trójnika,
  skrzyżowania, połączenia z murem, wolnego końca i otworów; lista cięć profili dla każdego elementu.
  Wszystko drukuje się do PDF razem z zestawieniem materiałów. Rysunki i ilości liczy ta sama
  geometria (`src/calc/layout.ts`), więc schemat zawsze zgadza się z listą zakupów.
- **Instalacja i aktualizacje** – aplikację instaluje się z przeglądarki („Dodaj do ekranu głównego”).
  Po każdej nowej wersji pokazuje się komunikat „Jest nowa wersja aplikacji” z przyciskiem *Odśwież*.

## Instalacja na telefonie

1. Otwórz adres aplikacji (GitHub Pages) w Chrome na Androidzie lub Safari na iPhonie.
2. Android: menu ⋮ → *Zainstaluj aplikację*. iPhone: *Udostępnij* → *Do ekranu początkowego*.
3. Od tej chwili aplikacja działa także bez internetu.

## Automatyka

| Workflow | Kiedy | Co robi |
|---|---|---|
| `CI` | każdy PR i push do `main` | typecheck, testy, build |
| `Auto-merge` | CI na PR zakończone sukcesem | scala PR (squash) i uruchamia deploy. Etykieta `nie-scalaj` lub draft wstrzymuje scalenie |
| `Deploy na GitHub Pages` | push do `main` lub wywołanie z Auto-merge | buduje i publikuje aplikację |

Jednorazowo w ustawieniach repozytorium: **Settings → Pages → Source: GitHub Actions**.
GitHub Pages dla repozytorium prywatnego wymaga planu GitHub Pro – na darmowym planie repozytorium musi być publiczne.

## Rozwój

```bash
npm install
npm run dev        # serwer deweloperski
npm test           # testy wyliczeń
npm run build      # wersja produkcyjna w dist/
```

Struktura:

- `src/catalog/rigips.ts` – katalog produktów i systemów
- `src/calc/materials.ts` – silnik ilości i rozkroju (testy obok)
- `src/geometry/` – połączenia ścian, wielokąty, wykrywanie pomieszczeń
- `src/model/` – model danych, fabryki, operacje edycji, ceny
- `src/storage/db.ts` – zapis projektów w IndexedDB
- `src/ui/` – interfejs (React)

Ilości liczone są wg typowych wytycznych montażu systemów Rigips. Przed zamówieniem warto sprawdzić
wymagania karty technicznej konkretnego systemu (np. klasy odporności ogniowej).
