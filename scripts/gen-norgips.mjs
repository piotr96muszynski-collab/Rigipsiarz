// Generator src/catalog/norgips.ts z tabel norgips.pl (norgips.txt) i zużycia z kalkulatora Norgips.
import fs from 'node:fs';
// Uruchomienie: node scripts/gen-norgips.mjs   (dane: data/norgips/norgips.txt, header.ts, drop.json)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCR = path.join(root, 'data/norgips');
const OUT = process.argv[2] ?? path.join(root, 'src/catalog/norgips.ts');
const drop = fs.existsSync(`${SCR}/drop.json`) ? JSON.parse(fs.readFileSync(`${SCR}/drop.json`, 'utf8')) : {};
const noRef = new Set(drop.__noRef ?? []);

// ---- parse
const groups = {};
let cur;
for (const line of fs.readFileSync(`${SCR}/norgips.txt`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (line.startsWith('#')) {
    const m = line.match(/^#(\d+) (\S+) tails=(.*)$/);
    cur = groups[m[1]] = { cat: m[2], tails: JSON.parse(m[3]), rows: [] };
  } else cur.rows.push(line.split('|'));
}

const num = (s) => {
  if (s == null || s === '-' || s === '') return undefined;
  const m = String(s).replace(',', '.').match(/[\d.]+/);
  return m ? Number(m[0]) : undefined;
};
const BNAME = { B: 'GKB (A)', I: 'GKBI (H2)', F: 'GKF (DF)', FI: 'GKFI (DFH2)', AC: 'Acoustic Comfort (A)', AS: 'Acoustic Super (DFH2IRE)', N: 'Norflex (A)' };
const BID = { B: 'GKB', I: 'GKBI', F: 'GKF', FI: 'GKFI', AC: 'AC', AS: 'AS', N: 'NORFLEX' };
const boardId = (code, thkStr) => {
  const first = code.split('+')[0];
  const t = /(^|x|\+)15/.test(thkStr) && !/12,5/.test(thkStr) ? 15 : /^9,5/.test(thkStr) ? 9.5 : first === 'N' ? 6.5 : 12.5;
  return `NG-${BID[first]}${t}`;
};
const layersTxt = (thk) => (thk.includes('x') ? thk : `1x${thk}`).replace(/x/g, '×').replace(/\+/g, ' + ');
const boardsTxt = (code) => code.split('+').map((c) => BNAME[c]).join(' + ');

// ---- płyty
const BOARDS = [
  ['GKB9.5', 'Norgips S GKB 9,5 (typ A)', 'GKB 9,5', 'A (GKB)', 9.5, [200, 260], 'Płyta standardowa 9,5 mm – sufity i okładziny', '#ece8de'],
  ['GKB12.5', 'Norgips S GKB 12,5 (typ A)', 'GKB', 'A (GKB)', 12.5, [200, 250, 260, 270, 300], 'Płyta standardowa do pomieszczeń suchych', '#e8e4da'],
  ['GKBI12.5', 'Norgips S GKBI 12,5 (typ H2)', 'GKBI', 'H2 (GKBI)', 12.5, [200, 260, 300], 'Płyta impregnowana do łazienek i kuchni', '#b9d8b0', 'humid'],
  ['GKF12.5', 'Norgips S GKF 12,5 (typ DF)', 'GKF', 'DF (GKF)', 12.5, [200, 260, 300], 'Płyta o zwiększonej odporności ogniowej', '#f2b8b0'],
  ['GKF15', 'Norgips S GKF 15 (typ DF)', 'GKF 15', 'DF (GKF)', 15, [200, 260], 'Płyta ogniochronna 15 mm do przegród o wyższej klasie EI', '#eaa79e'],
  ['GKFI12.5', 'Norgips S GKFI 12,5 (typ DFH2)', 'GKFI', 'DFH2 (GKFI)', 12.5, [260], 'Płyta ogniochronna i impregnowana', '#e6c9a8', 'humid'],
  ['GKFI15', 'Norgips S GKFI 15 (typ DFH2)', 'GKFI 15', 'DFH2 (GKFI)', 15, [260], 'Płyta ogniochronna i impregnowana 15 mm', '#dcbd99', 'humid'],
  ['AC12.5', 'Norgips Acoustic Comfort 12,5 (typ A)', 'Ac. Comfort', 'A', 12.5, [260], 'Płyta o podwyższonej izolacyjności akustycznej', '#d8d0e8'],
  ['AS12.5', 'Norgips Acoustic Super 12,5 (typ DFH2IRE)', 'Ac. Super', 'DFH2IRE', 12.5, [200, 260], 'Płyta akustyczna, ogniochronna, impregnowana i o zwiększonej twardości', '#c4b8de', 'humid'],
  ['NORFLEX6.5', 'Norgips Norflex 6,5 (typ A, giętka)', 'Norflex', 'A', 6.5, [260], 'Płyta giętka 6,5 mm do ścian i sufitów łukowych', '#efe6cf'],
].map(([id, name, short, type, thickness, lengths, description, color, moisture]) => ({
  id: `NG-${id}`, name, short, type, thickness, width: 120, lengths, description, color, maker: 'norgips', ...(moisture ? { moisture } : {}),
}));
const boardIds = new Set(BOARDS.map((b) => b.id));

const CAT_LABEL = {
  'sciany-dzialowe': 'Ściany działowe',
  'sciany-wysokie': 'Ściany wysokie',
  'sciany-oslonowe': 'Ściany osłonowe (szachty)',
  'sufity-podwieszane': 'Sufity podwieszane',
  'okladziny-sufitowe': 'Okładziny sufitowe',
  'zabudowa-poddasza': 'Zabudowa poddasza',
  'suchy-tynk': 'Suchy tynk',
  'okladziny-scienne': 'Okładziny ścienne',
};
const src = (cat) => `src('${cat}')`; // wstawiane do TS bez cudzysłowów

// ---- odmiany ścian
const clean = (v) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && !Number.isNaN(x)));
function wallVariant(r, { spacingCol = false, szacht = false, extra = '' } = {}) {
  // board|std|ti|profile|[spacing]|thk|wallThk|mass|EI|woolEI|Rw|RA1|woolRw|maxH
  // szacht: board|std|ti|profile|thk|wallThk|mass|EI|woolEI|Rw|RA1|ΔRw|woolRw|maxH
  let [b, , , profile, ...rest] = r;
  let spacing;
  if (spacingCol) spacing = rest.shift();
  const [thk, wallThk, mass, ei, woolEI, rw, ra1, x1, x2, x3] = rest;
  const woolRw = szacht ? x2 : x1;
  const maxH = szacht ? x3 : x2;
  const dbl = /\+CW/.test(profile) || (szacht && profile.startsWith('2x'));
  const sp = num(spacing);
  const woolVals = [num(woolEI), num(woolRw)].filter((x) => x !== undefined);
  const wool = woolVals.length ? Math.max(...woolVals) : undefined;
  const parts = [`${layersTxt(thk)} ${boardsTxt(b)}`];
  if (dbl) parts.push('słupki podwójne');
  if (sp) parts.push(`słupki co ${sp / 10} cm`);
  if (szacht && x1 && x1 !== '-') parts.push(`ΔRw ${x1.replace('do', 'do ')} dB`);
  if (wool === 0) parts.push('bez wełny');
  else if (wool) parts.push(`wełna ${wool} mm`);
  if (/^do/.test(wallThk)) parts.push(`grubość do ${num(wallThk)} mm`);
  if (extra) parts.push(extra);
  return clean({
    label: parts.join(' · '),
    board: boardId(b, thk),
    studSpacing: sp ? sp / 10 : undefined,
    doubleStuds: dbl || undefined,
    maxHeight: num(maxH) !== undefined ? Math.round(num(maxH) * 100) : undefined,
    fire: num(ei) || undefined,
    rw: num(rw),
    ra1: num(ra1),
    wool,
    thickness: num(wallThk),
    mass: num(mass),
  });
}
const profIdx = (g, profile) => ({ 50: 0, 75: 1, 100: 2 })[profile];
const rowsFor = (gid, prof, opt = {}) =>
  groups[gid].rows.filter((r) => num(r[3].replace(/^2x/, '')) === prof || (opt.any && true)).map((r) => wallVariant(r, opt));

// ---- zużycie z kalkulatora Norgips (na 1 m², do Q1)
const L = (product, label, qty, unit) => ({ product, label, qty, unit });
const TU = { 50: 'TASMA_USZ50', 75: 'TASMA_USZ70', 100: 'TASMA_USZ95' };
const plate = (m2) => ({ label: 'Płyta g-k', qty: m2, unit: 'm²' });
const screws = (spec) => spec.map(([len, q, note]) => L(`TN${len}`, `Wkręt 3,5×${len}${note ? ` (${note})` : ''}`, q, 'szt.'));
function wallRef(kind, p, layers) {
  const cw = (q) => L(`CW${p}`, `Profil CW ${p}`, q, 'mb');
  const uw = (q) => L(`UW${p}`, `Profil UW ${p}`, q, 'mb');
  const tu = (q) => L(TU[p], `Taśma uszczelniająca ${p === 50 ? 50 : p === 75 ? 75 : 100} mm`, q, 'mb');
  const kol = (q) => L('KOLEK', 'Kołki szybkiego montażu', q, 'szt.');
  const masa = (q) => L('MASA', 'Masa szpachlowa (Start / Start & Finish)', q, 'kg');
  const spoin = (q) => L('TASMA_SPOIN', 'Taśma zbrojąca', q, 'mb');
  const wool = (q) => L(`WELNA${p}`, 'Wełna mineralna', q, 'm²');
  const sc1 = { 1: [[25, 24]], 2: [[25, 10, '1. warstwa'], [35, 24, '2. warstwa']], 3: [[25, 10, '1. warstwa'], [35, 18, '2. warstwa'], [55, 24, '3. warstwa']] };
  switch (kind) {
    case 'SD':
      return [plate(2 * layers), cw(1.8), uw(0.8), tu(1.2), ...screws(sc1[layers]), kol(1.5), wool(1), masa(Math.round(4 * layers) / 10), spoin(2.6)];
    case 'SDM': {
      const tape = p === 50 ? [tu(3.6)] : [tu(2.4), L('TASMA_USZ50', 'Taśma uszczelniająca 50 mm (między rusztami)', 1.2, 'mb')];
      return [plate(2 * layers), L(`CW${p}`, `Profil CW ${p}`, 3.6, 'mb'), uw(1.6), ...tape, ...screws(sc1[layers]), kol(3), wool(2), masa(Math.round(4 * layers) / 10)];
    }
    case 'SDMAS':
      return [plate(5), cw(3.6), uw(1.6), tu(2.4), ...screws([[25, 22, '1. warstwa i płyta środkowa'], [35, 24, '2. warstwa']]), kol(3), wool(2)];
    case 'SDI': {
      const sc = layers === 2 ? [[25, 18, '1. warstwa i paski'], [35, 24, '2. warstwa']] : [[25, 18, '1. warstwa i paski'], [35, 18, '2. warstwa'], [55, 24, '3. warstwa']];
      return [plate(layers === 2 ? 4.1 : 6.1), cw(3.6), uw(1.6), tu(2.4), ...screws(sc), kol(3), wool(1), masa(Math.round(4 * layers) / 10)];
    }
    case 'SO': {
      const sc = { 1: [[25, 12]], 2: [[25, 5, '1. warstwa'], [35, 12, '2. warstwa']], 3: [[25, 5, '1. warstwa'], [35, 5, '2. warstwa'], [55, 12, '3. warstwa']], 4: [[25, 5, '1. warstwa'], [55, 5, 'warstwy wewnętrzne'], [70, 12, '4. warstwa']] }[layers];
      return [plate(layers), cw(1.8), uw(0.8), tu(1.2), ...screws(sc), kol(1.5), masa(Math.round(2 * layers) / 10), spoin(1.3)];
    }
    case 'OS': {
      const sc = { 1: [[25, 12]], 2: [[25, 5, '1. warstwa'], [35, 12, '2. warstwa']], 3: [[25, 5, '1. warstwa'], [35, 5, '2. warstwa'], [55, 12, '3. warstwa']], 4: [[25, 5, '1. warstwa'], [35, 5, '2. warstwa'], [55, 5, '3. warstwa'], [70, 12, '4. warstwa']] }[layers];
      return [
        plate(layers), L('CD60', 'Profil CD 60', 1.8, 'mb'), L('UD30', 'Profil UD 30', 0.8, 'mb'), L('WIESZAK_ES', 'Wieszak ES co 120 cm', 1.5, 'szt.'),
        L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', 0.5, 'szt.'), L('TASMA_USZ30', 'Taśma uszczelniająca 30 mm', 0.9, 'mb'), L('LN9', 'Blachowkręt 3,5×9,5', 12, 'szt.'),
        ...screws(sc), kol(4), masa(Math.round(2 * layers) / 10),
      ];
    }
  }
}

function ceilRef(kind, layers, at40) {
  const masa = (q) => L('MASA', 'Masa szpachlowa (Start / Start & Finish)', q, 'kg');
  const sc = {
    1: [[25, 25]],
    2: [[25, 10, '1. warstwa'], [35, 25, '2. warstwa']],
    3: [[25, 10, '1. warstwa'], [35, 10, '2. warstwa'], [55, 25, '3. warstwa']],
    4: [[25, 10, '1. warstwa'], [45, 10, '2. warstwa'], [55, 10, '3. warstwa'], [70, 25, '4. warstwa']],
  }[layers];
  const tn = sc.map(([len, q, n]) => L(`TN${len}`, `Wkręt 3,5×${len}${n ? ` (${n})` : ''}`, q, 'szt.'));
  if (kind === 'SP') {
    const hang = layers >= 4 ? 1.8 : layers === 3 ? 1.5 : at40 ? 1.4 : 1.3;
    return [
      plate(layers), L('CD60', 'Profil CD 60', at40 ? 3.8 : 3.3, 'mb'), L('UD30', 'Profil UD 30', 0.8, 'mb'), L('TASMA_USZ30', 'Taśma uszczelniająca 30 mm', 0.8, 'mb'),
      L('LACZNIK_KRZ', 'Łącznik krzyżowy CD 60', at40 ? 2.8 : 2.5, 'szt.'), L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', at40 ? 0.7 : 0.6, 'szt.'),
      L('WIESZAK_NONIUSZ', 'Wieszak (noniuszowy / obrotowy ze sprężyną)', hang, 'szt.'), L('KOTWA', 'Dyble stalowe (wieszaki)', hang, 'szt.'),
      L('KOLEK', 'Kołki (UD 30)', 1.5, 'szt.'), ...tn, masa(Math.round(2 * layers) / 10), L('TASMA_SPOIN', 'Taśma zbrojąca', 1.3, 'mb'),
    ];
  }
  if (kind === 'SPJ') {
    const hang = layers >= 4 ? 1.8 : layers === 3 ? 1.8 : 1.3;
    return [
      plate(layers), L('CD60', 'Profil CD 60', at40 ? 3.6 : 3.1, 'mb'), L('LACZNIK_JEDNO', 'Łącznik poprzeczny jednostronny', at40 ? 5.5 : 5, 'szt.'),
      L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', 0.2, 'szt.'), L('WIESZAK_NONIUSZ', 'Wieszak (noniuszowy / obrotowy ze sprężyną)', hang, 'szt.'),
      L('KOTWA', 'Dyble stalowe (wieszaki)', hang, 'szt.'), L('LN9', 'Blachowkręt 3,5×9,5', 8, 'szt.'), ...tn, masa(Math.round(2 * layers) / 10),
    ];
  }
  if (kind === 'OSF') {
    const es = { 1: at40 ? 3.1 : 2.5, 2: at40 ? 3.1 : 2.5, 3: 3.8, 4: 4.4 }[layers];
    return [
      plate(layers), L('CD60', 'Profil CD 60', at40 ? 2.6 : 2.1, 'mb'), L('UD30', 'Profil UD 30', 0.9, 'mb'), L('WIESZAK_ES', 'Wieszak ES / ES Plus', es, 'szt.'),
      L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', at40 ? 0.6 : 0.5, 'szt.'), L('LN9', 'Blachowkręt 3,5×9,5', at40 ? 18 : 15, 'szt.'),
      L('KOLEK', 'Kołki (UD 30)', 2.5, 'szt.'), ...tn, masa(Math.round(2 * layers) / 10),
    ];
  }
  // zużycie z kalkulatora systemów „ZP … CD 60, L” i „ZP … KAP” (norgips.pl, 19.11.2026)
  if (kind === 'ZPL') {
    return [
      plate(layers), L('CD60', 'Profil CD 60', 2.5, 'mb'), L('UD30', 'Profil UD 30', 0.3, 'mb'), L('WIESZAK_PLASKI', 'Wieszak płaski L-180 / L-270 lub wieszak do poddaszy L-350', 3, 'szt.'),
      L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', 0.5, 'szt.'), { label: 'Profil uniwersalny FLEX', qty: 0.4, unit: 'mb' },
      L('LN9', 'Blachowkręt 3,5×9,5', 5, 'szt.'), L('WKRET_DREWNO', 'Wkręt do drewna 3,5×35', 6, 'szt.'), L('KOLEK', 'Kołki', 0.5, 'szt.'),
      { label: 'Folia paroizolacyjna', qty: 1, unit: 'm²' }, { label: 'Wełna mineralna między krokwiami', qty: 1, unit: 'm²' }, ...tn, masa(Math.round(2 * layers) / 10),
      L('TASMA_SPOIN', 'Taśma zbrojąca', 1.3, 'mb'),
    ];
  }
  if (kind === 'ZPK') {
    return [
      plate(layers), L('KAPELUSZ', 'Profil kapeluszowy', 2.5, 'mb'), { label: 'Profil uniwersalny FLEX', qty: 0.4, unit: 'mb' },
      L('WKRET_DREWNO', 'Wkręt do drewna 3,5×25', 8, 'szt.'),
      { label: 'Folia paroizolacyjna', qty: 1, unit: 'm²' }, { label: 'Wełna mineralna między krokwiami', qty: 1, unit: 'm²' }, ...tn, masa(layers === 1 ? 0.3 : 0.4),
      L('TASMA_SPOIN', 'Taśma zbrojąca', 1.3, 'mb'),
    ];
  }
  if (kind === 'ZP') {
    return [
      plate(layers), L('CD60', 'Profil CD 60', 2.5, 'mb'), L('UD30', 'Profil UD 30', 0.3, 'mb'), L('WIESZAK_ES', 'Wieszak ES / ES Plus', 3, 'szt.'),
      L('LACZNIK_WZDL', 'Łącznik wzdłużny CD 60', 0.5, 'szt.'), { label: 'Profil uniwersalny FLEX', qty: 0.4, unit: 'mb' },
      L('LN9', 'Blachowkręt 3,5×9,5', 20, 'szt.'), { label: 'Wkręt do drewna 3,5×35', qty: 6, unit: 'szt.' }, L('KOLEK', 'Kołki', 0.5, 'szt.'),
      { label: 'Folia paroizolacyjna', qty: 1, unit: 'm²' }, { label: 'Wełna mineralna między krokwiami', qty: 1, unit: 'm²' }, ...tn, masa(Math.round(2 * layers) / 10),
    ];
  }
}

const applyDrop = (id, ref) => {
  if (!ref || noRef.has(id)) return undefined;
  const d = new Set(drop[id] ?? []);
  return ref.map((r) => (r.product && d.has(r.product) ? { label: `${r.label} – aplikacja liczy wg geometrii / inaczej niż kalkulator`, qty: r.qty, unit: r.unit } : r));
};

const range = (vals, f) => {
  const v = [...new Set(vals.filter((x) => x))].sort((a, b) => a - b);
  if (!v.length) return undefined;
  return v.length === 1 ? f(v[0]) : `${f(v[0])} – ${f(v[v.length - 1])}`;
};
const fireTxt = (vs) => range(vs.map((v) => v.fire), (x) => `EI ${x}`);
const acTxt = (vs) => {
  const rw = vs.map((v) => v.rw).filter(Boolean);
  return rw.length ? `Rw do ${Math.max(...rw)} dB` : undefined;
};
const mFmt = (cm) => (cm / 100).toFixed(2).replace(/0$/, '').replace('.', ',');

// ---- ściany
const walls = [];
const W = (o) => walls.push(o);
function mkWall({ id, gid, extraG = [], profile, name, category, frame, layers, sides = 2, defaultBoard, studSpacing = 60, insulationDefault = true, info, basic, refKind, gap, bracketSpacing, variants, maxHeight, opt = {} }) {
  let vs = variants ?? groups[gid].rows.filter((r) => num(r[3].replace(/^2x/, '').replace(/\+CW.*/, '')) === profile).map((r) => wallVariant(r, opt));
  for (const [g, o] of extraG) vs = vs.concat(groups[g].rows.filter((r) => num(r[3].replace(/^2x/, '')) === profile).map((r) => wallVariant(r, o)));
  const def = vs.find((v) => v.board === defaultBoard && !v.doubleStuds && !v.studSpacing) ?? vs[0];
  const mh = maxHeight ?? (def?.maxHeight ? { [studSpacing]: def.maxHeight } : undefined);
  const ref = refKind ? applyDrop(id, wallRef(refKind, profile, layers)) : undefined;
  W(clean({
    id, name, category, frame, profile, layers, sides, defaultBoard, studSpacing, maxHeight: mh, insulationDefault,
    fire: fireTxt(vs), acoustic: acTxt(vs), bracketSpacing, gap, info, source: src(groups[gid].cat), reference: ref,
    maker: 'norgips', basic: basic || undefined, variants: vs,
  }));
}
const H = { sd: 'słupki CW co 60 cm w UW, wkręty w zewnętrznej warstwie co 25 cm' };
for (const p of [50, 75, 100]) {
  mkWall({ id: `NG-SD-CW${p}-1`, gid: 9, profile: p, name: `Ściana działowa SD CW ${p}, 1×12,5 obustronnie`, category: 'działowa', frame: 'single', layers: 1, defaultBoard: 'NG-GKB12.5', basic: p !== 100, refKind: 'SD',
    info: `Grubość ${p + 25} mm · ${H.sd} · odmiany bez wełny mają niższą klasę EI` });
  mkWall({ id: `NG-SD-CW${p}-2`, gid: 11, profile: p, name: `Ściana działowa SD CW ${p}, 2×12,5 obustronnie`, category: 'działowa', frame: 'single', layers: 2, defaultBoard: 'NG-GKB12.5', basic: p !== 50, refKind: 'SD',
    info: `Grubość ${p + 50} mm · ${H.sd}, w wewnętrznej co 75 cm` });
  mkWall({ id: `NG-SD-CW${p}-3`, gid: 13, extraG: p === 100 ? [[58, { spacingCol: true, extra: 'wg zestawienia ścian wysokich' }]] : [], profile: p, name: `Ściana działowa SD CW ${p}, 3×12,5 obustronnie`, category: 'działowa', frame: 'single', layers: 3, defaultBoard: 'NG-GKB12.5', refKind: 'SD',
    info: `Grubość ${p + 75} mm · ${H.sd} · wysoka klasa EI z płytami GKF` });
  mkWall({ id: `NG-SDM-2CW${p}-2`, gid: 15, extraG: p === 100 ? [[57, { spacingCol: true, extra: 'wg zestawienia ścian wysokich' }]] : [], profile: p, name: `Ściana międzylokalowa SD 2×CW ${p}, 2×12,5 obustronnie`, category: 'podwójna', frame: 'double', layers: 2, defaultBoard: 'NG-GKB12.5', basic: p === 75, refKind: 'SDM',
    info: `Grubość ${2 * p + 55} mm · dwa niezależne rzędy CW co 60 cm, wełna w obu · taśma uszczelniająca także między rusztami` });
  mkWall({ id: `NG-SDM-2CW${p}-3`, gid: 16, extraG: p !== 50 ? [[59, { spacingCol: true, extra: 'wg zestawienia ścian wysokich' }]] : [], profile: p, name: `Ściana międzylokalowa SD 2×CW ${p}, 3×12,5 obustronnie`, category: 'podwójna', frame: 'double', layers: 3, defaultBoard: 'NG-GKF12.5', refKind: 'SDM',
    info: `Grubość ${2 * p + 80} mm · dwa niezależne rzędy CW co 60 cm · EI do 180 min` });
  mkWall({ id: `NG-SDM-AS-2CW${p}`, gid: 68, profile: p, name: `Ściana międzylokalowa SDM 2×CW ${p}, 2×12,5 + płyta środkowa Acoustic Super`, category: 'podwójna', frame: 'double', layers: 2, defaultBoard: 'NG-GKB12.5', refKind: 'SDMAS',
    info: `Grubość ${2 * p + 67.5} mm · między rzędami CW płyta Acoustic Super 12,5 – aplikacja jej nie dolicza, dodaj ok. 1 m² płyty na m² ściany` });
  mkWall({ id: `NG-SDI-2CW${p}-2`, gid: 17, extraG: p !== 50 ? [[56, { spacingCol: true, extra: 'wg zestawienia ścian wysokich' }]] : [], profile: p, name: `Ściana instalacyjna SD 2×CW ${p} rozsunięte, 2×12,5`, category: 'instalacyjna', frame: 'separate', layers: 2, defaultBoard: 'NG-GKBI12.5', basic: p === 75, refKind: 'SDI', gap: 10,
    info: `Grubość do ${2 * p + 180} mm · rzędy CW co 60 cm łączone paskami płyty o wysokości min. 30 cm` });
  mkWall({ id: `NG-SDI-2CW${p}-3`, gid: 18, extraG: p !== 50 ? [[54, { spacingCol: true, extra: 'wg zestawienia ścian wysokich' }]] : [], profile: p, name: `Ściana instalacyjna SD 2×CW ${p} rozsunięte, 3×12,5`, category: 'instalacyjna', frame: 'separate', layers: 3, defaultBoard: 'NG-GKBI12.5', refKind: 'SDI', gap: 10,
    info: `Grubość do ${2 * p + 205} mm · rzędy CW co 60 cm łączone paskami płyty o wysokości min. 30 cm` });
}
for (const p of [50, 75]) {
  const vs = groups[19].rows.filter((r) => num(r[3]) === p).map((r) => wallVariant(r));
  mkWall({ id: `NG-SDK-CW${p}`, gid: 19, profile: p, variants: vs, name: `Ściana łukowa SDK CW ${p}, 2×Norflex 6,5 obustronnie`, category: 'działowa', frame: 'single', layers: 2, defaultBoard: 'NG-NORFLEX6.5', studSpacing: 40,
    maxHeight: { 40: vs[0].maxHeight }, info: 'Słupki CW co 40 cm, UW wyginane po łuku · aplikacja liczy ścianę jak prostą (kalkulator Norgips: CW 2,4 mb, UW 0,8 mb, wkręty 25 mm 34 szt. na m²)' });
}
{
  const v20 = groups[20].rows.map((r) => wallVariant(r, { spacingCol: true }));
  mkWall({ id: 'NG-SDW-CW100-2', gid: 20, profile: 100, variants: v20, name: 'Ściana wysoka SDW CW 100, 2×12,5 obustronnie, słupki co 30 cm', category: 'działowa', frame: 'single', layers: 2, defaultBoard: 'NG-GKF12.5', studSpacing: 30, insulationDefault: false,
    maxHeight: { 30: 900, 40: 770 }, info: 'Do 9 m przy CW co 30 cm (10 m przy podwójnych słupkach co 40 cm – aplikacja nie liczy słupków podwójnych) · kalkulator Norgips: CW 3,6 mb, wkręty 25 mm 20 i 35 mm 48 szt. na m²' });
  const v21 = groups[21].rows.map((r) => wallVariant(r, { spacingCol: true }));
  mkWall({ id: 'NG-SDW-CW100-3', gid: 21, profile: 100, variants: v21, name: 'Ściana wysoka SDW CW 100, 3×12,5 obustronnie, słupki co 30 cm', category: 'działowa', frame: 'single', layers: 3, defaultBoard: 'NG-GKF12.5', studSpacing: 30, insulationDefault: false,
    maxHeight: { 30: 900 }, info: 'Do 9–10 m przy CW co 30 cm (11 m przy podwójnych słupkach co 40 cm z 3×15) · EI 120' });
}
for (const [gid, layers] of [[26, 1], [27, 2], [28, 3], [29, 4]])
  for (const p of [50, 75, 100])
    mkWall({ id: `NG-SO-CW${p}-${layers}`, gid, profile: p, opt: { szacht: true }, name: `Ściana osłonowa SO CW ${p}, ${layers}×12,5 (szacht, jednostronna)`, category: 'szacht', frame: 'single', layers, sides: 1,
      defaultBoard: layers <= 2 ? 'NG-GKF12.5' : 'NG-GKF12.5', insulationDefault: false, basic: layers === 2 && p !== 100, refKind: 'SO',
      info: `Obudowa szachtu od strony pomieszczenia · CW co 60 cm · wełna opcjonalnie · wyżej: słupki podwójne (odmiany)` });
for (const [gid, layers] of [[43, 1], [44, 2], [45, 3], [46, 4]]) {
  const vs = groups[gid].rows.filter((r) => r[3] === 'CD60').map((r) => {
    const [b, , , , thk, range, mass, ei, dRw, maxH] = r;
    return clean({ label: `${layersTxt(thk)} ${boardsTxt(b)} · odstęp od ściany ${range.replace("-", "–")} mm${dRw !== '-' ? ` · ΔRw ${dRw.replace('do', 'do ')} dB` : ''}`, board: boardId(b, thk), maxHeight: num(maxH) * 100, fire: num(ei) || undefined, thickness: num(range), mass: num(mass) });
  });
  mkWall({ id: `NG-OS-CD-${layers}`, gid, profile: 50, variants: vs, name: `Okładzina ścienna OS na CD 60 i wieszakach ES, ${layers}×12,5`, category: 'okładzina', frame: 'cd-lining', layers, sides: 1,
    defaultBoard: layers <= 2 ? 'NG-GKB12.5' : 'NG-GKF12.5', insulationDefault: false, bracketSpacing: 120, basic: layers <= 2, refKind: 'OS', maxHeight: undefined,
    info: 'Profile CD 60 pionowo co 60 cm, wieszaki ES co 120 cm, UD 30 góra i dół · odmiany na profilach kapeluszowych (KAP) – osobne pozycje NG-OS-KAP' });
}
{
  const vs = groups[42].rows.map(([b, , , thk, minThk, mass, maxH]) => clean({ label: `${layersTxt(thk)} ${boardsTxt(b)} na klej`, board: boardId(b, thk), maxHeight: num(maxH) * 100, thickness: num(minThk), mass: num(mass) }));
  mkWall({ id: 'NG-ST-1', gid: 42, profile: 50, variants: vs, name: 'Suchy tynk ST – płyta klejona do ściany, 1×12,5', category: 'okładzina', frame: 'glued', layers: 1, sides: 1, defaultBoard: 'NG-GKB12.5', insulationDefault: false, basic: true,
    maxHeight: { 60: 300 }, info: 'Płyta na placki kleju gipsowego (kalkulator Norgips: 5–6 kg/m², aplikacja liczy 4 kg/m²) · do 3 m wysokości · tylko równe i nośne podłoże' });
}

// ---- sufity
const ceilings = [];
const HANG = { S: 'wieszak obrotowy ze sprężyną', ES: 'wieszak ES', N: 'wieszak noniuszowy', L: 'wieszak płaski L', 0: '' };
const at40 = (code, thk) => !(['B', 'I'].includes(code) && thk === '12,5');
// strony systemów ZP: płyty GKB i GKBI 12,5 mm (także 2×12,5) – profile co max 50 cm, pozostałe co 40 cm
const zp40 = (code, thk) => !(['B', 'I'].includes(code) && /12,5$/.test(thk));
function ceilVariant(r, zp = false) {
  const [b, , , prof, hanger, thk, minThk, mass, ei, fill] = r;
  const parts = [`${layersTxt(thk)} ${boardsTxt(b)}`];
  if (HANG[hanger]) parts.push(HANG[hanger]);
  parts.push(`${prof === 'KAP' ? 'profile kapeluszowe' : 'CD'} co ${(zp ? zp40(b, thk) : at40(b, thk)) ? 40 : 50} cm`);
  parts.push(`zabudowa ${minThk.includes('-') ? minThk.replace('-', '–') : `min. ${minThk}`} mm`);
  if (zp && fill && fill !== '-') parts.push(fill === 'PUR' ? 'izolacja z pianki PUR' : 'izolacja z wełny');
  return clean({ label: parts.join(' · '), board: boardId(b, thk), fire: num(ei) || undefined, thickness: num(minThk), mass: num(mass) });
}
function mkCeil({ id, gid, name, kind, layers, defaultBoard, mainSpacing, secondarySpacing, hangerSpacing, hangerType, screwsOuter = 25, screwsInner = 10, info, basic, refKind, filter = () => true, zp = false, atticFrame }) {
  const vs = groups[gid].rows.filter(filter).map((r) => ceilVariant(r, zp));
  const ref = applyDrop(id, ceilRef(refKind, layers, secondarySpacing === 40));
  ceilings.push(clean({
    id, name, kind, layers, defaultBoard, mainSpacing, secondarySpacing, hangerSpacing, hangerType, screwsOuter, screwsInner,
    fire: fireTxt(vs), info, source: src(groups[gid].cat), reference: ref, maker: 'norgips', attic: zp || undefined, atticFrame, basic: basic || undefined, variants: vs,
  }));
}
const LT = { 1: '1×12,5', 2: '2×12,5', 3: '3×12,5 / 15 + 2×12,5', 4: '2×15 + 2×12,5' };
for (const [gid, gidJ, layers] of [[30, 31, 1], [32, 33, 2], [34, 35, 3], [36, 37, 4]]) {
  const fireOnly = layers >= 3;
  const sec = fireOnly ? 40 : 50;
  const hSP = layers === 4 ? 60 : layers === 3 ? 70 : 85;
  const hSPJ = layers === 4 ? 50 : layers === 3 ? 50 : 70;
  mkCeil({ id: `NG-SP-${layers}`, gid, refKind: 'SP', name: `Sufit podwieszany SP CD 60 dwupoziomowy, ${LT[layers]}`, kind: 'two-level', layers, defaultBoard: fireOnly ? 'NG-GKF12.5' : 'NG-GKB12.5',
    mainSpacing: 100, secondarySpacing: sec, hangerSpacing: hSP, hangerType: 'noniusz', basic: layers <= 2,
    info: `Nośne CD co 100 cm, montażowe CD co ${sec} cm (co 40 cm przy GKB 9,5 i płytach ogniowych), wieszaki co ${hSP} cm · wkręty w zewnętrznej warstwie co 17 cm` });
  mkCeil({ id: `NG-SPJ-${layers}`, gid: gidJ, refKind: 'SPJ', name: `Sufit podwieszany SPJ CD 60 jednopoziomowy, ${LT[layers]}`, kind: 'one-level', layers, defaultBoard: fireOnly ? 'NG-GKF12.5' : 'NG-GKB12.5',
    mainSpacing: 120, secondarySpacing: sec, hangerSpacing: hSPJ, hangerType: 'noniusz',
    info: `Główne CD co 120 cm, poprzeczki CD co ${sec} cm na łącznikach jednostronnych, wieszaki co ${hSPJ} cm` });
}
for (const [gid, layers] of [[38, 1], [39, 2], [40, 3], [41, 4]]) {
  const sec = layers >= 3 ? 40 : 50;
  const h = layers === 4 ? 60 : layers === 3 ? 70 : 85;
  mkCeil({ id: `NG-OSF-${layers}`, gid, refKind: 'OSF', filter: (r) => r[3] === 'CD60', name: `Okładzina sufitowa OSF na CD 60 i wieszakach ES, ${LT[layers]}`, kind: 'direct', layers,
    defaultBoard: layers >= 3 ? 'NG-GKF12.5' : 'NG-GKB12.5', mainSpacing: sec, secondarySpacing: sec, hangerSpacing: h, hangerType: 'es', basic: layers <= 2,
    info: `CD 60 co ${sec} cm na wieszakach ES / ES Plus co ${h} cm tuż pod stropem · odmiany na profilach kapeluszowych (KAP) – osobne pozycje NG-OSF-KAP` });
}
const ZP_COMMON = 'profil FLEX na załamaniach, folia paroizolacyjna i wełna między krokwiami · płyty ogniochronne i akustyczne: profile co 40 cm';
for (const [gid, layers] of [[22, 1], [24, 2]]) {
  mkCeil({ id: `NG-ZP-${layers}`, gid, refKind: 'ZP', zp: true, filter: (r) => r[4] === 'ES', name: `Zabudowa poddasza ZP CD 60 na wieszakach ES, ${layers}×12,5`, kind: 'direct', layers, defaultBoard: 'NG-GKB12.5',
    mainSpacing: 50, secondarySpacing: 50, hangerSpacing: 70, hangerType: 'es', basic: true,
    info: `Skosy i jętki: CD 60 co 50 cm na wieszakach ES do krokwi (kalkulator Norgips: ok. 3 szt./m²), ${ZP_COMMON} · odmiany z pianką PUR w tabeli` });
  const maxL = layers === 1 ? 290 : 305;
  mkCeil({ id: `NG-ZP-L-${layers}`, gid, refKind: 'ZPL', zp: true, filter: (r) => r[4] === 'L', name: `Zabudowa poddasza ZP CD 60 na wieszakach płaskich L, ${layers}×12,5`, kind: 'direct', layers, defaultBoard: 'NG-GKB12.5',
    mainSpacing: 50, secondarySpacing: 50, hangerSpacing: 70,
    atticFrame: {
      mount: 'hanger', profile: 'CD60', profileLabel: 'profil CD 60', profileMm: 27, edge: 'UD30', hanger: 'WIESZAK_PLASKI', hangerLabel: 'wieszak płaski L', hangerLn9: 1, joiner: 'LACZNIK_WZDL',
      woodScrews: 2, maxUnderMm: maxL - Math.round(12.5 * layers), maxUnderWhy: `tabela Norgips: zabudowa do ${maxL} mm`,
    },
    info: `Skosy i jętki: CD 60 co 50 cm na wieszakach płaskich L-180 / L-270 lub wieszakach do poddaszy L-350 (kalkulator Norgips: ok. 3 szt./m²), zabudowa do ${maxL} mm – miejsce na grubą wełnę pod krokwiami · ${ZP_COMMON}` });
}
for (const [gid, layers] of [[23, 1], [25, 2]])
  mkCeil({ id: `NG-ZP-KAP-${layers}`, gid, refKind: 'ZPK', zp: true, name: `Zabudowa poddasza ZP na profilach kapeluszowych, ${layers}×12,5`, kind: 'direct', layers, defaultBoard: 'NG-GKB12.5',
    mainSpacing: 50, secondarySpacing: 50, hangerSpacing: 100,
    atticFrame: { mount: 'direct', profile: 'KAPELUSZ', profileLabel: 'profil kapeluszowy', profileMm: 15, woodScrews: 2 },
    info: `Skosy i jętki: profile kapeluszowe co 50 cm przykręcone wprost do krokwi (kalkulator Norgips: 8 wkrętów do drewna na m²), zabudowa ${layers === 1 ? '28–30' : '40–45'} mm · ${ZP_COMMON} · strona nie podaje największego rozstawu mocowania – przyjęto 100 cm` });

// ---- emit
const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) || /^\d+$/.test(k) ? k : `'${k}'`);
function lit(v, ind = '') {
  if (typeof v === 'string') return v.startsWith("src('") ? v : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v !== 'object' || v === null) return String(v);
  const inner = ind + '  ';
  const items = Array.isArray(v) ? v.map((x) => lit(x, inner)) : Object.entries(v).map(([k, x]) => `${key(k)}: ${lit(x, inner)}`);
  const [o, c] = Array.isArray(v) ? ['[', ']'] : ['{ ', ' }'];
  const one = Array.isArray(v) ? `[${items.join(', ')}]` : `{ ${items.join(', ')} }`;
  if (one.length + ind.length <= 190 && !one.includes('\n')) return one;
  return `${o.trim()}\n${items.map((x) => inner + x + ',').join('\n')}\n${ind}${c.trim()}`;
}
const srcOf = (o) => ({ ...o, source: `src('${o.__cat}')` });
let ts = fs.readFileSync(`${SCR}/header.ts`, 'utf8');
ts += `export const NORGIPS_BOARDS: Board[] = ${lit(BOARDS)};\n\n`;
ts += `export const NORGIPS_WALL_SYSTEMS: WallSystem[] = ${lit(walls)};\n\n`;
ts += `export const NORGIPS_CEILING_SYSTEMS: CeilingSystem[] = ${lit(ceilings)};\n`;
for (const s of [...walls, ...ceilings]) for (const v of s.variants) if (!boardIds.has(v.board)) throw new Error(`${s.id}: ${v.board}`);
fs.writeFileSync(OUT, ts);
console.log(walls.length, 'ścian,', ceilings.length, 'sufitów,', [...walls, ...ceilings].reduce((a, s) => a + s.variants.length, 0), 'odmian');
