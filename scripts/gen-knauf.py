#!/usr/bin/env python3
"""Generator src/catalog/knauf.ts z danych odczytanych z Knauf Systemfinder (data/knauf/*.txt, ceil.tsv).

Uruchomienie z katalogu repozytorium: python3 scripts/gen-knauf.py data/knauf src/catalog/knauf.ts
"""
import json
import sys
from collections import OrderedDict

SCR = sys.argv[1]
OUT = sys.argv[2]

FINDER = 'https://systems.knauf.com/pl-PL/systemfinder'

# --- płyty -------------------------------------------------------------------------------------
# kod: (id, nazwa, short, typ, grubość, szerokość cm, długości cm, opis, kolor, extra)
BOARDS = OrderedDict([
    ('A13', ('KN-A13', 'Knauf A13 12,5 (płyta zwykła, typ A)', 'A13', 'A (GKB)', 12.5, 120, [200, 250, 260, 300], 'Płyta standardowa do pomieszczeń suchych', '#e8e4da', {})),
    ('HA13', ('KN-HA13', 'Knauf HA13 12,5 (impregnowana, typ H2)', 'HA13', 'H2 (GKBI)', 12.5, 120, [250, 260, 300], 'Płyta impregnowana do łazienek i kuchni', '#b9d8b0', {'moisture': 'humid'})),
    ('F13', ('KN-F13', 'Knauf F13 12,5 (ogniochronna, typ DF)', 'F13', 'DF (GKF)', 12.5, 120, [200, 260, 300], 'Płyta o zwiększonej odporności ogniowej', '#f2b8b0', {})),
    ('F15', ('KN-F15', 'Knauf F15 15 (ogniochronna, typ DF)', 'F15', 'DF (GKF)', 15, 120, [200, 260], 'Płyta ogniochronna 15 mm do przegród o wyższej klasie EI', '#eaa79e', {})),
    ('HF13', ('KN-HF13', 'Knauf HF13 12,5 (ogniochronna impregnowana, typ DFH2)', 'HF13', 'DFH2 (GKFI)', 12.5, 120, [200, 260, 300], 'Płyta ogniochronna i impregnowana', '#e6c9a8', {'moisture': 'humid'})),
    ('HF15', ('KN-HF15', 'Knauf HF15 15 (ogniochronna impregnowana, typ DFH2)', 'HF15', 'DFH2 (GKFI)', 15, 120, [200], 'Płyta ogniochronna i impregnowana 15 mm', '#dcbd99', {'moisture': 'humid'})),
    ('DIA13', ('KN-DIA13', 'Knauf Diamant HF13 12,5 (typ DFH2IR)', 'Diamant', 'DFH2IR', 12.5, 120, [200, 260], 'Płyta utwardzona, ogniochronna i impregnowana – wysoka odporność na uderzenia, lepsza akustyka', '#a9c7de', {'moisture': 'humid'})),
    ('DIA15', ('KN-DIA15', 'Knauf Diamant HF15 15 (typ DFH2IR)', 'Diamant 15', 'DFH2IR', 15, 125, [200, 250], 'Płyta utwardzona, ogniochronna i impregnowana 15 mm', '#98b8d2', {'moisture': 'humid'})),
    ('AKU', ('KN-AKU', 'Knauf Akustik 12,5', 'Akustik', 'DF (akustyczna)', 12.5, 120, [200, 260], 'Płyta o podwyższonej izolacyjności akustycznej (format jak Akustik impregnowana – strona produktu nie podaje)', '#c9c3e0', {})),
    ('AKUH', ('KN-AKUH', 'Knauf Akustik impregnowana 12,5', 'Akustik H', 'DFH2 (akustyczna)', 12.5, 120, [200, 260], 'Płyta akustyczna impregnowana do łazienek i kuchni', '#b5c9cf', {'moisture': 'humid'})),
    ('AKUP', ('KN-AKUP', 'Knauf Akustik Plus 12,5', 'Akustik Plus', 'DF (akustyczna)', 12.5, 120, [200, 260], 'Ciężka płyta akustyczna (13 kg/m²) do ścian o wysokiej izolacyjności', '#b3a9d6', {})),
    ('SIL', ('KN-SIL', 'Knauf Silentboard F13 12,5', 'Silentboard', 'DF (akustyczna)', 12.5, 62.5, [200, 250], 'Bardzo ciężka płyta akustyczna (17,5 kg/m²), wąski format 62,5 cm', '#9d93c4', {})),
    ('FB20', ('KN-FB20', 'Knauf Fireboard 20 (GM-F)', 'Fireboard 20', 'GM-F', 20, 125, [200], 'Płyta ogniochronna z włóknem szklanym do szachtów i obudów EI 90', '#e6d9c2', {})),
    ('FB25', ('KN-FB25', 'Knauf Fireboard 25 (GM-F)', 'Fireboard 25', 'GM-F', 25, 125, [200], 'Płyta ogniochronna z włóknem szklanym do szachtów i sufitów EI 120', '#dccdb1', {})),
    ('AQ', ('KN-AQ', 'Knauf Aquapanel Indoor 12,5 (płyta cementowa)', 'Aquapanel', 'cementowa', 12.5, 90, [120, 240, 250], 'Płyta cementowa do stref mokrych (prysznice, baseny, pralnie)', '#bfc3c7', {'kind': 'cement', 'moisture': 'wet'})),
])
BID = {k: v[0] for k, v in BOARDS.items()}
SHORT = {k: v[2] for k, v in BOARDS.items()}
TYPE = {k: v[3] for k, v in BOARDS.items()}
THK = {k: v[4] for k, v in BOARDS.items()}
PREF = ['A13', 'HA13', 'F13', 'HF13', 'F15', 'HF15', 'DIA13', 'DIA15', 'AKU', 'AKUH', 'AKUP', 'SIL', 'FB20', 'FB25', 'AQ']


def pl(x):
    s = ('%g' % x)
    return s.replace('.', ',')


def num(s):
    s = s.strip()
    if not s:
        return None
    f = float(s)
    return int(f) if f == int(f) else f


def read(path):
    rows = []
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        rows.append(line.split('|'))
    return rows


def layer_text(boards, layers, clad):
    """Opis poszycia jednej strony, np. „2×12,5 F13” albo „12,5 Silentboard + 12,5 Diamant”."""
    parts = boards.split('+')
    if len(parts) == 1:
        t = THK[parts[0]]
        return f'{layers}×{pl(t)} {SHORT[parts[0]]}'
    # mieszane: rozpisz grubości z opisu okładziny
    segs = [s.strip() for s in clad.split('+')]
    out = []
    for code, seg in zip(parts, segs):
        n = 1
        if 'x' in seg:
            n = int(seg.split('x')[0])
        out.append(f'{n}×{pl(THK[code])} {SHORT[code]}')
    return ' + '.join(out)


# --- ściany, okładziny, szachty ----------------------------------------------------------------
WALL_META = {
    # sys: (kategoria, frame, sides, opis rodzaju)
    'W111': ('działowa', 'single', 2, 'Ściana działowa'),
    'W112': ('działowa', 'single', 2, 'Ściana działowa'),
    'W113': ('działowa', 'single', 2, 'Ściana działowa'),
    'W113+': ('działowa', 'single', 2, 'Ściana działowa'),
    'W115': ('podwójna', 'double', 2, 'Ściana na podwójnym ruszcie'),
    'W116': ('instalacyjna', 'separate', 2, 'Ściana instalacyjna'),
    'W381': ('działowa', 'single', 2, 'Ściana z płyt cementowych'),
    'W382': ('działowa', 'single', 2, 'Ściana z płyt cementowych'),
    'W385': ('podwójna', 'double', 2, 'Ściana z płyt cementowych na podwójnym ruszcie'),
    'W386': ('podwójna', 'double', 2, 'Ściana z płyt cementowych na podwójnym ruszcie'),
    'W625': ('okładzina', 'single', 1, 'Przedścianka (okładzina na CW, bez mocowania do ściany)'),
    'W626': ('okładzina', 'single', 1, 'Przedścianka (okładzina na CW, bez mocowania do ściany)'),
    'W685': ('okładzina', 'single', 1, 'Przedścianka z płyt cementowych'),
    'W686': ('okładzina', 'single', 1, 'Przedścianka z płyt cementowych'),
    'W683': ('okładzina', 'cd-lining', 1, 'Okładzina z płyt cementowych na CD 60'),
    'W628B': ('szacht', 'single', 1, 'Ściana szybu (typ B)'),
}
# W629 = W628B na zdwojonych słupkach → odmiany doubleStuds w systemie W628B
MERGE = {'W629': 'W628B'}
BASIC = {'KN-W111-CW50', 'KN-W111-CW75', 'KN-W111-CW100', 'KN-W112-CW75', 'KN-W112-CW100', 'KN-W115-CW75-2',
         'KN-W116-CW75', 'KN-W625-CW50', 'KN-W626-CW75', 'KN-W628B-CW75-2', 'KN-W683-1', 'KN-W381-CW75'}

lines = read(f'{SCR}/walls.txt') + read(f'{SCR}/lin.txt')
groups = OrderedDict()
for r in lines:
    sysn, grid, prof, layers, boards, clad, wool, ei, rw, ra1, thk, mass, H = r[:13]
    sysn = MERGE.get(sysn, sysn)
    if sysn not in WALL_META:
        continue
    double = grid == 'Z' or (r[0] == 'W629')
    p = prof.replace('2x ', '').replace('2x', '').replace('CW', '').replace('CD60/27', '50')
    profile = int(p)
    nl = int(layers)
    key = (sysn, profile, nl)
    groups.setdefault(key, []).append(dict(boards=boards, clad=clad, wool=num(wool), ei=num(ei), rw=num(rw), ra1=num(ra1),
                                           thk=num(thk), mass=num(mass), H=[num(x) for x in H.split('/')], double=double, orig=r[0]))

# liczba różnych warstw w systemie – czy id potrzebuje sufiksu warstw
layers_per_sys = {}
for (s, p, n) in groups:
    layers_per_sys.setdefault(s, set()).add(n)

walls = []
for (sysn, profile, nl), vs in groups.items():
    cat, frame, sides, kind = WALL_META[sysn]
    if frame == 'cd-lining':
        sid = f'KN-{sysn}-{nl}'
    else:
        sid = f'KN-{sysn.replace("+", "P")}-CW{profile}' + (f'-{nl}' if len(layers_per_sys[sysn]) > 1 else '')
    # płyta domyślna
    codes = [v['boards'].split('+')[-1] for v in vs if '+' not in v['boards'] and not v['double']]
    mixed_all = all('+' in v['boards'] for v in vs)
    if mixed_all:
        codes = [v['boards'].split('+')[-1] for v in vs]
    default = min(codes, key=PREF.index)
    inner = None
    if mixed_all:
        inner = sorted({v['boards'].split('+')[0] for v in vs}, key=PREF.index)[0]
    dv = next(v for v in vs if (v['boards'] == default or (mixed_all and v['boards'].endswith('+' + default))) and not v['double'])
    spacings = [(30, dv['H'][0]), (40, dv['H'][1]), (60, dv['H'][2])]
    maxh = {sp: round(h * 100) for sp, h in spacings if h}
    stud = 60 if 60 in maxh else max(maxh)
    variants = []
    for v in sorted(vs, key=lambda v: (v['double'], PREF.index(v['boards'].split('+')[-1]), v['boards'])):
        parts = v['boards'].split('+')
        outer = parts[-1]
        desc = layer_text(v['boards'], nl, v['clad'])
        for sp, h in [(60, v['H'][2]), (40, v['H'][1]), (30, v['H'][0])]:
            if not h:
                continue
            lab = f'{desc} ({TYPE[outer]})' if len(parts) == 1 else desc
            lab += f' · słupki{" podwójne" if v["double"] else ""} co {sp} cm'
            if v['wool']:
                lab += f' · wełna {v["wool"]} mm'
            o = OrderedDict()
            o['code'] = v['orig']
            o['label'] = lab
            o['board'] = BID[outer]
            if len(parts) > 1:
                o['innerBoards'] = [BID[parts[0]]]
            o['studSpacing'] = sp
            if v['double']:
                o['doubleStuds'] = True
            o['maxHeight'] = round(h * 100)
            if v['ei']:
                o['fire'] = v['ei']
            if v['rw']:
                o['rw'] = v['rw']
            if v['ra1']:
                o['ra1'] = v['ra1']
            o['wool'] = v['wool'] or 0
            o['thickness'] = v['thk']
            o['mass'] = v['mass']
            variants.append(o)
    eis = sorted({v['ei'] for v in vs if v['ei']})
    rws = [v['rw'] for v in vs if v['rw']]
    thk = dv['thk']
    if frame == 'cd-lining':
        title = f'{kind}, {nl}×12,5'
    elif sides == 1:
        title = f'{kind} CW {profile}, {nl}×' + ('12,5' if not mixed_all else '…')
    else:
        title = f'{kind} CW {profile}, {nl}×12,5 obustronnie'
    if mixed_all:
        title = f'{kind} CW {profile}, ' + layer_text(dv['boards'], nl, dv['clad']).replace(' ' + SHORT[default], '').replace(' ' + SHORT[inner], '')
    has_double = any(v['double'] for v in vs)
    w = OrderedDict()
    w['id'] = sid
    w['name'] = f'Knauf {sysn} – {title[0].lower() + title[1:]}'
    w['category'] = cat
    w['frame'] = frame
    w['profile'] = profile if profile in (50, 75, 100) else 50
    w['layers'] = nl
    w['sides'] = sides
    w['defaultBoard'] = BID[default]
    if inner:
        w['innerBoard'] = BID[inner]
        w['innerLayers'] = 2
    w['studSpacing'] = stud
    w['maxHeight'] = maxh
    w['insulationDefault'] = bool(dv['wool'])
    if eis:
        w['fire'] = f'EI {eis[0]}' if len(eis) == 1 else f'EI {eis[0]} – EI {eis[-1]}'
    if rws:
        w['acoustic'] = f'Rw do {max(rws)} dB'
    if frame == 'separate':
        gap = max(0.5, (thk - 2 * profile - 2 * nl * 12.5) / 10)
        w['gap'] = gap
    if frame == 'cd-lining':
        w['bracketSpacing'] = 100
    hs = ', '.join(f'co {sp} cm do {pl(maxh[sp] / 100)} m' for sp in (60, 40, 30) if sp in maxh)
    info = [f'Grubość {pl(thk)} mm', f'słupki {hs}' if frame != 'cd-lining' else f'profile CD 60 co 60 cm, do {pl(maxh[60] / 100)} m']
    if has_double:
        info.append('wyższe odmiany na słupkach podwójnych' + (' (Knauf W629)' if sysn == 'W628B' else ''))
    if mixed_all:
        info.append(f'warstwy wewnętrzne {SHORT[inner]}, zewnętrzne {SHORT[default]}')
    if frame == 'separate':
        info.append('rozstaw rusztów dowolny – podana grubość minimalna')
    if frame == 'cd-lining':
        info.append('rozstaw uchwytów ES przyjęty 100 cm (Systemfinder go nie podaje)')
    w['info'] = ' · '.join(info)
    w['source'] = ('SRC', sysn if sysn != 'W628B' else 'W628B / W629')
    w['maker'] = 'knauf'
    if sid in BASIC:
        w['basic'] = True
    w['variants'] = variants
    walls.append(w)

# --- ręczne, ze stron systemów (bez tabeli odmian) ---------------------------------------------
HAND_WALLS = [
    OrderedDict([
        ('id', 'KN-W623-1'), ('name', 'Knauf W623 – okładzina na CD 60 i wieszakach bezpośrednich, 1×12,5'), ('category', 'okładzina'),
        ('frame', 'cd-lining'), ('profile', 50), ('layers', 1), ('sides', 1), ('defaultBoard', 'KN-A13'), ('studSpacing', 60),
        ('insulationDefault', False), ('fire', 'do EI 120 (zależnie od poszycia)'), ('bracketSpacing', 100),
        ('info', 'Profile CD 60 pionowo co maks. 60 cm na wieszakach bezpośrednich, UD 28 góra i dół · wysokość do 10 m wg strony systemu · rozstaw wieszaków przyjęty 100 cm'),
        ('source', ('APPROX', 'W623')), ('maker', 'knauf'), ('basic', True),
    ]),
    OrderedDict([
        ('id', 'KN-W623-2'), ('name', 'Knauf W623 – okładzina na CD 60 i wieszakach bezpośrednich, 2×12,5'), ('category', 'okładzina'),
        ('frame', 'cd-lining'), ('profile', 50), ('layers', 2), ('sides', 1), ('defaultBoard', 'KN-A13'), ('studSpacing', 60),
        ('insulationDefault', False), ('fire', 'do EI 120 (zależnie od poszycia)'), ('bracketSpacing', 100),
        ('info', 'Profile CD 60 pionowo co maks. 60 cm na wieszakach bezpośrednich, UD 28 góra i dół · wysokość do 10 m wg strony systemu · rozstaw wieszaków przyjęty 100 cm'),
        ('source', ('APPROX', 'W623')), ('maker', 'knauf'),
    ]),
    OrderedDict([
        ('id', 'KN-W611'), ('name', 'Knauf W611 – suchy tynk, płyta na kleju gipsowym'), ('category', 'okładzina'),
        ('frame', 'glued'), ('profile', 50), ('layers', 1), ('sides', 1), ('defaultBoard', 'KN-A13'), ('studSpacing', 60),
        ('insulationDefault', False), ('info', 'Płyty klejone placekami kleju gipsowego Perlfix do równego, nośnego podłoża'),
        ('source', ('APPROX', 'W611')), ('maker', 'knauf'), ('basic', True),
    ]),
]
walls += HAND_WALLS

# --- sufity i poddasza --------------------------------------------------------------------------
ceil_rows, attic_rows = [], []
cur = None
for line in open(f'{SCR}/ceil.tsv', encoding='utf-8'):
    line = line.rstrip('\n')
    if line.startswith('# D612'):
        cur = attic_rows
        continue
    if line.startswith('#'):
        cur = ceil_rows
        continue
    if not line:
        continue
    cur.append(line.split('|'))

CB = {'FIREBOARD25': 'FB25', 'SIL+DIA13': 'SIL+DIA13'}


def ceil_variant(code, clad, cd, load, ei, rw, ra1, mass, hang):
    parts = CB.get(code, code).split('+')
    outer = parts[-1]
    nl, t = clad.split('x')
    nl = int(nl)
    if len(parts) > 1:
        desc = f'{nl}×{t} {SHORT[parts[0]]} + {SHORT[outer]}'
    else:
        desc = f'{nl}×{t} {SHORT[outer]} ({TYPE[outer]})'
    lab = f'{desc} · profile montażowe co {int(cd) // 10} cm'
    if hang:
        lab += f' · wieszaki co {int(hang) // 10} cm'
    lab += f' · obciążenie do {load.replace(".", ",")} kN/m²'
    o = OrderedDict()
    o['label'] = lab
    o['board'] = BID[outer]
    if len(parts) > 1:
        o['innerBoards'] = [BID[parts[0]]]
    if num(ei):
        o['fire'] = num(ei)
    if rw and num(rw):
        o['rw'] = num(rw)
    if ra1 and num(ra1):
        o['ra1'] = num(ra1)
    o['mass'] = num(mass)
    return o, nl, outer, int(cd) // 10, int(hang) // 10 if hang else None


def ceil_systems(rows, sysn, kind, idx_mass, idx_hang, attic=False):
    by = OrderedDict()
    for r in rows:
        if attic:
            nr, code, clad, cd, load, ei, mass, hang = r[:8]
            rw = ra1 = None
        else:
            nr, code, clad, cd, load, ei, rw, ra1 = r[:8]
            mass, hang = r[idx_mass], r[idx_hang]
        v, nl, outer, cdcm, hcm = ceil_variant(code, clad, cd, load, ei, rw, ra1, mass, hang)
        if num(ei) and attic:
            v['label'] = v['label'] + f' · REI {num(ei)} (z konstrukcją dachu)'
        by.setdefault(nl, []).append((v, outer, cdcm, hcm))
    out = []
    for nl, vs in by.items():
        default = min((o for _, o, _, _ in vs), key=PREF.index)
        dv = next(x for x in vs if x[1] == default)
        sec, hang = dv[2], dv[3]
        eis = sorted({v.get('fire') for v, *_ in vs if v.get('fire')})
        c = OrderedDict()
        c['id'] = f'KN-{sysn}-{nl}'
        names = {
            'D112': 'sufit podwieszany CD 60 dwupoziomowy',
            'D113': 'sufit podwieszany CD 60 jednopoziomowy',
            'D612': 'zabudowa poddasza na CD 60 i wieszakach ES',
        }
        c['name'] = f'Knauf {sysn} – {names[sysn]}, {nl}×12,5'
        c['kind'] = kind
        c['layers'] = nl
        c['defaultBoard'] = BID[default]
        c['mainSpacing'] = 100 if kind != 'direct' else sec
        c['secondarySpacing'] = sec
        c['hangerSpacing'] = hang
        c['hangerType'] = 'es' if kind == 'direct' else 'noniusz'
        c['screwsOuter'] = 25 if sec >= 50 else 30
        c['screwsInner'] = 10 if sec >= 50 else 12
        if eis:
            pre = 'REI' if attic else 'EI'
            c['fire'] = f'{pre} {eis[0]}' if len(eis) == 1 else f'{pre} {eis[0]} – {pre} {eis[-1]}'
        if kind == 'direct':
            info = f'Profile CD 60 co {sec} cm (płyty ogniowe i cięższe co 40 cm) na wieszakach ES przykręcanych do krokwi co {hang} cm'
        elif kind == 'two-level':
            info = f'Nośne CD co 100 cm (rozstaw przyjęty – Systemfinder go nie podaje), montażowe CD co {sec} cm, wieszaki co {hang} cm · rozstawy dla cięższych płyt w opisie odmian'
        else:
            info = f'Główne i poprzeczne CD w jednym poziomie, główne co 100 cm (rozstaw przyjęty – Systemfinder go nie podaje), poprzeczne co {sec} cm, wieszaki co {hang} cm · rozstawy dla cięższych płyt w opisie odmian'
        c['info'] = info + ' · wkręty co 17 cm'
        c['source'] = ('SRC', sysn)
        c['maker'] = 'knauf'
        if nl == 1:
            c['basic'] = True
        if attic:
            c['attic'] = True
        c['variants'] = [v for v, *_ in vs]
        out.append(c)
    return out


ceilings = ceil_systems(ceil_rows, 'D112', 'two-level', 8, 9) + ceil_systems(ceil_rows, 'D113', 'one-level', 8, 9) + ceil_systems(attic_rows, 'D612', 'direct', 6, 7, attic=True)


# --- zapis TS ---------------------------------------------------------------------------------
def ts(v, ind=0):
    if isinstance(v, tuple) and v[0] == 'SRC':
        return f"src('{v[1]}')"
    if isinstance(v, tuple) and v[0] == 'APPROX':
        return f"approx('{v[1]}')"
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return ('%g' % v)
    if isinstance(v, str):
        return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'"
    if isinstance(v, list):
        return '[' + ', '.join(ts(x) for x in v) + ']'
    if isinstance(v, dict):
        items = []
        for k, x in v.items():
            kk = k if (isinstance(k, str) and k.isidentifier()) else str(k)
            items.append(f'{kk}: {ts(x)}')
        return '{ ' + ', '.join(items) + ' }'
    raise TypeError(v)


def obj(o, ind='  '):
    s = ind + '{\n'
    for k, v in o.items():
        if k == 'variants':
            s += ind + '  variants: [\n'
            for x in v:
                s += ind + '    ' + ts(x) + ',\n'
            s += ind + '  ],\n'
        else:
            s += ind + f'  {k}: {ts(v)},\n'
    return s + ind + '},\n'


hdr = '''// Katalog systemów suchej zabudowy Knauf – ściany, przedścianki, okładziny, szachty, sufity
// podwieszane i zabudowa poddasza.
//
// Źródło: Knauf Systemfinder (https://systems.knauf.com/pl-PL/systemfinder), stan 19.11.2026 –
// tabele odmian systemów: płyta, liczba warstw, profil, rozstaw słupków, maksymalna wysokość, EI,
// Rw, RA1, grubość, masa, wełna; w sufitach rozstaw profili montażowych i wieszaków wg klasy
// obciążenia. Formaty płyt ze stron produktów knauf.com/pl-PL/p/produkt/…
// Jedna pozycja = jedna konstrukcja (system × profil × liczba warstw); płyty, rozstawy słupków
// i słupki podwójne są odmianami (`variants`). W629 (szyb na zdwojonych słupkach) to odmiany W628B.
// Systemy Knauf nie mają pola `code` – numer systemu (W112, D112…) jest w nazwie i w odmianach.
// Pominięte (silnik ich nie liczy): ściany na drewnie (W12x), W115W (płyta między rusztami),
// W635 (szyb na UW), D116 (nośne UA), D131 (sufit samonośny), sufity modułowe, Cubo, Fireboard
// K25x, ściany RTG i antywłamaniowe.
//
// Plik generowany: python3 scripts/gen-knauf.py data/knauf src/catalog/knauf.ts (dane w data/knauf); importuje z `rigips.ts` wyłącznie typy.

import type { Board, CeilingSystem, Source, WallSystem } from './rigips';

const src = (sys: string): Source => ({
  label: `Knauf Systemfinder – ${sys} (tabela odmian systemu)`,
  url: 'https://systems.knauf.com/pl-PL/systemfinder',
});

const approx = (sys: string): Source => ({
  label: `Knauf ${sys} – opis ze strony systemu, bez tabeli odmian w Systemfinderze (wartości orientacyjne)`,
  url: 'https://knauf.com/pl-PL/systemy/systemy-suchej-zabudowy',
  approx: true,
});

'''

out = hdr + 'export const KNAUF_BOARDS: Board[] = [\n'
for code, (bid, name, short, typ, t, wdt, lens, desc, color, extra) in BOARDS.items():
    b = OrderedDict([('id', bid), ('name', name), ('short', short), ('type', typ), ('thickness', t), ('width', wdt), ('lengths', lens),
                     ('description', desc), ('color', color), ('maker', 'knauf')])
    b.update(extra)
    out += obj(b)
out += '];\n\nexport const KNAUF_WALL_SYSTEMS: WallSystem[] = [\n'
for w in walls:
    out += obj(w)
out += '];\n\nexport const KNAUF_CEILING_SYSTEMS: CeilingSystem[] = [\n'
for c in ceilings:
    out += obj(c)
out += '];\n'
open(OUT, 'w', encoding='utf-8').write(out)
print(len(walls), 'walls', sum(len(w.get('variants', [])) for w in walls), 'wall variants;', len(ceilings), 'ceilings', sum(len(c['variants']) for c in ceilings), 'ceil variants')
