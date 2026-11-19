import { useMemo, useState } from 'react';
import { materialsToCsv, type MaterialLine } from '../calc/materials';
import { formatPLN, priceLines, storeSearchUrl, type PriceBook } from '../model/prices';
import type { Project } from '../model/types';
import { appProfileLength, profileLengthLabel, type ProfileLengthPref } from '../calc/profileLength';

interface Props {
  project: Project;
  lines: MaterialLine[];
  prices: PriceBook;
  setPrice: (key: string, value: number | undefined) => void;
  update: (fn: (d: Project) => void) => void;
}

/** Wybór długości handlowej profilu – zapis w projekcie, ilości przeliczają się z rozkroju */
function ProfileLengthSelect({ pid, pref, choices, update }: { pid: string; pref: ProfileLengthPref; choices: number[]; update: Props['update'] }) {
  const app = appProfileLength(pid);
  return (
    <label className="item-len">
      <span className="muted">Kupuję po</span>
      <select
        value={String(pref)}
        onChange={(e) => {
          const v: ProfileLengthPref = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
          update((d) => {
            const next = { ...(d.settings.profileLengths ?? {}) };
            // jak w aplikacji = bez nadpisania w projekcie
            if (v === app) delete next[pid];
            else next[pid] = v;
            if (Object.keys(next).length) d.settings.profileLengths = next;
            else delete d.settings.profileLengths;
          });
        }}
        aria-label={`Długość profili: ${pid}`}
      >
        <option value="auto">Auto (z rozkroju)</option>
        {choices.map((c) => (
          <option key={c} value={String(c)}>
            {profileLengthLabel(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

const fmtQty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

export function ShoppingList({ project, lines, prices, setPrice, update }: Props) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showPrices, setShowPrices] = useState(() => Object.keys(prices).length > 0);
  const priced = useMemo(() => priceLines(lines, prices), [lines, prices]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof priced>();
    for (const l of priced) m.set(l.group, [...(m.get(l.group) ?? []), l]);
    return [...m.entries()];
  }, [priced]);
  const bought = project.bought ?? {};
  const doneCount = priced.filter((l) => bought[l.key]).length;
  const total = priced.reduce((s, l) => s + (l.total ?? 0), 0);
  const missingPrices = priced.filter((l) => l.price === undefined).length;

  const asText = () =>
    [
      `${project.name} – lista zakupów`,
      ...groups.flatMap(([g, ls]) => [
        '',
        g.toUpperCase(),
        ...ls.map((l) => `${bought[l.key] ? '✓' : '☐'} ${l.name}: ${fmtQty(l.buyQty)} ${l.buyUnit}${l.packs ? ` (${l.qty} ${l.unit})` : ''}`),
      ]),
    ].join('\n');

  const download = () => {
    const blob = new Blob(['﻿' + materialsToCsv(lines)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-materialy.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const share = async () => {
    const text = asText();
    if (navigator.share) {
      try {
        await navigator.share({ title: project.name, text });
        return;
      } catch {
        /* anulowano */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg('Skopiowano listę do schowka');
    } catch {
      setShareMsg('Nie udało się skopiować listy');
    }
    setTimeout(() => setShareMsg(null), 3000);
  };

  if (!lines.length)
    return (
      <div className="empty">
        <h3>Lista jest pusta</h3>
        <p>Dodaj ścianę lub sufit, a materiały policzą się automatycznie.</p>
      </div>
    );

  return (
    <div className="shopping">
      <div className="list-toolbar">
        <div className="progress-line" aria-label={`Kupione ${doneCount} z ${priced.length}`}>
          <div style={{ width: `${(doneCount / priced.length) * 100}%` }} />
        </div>
        <span className="muted small">
          Kupione {doneCount} z {priced.length}
        </span>
        <div className="spacer" />
        <label className="switch">
          <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
          Ceny
        </label>
        <label className="switch">
          <input
            type="checkbox"
            checked={project.settings.wasteEnabled}
            onChange={(e) => update((d) => void (d.settings.wasteEnabled = e.target.checked))}
          />
          Zapas {project.settings.waste}%
        </label>
      </div>

      <div className="groups">
      {groups.map(([g, ls]) => (
        <section key={g} className="group">
          <h3>{g}</h3>
          <ul>
            {ls.map((l) => (
              <li key={l.key} className={bought[l.key] ? 'done' : ''}>
                <label className="item-check">
                  <input
                    type="checkbox"
                    checked={!!bought[l.key]}
                    onChange={(e) => update((d) => void ((d.bought ??= {})[l.key] = e.target.checked))}
                    aria-label={`Kupione: ${l.name}`}
                  />
                </label>
                <div className="item-main">
                  <span className="item-name">{l.name}</span>
                  {(l.note || l.packs) && (
                    <span className="item-note">
                      {l.packs ? `${fmtQty(l.qty)} ${l.unit}` : ''}
                      {l.packs && l.note ? ' · ' : ''}
                      {l.note}
                    </span>
                  )}
                  {l.profile?.first && <ProfileLengthSelect {...l.profile} update={update} />}
                  {showPrices && (
                    <span className="item-price">
                      <input
                        inputMode="decimal"
                        placeholder="cena"
                        defaultValue={l.price !== undefined ? String(l.price).replace('.', ',') : ''}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value.replace(',', '.'));
                          setPrice(l.key, Number.isFinite(v) ? v : undefined);
                        }}
                        aria-label={`Cena za ${l.buyUnit}: ${l.name}`}
                      />
                      <span className="muted">zł/{l.buyUnit}</span>
                      <a href={storeSearchUrl(l.name)} target="_blank" rel="noreferrer" className="link small">
                        Bricoman
                      </a>
                      {l.total !== undefined && <strong>{formatPLN(l.total)}</strong>}
                    </span>
                  )}
                </div>
                <div className="item-qty">
                  <strong>{fmtQty(l.buyQty)}</strong>
                  <span>{l.buyUnit}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      </div>

      {showPrices && (
        <div className="total-bar">
          <span>Razem{missingPrices ? ` (bez ${missingPrices} poz. bez ceny)` : ''}</span>
          <strong>{formatPLN(total)}</strong>
        </div>
      )}

      <div className="actions wrap no-print">
        <button className="btn" onClick={share}>
          Udostępnij listę
        </button>
        <button className="btn" onClick={download}>
          Pobierz CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Drukuj / PDF
        </button>
        {shareMsg && (
          <span className="muted small share-msg" role="status">
            {shareMsg}
          </span>
        )}
      </div>
      <p className="muted small disclaimer">
        Ilości wyliczone wg typowych wytycznych montażu systemów Rigips i ATLAS M-System 3G (rozstawy profili i łączników, zużycie wkrętów i masy). Profile
        policzone z rozkroju na długości handlowe – długość każdego profilu możesz zmienić („Kupuję po”), ilości, przedłużenia i łączniki przeliczą się z projektu. Przed zamówieniem sprawdź wymagania karty technicznej systemu.
      </p>
    </div>
  );
}
