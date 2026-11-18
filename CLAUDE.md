# Rigipsiarz – zasady pracy

- Język interfejsu i komentarzy: polski. Wymiary w modelu w centymetrach, w obliczeniach w metrach.
- Statyczna PWA bez backendu (GitHub Pages). Dane tylko lokalnie (IndexedDB). Nie dodawaj zależności od serwera.
- Każda zmiana wyliczeń (`src/calc`) musi mieć test w `*.test.ts`. Uruchom `npm run typecheck && npm test && npm run build` przed PR.
- Praca w PR-ach do `main`; po zielonym CI PR scala się automatycznie (etykieta `nie-scalaj` wstrzymuje).
- Pola wymiarów w UI używają `DimInput` – dzięki temu działa przyszła integracja z dalmierzem (`src/ui/measure.ts`).
