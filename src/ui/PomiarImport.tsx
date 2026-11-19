import { useRef, useState } from 'react';
import { importPomiar, parsePomiar } from '../import/pomiar';
import type { Project } from '../model/types';

/**
 * Kafel „Importuj pomiar”: plik .pomiar.json (np. z PomierzTu) → nowy projekt z obrysem pomieszczeń.
 * Plik czytamy tylko lokalnie, nic nie jest wysyłane.
 */
export function PomiarImportTile({ onOpen }: { onOpen: (p: Project) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ project: Project; warnings: string[] } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const res = importPomiar(parsePomiar(await file.text()));
      if (res.warnings.length) setPending(res);
      else onOpen(res.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać pliku.');
    }
  };

  return (
    <>
      <button className="tile" onClick={() => input.current?.click()}>
        <strong>Importuj pomiar</strong>
        <span>Plik .pomiar.json z PomierzTu: ściany, grubości, otwory, wysokości i skosy</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void pick(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      {error && (
        <div className="card import-note" role="alert">
          <p>{error}</p>
          <button className="btn" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      )}
      {pending && (
        <div className="card import-note" role="status">
          <p>
            <strong>Zaimportowano „{pending.project.name}”.</strong> Sprawdź:
          </p>
          <ul>
            {pending.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button
            className="btn"
            onClick={() => {
              const p = pending.project;
              setPending(null);
              onOpen(p);
            }}
          >
            Otwórz projekt
          </button>
        </div>
      )}
    </>
  );
}
