// Wspólne funkcje do czytania danych zebranych ze strony rigips.pl (data/rigips-systemy.json).
// Plik danych: lista systemów; każdy ma tabelę odmian (komórki tekstowe z przypisami)
// i zużycie materiałów na 100 m² z kalkulatora Rigips.

/** Usuwa znaczniki przypisów: „EI 601) *)” → „EI 60”, „40003)5)” → „4000” */
export function clean(text) {
  let t = String(text ?? '').replace(/\*+\)/g, ' ');
  // cyfra przypisu stoi tuż przed nawiasem zamykającym
  for (let i = 0; i < 4; i++) t = t.replace(/(\d|[a-ząćęłńóśźż]|\+)\d\)/gi, '$1');
  return t.replace(/__/g, ' ').replace(/\s+/g, ' ').trim();
}

export const num = (text) => {
  const m = clean(text).match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : undefined;
};

/** Wysokość w mm → cm (undefined dla „bez ograniczeń” i pustych) */
export function heightCm(text) {
  const t = clean(text);
  const m = t.match(/\d{4,5}/);
  if (!m) return undefined;
  const v = Number(m[0]);
  return v >= 1000 && v <= 20000 ? v / 10 : undefined;
}

/** Klasa EI w minutach (bierzemy EI, nie REI) */
export function fireMin(text) {
  const m = clean(text).match(/\bR?EI ?(15|30|45|60|90|120|180|240)\b/);
  return m ? Number(m[1]) : undefined;
}

/** Izolacyjność akustyczna w dB: pierwsza liczba dwucyfrowa */
export function dB(text) {
  const m = clean(text).match(/\b(\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

/** Wymagana grubość wełny, mm: 0 = niewymagana, undefined = brak informacji */
export function woolMm(text) {
  const t = clean(text);
  if (!t || t === '-' || t === '–') return undefined;
  if (/niewymagan|brak|bez we/i.test(t)) return 0;
  const m = t.match(/gr\.? ?(\d{2,3}) ?mm/);
  return m ? Number(m[1]) : undefined;
}

export function cell(sys, variant, pattern) {
  const i = sys.head.findIndex((h) => pattern.test(h));
  return i >= 0 ? (variant.cells[i] ?? '') : '';
}

// ---------------------------------------------------------------------------
// Płyty
// ---------------------------------------------------------------------------

const T = (t) => String(t).replace('.', ',');

/** Rozpoznaje rodzaje płyt w opisie (etykieta odmiany albo nazwa produktu) dla grubości `th` mm */
export function boardIds(text, th) {
  const t = clean(text);
  const out = [];
  const add = (id) => out.includes(id) || out.push(id);
  const rest = t
    .replace(/Aku[^+]*?Fire\+? ?(?:Hydro )?typ DF(?:H2)?\b/gi, () => (add(`AKUF${th}`), ' '))
    .replace(/Duraline|DFRIEH1|DFIREH1/gi, () => (add(`DURA${th}`), ' '))
    .replace(/HABITO[®™]? ?(HYDRO|H\b)/gi, () => (add(`HABITOH${th}`), ' '))
    .replace(/HABITO/gi, () => (add(`HABITO${th}`), ' '))
    .replace(/X ?OCEAN|GM-FH1/gi, () => (add(`XOCEAN${th}`), ' '))
    .replace(/AQUAROC/gi, () => (add(`AQUAROC${th}`), ' '))
    .replace(/Rigidur H|GF-C1-I-W2/gi, () => (add(`RIGIDUR${th}`), ' '))
    .replace(/Ridurit|GM-F\b/gi, () => (add(`RIDURIT${th}`), ' '))
    .replace(/GLASROC F \(Riflex\)|Riflex|Flexi/gi, () => (add(`FLEXI${th}`), ' '))
    .replace(/\bAku\b/gi, () => (add(`AKU${th}`), ' '))
    .replace(/Fire\+? ?Hydro(?: typ)? ?DFH2|DFH2|GKFI/gi, () => (add(`RFI${th}`), ' '))
    .replace(/Fire\+ ?(?:typ )?DF\b|typ DF\b/gi, () => (add(`RFP${th}`), ' '))
    .replace(/Fire typ F\b|typ F\b/gi, () => (add(`RF${th}`), ' '))
    .replace(/Hydro typ H2|typ H2|GKBI/gi, () => (add(`RBI${th}`), ' '))
    .replace(/typ A\b|GKB\b/gi, () => (add(`RB${th}`), ' '));
  void rest;
  return out;
}

/**
 * Rozbiera etykietę odmiany na grupy warstw:
 * „gr. 1x12,5 mm typ A lub Hydro typ H2 + gr. 1x10mm Rigidur H” →
 * [{ n: 1, th: 12.5, ids: ['RB12.5','RBI12.5'] }, { n: 1, th: 10, ids: ['RIGIDUR10'] }]
 */
export function parseLabel(label) {
  const t = clean(label);
  const groups = [];
  const re = /(?:gr\.? ?)?(?<![\d,.])(\d)\s?x\s?(\d{1,2}(?:[.,]\d)?)(?![\d,.]\d)\s?(?:mm)?/gi;
  const marks = [...t.matchAll(re)];
  const prefix = marks.length ? t.slice(0, marks[0].index) : '';
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    const text = t.slice(m.index + m[0].length, end);
    const th = Number(m[2].replace(',', '.'));
    let ids = boardIds(text, th);
    // rodzaj płyty bywa przed grubością („Duraline typ DFRIEH1 gr. 1x12,5 mm”) albo wspólny dla kilku grup
    if (!ids.length) ids = boardIds(prefix, th);
    if (!ids.length) ids = boardIds(t, th);
    groups.push({ n: Number(m[1]), th, ids, text: text.replace(/\+\s*$/, '').trim() });
  });
  return groups;
}

const SPECIAL = /^(DURA|HABITO|XOCEAN|AQUAROC|RIGIDUR|RIDURIT|AKU|FLEXI)/;
export const boardClass = (id) => (id.match(SPECIAL)?.[1] ?? 'STD').replace(/^HABITOH?$/, 'HABITO').replace(/^AKUF$/, 'AKU');

// ---------------------------------------------------------------------------
// Materiały
// ---------------------------------------------------------------------------

/** Skrócona nazwa materiału bez długości handlowych i marki profili */
export function matName(n) {
  return n
    .replace(/RIGIPS |Rigips /g, '')
    .replace(/GypSerra®?|Ultrastil®?|ULTRASTIL®?/gi, '')
    .replace(/,? ?L ?[-=] ?[\d,.]+ ?m?m?\b/gi, '')
    .replace(/o dł\.\s*/g, '')
    .replace(/\(\d+ szt\.\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wyszukuje pozycje materiałowe: mats = [poz, ilość, jedn., kategoria, nazwy[], ceny[]] */
export function findMats(variant, pattern, unit) {
  return variant.mats.filter(([, , u, , names]) => (!unit || u === unit) && names.some((n) => pattern.test(matName(n))));
}

export const sumMats = (variant, pattern, unit) => {
  // ta sama pozycja bywa wpisana dwa razy (GypSerra i Ultrastil) – bierzemy największą wartość, nie sumę
  const hits = findMats(variant, pattern, unit).map((m) => m[1]);
  return hits.length ? Math.max(...hits) : 0;
};

/** Rozmiary płyt z nazw produktów: „… 1200x2600x12,5” → { w: 1200, l: 2600, t: 12.5 } */
export function boardSize(name) {
  const m = name.match(/(\d{3,4})\s?[xX*]\s?(\d{3,4})\s?[xX*]\s?(\d+(?:[.,]\d+)?)/);
  return m ? { w: Number(m[1]), l: Number(m[2]), t: Number(m[3].replace(',', '.')) } : undefined;
}

export const fmtTh = T;
