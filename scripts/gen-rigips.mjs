// Generator katalogu Rigips: data/rigips-systemy.json (dane zebrane ze strony rigips.pl)
// → src/catalog/rigips.gen.ts. Uruchomienie: node scripts/gen-rigips.mjs [--debug]
//
// Jedna pozycja katalogu = jedna konstrukcja (ruszt × profil × układ warstw × rodzaj płyty).
// Numery systemów Rigips różniące się tylko płytą albo zagęszczeniem słupków trafiają do `variants`.
// Wartości (wysokość, EI, akustyka, zużycie) są przepisywane z danych – nic nie jest szacowane.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardClass, boardIds, cell, clean, dB, fireMin, fmtTh, heightCm, matName, num, parseLabel, woolMm } from './rigips-parse.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/rigips-systemy.json'), 'utf8'));
const DEBUG = process.argv.includes('--debug');

const KIND = {
  'sciany-dzialowe': 'wall',
  'sciany-dzialowe-do-pomieszczen-wilgotnych-mokrych': 'wall',
  'okladziny-scienne': 'lining',
  'obudowy-szybow-instalacyjnych-windowych': 'shaft',
};

/** Kolejność płyt standardowych od najtańszej – domyślna płyta systemu to pierwsza dostępna */
const RANK = ['RB', 'RBI', 'RF', 'RFP', 'RFI'];
const rank = (id) => {
  const i = RANK.indexOf(id.replace(/[\d.]+$/, ''));
  return i < 0 ? 9 : i;
};
const byRank = (a, b) => rank(a) - rank(b) || a.localeCompare(b);

const CLASS_NAME = {
  STD: 'PRO',
  DURA: 'Duraline',
  HABITO: 'Habito',
  XOCEAN: 'Glasroc X Ocean',
  AQUAROC: 'Aquaroc',
  RIGIDUR: 'Rigidur H',
  RIDURIT: 'Glasroc F Ridurit',
  AKU: 'PRO Aku',
  FLEXI: 'Riflex',
};

const skipped = [];
const skip = (s, why) => skipped.push(`${s.list[0]} – ${why}`);

/** Zużycie pozycji na 100 m² (największa z wartości dla wariantów tej samej pozycji) */
const qty = (v, pattern, unit) => {
  const hits = v.mats.filter(([, , u, , names]) => (!unit || u === unit) && names.some((n) => pattern.test(matName(n)))).map((m) => m[1]);
  return hits.length ? Math.max(...hits) : 0;
};

const spacingOf = (perRow) => (perRow <= 200 ? 60 : perRow <= 300 ? 40 : 30);

// ---------------------------------------------------------------------------
// Ściany, okładziny, obudowy szachtów
// ---------------------------------------------------------------------------

const families = new Map();

for (const s of data.systems) {
  const kind = KIND[s.cat];
  if (!kind) continue;
  const code = s.list[0];
  const sysName = clean(s.list[1]);
  if (/RC ?\d|z wykończeniem|EasyTherm/i.test(code)) {
    skip(s, 'odmiana antywłamaniowa / propozycja wykończenia / płyta zespolona');
    continue;
  }
  if (/łukow/i.test(sysName)) {
    skip(s, 'ściana łukowa');
    continue;
  }
  if (!s.vars.length) {
    skip(s, 'brak tabeli odmian na stronie');
    continue;
  }
  for (const v of s.vars) {
    const label = clean(v.cells[0]);
    let K = clean(cell(s, v, /Konstrukcja/));
    const cwNames = v.mats.flatMap((m) => m[4]).filter((n) => /^\s*CW \d/.test(n));
    if (!K && cwNames.length) K = `CW/UW ${cwNames[0].match(/CW (\d+)/)[1]}`;
    if (/C250|4xCW|RIGISTIL|kapelusz|Kątownik/i.test(K)) {
      skip(s, `konstrukcja „${K.slice(0, 30)}” poza zakresem silnika`);
      break;
    }
    const glued = /klej/i.test(K);
    const cd = /CD ?60/.test(K);
    if (cd && /wieszak\w* do poddaszy/i.test(sysName)) {
      skip(s, 'okładzina na wieszakach do poddaszy');
      break;
    }
    const groups = parseLabel(label);
    if (/^Aku\b/i.test(label)) for (const g of groups) g.ids = g.ids.map((id) => id.replace(/^RB(?=\d)/, 'AKU'));
    if (!groups.length || groups.some((g) => !g.ids.length)) {
      skip(s, `nierozpoznana płyta „${label.slice(0, 40)}”`);
      break;
    }
    const sidesN = kind === 'wall' ? 2 : 1;
    const boardsM2 = v.mats.filter((x) => x[3] === 'Płyty' && x[2] === 'm2').reduce((a, x) => a + x[1], 0);
    const layersN = groups.reduce((a, g) => a + g.n, 0);
    if (boardsM2 && Math.abs(boardsM2 - layersN * sidesN * 100) > 10) {
      skip(s, `odmiana „${label.slice(0, 50)}” – inne poszycie z każdej strony ściany`);
      continue;
    }
    const cwM = qty(v, /^CW \d/, 'm');
    const uwM = qty(v, /^UW \d/, 'm');
    if (!glued && !cd && (!cwM || uwM < 60)) {
      skip(s, 'nietypowy ruszt (brak CW albo UW w zestawieniu)');
      break;
    }
    const profile = glued || cd ? 50 : Number(K.match(/(?:CW|UW)\D{0,6}(50|75|100)/)?.[1] ?? K.match(/\b(50|75|100)\b/)?.[1]);
    if (!profile) {
      skip(s, `brak szerokości profilu w „${K}”`);
      break;
    }
    const twoRows = kind === 'wall' && (uwM >= 130 || /podwójnej konstrukcji/i.test(sysName));
    const doubled = !twoRows && !cd && !glued && (/^2x/i.test(K) || /podwójnych profilach/i.test(sysName));
    const frame = glued ? 'glued' : cd ? 'cd-lining' : twoRows ? 'double' : 'single';
    const cdM = qty(v, /^CD ?60/, 'm');
    const spacing = glued ? 60 : cd ? spacingOf(cdM) : spacingOf(cwM / (twoRows || doubled ? 2 : 1));
    const aku = /Aku/i.test(K);

    // grupa „główna” = płyta specjalna (jeśli jest) albo ostatnia wymieniona; pozostałe to warstwy wewnętrzne
    const cls = (g) => boardClass(g.ids[0]);
    let mainIdx = groups.findIndex((g) => cls(g) !== 'STD');
    if (mainIdx < 0) mainIdx = groups.length - 1;
    const main = groups[mainIdx];
    const inner = groups.filter((_, i) => i !== mainIdx);
    if (inner.length > 1 || (inner[0] && cls(inner[0]) !== 'STD')) {
      skip(s, `odmiana „${label.slice(0, 50)}” – układ płyt, którego aplikacja nie liczy`);
      continue;
    }
    const tag = (g) => (cls(g) === 'STD' ? '' : cls(g));
    const spec = inner[0] ? `${inner[0].n}${tag(inner[0])}+${main.n}${tag(main)}` : `${main.n}${tag(main)}`;
    const prefix = { wall: 'W', lining: 'O', shaft: 'SZ' }[kind];
    let id = `${prefix}-${twoRows ? '2' : ''}${glued ? 'KLEJ' : cd ? 'CD' : `CW${profile}`}${aku ? 'AKU' : ''}-${spec}`;
    if (id === 'O-KLEJ-1') id = 'O-KLEJ';

    let fam = families.get(id);
    if (!fam) {
      fam = { id, kind, frame, profile, aku, cls: cls(main), innerCls: inner[0] ? cls(inner[0]) : undefined, mainN: main.n, innerN: inner[0]?.n ?? 0, innerTh: inner[0]?.th, recs: [], variants: [], order: families.size };
      families.set(id, fam);
    }
    const wall = kind !== 'lining';
    const base = {
      code,
      label,
      studSpacing: spacing,
      doubleStuds: doubled || undefined,
      maxHeight: heightCm(cell(s, v, /Wysokość maks/)),
      fire: fireMin(cell(s, v, /ogniow/)),
      rw: wall ? dB(cell(s, v, /Rw/)) : undefined,
      ra1: wall ? dB(cell(s, v, /akustyczna RA1/)) : undefined,
      wool: woolMm(cell(s, v, /wełn/i)),
      thickness: num(cell(s, v, /Grubość/)),
      mass: num(cell(s, v, /Masa/)),
      price: num(cell(s, v, /Cena/)),
    };
    const innerBoards = inner[0] ? [...inner[0].ids].sort(byRank) : undefined;
    for (const board of [...main.ids].sort(byRank)) fam.variants.push({ ...base, board, innerBoards });
    fam.recs.push({ s, v, spacing, doubled, th: main.th });
  }
}

// ---------------------------------------------------------------------------
// Wzorzec zużycia z kalkulatora Rigips (na 1 m²)
// ---------------------------------------------------------------------------

function reference(fam, v) {
  const out = [];
  const used = new Set();
  const UNIT = { m: 'mb', PC: 'szt.', kg: 'kg', m2: 'm²' };
  /** `sum`: różne pozycje zestawienia sumujemy (np. masa do każdej warstwy), w obrębie pozycji bierzemy największą */
  const line = (pattern, unit, product, label, sum = false) => {
    const byPos = new Map();
    for (const row of v.mats) {
      const [pos, q, u, , names] = row;
      if (u !== unit || !names.some((n) => pattern.test(matName(n)))) continue;
      used.add(row);
      byPos.set(pos, Math.max(byPos.get(pos) ?? 0, q));
    }
    const vals = [...byPos.values()];
    const q = vals.length ? (sum ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals)) : 0;
    if (q > 0) out.push({ ...(product ? { product } : {}), label, qty: Math.round(q) / 100, unit: UNIT[unit] });
  };
  const boardRows = v.mats.filter((x) => x[3] === 'Płyty');
  boardRows.forEach((x) => used.add(x));
  const boards = boardRows.filter((x) => x[2] === 'm2').reduce((a, x) => a + x[1], 0);
  if (boards) out.push({ label: 'Płyty', qty: boards / 100, unit: 'm²' });
  const p = fam.profile;
  if (fam.frame === 'cd-lining') {
    line(/^CD ?60/, 'm', 'CD60', 'Profil CD 60');
    line(/^UD 30/, 'm', 'UD30', 'Profil UD 30');
    line(/^Uchwyt (ES|elastyczny)/, 'PC', 'WIESZAK_ES', 'Uchwyt ES / elastyczny');
  } else if (fam.frame !== 'glued') {
    line(/^CW \d/, 'm', `CW${p}${fam.aku && p !== 50 ? 'AKU' : ''}`, `Profil CW ${p}${fam.aku ? ' Aku' : ''}`);
    line(/^UW \d/, 'm', `UW${p}`, `Profil UW ${p}`);
  }
  for (const len of [25, 35, 45, 55]) line(new RegExp(`^Wkręty\\s+TN 3,5x${len}\\b`), 'PC', `TN${len}`, `Wkręt TN ${len}`);
  line(/^Wkręty\s+TN 4,2x70/, 'PC', 'TN70', 'Wkręt TN 70');
  line(/^Wkręty Habito 4.2x26/, 'PC', 'HABITO26', 'Wkręt Habito 26');
  line(/^Wkręty Habito 4.2x41/, 'PC', 'HABITO41', 'Wkręt Habito 41');
  for (const len of [25, 35, 45]) line(new RegExp(`^Wkręty HartFix 3,[89]x${len}`), 'PC', `HARTFIX${len}`, `Wkręt HartFix ${len}`);
  for (const len of [30, 40]) line(new RegExp(`^Wkręty Rigidur 3,5x${len}`), 'PC', `RIGIDUR${len}`, `Wkręt Rigidur ${len}`);
  for (const len of [40, 50, 70]) line(new RegExp(`^Wkręty GLASROC F \\(Ridurit\\) 3,5x${len}`), 'PC', `RIDURIT${len}`, `Wkręt Ridurit ${len}`);
  line(/^Wkręty Aquaroc Interior HB 25/, 'PC', 'AQ25', 'Wkręt Aquaroc 25');
  line(/^Wkręty Aquaroc Interior HB 3,5x41/, 'PC', 'AQ35', 'Wkręt Aquaroc 41');
  line(/^Wkręty "Pchełki"/, 'PC', 'LN9', 'Wkręt „pchełka” 3,9×11');
  line(/^Kołek/, 'PC', 'KOLEK', 'Kołek rozporowy');
  for (const [w, id] of [[30, 'TASMA_USZ30'], [50, 'TASMA_USZ50'], [70, 'TASMA_USZ70'], [95, 'TASMA_USZ95']])
    line(new RegExp(`^Taśma uszczelniająca.*szerkości ${w} mm`), 'm', id, `Taśma uszczelniająca ${w} mm`);
  line(/^Klej gipsowy/, 'kg', 'KLEJ', 'Klej gipsowy');
  // masy i taśmy do płyt specjalnych aplikacja liczy uproszczone – bez porównania
  const plain = fam.cls === 'STD' || fam.cls === 'AKU' || fam.cls === 'HABITO' || fam.cls === 'DURA';
  line(/VARIO|SUPER|Q1 Zaczyna|ProMix HYDRO/, 'kg', plain ? 'MASA' : undefined, 'Masa do spoinowania', true);
  line(/^Taśma (spoinowa|z włókna)|FLEECE|Fiba ?Tape/, 'm', plain ? 'TASMA_SPOIN' : undefined, 'Taśma spoinowa');
  line(/Kończy|Finish|Premium Light|Airless/, 'kg', 'MASA_WYK', 'Masa wykończeniowa');
  line(/Wełna|Aku-Płyta|Polterm/, 'm2', undefined, 'Wełna mineralna');
  line(/Wełna|Aku-Płyta|Polterm/, 'kg', undefined, 'Wełna mineralna');
  // pozostałe pozycje zestawienia Rigips (kleje, grunty, akcesoria) – tylko do wglądu
  const rest = new Map();
  for (const row of v.mats) {
    if (used.has(row) || !UNIT[row[2]]) continue;
    const label = matName(row[4][0]).replace(/\s*[–-]\s*(worek|wiadro|pojemnik|w tubie).*$/i, '').replace(/\s+\d+ szt\.?.*$/i, '').replace(/\*+$/, '').trim();
    if (!rest.has(row[0])) rest.set(row[0], { label, qty: Math.round(row[1]) / 100, unit: UNIT[row[2]] });
  }
  out.push(...rest.values());
  return out;
}

// ---------------------------------------------------------------------------
// Składanie pozycji katalogu
// ---------------------------------------------------------------------------

const uniq = (a) => [...new Set(a)];
const m = (cm) => (cm / 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '');
const range = (vals, pre, post = '') => {
  const x = uniq(vals.filter((n) => n !== undefined)).sort((a, b) => a - b);
  return x.length ? `${pre} ${x[0]}${x.length > 1 ? `–${x[x.length - 1]}` : ''}${post}` : undefined;
};

const walls = [];
for (const fam of families.values()) {
  // odmiany: bez powtórek, od najrzadszego rusztu
  const seen = new Set();
  const variants = fam.variants
    .filter((x) => {
      const k = JSON.stringify(x);
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .sort((a, b) => (a.doubleStuds ? 1 : 0) - (b.doubleStuds ? 1 : 0) || b.studSpacing - a.studSpacing);
  const boards = uniq(variants.map((x) => x.board)).sort(byRank);
  const defaultBoard = boards[0];
  const first = variants.find((x) => x.board === defaultBoard);
  const baseRec = fam.recs.find((r) => r.s.list[0] === first.code && r.spacing === first.studSpacing && !!r.doubled === !!first.doubleStuds) ?? fam.recs[0];
  const sides = fam.kind === 'wall' ? 2 : 1;
  const layers = fam.mainN + fam.innerN;
  const ths = uniq(variants.map((x) => Number(x.board.match(/[\d.]+$/)[0]))).sort((a, b) => a - b);
  const thText = `${fmtTh(ths[0])}${ths.length > 1 ? ` (lub ${ths.slice(1).map(fmtTh).join(', ')})` : ''}`;
  const boardText = fam.innerN
    ? `${fam.innerN}×${fmtTh(fam.innerTh)} ${CLASS_NAME[fam.innerCls]} + ${fam.mainN}×${thText} ${CLASS_NAME[fam.cls]}`
    : `${fam.mainN}×${thText}${fam.cls === 'STD' ? '' : ` ${CLASS_NAME[fam.cls]}`}`;
  const cwText = `CW ${fam.profile}${fam.aku ? ' Aku' : ''}`;
  const name =
    fam.frame === 'glued'
      ? 'Suchy tynk – płyta na klej gipsowy'
      : fam.frame === 'cd-lining'
        ? `Okładzina na CD 60 i uchwytach ES, ${boardText}`
        : fam.kind === 'lining'
          ? `Okładzina wolnostojąca ${cwText}, ${boardText}`
          : fam.kind === 'shaft'
            ? `Obudowa szachtu ${cwText}, ${boardText} jednostronnie`
            : fam.frame === 'double'
              ? `Ściana 2×${cwText}, ${boardText} obustronnie`
              : `Ściana ${cwText}, ${boardText} obustronnie`;

  const maxHeight = {};
  for (const x of variants) {
    if (x.doubleStuds || !x.maxHeight || x.board !== defaultBoard) continue;
    maxHeight[x.studSpacing] = Math.max(maxHeight[x.studSpacing] ?? 0, x.maxHeight);
  }
  const studSpacing = Math.max(...variants.filter((x) => !x.doubleStuds).map((x) => x.studSpacing), 0) || variants[0].studSpacing;
  const codes = uniq(variants.map((x) => x.code));
  const hMax = Math.max(...variants.map((x) => x.maxHeight ?? 0));
  const hBase = maxHeight[studSpacing];
  const info = [
    first.thickness ? `Grubość ${first.thickness} mm` : undefined,
    hBase ? `do ${m(hBase)} m przy rozstawie ${studSpacing} cm` : undefined,
    hMax > (hBase ?? 0) ? `do ${m(hMax)} m z gęstszymi lub podwójnymi słupkami` : undefined,
    codes.length > 1 ? `${codes.length} systemów Rigips (${codes[0]}…)` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  walls.push({
    id: fam.id,
    code: first.code,
    name,
    category: fam.kind === 'lining' ? 'okładzina' : fam.kind === 'shaft' ? 'szacht' : fam.frame === 'double' ? 'podwójna' : 'działowa',
    frame: fam.frame,
    profile: fam.profile,
    layers,
    sides,
    defaultBoard,
    ...(fam.innerN ? { innerBoard: first.innerBoards[0], innerLayers: fam.innerN } : {}),
    ...(fam.aku ? { akuStuds: true } : {}),
    studSpacing,
    ...(Object.keys(maxHeight).length ? { maxHeight } : {}),
    insulationDefault: (first.wool ?? 0) > 0,
    fire: range(variants.map((x) => x.fire), 'EI', ' (zależnie od płyty i wypełnienia – patrz odmiany)'),
    acoustic: range(variants.map((x) => x.ra1), 'RA1', ' dB'),
    ...(fam.frame === 'cd-lining' ? { bracketSpacing: 100 } : {}),
    info,
    source: { label: `Rigips ${first.code} – strona systemu i kalkulator zużycia`, url: `https://www.rigips.pl${baseRec.s.url}` },
    reference: reference(fam, baseRec.v),
    variants,
  });
}

if (DEBUG) {
  for (const w of walls)
    console.log(
      `${w.id.padEnd(26)} ${String(w.variants.length).padStart(3)}v ${w.defaultBoard.padEnd(11)} ${(w.innerBoard ?? '').padEnd(9)} H${JSON.stringify(w.maxHeight ?? {})} ${w.fire?.slice(0, 10) ?? ''} | ${uniq(w.variants.map((x) => x.code)).join(' ').slice(0, 90)}`,
    );
}

// ---------------------------------------------------------------------------
// Sufity podwieszane, okładziny sufitów i poddasza na profilach CD 60
// ---------------------------------------------------------------------------

const CEIL_CATS = new Set(['poddasza', 'okladziny-sufitowe', 'sufity-podwieszane']);
/** Identyfikatory sufitów sprzed generatora – zostają, żeby zapisane projekty wskazywały ten sam system */
const CEIL_LEGACY = {
  '4.05.24|1': 'S-CD-2P-1',
  '4.05.24|2': 'S-CD-2P-2',
  '4.10.13|1': 'S-CD-2P-1F',
  '4.10.15|2': 'S-CD-2P-2F',
  '4.10.17|2': 'S-CD-2P-2x15F',
  '4.10.19|3': 'S-CD-2P-3F',
  '4.05.25|1': 'S-CD-1P-1',
  '4.05.25|2': 'S-CD-1P-2',
  '4.10.14|1': 'S-CD-1P-1F',
  '4.10.16|2': 'S-CD-1P-2F',
  '4.05.23|1': 'S-ES-1',
  '4.05.23|2': 'S-ES-2',
  '4.70.06|1': 'S-PODD-1',
  '4.70.06|2': 'S-PODD-2',
};
const CEIL_SKIP = [
  [/RIGISTIL/i, 'profile Rigistil'],
  [/kapelusz/i, 'profile kapeluszowe'],
  [/Klick/i, 'wieszaki Klick-Fix'],
  [/łatach/i, 'ruszt z łat drewnianych'],
  [/RIGITONE|GYPTONE|kaseton/i, 'sufit akustyczny lub kasetonowy'],
  [/Riflex|Flexi|CURVE/i, 'sufit łukowy'],
  [/sufit pod sufitem/i, 'sufit pod sufitem (dwa niezależne sufity)'],
  [/CW i UW|\bUA\b/i, 'sufit bez wieszaków – w katalogu z tabelą rozpiętości z karty'],
  [/wieszakach z elementem rozprężnym/i, 'ta sama konstrukcja co 4.05.241 AKU, na wieszakach z prętem (bez klasy ogniowej)'],
];

const cm = (text) => {
  const v = num(text);
  return v && v >= 100 ? v / 10 : undefined;
};

const ceilFams = new Map();
for (const s of data.systems) {
  if (!CEIL_CATS.has(s.cat)) continue;
  const code = s.list[0];
  const sysName = clean(s.list[1]);
  const why = CEIL_SKIP.find(([re]) => re.test(sysName))?.[1];
  if (why) {
    skip(s, why);
    continue;
  }
  if (!s.vars.length) {
    skip(s, 'brak tabeli odmian na stronie');
    continue;
  }
  for (const v of s.vars) {
    const label = clean(v.cells[0]);
    // pozycje o numerach ≥ 100 to zamienniki płyt dopisane na końcu zestawienia
    const boardsM2 = v.mats.filter((x) => x[3] === 'Płyty' && x[2] === 'm2' && x[0] < 100).reduce((a, x) => a + x[1], 0);
    let groups = parseLabel(label);
    if (!groups.length) {
      // etykieta bez liczby warstw („GLASROC X OCEAN typ GM-FH1 gr. 12,5 mm”) – warstwy z ilości płyt
      const th = num(label.match(/gr\.? ?(\d+(?:,\d)?) ?mm/)?.[1]);
      const ids = th ? boardIds(label, th) : [];
      if (ids.length && boardsM2) groups = [{ n: Math.round(boardsM2 / 100), th, ids }];
    }
    if (/^Aku\b|\bAku Fire/i.test(label)) for (const g of groups) g.ids = g.ids.map((id) => id.replace(/^R(B|FP)(?=\d)/, (m0, t) => (t === 'B' ? 'AKU' : 'AKUF')));
    if (!groups.length || groups.some((g) => !g.ids.length)) {
      skip(s, `nierozpoznana płyta „${label.slice(0, 40)}”`);
      break;
    }
    const layers = groups.reduce((a, g) => a + g.n, 0);
    if (boardsM2 && Math.abs(boardsM2 - layers * 100) > 10) {
      skip(s, `odmiana „${label.slice(0, 50)}” – ilość płyt niezgodna z opisem`);
      continue;
    }
    if (groups.length > 2) {
      skip(s, `odmiana „${label.slice(0, 50)}” – trzy rodzaje płyt`);
      continue;
    }
    const main = groups[groups.length - 1];
    const inner = groups.length > 1 ? groups[0] : undefined;
    const cross = qty(v, /krzyżowy/, 'PC');
    const trans = qty(v, /poprzeczny/, 'PC');
    const kind = cross ? 'two-level' : trans ? 'one-level' : 'direct';
    const hangRow = v.mats.find(([, , u, , names]) => u === 'PC' && /^(Wieszak|Uchwyt)/.test(matName(names[0])));
    const hangName = hangRow ? matName(hangRow[4][0]) : '';
    const hangerType = kind !== 'direct' ? 'noniusz' : /do poddaszy/i.test(sysName) ? 'attic' : /elastyczny/i.test(hangName) ? 'elastic' : 'es';
    const cdM = qty(v, /^CD ?60/, 'm');
    const along = cm(cell(s, v, /Podłużnie/));
    const across = cm(cell(s, v, /Poprzecznie/));
    let hangerSpacing = cm(cell(s, v, /rozstaw wieszaków|rozstaw mocowania/));
    // okładziny sufitów nie mają w tabeli rozstawu uchwytów – wynika z zużycia profili i uchwytów w kalkulatorze
    if (!hangerSpacing && hangRow) hangerSpacing = Math.min(100, Math.floor((cdM / hangRow[1]) * 20) * 5);
    // Rigips: profile „główne” (górne) i „nośne” (dolne, pod płytę); w aplikacji to odpowiednio nośne i montażowe
    const mainSpacing = kind === 'direct' ? along : cm(cell(s, v, /profili głównych/));
    const secondarySpacing = kind === 'direct' ? along : cm(cell(s, v, /profili nośnych/));
    if (!mainSpacing || !secondarySpacing || !hangerSpacing) {
      skip(s, `odmiana „${label.slice(0, 40)}” – brak rozstawów w tabeli`);
      continue;
    }
    const screws = v.mats
      .filter(([, , u, , names]) => u === 'PC' && /^Wkręty/.test(matName(names[0])) && !/Pchełki|mocujący/i.test(names[0]))
      .map(([, q, , , names]) => ({ q, len: Number(matName(names[0]).match(/(?:x ?|HB )(\d{2})/)?.[1] ?? 0) }))
      .sort((a, b) => a.len - b.len);
    const outerScrews = screws.length ? screws[screws.length - 1].q / 100 : 17;
    const innerScrews = screws.length > 1 ? screws.slice(0, -1).reduce((a, x) => a + x.q, 0) / (screws.length - 1) / 100 : 6.5;

    const key = `${code}|${layers}`;
    let fam = ceilFams.get(key);
    const load = label.match(/\((bez obciążenia[^)]*|z obciążeniem[^)]*)\)/)?.[1];
    if (!fam) {
      const cls = boardClass(main.ids[0]);
      fam = {
        id: CEIL_LEGACY[key] ?? `S-${code.replace(/\s+/g, '')}-${layers}`,
        code, s, v, kind, hangerType, layers, main, inner, cls,
        mainSpacing, secondarySpacing, hangerSpacing, across,
        screwsOuter: outerScrews, screwsInner: innerScrews,
        attic: s.cat === 'poddasza', variants: [], loads: [],
      };
      ceilFams.set(key, fam);
    }
    // odmiany z obciążeniem dodatkowym różnią się tylko rozstawem wieszaków – trafiają do opisu
    if (load && !/^bez obciążenia/.test(load)) {
      const kg = load.match(/<= ?(\d+) ?kg/)?.[1];
      const note = `${kg ? `przy masie zabudowy do ${kg} kg/m²` : 'z obciążeniem dodatkowym'} wieszaki co ${hangerSpacing} cm`;
      if (hangerSpacing !== fam.hangerSpacing && !fam.loads.includes(note)) fam.loads.push(note);
      continue;
    }
    const base = {
      code,
      label: label.replace(/\s*\((bez obciążenia|z obciążeniem)[^)]*\)\s*/, '').trim(),
      fire: fireMin(cell(s, v, /ogniow/)),
      rw: dB(cell(s, v, /Rw/)),
      wool: woolMm(cell(s, v, /wełn/i)),
      thickness: num(cell(s, v, /Grubość/)),
      mass: num(cell(s, v, /Masa/)),
      price: num(cell(s, v, /Cena/)),
    };
    const innerBoards = inner ? [...inner.ids].sort(byRank) : undefined;
    for (const board of [...main.ids].sort(byRank)) {
      if (fam.variants.some((x) => x.board === board && x.fire === base.fire && x.thickness === base.thickness)) continue;
      fam.variants.push({ ...base, board, innerBoards });
    }
  }
}

function ceilingReference(fam) {
  const v = fam.v;
  const out = [];
  const used = new Set();
  const UNIT = { m: 'mb', PC: 'szt.', kg: 'kg', m2: 'm²' };
  const line = (pattern, unit, product, label, sum = false) => {
    const byPos = new Map();
    for (const row of v.mats) {
      const [pos, q, u, , names] = row;
      if (u !== unit || !names.some((n) => pattern.test(matName(n)))) continue;
      used.add(row);
      byPos.set(pos, Math.max(byPos.get(pos) ?? 0, q));
    }
    const vals = [...byPos.values()];
    const q = vals.length ? (sum ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals)) : 0;
    if (q > 0) out.push({ ...(product ? { product } : {}), label, qty: Math.round(q) / 100, unit: UNIT[unit] });
  };
  const boardRows = v.mats.filter((x) => x[3] === 'Płyty');
  boardRows.forEach((x) => used.add(x));
  const boards = boardRows.filter((x) => x[2] === 'm2').reduce((a, x) => a + x[1], 0);
  if (boards) out.push({ label: 'Płyty', qty: boards / 100, unit: 'm²' });
  line(/^CD ?60/, 'm', 'CD60', 'Profil CD 60');
  line(/^UD 30/, 'm', 'UD30', 'Profil UD 30');
  if (fam.kind === 'direct') {
    const product = { es: 'WIESZAK_ES', elastic: 'UCHWYT_ELAST', attic: 'WIESZAK_PODD' }[fam.hangerType];
    line(/^(Uchwyt|Wieszak do poddaszy)/, 'PC', product, { es: 'Uchwyt ES', elastic: 'Uchwyt elastyczny', attic: 'Wieszak do poddaszy' }[fam.hangerType]);
  } else {
    line(/^Wieszak/, 'PC', 'WIESZAK_NONIUSZ', 'Wieszak (część dolna)');
    line(/^(Część górna|Pręt wieszakowy)/, 'PC', undefined, 'Część górna wieszaka / pręt');
    line(/^Klamra zabezpieczająca/, 'PC', 'ZAWLECZKA', 'Klamra zabezpieczająca');
    line(/^Łącznik krzyżowy/, 'PC', 'LACZNIK_KRZ', 'Łącznik krzyżowy CD 60');
    line(/^Łącznik poprzeczny/, 'PC', 'LACZNIK_JEDNO', 'Łącznik poprzeczny CD 60');
  }
  line(/^Łącznik wzdłużny/, 'PC', 'LACZNIK_WZDL', 'Łącznik wzdłużny CD 60');
  for (const len of [25, 35, 45, 55]) line(new RegExp(`^Wkręty\\s+TN 3,5x${len}\\b`), 'PC', `TN${len}`, `Wkręt TN ${len}`);
  line(/^Wkręty\s+TN 4,2x70/, 'PC', 'TN70', 'Wkręt TN 70');
  for (const len of [25, 35, 45]) line(new RegExp(`^Wkręty HartFix 3,[89]x${len}`), 'PC', `HARTFIX${len}`, `Wkręt HartFix ${len}`);
  line(/^Wkręty GLASROC F \(Ridurit\) 3,5x40/, 'PC', 'RIDURIT40', 'Wkręt Ridurit 40');
  line(/^Wkręty GLASROC F \(Ridurit\) 3,5x58/, 'PC', undefined, 'Wkręt Ridurit 58');
  line(/^Wkręty Aquaroc Interior HB 25/, 'PC', 'AQ25', 'Wkręt Aquaroc 25');
  line(/^Wkręty Aquaroc Interior HB 3,5x41/, 'PC', 'AQ35', 'Wkręt Aquaroc 41');
  line(/^"?Wkręty "+Pchełki/, 'PC', 'LN9', 'Wkręt „pchełka”');
  line(/^Dybel sufitowy/, 'PC', undefined, 'Dybel sufitowy stalowy (wieszaki + UD)');
  line(/^Taśma uszczelniająca.*szerkości 30 mm/, 'm', 'TASMA_USZ30', 'Taśma uszczelniająca 30 mm');
  const plain = fam.cls === 'STD' || fam.cls === 'AKU';
  line(/VARIO|SUPER|Q1 Zaczyna|ProMix HYDRO/, 'kg', plain ? 'MASA' : undefined, 'Masa do spoinowania', true);
  line(/^Taśma (spoinowa|z włókna)|FLEECE|Fiba ?Tape/, 'm', plain ? 'TASMA_SPOIN' : undefined, 'Taśma spoinowa');
  line(/Kończy|Finish|Premium Light|Airless/, 'kg', 'MASA_WYK', 'Masa wykończeniowa');
  line(/Wełna|Aku-Płyta|Polterm|Mata/, 'm2', undefined, 'Wełna mineralna');
  // w poddaszach folia jest elementem systemu (aplikacja liczy ją domyślnie), w okładzinach „w razie potrzeby”
  line(/Paroizolacja/, 'm2', fam.attic ? 'FOLIA_PAROIZ' : undefined, 'Paroizolacja');
  const rest = new Map();
  for (const row of v.mats) {
    if (used.has(row) || !UNIT[row[2]]) continue;
    const label = matName(row[4][0]).replace(/\s*[–-]\s*(worek|wiadro|pojemnik|w tubie).*$/i, '').replace(/\s+\d+ szt\.?.*$/i, '').replace(/\*+$/, '').trim();
    if (!rest.has(row[0])) rest.set(row[0], { label, qty: Math.round(row[1]) / 100, unit: UNIT[row[2]] });
  }
  out.push(...rest.values());
  return out;
}

const HANGER_NAME = { noniusz: 'wieszaki', es: 'uchwyty ES', elastic: 'uchwyty elastyczne', attic: 'wieszaki do poddaszy' };
const ceilings = [];
for (const fam of ceilFams.values()) {
  if (!fam.variants.length) continue;
  const boards = uniq(fam.variants.map((x) => x.board)).sort(byRank);
  const defaultBoard = boards[0];
  const first = fam.variants.find((x) => x.board === defaultBoard);
  const ths = uniq(fam.variants.map((x) => Number(x.board.match(/[\d.]+$/)[0]))).sort((a, b) => a - b);
  const thText = `${fmtTh(ths[0])}${ths.length > 1 ? ` (lub ${ths.slice(1).map(fmtTh).join(', ')})` : ''}`;
  const clsText = fam.cls === 'STD' ? '' : ` ${CLASS_NAME[fam.cls]}`;
  const boardText = fam.inner
    ? `${fam.inner.n}×${fmtTh(fam.inner.th)} + ${fam.main.n}×${thText}${clsText}`
    : `${fam.layers}×${thText}${clsText}`;
  const fireOnly = fam.variants.every((x) => x.fire);
  const frameText =
    fam.kind === 'two-level'
      ? `Sufit ${fireOnly ? 'ogniochronny ' : ''}dwupoziomowy CD 60`
      : fam.kind === 'one-level'
        ? `Sufit ${fireOnly ? 'ogniochronny ' : ''}jednopoziomowy CD 60`
        : fam.attic
          ? `Poddasze: CD 60 na ${{ es: 'uchwytach ES', elastic: 'uchwytach elastycznych', attic: 'wieszakach do poddaszy' }[fam.hangerType]}`
          : `Okładzina sufitu ${fireOnly ? 'ogniochronna ' : ''}CD 60 na ${fam.hangerType === 'elastic' ? 'uchwytach elastycznych' : 'uchwytach ES'}`;
  const info = [
    fam.kind === 'direct'
      ? `Profile CD co ${fam.secondarySpacing} cm, ${HANGER_NAME[fam.hangerType]} co ${fam.hangerSpacing} cm`
      : `Profile nośne (górne) co ${fam.mainSpacing} cm, montażowe (dolne) co ${fam.secondarySpacing} cm, wieszaki co ${fam.hangerSpacing} cm`,
    fam.kind === 'direct' && fam.across && fam.across !== fam.secondarySpacing ? `przy płytach w poprzek profili z płytą typ A profile co ${fam.across} cm` : undefined,
    first.thickness ? `zabudowa od ${first.thickness} mm` : undefined,
    ...fam.loads,
    fam.kind === 'two-level' && fam.secondarySpacing === 50 && qty(fam.v, /^CD ?60/, 'm') >= 360 ? 'kalkulator Rigips liczy tu profile montażowe co 40 cm' : undefined,
    fam.inner ? `układ płyt z karty: ${fam.inner.n}×${fmtTh(fam.inner.th)} mm + ${fam.main.n}×${fmtTh(fam.main.th)} mm` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  ceilings.push({
    id: fam.id,
    code: fam.code,
    name: `${frameText}, ${boardText}`,
    kind: fam.kind,
    layers: fam.layers,
    defaultBoard,
    ...(fam.inner ? { innerBoard: first.innerBoards[0], innerLayers: fam.inner.n } : {}),
    mainSpacing: fam.mainSpacing,
    secondarySpacing: fam.secondarySpacing,
    hangerSpacing: fam.hangerSpacing,
    hangerType: fam.hangerType,
    screwsOuter: fam.screwsOuter,
    screwsInner: fam.screwsInner,
    fire: range(fam.variants.map((x) => x.fire), 'EI', fam.variants.some((x) => !x.fire) || uniq(fam.variants.map((x) => x.fire)).length > 1 ? ' (zależnie od płyty – patrz odmiany)' : ''),
    info,
    source: { label: `Rigips ${fam.code} – strona systemu i kalkulator zużycia`, url: `https://www.rigips.pl${fam.s.url}` },
    ...(fam.kind === 'direct' ? { attic: fam.attic } : {}),
    reference: ceilingReference(fam),
    variants: fam.variants,
  });
}

if (DEBUG) {
  console.log('\nSufity:');
  for (const c of ceilings)
    console.log(
      `${c.id.padEnd(20)} ${c.kind.padEnd(9)} ${c.hangerType.padEnd(8)} L${c.layers} ${c.defaultBoard.padEnd(11)} ${(c.innerBoard ?? '').padEnd(8)} ${c.mainSpacing}/${c.secondarySpacing}/${c.hangerSpacing} wkr ${c.screwsOuter}/${c.screwsInner} ${String(c.variants.length).padStart(2)}v ${c.fire ?? ''} | ${c.name}`,
    );
  console.log(`\nPominięte (${uniq(skipped).length}):\n` + uniq(skipped).join('\n'));
}

// ---------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------

const strip = (o) => JSON.parse(JSON.stringify(o));
const ser = (list) =>
  '[\n' +
  list
    .map((w) => {
      const { variants, reference: ref, ...rest } = strip(w);
      return (
        `  {\n    ...${JSON.stringify(rest)},\n` +
        `    reference: [\n${ref.map((r) => `      ${JSON.stringify(r)},`).join('\n')}\n    ],\n` +
        `    variants: [\n${variants.map((x) => `      ${JSON.stringify(x)},`).join('\n')}\n    ],\n  },`
      );
    })
    .join('\n') +
  '\n]';

const out = `// PLIK GENEROWANY – nie edytuj ręcznie. Źródło: data/rigips-systemy.json (rigips.pl, pobrano ${data.fetched}).
// Generator: node scripts/gen-rigips.mjs
import type { CeilingSystem, WallSystem } from './rigips';

/** Ściany, okładziny i obudowy szachtów Rigips z kart systemów (odmiany w \`variants\`) */
export const RIGIPS_WALLS: WallSystem[] = ${ser(walls)};

/** Sufity podwieszane, okładziny sufitów i poddasza Rigips na profilach CD 60 z kart systemów */
export const RIGIPS_CEILINGS: CeilingSystem[] = ${ser(ceilings)};

/** Systemy ze strony Rigips, których aplikacja jeszcze nie liczy (inna konstrukcja) */
export const RIGIPS_SKIPPED: string[] = ${JSON.stringify(uniq(skipped), null, 2)};
`;
const file = path.join(root, 'src/catalog/rigips.gen.ts');
fs.writeFileSync(file, out);
console.log(`${walls.length} konstrukcji ścian (${walls.reduce((a, w) => a + w.variants.length, 0)} odmian), ${ceilings.length} sufitów (${ceilings.reduce((a, w) => a + w.variants.length, 0)} odmian), pominięte: ${uniq(skipped).length}, ${(out.length / 1024).toFixed(0)} kB → ${path.relative(root, file)}`);
