// Generator src/catalog/hat.gen.ts – okładziny ścian i sufitów na profilach kapeluszowych 15/48 (bez uchwytów, bez UD),
// kołkowanych wprost do podłoża. Dane z tych samych plików co pozostałe generatory:
//   Rigips  – data/rigips-systemy.json (3.21.30, 3.29.20, 4.05.21; rozstawy z kart PDF 3.21.30 i 4.05.21),
//   Norgips – data/norgips/norgips.txt (wiersze KAP grup OS i OSF; opis konstrukcji i kalkulator ze stron systemów),
//   Siniat  – data/siniat/02_kotwione.json i 06_sufity.json (karty „Nida PK48”).
// Knauf Polska nie ma okładzin na profilach kapeluszowych (Systemfinder: W611/W623/W625/W626, D11x, D612).
// Uruchomienie: node scripts/gen-hat.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ?? path.join(root, 'src/catalog/hat.gen.ts');
const num = (s) => {
  if (s == null) return undefined;
  const m = String(s).replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));
const pl = (x) => String(x).replace('.', ',');
const ei = (s) => {
  const all = [...String(s ?? '').matchAll(/EI\s*(\d+)/g)].map((m) => Number(m[1]));
  return all.length ? Math.max(...all) : undefined;
};
const fireTxt = (vs) => {
  const f = [...new Set(vs.map((v) => v.fire).filter(Boolean))].sort((a, b) => a - b);
  return f.length ? (f.length === 1 ? `EI ${f[0]}` : `EI ${f[0]} – EI ${f[f.length - 1]}`) : undefined;
};

const walls = [];
const ceilings = [];

// ---------------------------------------------------------------------------
// Rigips
// ---------------------------------------------------------------------------
const rg = JSON.parse(fs.readFileSync(path.join(root, 'data/rigips-systemy.json'), 'utf8'));
const rsys = (code) => rg.systems.find((s) => s.list[0] === code);
const RB = { A: 'RB12.5', H2: 'RBI12.5', F: 'RF12.5', DF: 'RFP12.5', DFH2: 'RFI12.5', DF15: 'RFP15', DFH215: 'RFI15' };
// odmiany 3.21.30 i 3.29.20 (te same poszycia, kolejność wierszy jak na stronie): warstwy, płyty
const WALL_VARS = {
  '_01': { layers: 1, boards: ['A', 'H2', 'F', 'DF', 'DFH2'] },
  '_02': { layers: 1, boards: ['F', 'DFH2'] },
  '_03': { layers: 2, boards: ['F', 'DFH2'] },
  '_04': { layers: 2, boards: ['DF15', 'DFH215'] },
  '_05': { layers: 3, boards: ['F', 'DFH2'] },
  '_06': { layers: 4, boards: ['DF', 'DFH2'], inner: ['DF15'] },
  '_07': { layers: 2, boards: ['A', 'H2'] },
};
const R_NAME = { A: 'PRO typ A', H2: 'PRO Hydro H2', F: 'PRO Fire F', DF: 'PRO Fire+ DF', DFH2: 'PRO Fire+ Hydro DFH2', DF15: 'PRO Fire+ DF 15', DFH215: 'PRO Fire+ Hydro DFH2 15' };
// zużycie wkrętów i masy z karty 3.21.30 (kolumny 1×12,5 / 2×12,5 / 2×15 + 2×12,5), szt./m²
const tn = (len, qty) => ({ product: `TN${len}`, label: `Wkręt TN 3,5×${len}`, qty, unit: 'szt.' });
const R_SCREWS = { 1: [tn(25, 12)], 2: [tn(25, 5), tn(35, 12)], 3: [{ label: 'Wkręty zewn. warstwy', qty: 12, unit: 'szt.' }], 4: [tn(25, 5), tn(45, 5), tn(55, 5), tn(70, 12)] };
const R_MASA = { 1: 0.25, 2: 0.5, 4: 1 };
const thkLabel = (layers, b, inner) => (inner ? `2×15 + 2×12,5` : `${layers}×${/15$/.test(b) ? '15' : '12,5'}`);

function rigipsWalls(code, { id, title, anchor, info, url }) {
  const s = rsys(code);
  const byLayers = new Map();
  for (const v of s.vars) {
    const key = v.title.slice(-3);
    const def = WALL_VARS[key];
    for (const b of def.boards) {
      const vv = clean({
        code,
        label: `${thkLabel(def.layers, b, def.inner)} ${R_NAME[b]}${def.inner ? ' (2 wewnętrzne warstwy Fire+ DF 15)' : ''}`,
        board: RB[b],
        innerBoards: def.inner?.map((x) => RB[x]),
        fire: ei(v.cells[5]),
        thickness: num(v.cells[2]),
        mass: num(v.cells[3]),
      });
      if (!byLayers.has(def.layers)) byLayers.set(def.layers, []);
      // ta sama płyta z dwóch wierszy (np. Fire w _01 i _02) – zostaje wiersz z klasą EI
      const list = byLayers.get(def.layers);
      const same = list.findIndex((x) => x.board === vv.board && x.thickness === vv.thickness);
      if (same < 0) list.push(vv);
      else if ((vv.fire ?? 0) > (list[same].fire ?? 0)) list[same] = vv;
    }
  }
  for (const [layers, vs] of [...byLayers.entries()].sort((a, b) => a[0] - b[0])) {
    const def = vs.find((v) => v.board === 'RB12.5') ?? vs[0];
    walls.push(clean({
      id: `${id}-${layers}`,
      code,
      name: `Okładzina ściany na profilach kapeluszowych ${title}, ${layers === 4 ? '2×15 + 2×12,5' : `${layers}×12,5`}`,
      category: 'okładzina',
      frame: 'hat-lining',
      profile: 50,
      layers,
      sides: 1,
      defaultBoard: def.board,
      innerBoard: layers === 4 ? 'RFP15' : undefined,
      innerLayers: layers === 4 ? 2 : undefined,
      studSpacing: 60,
      bracketSpacing: 100,
      anchor,
      insulationDefault: false,
      fire: fireTxt(vs),
      info,
      source: { label: `Rigips ${code} – strona systemu i kalkulator zużycia${code === '3.21.30' ? ', karta systemu (PDF)' : ''}`, url },
      reference: [
        { label: 'Płyta', qty: layers, unit: 'm²' },
        { product: 'KAPELUSZ', label: 'Profil kapeluszowy 15/48 (przy poziomym układzie co 50 cm)', qty: 2.1, unit: 'mb' },
        anchor === 'WKRET_DREWNO' ? { product: 'WKRET_DREWNO', label: 'Wkręt do drewna', qty: 5, unit: 'szt.' } : { product: 'KOLEK', label: 'Kołki rozporowe max. co 1000 mm', qty: 5, unit: 'szt.' },
        // wkręty TN z karty 3.21.30 (3.29.20: wkręty HartFix / Habito – inne niż liczy aplikacja dla płyt PRO)
        ...(anchor === 'KOLEK' ? R_SCREWS[layers] : [{ label: 'Wkręty zewn. warstwy', qty: 12, unit: 'szt.' }]),
        ...(R_MASA[layers] ? [{ product: 'MASA', label: 'Masa konstrukcyjna', qty: R_MASA[layers], unit: 'kg' }] : []),
        { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.4, unit: 'mb' },
      ],
      variants: vs,
    }));
  }
}
rigipsWalls('3.21.30', {
  id: 'R-HAT-W',
  title: '(do muru i betonu)',
  anchor: 'KOLEK',
  url: 'https://www.rigips.pl/system/okladziny-scienne/3_21_30',
  info: 'Profile kapeluszowe 15/48 pionowo co max. 60 cm (poziomo co 50 cm), kołki rozporowe max. co 100 cm · bez UD i bez uchwytów – płyta 15 mm od ściany · wysokość bez ograniczeń · ściana musi być równa (profil nie ma regulacji)',
});
rigipsWalls('3.29.20', {
  id: 'R-HAT-WD',
  title: 'do konstrukcji drewnianej',
  anchor: 'WKRET_DREWNO',
  url: 'https://www.rigips.pl/system/okladziny-scienne/3_29_20',
  info: 'Profile kapeluszowe 15/48 przykręcone wkrętami do drewna (kalkulator Rigips: 5 szt./m²) · strona nie podaje rozstawów – przyjęto jak w 3.21.30: profile pionowo co 60 cm, mocowanie max. co 100 cm · wysokość bez ograniczeń',
});

{
  const s = rsys('4.05.21');
  for (const heavy of [false, true]) {
    for (const layers of [1, 2]) {
      const v = s.vars.find((x) => num(x.cells[0].match(/gr\. (\d)/)?.[1]) === layers && /50 kg/.test(x.cells[0]) === heavy);
      const vs = ['A', 'H2', 'F', 'DF', 'DFH2'].map((b) =>
        clean({ code: '4.05.21', label: `${layers}×12,5 ${R_NAME[b]}${heavy ? ' · całkowita masa ≤ 50 kg/m²' : ' · masa ≤ 30 kg/m²'}`, board: RB[b], rw: num(v.cells[4]), thickness: num(v.cells[1]), mass: num(v.cells[2]) }),
      );
      ceilings.push(clean({
        id: `R-HAT-S-${layers}${heavy ? '-50' : ''}`,
        code: '4.05.21',
        name: `Okładzina sufitu na profilach kapeluszowych, ${layers}×12,5${heavy ? ' – z obciążeniem dodatkowym (do 50 kg/m²)' : ''}`,
        kind: 'direct',
        hangerType: 'hat',
        layers,
        defaultBoard: 'RB12.5',
        mainSpacing: 50,
        secondarySpacing: 50,
        hangerSpacing: heavy ? 75 : 100,
        screwsOuter: 17,
        screwsInner: 6.5,
        info: `Profile kapeluszowe co max. 50 cm (płyty w poprzek profili; wzdłuż – co 40 cm), stalowe elementy mocujące max. co ${heavy ? 75 : 100} cm ${heavy ? '(z obciążeniem dodatkowym, całkowita masa ≤ 50 kg/m²)' : '(całkowita masa ≤ 30 kg/m²)'} · bez wieszaków i bez UD – płyty 15 mm pod stropem · strop musi być równy`,
        source: { label: 'Rigips 4.05.21 – karta systemu (PDF) i kalkulator zużycia', url: 'https://www.rigips.pl/system/okladziny-sufitowe/4_05_21' },
        reference: [
          { label: 'Płyta', qty: layers, unit: 'm²' },
          { product: 'KAPELUSZ', label: 'Profil kapeluszowy', qty: 2.5, unit: 'mb' },
          { product: 'KOTWA', label: 'Stalowe elementy mocujące (dybel sufitowy 6×40)', qty: 6, unit: 'szt.' },
          { label: 'Wkręty zewn. warstwy', qty: 17, unit: 'szt.' },
          { product: 'TASMA_SPOIN', label: 'Taśma spoinowa', qty: 1.2, unit: 'mb' },
        ],
        variants: vs,
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Norgips (wiersze KAP z tabel OS i OSF)
// ---------------------------------------------------------------------------
const ng = {};
{
  let cur;
  for (const line of fs.readFileSync(path.join(root, 'data/norgips/norgips.txt'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) cur = ng[line.match(/^#(\d+)/)[1]] = [];
    else cur.push(line.split('|'));
  }
}
const NB = { B: 'GKB (A)', I: 'GKBI (H2)', F: 'GKF (DF)', FI: 'GKFI (DFH2)', AC: 'Acoustic Comfort (A)', AS: 'Acoustic Super (DFH2IRE)' };
const NID = { B: 'GKB', I: 'GKBI', F: 'GKF', FI: 'GKFI', AC: 'AC', AS: 'AS' };
const ngBoard = (code, thk) => {
  const last = code.split('+').at(-1);
  const t = /^9,5/.test(thk) ? 9.5 : /(^|x)15$/.test(thk) || (/15/.test(thk) && !/12,5/.test(thk)) ? 15 : 12.5;
  return `NG-${NID[last]}${t}`;
};
const ngInner = (code, thk) => {
  const parts = code.split('+');
  if (parts.length > 1) return [`NG-${NID[parts[0]]}12.5`];
  if (/15.*12,5/.test(thk)) return code === 'F' || code === 'FI' ? [`NG-${NID[code]}15`] : undefined;
  return undefined;
};
const ngLayers = (thk) => (thk.match(/(\d)x/g) ?? ['1x']).reduce((a, x) => a + Number(x[0]), 0) + (/\+\s*1x|^1x/.test(thk) ? 0 : 0);
const layTxt = (thk) => (thk.includes('x') ? thk : `1x${thk}`).replace(/x/g, '×').replace(/\+/g, ' + ');
const ngSrc = (kat, what) => ({ label: `Norgips – ${what} na profilach kapeluszowych (tabela systemów, opis konstrukcji i kalkulator zużycia)`, url: `https://norgips.pl/rozwiazania/${kat}/` });
const NG_SC = { 1: [[25, 12]], 2: [[25, 5], [35, 12]], 3: [[25, 5], [35, 5], [55, 12]], 4: [[25, 5], [45, 5], [55, 5], [70, 12]] };
for (const [gid, layers] of [[43, 1], [44, 2], [45, 3], [46, 4]]) {
  const rows = ng[gid].filter((r) => r[3] === 'KAP');
  const vs = rows.map(([b, , , , thk, wallThk, mass, e, dRw]) =>
    clean({
      label: `${layTxt(thk)} ${b.split('+').map((c) => NB[c]).join(' + ')} · profile kapeluszowe co 60 cm${dRw !== '-' ? ` · ΔRw ${dRw} dB` : ''}`,
      board: ngBoard(b, thk),
      innerBoards: ngInner(b, thk),
      fire: num(e) || undefined,
      thickness: num(wallThk),
      mass: num(mass),
    }),
  );
  const defaultBoard = layers <= 2 ? 'NG-GKB12.5' : 'NG-GKF12.5';
  walls.push(clean({
    id: `NG-OS-KAP-${layers}`,
    name: `Okładzina ścienna OS na profilach kapeluszowych, ${layers === 4 ? '2×15 + 2×12,5' : `${layers}×12,5`}`,
    category: 'okładzina',
    frame: 'hat-lining',
    profile: 50,
    layers,
    sides: 1,
    defaultBoard,
    innerBoard: layers === 4 ? 'NG-GKF15' : undefined,
    innerLayers: layers === 4 ? 2 : undefined,
    studSpacing: 60,
    bracketSpacing: 100,
    anchor: 'KOTWA',
    insulationDefault: false,
    fire: fireTxt(vs),
    info: 'Profile kapeluszowe pionowo co max. 60 cm, dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyta 15 mm od ściany · do 12 m wysokości · taśma uszczelniająca 75 mm opcjonalnie',
    source: ngSrc('okladziny-scienne', 'okładziny ścienne OS'),
    reference: [
      { label: 'Płyta g-k', qty: layers, unit: 'm²' },
      { product: 'KAPELUSZ', label: 'Profil kapeluszowy 0,6 mm', qty: 1.8, unit: 'mb' },
      { product: 'KOTWA', label: 'Kołki rozporowe / dyble 6×40', qty: 5, unit: 'szt.' },
      ...NG_SC[layers].map(([len, q]) => ({ product: `TN${len}`, label: `Blachowkręt 3,5×${len}`, qty: q, unit: 'szt.' })),
      { product: 'TASMA_SPOIN', label: 'Taśma zbrojąca', qty: 1.3, unit: 'mb' },
    ],
    maxHeight: { 60: 1200 },
    maker: 'norgips',
    variants: vs,
  }));
}
for (const [gid, layers] of [[38, 1], [39, 2], [40, 3], [41, 4]]) {
  const rows = ng[gid].filter((r) => r[3] === 'KAP');
  const at40 = (b, thk) => !(['B', 'I'].includes(b) && /(^|x)(9,5|12,5)$/.test(thk) && layers <= 2);
  const vs = rows.map(([b, , , , , thk, minThk, mass, e]) =>
    clean({
      label: `${layTxt(thk)} ${b.split('+').map((c) => NB[c]).join(' + ')} · profile kapeluszowe co ${at40(b, thk) ? 40 : 50} cm`,
      board: ngBoard(b, thk),
      innerBoards: ngInner(b, thk),
      fire: num(e) || undefined,
      thickness: num(minThk),
      mass: num(mass),
    }),
  );
  const sec = layers >= 3 ? 40 : 50;
  const scr = { 1: [25, 0], 2: [25, 10], 3: [25, 10], 4: [25, 10] }[layers];
  ceilings.push(clean({
    id: `NG-OSF-KAP-${layers}`,
    name: `Okładzina sufitowa OSF na profilach kapeluszowych, ${{ 1: '1×12,5', 2: '2×12,5', 3: '3×12,5 / 15 + 2×12,5', 4: '2×15 + 2×12,5' }[layers]}`,
    kind: 'direct',
    hangerType: 'hat',
    layers,
    defaultBoard: layers >= 3 ? 'NG-GKF12.5' : 'NG-GKB12.5',
    innerBoard: layers === 4 ? 'NG-GKF15' : undefined,
    innerLayers: layers === 4 ? 2 : undefined,
    mainSpacing: sec,
    secondarySpacing: sec,
    hangerSpacing: 100,
    screwsOuter: scr[0],
    screwsInner: scr[1],
    fire: fireTxt(vs),
    info: `Profile kapeluszowe co max. ${sec} cm (płyty ogniochronne co 40 cm), dyble stalowe min. ø6×40 w dwóch rzędach co 100 cm · bez UD i bez wieszaków – płyty 15 mm pod stropem · taśma uszczelniająca 30 mm opcjonalnie`,
    source: ngSrc('okladziny-sufitowe', 'okładziny sufitowe OSF'),
    reference: [
      { label: 'Płyta g-k', qty: layers, unit: 'm²' },
      { product: 'KAPELUSZ', label: 'Profil kapeluszowy 0,6 mm', qty: layers >= 3 ? 2.7 : 2.2, unit: 'mb' },
      { product: 'KOTWA', label: 'Dyble stalowe 6×40', qty: layers >= 3 ? 5 : 4, unit: 'szt.' },
      { product: 'TASMA_SPOIN', label: 'Taśma zbrojąca', qty: 1.3, unit: 'mb' },
    ],
    maker: 'norgips',
    variants: vs,
  }));
}

// ---------------------------------------------------------------------------
// Siniat (Nida PK48)
// ---------------------------------------------------------------------------
const sn = (f) => JSON.parse(fs.readFileSync(path.join(root, `data/siniat/${f}.json`), 'utf8')).filter((t) => /PK48/.test(t.title));
const SB = { Expert: 'EXP', Woda: 'WODA', 'Ogień Plus': 'OP', 'Woda Ogień Plus': 'WOP', 'Ogień Typ F': 'OTF', Cicha: 'CICHA', Twarda: 'TW', Hydro: 'HYDRO' };
const snLayers = (thk) => {
  const parts = thk.split('+').map((p) => (p.includes('x') ? p : `1x${p}`));
  return parts.map((p) => ({ n: Number(p.split('x')[0]), t: num(p.split('x')[1]) }));
};
const snBoard = (name, t) => `SN-${SB[name]}${pl(t).replace(',', '.').replace(/\.0$/, '')}`;
const snDesc = (ls) => ls.map(({ n, t }) => `${n}×${pl(t).replace(/,0$/, '')}`).join(' + ');
const SRC_SN = (ch, pages) => ({
  label: `Siniat – Katalog techniczny, ${ch === '02' ? 'rozdz. 2 Okładziny kotwione Nida Tynk' : 'rozdz. 6 Sufity podwieszane Nida Sufit'}, karty s. ${pages.join(', ')}`,
  url: 'https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue',
});
{
  const groups = new Map();
  for (const t of sn('02_kotwione'))
    for (const r of t.rows) {
      const [code, name, thk, , fix, sp, , , , mass, e] = r;
      const ls = snLayers(thk);
      const layers = ls.reduce((a, x) => a + x.n, 0);
      if (!groups.has(layers)) groups.set(layers, { pages: new Set(), vs: [] });
      const g = groups.get(layers);
      g.pages.add(t.page);
      const outer = ls.at(-1).t;
      const inner = ls.length > 1 ? [snBoard(name, ls[0].t)] : undefined;
      g.vs.push(clean({
        code: code.replace(/\s*\d\)$/, '').split('/')[0],
        label: `${snDesc(ls)} Nida ${name} · PK48 co ${num(sp) / 10} cm · elementy kotwiące co ${num(fix) / 10} cm`,
        board: snBoard(name, outer),
        innerBoards: inner,
        fire: ei(e),
        mass: num(mass),
      }));
    }
  for (const [layers, g] of groups) {
    const def = g.vs.find((v) => /SN-EXP/.test(v.board) && !v.innerBoards) ?? g.vs.find((v) => /SN-OP12/.test(v.board) && !v.innerBoards) ?? g.vs[0];
    walls.push(clean({
      id: `SN-O-PK48-${layers}`,
      name: `Nida Tynk – okładzina kotwiona na profilach kapeluszowych PK48, ${layers}×${def.board.endsWith('15') ? '15' : '12,5'}`,
      category: 'okładzina',
      frame: 'hat-lining',
      profile: 50,
      layers,
      sides: 1,
      defaultBoard: def.board,
      studSpacing: 60,
      bracketSpacing: 100,
      anchor: 'KOLEK',
      insulationDefault: false,
      fire: fireTxt(g.vs),
      info: 'Profile PK48 pionowo co 60 cm, elementy kotwiące co 100 cm (płyty Ogień typ F i 12,5 + 15 – co 125 cm) · bez UD – płyta 15 mm od ściany · wysokość bez ograniczeń · PK48 liczony jako profil kapeluszowy 15/48',
      source: SRC_SN('02', [...g.pages].sort((a, b) => a - b)),
      reference: [
        { label: 'Płyta', qty: layers, unit: 'm²' },
        { product: 'KAPELUSZ', label: 'Profil Nida PK48', qty: 1.8, unit: 'mb' },
        { product: 'KOLEK', label: 'Element kotwiący', qty: 3.8, unit: 'szt.' },
        { label: 'Blachowkręty zewn. warstwy', qty: 12, unit: 'szt.' },
        { product: 'TASMA_SPOIN', label: 'Taśma zbrojąca Nida', qty: 1.4, unit: 'mb' },
      ],
      maker: 'siniat',
      variants: g.vs,
    }));
  }
}
{
  // sufity: osobna pozycja dla każdego rozstawu elementów kotwiących (zależy od poszycia)
  const groups = new Map();
  for (const t of sn('06_sufity'))
    for (const r of t.rows) {
      const [code, , sp, fix, name, thk, minThk, mass, e, rw] = r;
      const ls = snLayers(thk);
      const layers = ls.reduce((a, x) => a + x.n, 0);
      const fixCm = num(fix) / 10;
      const sec = /500/.test(sp) ? 50 : 40;
      const key = `${layers}|${fixCm}|${sec}`;
      if (!groups.has(key)) groups.set(key, { layers, fixCm, sec, pages: new Set(), vs: [] });
      const g = groups.get(key);
      g.pages.add(t.page);
      const inner = ls.length > 1 ? [snBoard(name, ls[0].t)] : undefined;
      g.innerN = ls.length > 1 ? ls[0].n : 0;
      g.vs.push(clean({
        code: code.replace(/\s*\d\)$/, '').split('/').slice(0, 2).join('/'),
        label: `${snDesc(ls)} Nida ${name} · PK48 co ${sp.replace('/', ' / ').replace(/00/g, '0').replace(/(\d+)0\b/g, '$1')} cm · kotwy co ${fixCm} cm`,
        board: snBoard(name, ls.at(-1).t),
        innerBoards: inner,
        fire: ei(e),
        rw: num(String(rw).split('/')[0]),
        thickness: num(minThk),
        mass: num(mass),
      }));
    }
  for (const g of [...groups.values()].sort((a, b) => a.layers - b.layers || b.fixCm - a.fixCm)) {
    const def = g.vs.find((v) => !v.innerBoards) ?? g.vs[0];
    const mixed = g.vs.every((v) => v.innerBoards);
    const ls = def.label.split(' Nida')[0];
    ceilings.push(clean({
      id: `SN-S-PK48-${g.layers}-${g.fixCm}`,
      name: `Nida Sufit – okładzina na profilach kapeluszowych PK48, ${ls}${g.sec === 50 ? ' (Expert, Woda)' : ' (Ogień Plus)'}`,
      kind: 'direct',
      hangerType: 'hat',
      layers: g.layers,
      defaultBoard: def.board,
      innerBoard: mixed ? def.innerBoards[0] : undefined,
      innerLayers: mixed ? g.innerN : undefined,
      mainSpacing: g.sec,
      secondarySpacing: g.sec,
      hangerSpacing: g.fixCm,
      screwsOuter: 18,
      screwsInner: 6,
      fire: fireTxt(g.vs),
      info: `Profile PK48 co ${g.sec === 50 ? '40–50' : '40'} cm, stalowe elementy kotwiące co ${g.fixCm} cm (kalkulator Siniat: 6 szt./m², aplikacja liczy wg rozstawu, w dwóch rzędach na półkach) · bez wieszaków i bez UD – płyty 15 mm pod stropem · PK48 liczony jako profil kapeluszowy 15/48`,
      source: SRC_SN('06', [...g.pages].sort((a, b) => a - b)),
      reference: [
        { label: 'Płyta', qty: g.layers, unit: 'm²' },
        { product: 'KAPELUSZ', label: 'Profil Nida PK48', qty: 2.5, unit: 'mb' },
        { product: 'KOTWA', label: 'Stalowy element kotwiący', qty: 6, unit: 'szt.' },
        { product: 'TASMA_SPOIN', label: 'Taśma zbrojąca Nida', qty: 1.4, unit: 'mb' },
      ],
      maker: 'siniat',
      variants: g.vs,
    }));
  }
}

// ---------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------
const ser = (list) => JSON.stringify(list, null, 2);
const out = `// PLIK GENEROWANY – nie edytuj ręcznie. Generator: node scripts/gen-hat.mjs
// Okładziny ścian i sufitów na profilach kapeluszowych 15/48 (Siniat PK48) mocowanych wprost do podłoża:
// Rigips 3.21.30, 3.29.20, 4.05.21 · Norgips OS i OSF „KAP” · Siniat Nida Tynk PK48 i Nida Sufit PK48.
// Kołki / dyble w dwóch rzędach (na obu półkach profilu) – \`bracketSpacing\` / \`hangerSpacing\` to rozstaw w jednym rzędzie.
// Knauf Polska nie ma takich systemów.
import type { CeilingSystem, WallSystem } from './rigips';

/** Okładziny ścian na profilach kapeluszowych (frame 'hat-lining') */
export const HAT_WALL_SYSTEMS: WallSystem[] = ${ser(walls)};

/** Okładziny sufitów na profilach kapeluszowych (kind 'direct', hangerType 'hat') */
export const HAT_CEILING_SYSTEMS: CeilingSystem[] = ${ser(ceilings)};
`;
fs.writeFileSync(OUT, out);
console.log(`${walls.length} okładzin ścian, ${ceilings.length} okładzin sufitów, ${[...walls, ...ceilings].reduce((a, s) => a + s.variants.length, 0)} odmian → ${path.relative(root, OUT)}`);
