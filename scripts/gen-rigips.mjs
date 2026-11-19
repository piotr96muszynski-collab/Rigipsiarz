// Generator katalogu Rigips: data/rigips-systemy.json (dane zebrane ze strony rigips.pl)
// → src/catalog/rigips.gen.ts. Uruchomienie: node scripts/gen-rigips.mjs [--debug]
//
// Jedna pozycja katalogu = jedna konstrukcja (ruszt × profil × układ warstw × rodzaj płyty).
// Numery systemów Rigips różniące się tylko płytą albo zagęszczeniem słupków trafiają do `variants`.
// Wartości (wysokość, EI, akustyka, zużycie) są przepisywane z danych – nic nie jest szacowane.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardClass, cell, clean, dB, fireMin, fmtTh, heightCm, matName, num, parseLabel, woolMm } from './rigips-parse.mjs';

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
    codes.length > 1 ? `systemy Rigips ${codes.join(', ')}` : undefined,
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
  console.log(`\nPominięte (${skipped.length}):\n` + uniq(skipped).join('\n'));
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
import type { WallSystem } from './rigips';

/** Ściany, okładziny i obudowy szachtów Rigips z kart systemów (odmiany w \`variants\`) */
export const RIGIPS_WALLS: WallSystem[] = ${ser(walls)};

/** Systemy ze strony Rigips, których aplikacja jeszcze nie liczy (inna konstrukcja) */
export const RIGIPS_SKIPPED: string[] = ${JSON.stringify(uniq(skipped), null, 2)};
`;
const file = path.join(root, 'src/catalog/rigips.gen.ts');
fs.writeFileSync(file, out);
console.log(`${walls.length} konstrukcji ścian (${walls.reduce((a, w) => a + w.variants.length, 0)} odmian), pominięte: ${uniq(skipped).length}, ${(out.length / 1024).toFixed(0)} kB → ${path.relative(root, file)}`);
