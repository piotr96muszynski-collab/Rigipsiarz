#!/usr/bin/env python3
"""Generator src/catalog/siniat.ts z tabel Katalogu technicznego Siniat (data/siniat/*.json).

Dane: python3 scripts/siniat-extract.py <katalog z PDF> data/siniat
Uruchomienie z katalogu repozytorium: python3 scripts/gen-siniat.py data/siniat src/catalog/siniat.ts [--debug]
"""
import json
import re
import sys
from collections import OrderedDict

SRC, OUT = sys.argv[1], sys.argv[2]
DEBUG = '--debug' in sys.argv
DOCS = 'https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue'

CHAPTER = {
    '02': 'rozdz. 2 Okładziny kotwione Nida Tynk',
    '03': 'rozdz. 3 Okładziny wolnostojące Nida Tynk',
    '04': 'rozdz. 4 Ściany działowe Nida Ściana',
    '06': 'rozdz. 6 Sufity podwieszane Nida Sufit',
    '08': 'rozdz. 8 Zabudowa poddaszy Nida Poddasze',
    '09': 'rozdz. 9 Zabudowa dachów skośnych Nida Dach',
    '10': 'rozdz. 10 Obudowy pionów Nida Szacht',
}
FILES = {'02': '02_kotwione', '03': '03_wolnostojace', '04': '04_sciany', '06': '06_sufity', '08': '08_poddasza', '09': '09_dachy',
         '10': '10_szachty'}

# --- płyty ------------------------------------------------------------------------------------
# Formaty: cennik Siniat 08.2026 (rozdz. 1 Płyty gipsowe, rozdz. 2 Płyty cementowe) i strony produktów siniat.pl.
# (kod, grubość): (id, nazwa, short, typ, szerokość cm, długości cm, opis, kolor, extra)
BOARDS = OrderedDict([
    (('EXP', 12.5), ('SN-EXP12.5', 'Nida Expert 12,5 (typ A)', 'Expert', 'A (GKB)', 120, [200, 260, 300],
                     'Płyta standardowa do pomieszczeń suchych (wilgotność do 70%)', '#e8e4da', {})),
    (('WODA', 12.5), ('SN-WODA12.5', 'Nida Woda 12,5 (impregnowana, typ H2)', 'Woda', 'H2 (GKBI)', 120, [200, 260, 300],
                      'Płyta impregnowana do łazienek i kuchni (wilgotność do 85%)', '#b9d8b0', {'moisture': 'humid'})),
    (('OP', 12.5), ('SN-OP12.5', 'Nida Ogień Plus 12,5 (typ DF)', 'Ogień+', 'DF (GKF)', 120, [200, 260, 300],
                    'Płyta o zwiększonej odporności ogniowej', '#f2b8b0', {})),
    (('OP', 15), ('SN-OP15', 'Nida Ogień Plus 15 (typ DF)', 'Ogień+ 15', 'DF (GKF)', 120, [200, 260, 300],
                  'Płyta ogniochronna 15 mm', '#eaa79e', {})),
    (('OP', 18), ('SN-OP18', 'Nida Ogień Plus 18 (typ DF)', 'Ogień+ 18', 'DF (GKF)', 120, [200],
                  'Płyta ogniochronna 18 mm', '#e0978d', {})),
    (('WOP', 12.5), ('SN-WOP12.5', 'Nida Woda Ogień Plus 12,5 (typ DFH2)', 'Woda Ogień+', 'DFH2 (GKFI)', 120, [200, 260, 300],
                     'Płyta ogniochronna i impregnowana', '#e6c9a8', {'moisture': 'humid'})),
    (('WOP', 15), ('SN-WOP15', 'Nida Woda Ogień Plus 15 (typ DFH2)', 'Woda Ogień+ 15', 'DFH2 (GKFI)', 120, [200],
                   'Płyta ogniochronna i impregnowana 15 mm', '#dcbd99', {'moisture': 'humid'})),
    (('OTF', 12.5), ('SN-OTF12.5', 'Nida Ogień typ F 12,5 (typ F)', 'Ogień F', 'F (GKF)', 120, [260],
                     'Płyta ogniochronna typu F (format ze strony produktu Siniat Smart F 12,5×1200×2600)', '#f0c2b8', {})),
    (('CICHAA', 12.5), ('SN-CICHAA12.5', 'Nida Cicha typ A 12,5 (akustyczna, typ A)', 'Cicha A', 'A (akustyczna)', 120, [200, 260],
                        'Płyta akustyczna o podwyższonej gęstości', '#c9c3e0', {})),
    (('CICHA', 12.5), ('SN-CICHA12.5', 'Nida Cicha 12,5 (typ DFH1IR)', 'Cicha', 'DFH1IR (akustyczna)', 120, [200, 260],
                       'Płyta akustyczna, ogniochronna, o zwiększonej twardości', '#b3a9d6', {})),
    (('TW', 12.5), ('SN-TW12.5', 'Nida Twarda 12,5 (typ DEFH1IR)', 'Twarda', 'DEFH1IR', 120, [200],
                    'Płyta o zwiększonej twardości – szafki i półki na samych wkrętach', '#a9c7de', {'hard': True, 'moisture': 'humid', 'screws': 'hartfix'})),
    (('TW', 15), ('SN-TW15', 'Nida Twarda 15 (typ DEFH1IR)', 'Twarda 15', 'DEFH1IR', 120, [200],
                  'Płyta o zwiększonej twardości 15 mm', '#98b8d2', {'hard': True, 'moisture': 'humid', 'screws': 'hartfix'})),
    (('HYDRO', 12.5), ('SN-HYDRO12.5', 'Nida Hydro 12,5 (z włóknami, typ GMFH1I)', 'Hydro', 'GMFH1I', 120, [260],
                       'Płyta gipsowa z włóknami do stref narażonych na wodę (okolice wanny, prysznica)', '#9fc9c0', {'moisture': 'wet'})),
    (('HYDRO', 15), ('SN-HYDRO15', 'Nida Hydro 15 (z włóknami, typ GMFH1I)', 'Hydro 15', 'GMFH1I', 120, [240],
                     'Płyta gipsowa z włóknami 15 mm do stref narażonych na wodę', '#8fbdb3', {'moisture': 'wet'})),
    (('CEM', 10), ('SN-CEM10', 'Siniat Cementex 10 (płyta cementowa)', 'Cementex', 'cementowa', 120, [240],
                   'Płyta cementowa do stref mokrych', '#bfc3c7', {'kind': 'cement', 'moisture': 'wet', 'screws': 'aquaroc'})),
    (('CEM', 12), ('SN-CEM12', 'Siniat Cementex 12 (płyta cementowa)', 'Cementex 12', 'cementowa', 120, [240],
                   'Płyta cementowa 12 mm do stref mokrych (format przyjęty jak dla 10 mm)', '#b2b6bb', {'kind': 'cement', 'moisture': 'wet', 'screws': 'aquaroc'})),
    (('RTG', 13), ('SN-RTG0.5', 'Nida RTG 12,5 + 0,5 mm ołowiu (osłona przed promieniowaniem)', 'RTG 0,5', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 0,5 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 0.5})),
    (('RTG', 13.5), ('SN-RTG1', 'Nida RTG 12,5 + 1,0 mm ołowiu (osłona przed promieniowaniem)', 'RTG 1,0', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 1,0 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 1})),
    (('RTG', 14), ('SN-RTG1.5', 'Nida RTG 12,5 + 1,5 mm ołowiu (osłona przed promieniowaniem)', 'RTG 1,5', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 1,5 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 1.5})),
    (('RTG', 14.5), ('SN-RTG2', 'Nida RTG 12,5 + 2,0 mm ołowiu (osłona przed promieniowaniem)', 'RTG 2,0', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 2,0 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 2})),
    (('RTG', 15), ('SN-RTG2.5', 'Nida RTG 12,5 + 2,5 mm ołowiu (osłona przed promieniowaniem)', 'RTG 2,5', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 2,5 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 2.5})),
    (('RTG', 15.5), ('SN-RTG3', 'Nida RTG 12,5 + 3,0 mm ołowiu (osłona przed promieniowaniem)', 'RTG 3,0', 'RTG (DF + ołów)', 62.5, [260],
                   'Płyta Ogień Plus z blachą ołowianą 3,0 mm do pomieszczeń RTG – szerokość 625 mm wg rozstawu słupków z karty, długość przyjęta (sprawdź w cenniku)', '#9aa0a8', {'leadMm': 3})),
])
PREF = ['EXP', 'WODA', 'OP', 'WOP', 'OTF', 'CICHAA', 'CICHA', 'TW', 'HYDRO', 'CEM']
NAME = {
    'expert': 'EXP', 'woda': 'WODA', 'ogień+': 'OP', 'ogień plus': 'OP', 'wodaogień+': 'WOP', 'woda ogień plus': 'WOP',
    'cicha': 'CICHA', 'cicha typ a': 'CICHAA', 'twarda': 'TW', 'hydro': 'HYDRO', 'ogieńtypf': 'OTF', 'ogień typ f': 'OTF',
    'cementex': 'CEM',
}


def split_mix(code, t):
    """„OP@12.5x2” = 2 warstwy wewnętrzne OP 12,5 mm (poszycie z płyt różnej grubości)."""
    if '@' in code:
        base, rest = code.split('@')
        th, n = rest.split('x')
        return base, num(th), int(n)
    return code, t, None


def inner_count(codes, nl):
    """Liczba warstw wewnętrznych (od rusztu) w poszyciu z dwóch rodzajów płyt."""
    n = split_mix(codes[0], 0)[2] if len(codes) > 1 else None
    return n if n is not None else nl - 1


def mix_key(codes):
    """
    Klucz grupy dla poszycia z dwóch rodzajów płyt: hybrydy (Expert+Twarda) – kody płyt wewnętrznych,
    różne grubości (12,5 pod 15) – układ warstw, np. „12.5x2” (Ogień+, Twarda, Hydro to odmiany jednego systemu).
    """
    if len(codes) < 2:
        return ''
    if '@' in codes[0]:
        return codes[0].split('@')[1]
    return '+'.join(codes[:-1])


def mix_id(mixed):
    """Kod do id systemu: „12.5x2” → „IN12.5x2”, hybrydy bez zmian."""
    return f'IN{mixed}' if re.match(r'^\d', mixed) else mixed


def board_id(code, t):
    code, t, _ = split_mix(code, t)
    k = (code, t)
    if k not in BOARDS:
        raise KeyError(k)
    return BOARDS[k][0]


def short(code, t):
    code, t, _ = split_mix(code, t)
    return BOARDS[(code, t)][2]


def btype(code, t):
    code, t, _ = split_mix(code, t)
    return BOARDS[(code, t)][3]


def pl(x):
    return ('%g' % x).replace('.', ',')


def num(s):
    s = (s or '').strip().replace(',', '.')
    try:
        f = float(s)
    except ValueError:
        return None
    return int(f) if f == int(f) else f


FOOT = re.compile(r'\s+\d\)')


def clean(s):
    return FOOT.sub('', ' ' + s).strip()


def split_code(row):
    """Kod systemu z pierwszej komórki (komórka bywa sklejona z nazwą płyty)."""
    first = clean(row[0])
    m = re.match(r'^(\S*/(?:Cicha typ A|Expert \+ Ogień\+|Expert\+Cicha typ A|Ogień Plus \+ Cicha|Ogień Plus|[^\s/]+))(?:\s+(.*))?$', first)
    code, extra = (m[1], m[2]) if m else (first, None)
    rest = ([extra] if extra else []) + [clean(c) for c in row[1:]]
    return code, rest


CLAD = re.compile(r'(?:(\d)x(\d+(?:,\d)?)(?:\s*\+\s*(\d)x(\d+(?:,\d)?))?)|(?:(\d+,\d)\s*\+\s*(\d+,\d))|^(12,5|15,0|18,0|10,0|15|18)$')


def norm_clad(t):
    """„2x12,5+15,0” → „2x12,5+1x15,0” (karta pomija „1x” przy drugiej grubości)."""
    return re.sub(r'(\dx\d+(?:,\d)?)\s*\+\s*(\d+,\d)', r'\1+1x\2', t)


def find_clad(tokens):
    """(liczba warstw, grubość, indeks) – np. „2x12,5”, „12,5+12,5”, „15,0”."""
    for i, t in enumerate(tokens):
        t = norm_clad(t)
        for part in [t] + t.split(' '):
            m = CLAD.search(part)
            if not m:
                continue
            if m[1]:
                n, th = int(m[1]), num(m[2])
                if m[3]:
                    n += int(m[3])
                return n, th, i
            if m[5]:
                return 2, num(m[5]), i
            return 1, num(m[7]), i
    return None


def board_codes(name):
    """„Expert+Twarda” → ['EXP', 'TW'] (warstwa wewnętrzna, zewnętrzna)."""
    name = re.sub(r'(\s*\d\))+\s*$', '', name)
    parts = [p.strip().lower() for p in re.split(r'\s*\+\s*(?=[A-ZĆŁŚŻŹ])', name)]
    return [NAME[p] for p in parts]


def ei_of(tokens):
    for t in tokens:
        m = re.search(r'R?EI\s?(\d+)', t.replace('EI/REI', 'EI').replace('(R)EI', 'EI'))
        if m:
            return int(m[1])
    return None


def is_mass(t):
    return bool(re.fullmatch(r'\d+[,.]\d', t))


MIXED_TH = re.compile(r'(\d)x(\d+(?:,\d)?)\s*\+\s*(\d)x(\d+(?:,\d)?)|(\d+,\d)\s*\+\s*(\d+,\d)')


def apply_mix(codes, tokens, nl, th):
    """
    Poszycie z płyt różnej grubości („1x12,5+1x15,0”, „2x12,5+2x15,0”): pierwsza w zapisie karty = warstwy
    wewnętrzne (od rusztu, jak w kartach Knauf „2×15 + 2×12,5”), druga = zewnętrzne. Zwraca (kody, grubość zewnętrzna).
    """
    for t in tokens:
        m = MIXED_TH.search(norm_clad(t))
        if not m:
            continue
        if m[1]:
            n1, t1, n2, t2 = int(m[1]), num(m[2]), int(m[3]), num(m[4])
        else:
            n1, t1, n2, t2 = 1, num(m[5]), 1, num(m[6])
        if t1 == t2 or t2 < 5:  # ta sama grubość albo „12,5+0,5” (powłoka ołowiana RTG)
            return codes, th
        assert len(codes) == 1 and n1 + n2 == nl, (codes, t, nl)
        return [f'{codes[0]}@{t1}x{n1}', codes[0]], t2
    return codes, th


def load(ch):
    return json.load(open(f'{SRC}/{FILES[ch]}.json', encoding='utf-8'))


def card_src(ch, page):
    return ('SRC', f'Siniat – Katalog techniczny, {CHAPTER[ch]}, karta s. {page}')


skipped = OrderedDict()


def skip(name, why):
    skipped.setdefault(why, set()).add(name)


# --- ściany działowe (rozdz. 4) ------------------------------------------------------------------
WALL_CODE = re.compile(r'^([\d,]+)(AA|BB|A|B|C|D|G|UU)(\d+)(-PWA|-400|-300)?$')
# ściany wysokie na C100 (rozdz. 4, s. 66–69): SW = pojedyncze słupki, SWSW = zdwojone; liczba = grubość ściany
SW_CODE = re.compile(r'^(SWSW|SW)([\d,]+)(-400|-300)?$')


def wall_rows():
    out = []
    tables = []
    for c in load('04'):
        if 'TABLICE DOBORU' in c['title']:
            tables.append(c)
            continue
        for r in c['rows']:
            code, rest = split_code(r)
            sysc, _, bname = code.partition('/')
            # płyta dosztywniająca między rzędami: z tabeli zużycia (1,0 m² Ogień Plus 12,5 na m² ściany)
            mid = 'SN-OP12.5' if 'DOSZTYWNIAJĄC' in c['title'] else None
            bs = ' (BS)' in sysc
            q = '-Q' in bname  # wykończenie Q3/Q4 – ta sama ściana, szpachlowanie całopowierzchniowe
            bname = bname.replace('-Q', '')
            # komórka sklejona z kolumną konstrukcji (255BB100 (BS)/Ogień Plus + Cicha 2xC100+2xC100 Ogień Plus 3) + Cicha)
            bname = re.sub(r'\s+\d+xC\d+\+.*$', '', bname)
            sw = SW_CODE.match(sysc)
            m = WALL_CODE.match(sysc.replace(' (BS)', ''))
            if sw:
                fam, prof, suffix = sw[1], 100, sw[3] or ''
                thk = num(sw[2])
            elif bname.startswith('RTG') or sysc == 'SLA':
                continue  # ściany z innym poszyciem stron – make_side_b_walls()
            elif not m or bname.startswith(('LS', 'CC')) or m[2] in ('G', 'UU'):
                skip(code.split('/')[0], SPECIAL_WHY)
                continue
            else:
                fam, prof, suffix = m[2], int(m[3]), m[4] or ''
                thk = num(m[1])
            spacing = 60
            if suffix in ('-400', '-300'):
                spacing = int(suffix[1:]) // 10
            elif len(rest) > 1 and rest[1] in ('400', '300'):
                spacing = int(rest[1]) // 10
            try:
                codes = board_codes(bname)
            except KeyError:
                skip(code, SPECIAL_WHY)
                continue
            cl = find_clad(rest)
            nl, th, ci = cl
            codes, th = apply_mix(codes, rest, nl, th)
            # wysokość: pierwsza liczba ≥ 2000 za poszyciem
            hi = next(i for i in range(ci + 1, len(rest)) if (num(rest[i]) or 0) >= 2000)
            wool = num(rest[hi - 2].replace('2x', '')) if hi - 2 > ci else None
            dens = num(rest[hi - 1]) if wool else None
            mi = max(i for i, t in enumerate(rest) if is_mass(t))
            ac = [num(t) for t in rest[hi + 1:mi]]
            out.append(dict(page=c['page'], code=code, sys=sysc, fam=fam, prof=prof, pwa=suffix == '-PWA', spacing=spacing, mid=mid, bs=bs, q=q,
                            double=fam in ('AA', 'BB', 'SWSW'), codes=codes, layers=nl, th=th, maxh=num(rest[hi]) // 10,
                            wool=wool or 0, dens=dens, rw=ac[0] if ac else None, ra1=ac[1] if len(ac) > 1 else None,
                            mass=num(rest[mi]), ei=ei_of(rest[mi + 1:]), thk=thk))
    # tablice doboru wysokości (bez wymagań ogniowych): rozstaw 40/30 cm i słupki zdwojone
    tab = []
    for c in tables:
        for r in c['rows']:
            m = re.match(r'^([\d,]+)(AA|BB|A|B|C|D)(\d+)(-PWA)?(?:-(400|300))?$', r[0])
            if not m or len(r) < 6:
                continue
            nl, th, _ = find_clad([r[1]])
            tab.append(dict(page=c['page'], code=r[0], fam=m[2], prof=int(m[3]), pwa=bool(m[4]), spacing=int(r[3]) // 10,
                            double=m[2] in ('AA', 'BB'), layers=nl, th=th, h1=num(r[4]) // 10, h2=num(r[5]) // 10))
    return out, tab


SPECIAL_WHY = 'ściany specjalne: LS – niepełne opłytowanie, gięte'

WALL_FAM = {
    # rodzina: (kategoria, frame, sides, opis)
    'SW': ('działowa', 'single', 2, 'wysoka ściana działowa'),
    'A': ('działowa', 'single', 2, 'ściana działowa'),
    'B': ('podwójna', 'double', 2, 'ściana na dwurzędowej konstrukcji'),
    'D': ('podwójna', 'double', 2, 'ściana na dwurzędowej konstrukcji z dylatacją 10 mm'),
    'C': ('instalacyjna', 'separate', 2, 'ściana instalacyjna na dwurzędowej konstrukcji'),
}


def layer_desc(codes, nl, th):
    if len(codes) == 1:
        return f'{nl}×{pl(th)} {short(codes[0], th)} ({btype(codes[0], th)})'
    inner = inner_count(codes, nl)
    ith = split_mix(codes[0], th)[1]
    if ith != th:
        return f'{inner}×{pl(ith)} + {nl - inner}×{pl(th)} {short(codes[1], th)} ({btype(codes[1], th)})'
    return f'{inner}×{pl(th)} {short(codes[0], th)} + {nl - inner}×{pl(th)} {short(codes[1], th)}'


def wall_key(r):
    fam = {'AA': 'A', 'BB': 'B', 'SWSW': 'SW'}.get(r['fam'], r['fam'])
    mixed = mix_key(r['codes'])
    return (fam, r['pwa'], r['prof'], r['layers'], mixed, r['mid'], r['bs'])


def make_walls(rows, tab, ch_sources):
    groups = OrderedDict()
    for r in rows:
        groups.setdefault(wall_key(r), []).append(r)
    walls = []
    for (fam, pwa, prof, nl, mixed, mid, bs), vs in groups.items():
        cat, frame, sides, kind = WALL_FAM[fam]
        kind = 'wysoka ściana (BS) na dwurzędowej zdwojonej konstrukcji' if bs else kind + (' z płytą dosztywniającą' if mid else '')
        sid = f'SN-W-{fam}{prof}' + ('-PWA' if pwa else '') + ('-PD' if mid else '') + ('-BS' if bs else '') + f'-{nl}' + (f'-{mix_id(mixed)}' if mixed else '')
        single = [v for v in vs if not v['double'] and v['spacing'] == 60] or [v for v in vs if not v['double']]
        default = min((v for v in (single or vs)), key=lambda v: (PREF.index(v['codes'][-1]), v['th'], -v['maxh']))
        dcode, dth = default['codes'][-1], default['th']
        variants, seen = [], set()
        for v in sorted(vs, key=lambda v: (v['double'], v['spacing'] != 60, -v['spacing'], PREF.index(v['codes'][-1]), v['th'], v['ei'] or 0, v['wool'])):
            outer = v['codes'][-1]
            lab = layer_desc(v['codes'], nl, v['th'])
            lab += f' · słupki{" zdwojone" if v["double"] else ""} co {v["spacing"]} cm'
            lab += (f' · wełna {v["wool"]} mm' + (f' ({pl(v["dens"])} kg/m³)' if v.get('dens') else '')) if v['wool'] else ' · bez wełny'
            if v['q']:
                lab += ' · wykończenie Q3/Q4 – szpachlowanie całopowierzchniowe'
            o = OrderedDict()
            o['code'] = v['code'].split('/')[0] + ('-Q' if v['q'] else '')
            o['label'] = lab
            o['board'] = board_id(outer, v['th'])
            if len(v['codes']) > 1:
                o['innerBoards'] = [board_id(v['codes'][0], v['th'])]
            o['studSpacing'] = v['spacing']
            if v['double']:
                o['doubleStuds'] = True
            o['maxHeight'] = v['maxh']
            if v['ei']:
                o['fire'] = v['ei']
            if v['rw']:
                o['rw'] = v['rw']
            if v['ra1']:
                o['ra1'] = v['ra1']
            o['wool'] = v['wool']
            o['thickness'] = v['thk']
            o['mass'] = v['mass']
            k = tuple((x, str(y)) for x, y in o.items() if x not in ('code', 'mass'))  # ten sam wiersz na dwóch kartach
            if k in seen:
                continue
            seen.add(k)
            variants.append(o)
        # tablice doboru: wyższe ściany przy rozstawie 40/30 cm i na słupkach zdwojonych (bez wymagań ogniowych)
        tfam = {'A': ('A', 'AA'), 'B': ('B', 'BB'), 'D': ('D',), 'C': ('C',), 'SW': ()}[fam]
        hmax = {default['spacing']: default['maxh']}
        if not mixed and not mid and not bs:
            for t in tab:
                if t['fam'] in tfam and t['prof'] == prof and t['layers'] == nl and t['pwa'] == pwa and (t['spacing'] != 60 or t['double']):
                    lab = f'{nl}×{pl(t["th"])} – dowolna płyta Nida z tabeli · słupki{" zdwojone" if t["double"] else ""} co {t["spacing"]} cm · bez wymagań ogniowych'
                    lab += f' · wysokość dla pomieszczeń o małej liczbie osób (zakres 1; zakres 2: {pl(t["h2"] / 100)} m)'
                    o = OrderedDict([('code', t['code']), ('label', lab), ('studSpacing', t['spacing'])])
                    if t['double']:
                        o['doubleStuds'] = True
                    o['maxHeight'] = t['h1']
                    variants.append(o)
                    if not t['double'] and t['th'] == dth:
                        hmax[t['spacing']] = t['h1']
        eis = sorted({v['ei'] for v in vs if v['ei']})
        rws = [v['rw'] for v in vs if v['rw']]
        pages = sorted({v['page'] for v in vs})
        title = f'{kind} C{prof}' + (' z przewiązkami PWA' if pwa else '') + ', '
        title += (layer_desc(default['codes'], nl, dth).split(' (')[0].replace(' ' + short(dcode, dth), '') + ' (warstwy mieszane)') if mixed else f'{nl}×{pl(dth)} obustronnie'
        if mixed:
            title = f'{kind} C{prof}' + (' z przewiązkami PWA' if pwa else '') + ', ' + layer_desc(default['codes'], nl, dth) + ' obustronnie'
        w = OrderedDict()
        w['id'] = sid
        w['name'] = f'Nida Ściana {default["sys"]} – {title}'
        w['category'] = cat
        w['frame'] = frame
        w['profile'] = prof
        w['layers'] = nl
        w['sides'] = sides
        w['defaultBoard'] = board_id(dcode, dth)
        if mixed:
            w['innerBoard'] = board_id(default['codes'][0], dth)
            w['innerLayers'] = inner_count(default['codes'], nl)
        if mid:
            w['midBoard'] = mid
        w['studSpacing'] = default['spacing']
        if not default['double']:  # same słupki zdwojone (BS): wysokości tylko w odmianach
            w['maxHeight'] = {sp: hmax[sp] for sp in (30, 40, 60) if sp in hmax}
        w['insulationDefault'] = bool(default['wool'])
        if eis:
            w['fire'] = f'EI {eis[0]}' if len(eis) == 1 else f'EI {eis[0]} – EI {eis[-1]}'
        if rws:
            w['acoustic'] = f'Rw do {max(rws)} dB'
        if frame == 'separate':
            w['gap'] = max(0.5, (default['thk'] - 2 * prof - 2 * nl * dth) / 10)
        info = [f'Grubość {pl(default["thk"])} mm',
                f'słupki C{prof}{" zdwojone" if default["double"] else ""} co {default["spacing"]} cm do {pl(default["maxh"] / 100)} m (płyta {short(dcode, dth)})']
        extra = [f'co {sp} cm do {pl(hmax[sp] / 100)} m' for sp in (40, 30) if sp in hmax and sp != default['spacing']]
        if extra:
            info.append('gęstsze słupki bez wymagań ogniowych: ' + ', '.join(extra) + ' (tablice doboru wysokości)')
        if any(v['double'] for v in vs) or any(o.get('doubleStuds') for o in variants):
            info.append('wyższe odmiany na słupkach zdwojonych (' + {'A': 'AA', 'SW': 'SWSW'}.get(fam, 'BB') + ')')
        if fam == 'SW' or bs:
            info.append('profil U100 specjalny przy stropie i wkręty FLAT HEAD do blachy 2 mm wg karty – aplikacja liczy zwykłe U100; słupki łączone na długości wg karty')
        if bs:
            info.append('przewiązki z blachy stalowej 2 mm między rzędami (1 szt./m² wg karty) – aplikacja ich nie liczy, dolicz wg karty')
        if mid:
            info.append(f'płyta dosztywniająca {short("OP", 12.5)} 12,5 mm między rzędami, przykręcona do słupków jednego rzędu (liczona w płytach i wkrętach)')
        if pwa:
            info.append('przewiązki wibroakustyczne Nida PWA co ≤ 100 cm między rzędami – aplikacja ich nie liczy, dolicz wg karty')
        if mixed:
            info.append(f'warstwa wewnętrzna {short(default['codes'][0], dth)}, zewnętrzna {short(dcode, dth)}')
        if frame == 'separate':
            info.append('rozstaw rusztów dowolny – podana grubość minimalna')
        w['info'] = ' · '.join(info)
        w['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER["04"]}, karty s. ' + ', '.join(str(p) for p in pages))
        w['maker'] = 'siniat'
        w['variants'] = variants
        walls.append(w)
    return walls


# --- okładziny wolnostojące (3), kotwione (2), szachty (10) --------------------------------------
LIN_CODE = re.compile(r'^(C|CC|CD|PK48|UAR|UU)?(\d+)?')


def lining_rows(ch):
    out = []
    for c in load(ch):
        for r in c['rows']:
            code, rest = split_code(r)
            parts = code.split('/')
            bname = parts[-1]
            try:
                codes = board_codes(bname)
            except KeyError:
                skip(code, 'okładziny akustyczne Sonic, RTG')
                continue
            cl = find_clad(rest)
            if not cl:
                continue
            nl, th, ci = cl
            codes, th = apply_mix(codes, rest, nl, th)
            out.append(dict(page=c['page'], title=c['title'], code=code, parts=parts, rest=rest, codes=codes, layers=nl, th=th, ci=ci))
    return out


def tail(rest, start):
    """Wysokość, akustyka, masa, EI od pozycji `start`."""
    hi = next((i for i in range(start, len(rest)) if (num(rest[i]) or 0) >= 2000 or rest[i].startswith('bez ogranicz')), None)
    mis = [i for i, t in enumerate(rest) if is_mass(t)]
    if not mis:
        print('BRAK MASY', rest, file=sys.stderr)
    mi = mis[-1] if mis else len(rest)
    h = num(rest[hi]) // 10 if hi is not None and num(rest[hi]) else None
    ac = [num(t) for t in rest[(hi + 1 if hi is not None else mi):mi] if num(t)]
    return hi, h, ac, (num(rest[mi]) if mis else None), ei_of(rest[mi + 1:])


def make_linings():
    walls = []
    # 1) okładziny wolnostojące na C (rozdz. 3) i szachty na C (rozdz. 10)
    for ch, cat, kind in (('03', 'okładzina', 'Okładzina wolnostojąca'), ('10', 'szacht', 'Obudowa pionu instalacyjnego')):
        groups = OrderedDict()
        for r in lining_rows(ch):
            sysc = r['parts'][0]
            # rodzaj słupka: C (CW), UA (profil ościeżnicowy UAR, 2 mm), UU (para U w skrzynkę z płytą rdzeniową)
            if ch == '03':
                m = re.match(r'^(UARUAR|UAR|CC|C)(\d+)-', sysc)
                if not m:
                    skip(r['code'].rsplit('/', 1)[0], 'okładziny wolnostojące z łącznikami stabilizacyjnymi LS (opłytowanie na 3/4 wysokości, karta bez pełnej tabeli parametrów)')
                    continue
                double, prof, kind_s = m[1] in ('CC', 'UARUAR'), int(m[2]), 'UA' if m[1].startswith('UAR') else 'C'
            else:
                m = re.match(r'^([\d,]+)(AA|A)(\d+)$', sysc)
                mua = re.match(r'^([\d,]+)(AA|A)$', sysc) and len(r['parts']) > 2 and re.match(r'^UAR(\d+)$', r['parts'][1])
                muu = re.match(r'^([\d,]+)UU(\d+)$', sysc)
                if m:
                    double, prof, kind_s = m[2] == 'AA', int(m[3]), 'C'
                elif mua:
                    double, prof, kind_s = sysc.endswith('AA'), int(mua[1]), 'UA'
                elif muu:
                    double, prof, kind_s = False, int(muu[2]), 'UU'
                else:
                    skip(sysc, 'obudowy pionów bez konstrukcji nośnej (płyty samonośne skręcane ze sobą) – inny rodzaj zabudowy niż ruszt')
                    continue
            rest = r['rest']
            # rozstaw: pierwsza wartość 600/400/300 za poszyciem
            sp = next((int(t) // 10 for t in rest[r['ci'] + 1:] if t in ('600', '400', '300')), 60)
            hi, h, ac, mass, ei = tail(rest, r['ci'] + 1)
            woolm = [num(t) for t in rest[r['ci'] + 1:hi] if num(t)]
            wool = int(woolm[-2]) if len(woolm) >= 3 else 0
            groups.setdefault((kind_s, prof, r['layers'], mix_key(r['codes'])), []).append(
                dict(r, double=double, spacing=sp, maxh=h, ac=ac, mass=mass, ei=ei, wool=wool))
        for (kind_s, prof, nl, mixed), vs in groups.items():
            single = [v for v in vs if not v['double']]
            default = min(single or vs, key=lambda v: (PREF.index(v['codes'][-1]), v['th'], -(v['maxh'] or 0)))
            dcode, dth = default['codes'][-1], default['th']
            pfx = 'SN-O' if ch == '03' else 'SN-SZ'
            sid = f'{pfx}-{"C" if kind_s == "C" else kind_s}{prof}-{nl}' + (f'-{mix_id(mixed)}' if mixed else '')
            pname = {'C': f'C{prof}', 'UA': f'UAR{prof}', 'UU': f'UU{prof}'}[kind_s]
            variants = []
            for v in sorted(vs, key=lambda v: (v['double'], PREF.index(v['codes'][-1]), v['th'], v['ei'] or 0)):
                outer = v['codes'][-1]
                o = OrderedDict()
                o['code'] = v['code'].rsplit('/', 1)[0]
                lab = layer_desc(v['codes'], nl, v['th']) + f' · {"słupki" if kind_s == "UU" else "profile"} {pname}{" zdwojone" if v["double"] else ""} co {v["spacing"]} cm'
                if kind_s == 'UU':
                    lab += ' · w tym 1 warstwa rdzeniowa w ruszcie'
                lab += f' · wełna {v["wool"]} mm' if v['wool'] else ''
                o['label'] = lab
                o['board'] = board_id(outer, v['th'])
                if len(v['codes']) > 1:
                    o['innerBoards'] = [board_id(v['codes'][0], v['th'])]
                o['studSpacing'] = v['spacing']
                if v['double']:
                    o['doubleStuds'] = True
                if v['maxh']:
                    o['maxHeight'] = v['maxh']
                if v['ei']:
                    o['fire'] = v['ei']
                if v['ac']:
                    o['rw'] = v['ac'][0]
                    if len(v['ac']) > 1:
                        o['ra1'] = v['ac'][1]
                if v['wool']:
                    o['wool'] = v['wool']
                o['mass'] = v['mass']
                variants.append(o)
            # dwa wiersze karty z tym samym poszyciem, różniące się klasą EI (np. 105UU75) – EI w opisie
            labs = [(o.get('board'), o['label']) for o in variants]
            for o in variants:
                if labs.count((o.get('board'), o['label'])) > 1 and o.get('fire'):
                    o['label'] += f' · EI {o["fire"]}'
            eis = sorted({v['ei'] for v in vs if v['ei']})
            pages = sorted({v['page'] for v in vs})
            w = OrderedDict()
            w['id'] = sid
            desc = layer_desc(default['codes'], nl, dth) if mixed else f'{nl}×{pl(dth)}'
            w['name'] = ('Nida Tynk – ' if ch == '03' else 'Nida Szacht – ') + f'{kind.lower()} na {pname}' + (
                f' (2×U{prof} skręcone w skrzynkę)' if kind_s == 'UU' else ' (profile UA, 2 mm)' if kind_s == 'UA' else '') + f', {desc}'
            w['category'] = cat
            w['frame'] = 'single'
            w['profile'] = prof
            if kind_s != 'C':
                w['studKind'] = kind_s
            w['layers'] = nl
            w['sides'] = 1
            w['defaultBoard'] = board_id(dcode, dth)
            if mixed:
                w['innerBoard'] = board_id(default['codes'][0], dth)
                w['innerLayers'] = inner_count(default['codes'], nl)
            w['studSpacing'] = default['spacing']
            if default['maxh'] and not default['double']:  # same profile zdwojone: wysokości tylko w odmianach
                w['maxHeight'] = {default['spacing']: default['maxh']}
            w['insulationDefault'] = bool(default['wool'])
            if eis:
                w['fire'] = f'EI {eis[0]}' if len(eis) == 1 else f'EI {eis[0]} – EI {eis[-1]}'
            head = {'C': f'Profile C{prof}', 'UA': f'Profile ościeżnicowe UAR{prof} (blacha 2 mm)', 'UU': f'Słupki z dwóch profili U{prof} skręconych w skrzynkę'}[kind_s]
            info = [head + f' co {default["spacing"]} cm' + (f' do {pl(default["maxh"] / 100)} m' if default['maxh'] else ''),
                    'bez mocowania do ściany (U góra i dół)' if ch == '03' else 'obudowa jednostronna, U góra i dół']
            if kind_s == 'UA':
                info.append(f'na końcu każdego profilu kątownik do UA{prof} ze śrubami M8')
            if kind_s == 'UU':
                info.append('para UD 27 wzdłuż słupka trzyma płytę rdzeniową (pierwsza warstwa, osadzona w ruszcie) – aplikacja liczy UD 30, płytę rdzeniową jako warstwę wewnętrzną')
            if any(v['double'] for v in vs):
                info.append('wyższe odmiany na profilach zdwojonych (' + (('UARUAR' if kind_s == 'UA' else 'CC') if ch == '03' else 'AA') + ')'
                            + (' skręconych śrubami M8' if kind_s == 'UA' else ''))
            if ch == '03':
                info.append('przyrost izolacyjności ściany masywnej podany jako Rw/RA1 okładziny z kartą (układ z kartą)')
            w['info'] = ' · '.join(info)
            w['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER[ch]}, karty s. ' + ', '.join(str(p) for p in pages))
            w['maker'] = 'siniat'
            w['variants'] = variants
            walls.append(w)
    # 2) okładziny kotwione (rozdz. 2): CD/ES, CD/EL, C100/L, C/PWA, Nida Fix
    groups = OrderedDict()
    for r in lining_rows('02'):
        sysc = r['parts'][0]
        rest = r['rest']
        if sysc.startswith('CD'):
            el = sysc.startswith('CD/EL') or (len(r['parts']) > 1 and r['parts'][1].startswith('EL'))
            m = re.match(r'^CD/(ES|EL)-', r['code'])
            el = bool(m and m[1] == 'EL')
            nums = [num(t) for t in rest[r['ci'] + 1:]]
            ints = [x for x in nums if isinstance(x, int)]
            bracket, sp = ints[0] // 10, ints[1] // 10
            hi, h, ac, mass, ei = tail(rest, r['ci'] + 1)
            key = ('CD', 'EL' if el else 'ES', r['layers'], mix_key(r['codes']))
            groups.setdefault(key, []).append(dict(r, bracket=bracket, spacing=sp, maxh=None, ac=ac, mass=mass, ei=ei, double=False))
        elif re.match(r'^CC?\d+$', sysc) and len(r['parts']) > 2 and r['parts'][1].startswith(('L-', 'PWA-')):
            prof = int(sysc.lstrip('C'))
            how = r['parts'][1].split('-')[0]
            nums = [num(t) for t in rest[r['ci'] + 1:]]
            ints = [x for x in nums if isinstance(x, int)]
            fix, sp = ints[0] // 10, ints[1] // 10
            # wysokość szukamy za rozstawem profili (rozstaw kątowników 2500 to nie wysokość)
            si = next(i for i in range(r['ci'] + 1, len(rest)) if rest[i] in ('600', '400', '300'))
            hi, h, ac, mass, ei = tail(rest, si + 1)
            double = 'ZDWOJONEJ' in r['title']
            key = (how, prof, r['layers'], mix_key(r['codes']))
            groups.setdefault(key, []).append(dict(r, bracket=fix, spacing=sp, maxh=h, ac=ac, mass=mass, ei=ei, double=double))
        else:
            skip(sysc, 'okładziny kotwione na profilach kapeluszowych PK48 (wall), Sonic, RTG')
    for key, vs in groups.items():
        how = key[0]
        nl = key[2]
        mixed = key[3]
        default = min([v for v in vs if not v['double']] or vs, key=lambda v: (PREF.index(v['codes'][-1]), v['th']))
        dcode, dth = default['codes'][-1], default['th']
        variants = []
        for v in sorted(vs, key=lambda v: (v['double'], PREF.index(v['codes'][-1]), v['th'], v['ei'] or 0)):
            o = OrderedDict()
            o['code'] = v['code'].rsplit('/', 1)[0]
            lab = layer_desc(v['codes'], nl, v['th'])
            if how == 'CD':
                lab += f' · CD 60 co {v["spacing"]} cm · uchwyty {"elastyczne EL60" if key[1] == "EL" else "ES60"} co {v["bracket"]} cm'
            else:
                lab += f' · profile C{key[1]}{" zdwojone" if v["double"] else ""} co {v["spacing"]} cm'
                lab += f' · {"kątowniki stalowe" if how == "L" else "przewiązki Nida PWA"} co {v["bracket"]} cm'
            o['label'] = lab
            o['board'] = board_id(v['codes'][-1], v['th'])
            if len(v['codes']) > 1:
                o['innerBoards'] = [board_id(v['codes'][0], v['th'])]
            o['studSpacing'] = v['spacing']
            if v['double']:
                o['doubleStuds'] = True
            if v['maxh']:
                o['maxHeight'] = v['maxh']
            if v['ei']:
                o['fire'] = v['ei']
            o['mass'] = v['mass']
            variants.append(o)
        eis = sorted({v['ei'] for v in vs if v['ei']})
        pages = sorted({v['page'] for v in vs})
        w = OrderedDict()
        desc = layer_desc(default['codes'], nl, dth) if mixed else f'{nl}×{pl(dth)}'
        if how == 'CD':
            el = key[1] == 'EL'
            w['id'] = f'SN-O-CD{"EL" if el else "ES"}-{nl}' + (f'-{mix_id(mixed)}' if mixed else '')
            w['name'] = f'Nida Tynk – okładzina kotwiona na CD 60 i uchwytach {"elastycznych EL60" if el else "ES60"}, {desc}'
            w['frame'] = 'cd-lining'
            w['profile'] = 50
        else:
            prof = key[1]
            w['id'] = f'SN-O-C{prof}{how}-{nl}' + (f'-{mix_id(mixed)}' if mixed else '')
            w['name'] = f'Nida Tynk – okładzina kotwiona na C{prof} ({"kątowniki stalowe" if how == "L" else "przewiązki PWA"}), {desc}'
            w['frame'] = 'single'
            w['profile'] = prof
        w['category'] = 'okładzina'
        w = OrderedDict([('id', w['id']), ('name', w['name']), ('category', 'okładzina'), ('frame', w['frame']), ('profile', w['profile'])])
        w['layers'] = nl
        w['sides'] = 1
        w['defaultBoard'] = board_id(dcode, dth)
        if mixed:
            w['innerBoard'] = board_id(default['codes'][0], dth)
            w['innerLayers'] = inner_count(default['codes'], nl)
        w['studSpacing'] = default['spacing']
        if default['maxh'] and not default['double']:
            w['maxHeight'] = {default['spacing']: default['maxh']}
        w['insulationDefault'] = False
        if eis:
            w['fire'] = f'EI {eis[0]}' if len(eis) == 1 else f'EI {eis[0]} – EI {eis[-1]}'
        if how == 'CD':
            w['bracketSpacing'] = default['bracket']
            info = [f'Profile CD 60 pionowo co {default["spacing"]} cm, uchwyty co {default["bracket"]} cm, UD 27 góra i dół', 'wysokość bez ograniczeń wg karty']
            if key[1] == 'EL':
                info.append('uchwyty elastyczne EL60 aplikacja liczy jak ES (ta sama liczba sztuk)')
        else:
            brackets = {v['bracket'] for v in vs}
            assert len(brackets) == 1, (key, brackets)
            w['wallTie'] = OrderedDict([('kind', 'angle' if how == 'L' else 'pwa'), ('spacing', default['bracket'])])
            info = [f'Profile C{key[1]} co {default["spacing"]} cm' + (f' do {pl(default["maxh"] / 100)} m' if default['maxh'] else ''),
                    (f'kotwione do ściany kątownikami stalowymi (do UA{key[1]}) przy posadzce, przy stropie i co {default["bracket"]} cm w pionie'
                     if how == 'L' else f'kotwione do ściany przewiązkami wibroakustycznymi Nida PWA{key[1]} co {default["bracket"]} cm w pionie')]
            if any(v['double'] for v in vs):
                dh = max(v['maxh'] or 0 for v in vs if v['double'])
                info.append(f'wyższe odmiany na profilach zdwojonych (CC{key[1]}' + (f', do {pl(dh / 100)} m)' if dh else ')'))
        w['info'] = ' · '.join(info)
        w['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER["02"]}, karty s. ' + ', '.join(str(p) for p in pages))
        w['maker'] = 'siniat'
        w['variants'] = variants
        walls.append(w)
    # suchy tynk Nida Fix (karta bez tabeli odmian w PDF – tylko zużycie kleju)
    fix = next(c for c in load('02') if 'NIDA FIX' in c['title'])
    klej = next(x for x in fix['cons'] if x[0].startswith('Klej'))
    walls.append(OrderedDict([
        ('id', 'SN-O-FIX'), ('name', 'Nida Tynk – suchy tynk, płyta na kleju gipsowym Nida Fix'), ('category', 'okładzina'),
        ('frame', 'glued'), ('profile', 50), ('layers', 1), ('sides', 1), ('defaultBoard', 'SN-EXP12.5'), ('studSpacing', 60),
        ('insulationDefault', False),
        ('info', f'Płyty klejone placekami kleju gipsowego Nida Fix do równego, nośnego podłoża · zużycie kleju {klej[2]} kg/m² wg karty'),
        ('source', card_src('02', fix['page'])), ('maker', 'siniat'),
    ]))
    return walls


# --- sufity podwieszane (rozdz. 6) ---------------------------------------------------------------
def make_ceilings():
    groups = OrderedDict()
    for c in load('06'):
        if 'Z DODATKOWYM' in c['title'] or 'WDNW60' in c['title']:
            skip(f'karta s. {c["page"]}', 'sufity z dodatkowym obciążeniem sufitem akustycznym i z odpornością ogniową obustronną (WDNW60)')
            continue
        for r in c['rows']:
            code, rest = split_code(r)
            m = re.match(r'^(DK/ES|DK/WON|DK/WO|JK/WO|WON|WO|ES|WP)/CD60-([\d,]+)/', code) or re.match(r'^(DK/MFC)-([\d,]+)/', code)
            if not m:
                skip(code.rsplit('/', 1)[0], 'sufity na PK48, MF, UA50, gięte, Sonic, RTG, z dodatkowym sufitem akustycznym, jednopoziomowe na wieszakach WO/WON')
                continue
            typ = m[1]
            try:
                codes = board_codes(code.split('/')[-1])
            except KeyError:
                skip(code, 'sufity na PK48, MF, UA50, gięte, Sonic, RTG, z dodatkowym sufitem akustycznym, jednopoziomowe na wieszakach WO/WON')
                continue
            nl, th, ci = find_clad(rest)
            codes, th = apply_mix(codes, rest, nl, th)
            ints = [num(t.split('/')[0]) for t in rest[1:ci]]
            ints = [x for x in ints if isinstance(x, int)]
            if typ in ('ES', 'WP', 'WO', 'WON'):
                main, sec, hang = None, ints[0] // 10, ints[1] // 10
            else:
                main, sec, hang = ints[0] // 10, ints[1] // 10, ints[2] // 10
            mi = max(i for i, t in enumerate(rest) if is_mass(t))
            minh = num(rest[ci + 1])
            ei = ei_of(rest[mi + 1:])
            groups.setdefault((typ, nl, mix_key(codes)), []).append(dict(page=c['page'], code=code, codes=codes, th=th, main=main, sec=sec, hang=hang,
                                                         mass=num(rest[mi]), ei=ei, minh=minh))
    out = []
    NAMES = {
        'ES': ('direct', 'es', 'sufit na CD 60 i uchwytach ES60 (jednopoziomowy, równoległy)'),
        'WP': ('direct', 'attic', 'sufit na CD 60 i wieszakach WP60 (jednopoziomowy, równoległy)'),
        'WO': ('parallel', 'noniusz', 'sufit na CD 60 i wieszakach obrotowych WO60 (jednopoziomowy, równoległy)'),
        'WON': ('parallel', 'noniusz', 'sufit na CD 60 i wieszakach obrotowych z noniuszem WON60 (jednopoziomowy, równoległy)'),
        'DK/MFC': ('two-level', 'noniusz', 'sufit krzyżowy dwupoziomowy na profilach Nida MF (MFCP44 + MFCC50) i kątownikach MFC2330'),
        'JK/WO': ('one-level', 'noniusz', 'sufit krzyżowy jednopoziomowy CD 60 na wieszakach obrotowych WO60'),
        'DK/ES': ('two-level', 'es', 'sufit krzyżowy dwupoziomowy CD 60 na uchwytach ES60'),
        'DK/WO': ('two-level', 'noniusz', 'sufit krzyżowy dwupoziomowy CD 60 na wieszakach obrotowych WO60'),
        'DK/WON': ('two-level', 'noniusz', 'sufit krzyżowy dwupoziomowy CD 60 na wieszakach obrotowych z noniuszem WON60'),
    }
    for (typ, nl, mixed), vs in groups.items():
        kind, hanger, title = NAMES[typ]
        single = [v for v in vs if len(v['codes']) == 1]
        default = min(single or vs, key=lambda v: (PREF.index(v['codes'][-1]), v['th']))
        dcode, dth = default['codes'][-1], default['th']
        variants = []
        for v in vs:
            o = OrderedDict()
            o['code'] = v['code'].rsplit('/', 1)[0]
            lab = layer_desc(v['codes'], nl, v['th'])
            if v['main']:
                lab += f' · główne {"MFCP44" if typ == "DK/MFC" else "CD"} co {v["main"]} cm'
            lab += f' · nośne {"MFCC50" if typ == "DK/MFC" else "CD"} co {v["sec"]} cm'
            lab += f' · {"uchwyty" if hanger == "es" else "zawiesia" if typ == "DK/MFC" else "wieszaki"} co {v["hang"]} cm · zabudowa min. {pl(v["minh"])} mm'
            o['label'] = lab
            o['board'] = board_id(v['codes'][-1], v['th'])
            if len(v['codes']) > 1:
                o['innerBoards'] = [board_id(v['codes'][0], v['th'])]
            if v['ei']:
                o['fire'] = v['ei']
            o['thickness'] = v['minh']
            o['mass'] = v['mass']
            variants.append(o)
        eis = sorted({v['ei'] for v in vs if v['ei']})
        pages = sorted({v['page'] for v in vs})
        s = OrderedDict()
        s['id'] = f'SN-S-{typ.replace("/", "")}-{nl}' + (f'-{mix_id(mixed)}' if mixed else '')
        s['name'] = f'Nida Sufit {typ}{"" if typ == "DK/MFC" else "/CD60"} – {title}, ' + (layer_desc(default['codes'], nl, dth) if mixed else f'{nl}×{pl(dth)}')
        s['kind'] = kind
        s['layers'] = nl
        s['defaultBoard'] = board_id(dcode, dth)
        if mixed:
            s['innerBoard'] = board_id(default['codes'][0], dth)
            s['innerLayers'] = inner_count(default['codes'], nl)
        s['mainSpacing'] = default['main'] or default['sec']
        s['secondarySpacing'] = default['sec']
        s['hangerSpacing'] = default['hang']
        s['hangerType'] = hanger
        s['screwsOuter'] = 25 if default['sec'] >= 50 else 30
        s['screwsInner'] = 10 if default['sec'] >= 50 else 12
        if eis:
            s['fire'] = f'EI {eis[0]}' if len(eis) == 1 else f'EI {eis[0]} – EI {eis[-1]}'
        if typ == 'DK/MFC':
            # karta s. 31–33: MFCP44 + MFCC50, przyścienny MFCE26, zawiesia z kątownika MFC2330 (zużycie przy zwieszeniu 500 mm),
            # wkręty 4,2×13 FLAT HEAD do łączenia profili; wysokość rusztu = min. wysokość podwieszenia – płyta (82,5 – 12,5)
            s['profiles'] = OrderedDict([('main', 'MFCP44'), ('secondary', 'MFCC50'), ('edge', 'MFCE26'),
                                         ('label', 'Nida MF: profil główny MFCP44, sufitowy MFCC50, przyścienny MFCE26'),
                                         ('frameMm', 70), ('hangerAngle', 'MFC2330_MB'), ('hangerOverlap', 0.1),
                                         ('screw', 'WKRET_FLAT13'), ('crossScrews', 2), ('hangerScrews', 2)])
        info = []
        if typ == 'DK/MFC':
            info.append(f'Profile główne MFCP44 co {default["main"]} cm, sufitowe MFCC50 co {default["sec"]} cm wpinane w główne')
            info.append(f'zawiesia z kątownika MFC2330 co {default["hang"]} cm (płyta {short(dcode, dth)}), przykręcone do stropu i do MFCP44; dla płyt cięższych i ogniowych rozstawy w odmianach')
            info.append('kątownik liczony w mb: zwieszenie + 10 cm na zawiesie (założenie); wkręty 4,2×13 FLAT HEAD: 2 na skrzyżowanie i 2 na zawiesie (założenie, karta podaje łącznie 9–10 szt./m²)')
        elif default['main']:
            info.append(f'Profile główne CD 60 co {default["main"]} cm, nośne co {default["sec"]} cm')
        else:
            info.append(f'Profile CD 60 co {default["sec"]} cm')
        if typ != 'DK/MFC':
            info.append(f'{"uchwyty ES60" if hanger == "es" else "wieszaki WP60" if hanger == "attic" else "wieszaki"} co {default["hang"]} cm (płyta {short(dcode, dth)}); dla płyt cięższych i ogniowych rozstawy w odmianach')
        if typ in ('WO', 'JK/WO', 'DK/WO'):
            info.append('wieszaki obrotowe WO60 liczone w zestawieniu jak wieszaki noniuszowe (ta sama liczba sztuk)')
        info.append('liczba wkrętów do płyt na m² przyjęta jak w pozostałych sufitach aplikacji, nie z tabeli zużycia karty')
        s['info'] = ' · '.join(info)
        s['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER["06"]}, karty s. ' + ', '.join(str(p) for p in pages))
        s['maker'] = 'siniat'
        s['variants'] = variants
        out.append(s)
    return out


# --- poddasza i dachy skośne (rozdz. 8 i 9) ------------------------------------------------------
ATTIC = {
    'WP': ('hanger', 'attic', 'na CD 60 i wieszakach do poddaszy WP60'),
    'ES': ('hanger', 'es', 'na CD 60 i elementach ES60'),
    'EL': ('hanger', 'elastic', 'na CD 60 i elementach elastycznych EL60'),
    'PK': ('direct', None, 'na profilach kapeluszowych PK48 przykręconych do krokwi'),
    'LD': ('direct', None, 'na łatach drewnianych przykręconych do krokwi'),
    'ES/DK': ('hanger', 'es', 'na ruszcie krzyżowym CD 60 i elementach ES60'),
    'EL/DK': ('hanger', 'elastic', 'na ruszcie krzyżowym CD 60 i elementach elastycznych EL60'),
    'DK/MFC': ('hanger', None, 'na ruszcie krzyżowym z profili MF i kątownikach MFC2330'),
}

# Ruszt krzyżowy (karty rozdz. 8 s. 11–14, rozdz. 9 s. 17–22): profile nośne pod krokwiami mocowane co max 100 cm,
# profile pod płyty w poprzek krokwi co 40 cm. Zasięg wieszaka pod krokwią = jak w ruszcie jednopoziomowym
# (ES 125 mm, EL60 90 mm) + drugi poziom CD 27 mm – założenie aplikacji, karty go nie podają.
def cross_frame(typ):
    cd = OrderedDict([('mount', 'hanger'), ('profile', 'CD60'), ('profileLabel', 'profil CD 60 pod płyty'), ('profileMm', 27), ('edge', 'UD30')])
    if typ == 'DK/MFC':
        return OrderedDict([('mount', 'hanger'), ('profile', 'MFCC50'), ('profileLabel', 'profil sufitowy MFCC50'), ('profileMm', 26), ('edge', 'MFCE26'),
                            ('hanger', 'MFC2330'), ('hangerLabel', 'kątownik MFC2330'), ('hangerLn9', 2), ('woodScrews', 2),
                            ('carrier', OrderedDict([('product', 'MFCP44'), ('label', 'profil główny MFCP44'), ('mm', 44), ('maxSpacing', 100), ('crossLn9', 2)]))])
    es = typ == 'ES/DK'
    return OrderedDict(list(cd.items()) + [
        ('hanger', 'WIESZAK_ES' if es else 'UCHWYT_ELAST'), ('hangerLabel', 'element ES60' if es else 'element elastyczny EL60'), ('hangerLn9', 4),
        ('joiner', 'LACZNIK_WZDL'), ('woodScrews', 2), ('maxUnderMm', 145 if es else 115),
        ('maxUnderWhy', 'element ES60 (125 mm) + drugi poziom CD 60' if es else 'element elastyczny EL60 (90 mm) + drugi poziom CD 60'),
        ('carrier', OrderedDict([('product', 'CD60'), ('label', 'profil nośny CD 60'), ('mm', 27), ('maxSpacing', 100),
                                 ('cross', 'LACZNIK_KRZ'), ('crossLabel', 'łącznik krzyżowy LK60')]))])


def make_attics():
    groups = OrderedDict()
    for ch in ('09', '08'):
        for c in load(ch):
            for r in c['rows']:
                code, rest = split_code(r)
                m = re.match(r'^(WP|ES|EL|ES/DK|EL/DK)/CD60/([\d,]+)/|^(PK|LD|DK/MFC)/([\d,]+)/', code)
                if not m:
                    print('PODDASZE nieznany ruszt', ch, c['page'], code, file=sys.stderr)
                    continue
                typ = m[1] or m[3]
                cross = '/DK' in typ or typ.startswith('DK/')
                codes = board_codes(code.split('/')[-1])
                cl = find_clad(rest)
                if not cl:
                    print('PODDASZE bez poszycia', ch, c['page'], code, rest, file=sys.stderr)
                    continue
                nl, th, ci = cl
                ints = [num(t) for t in rest[ci + 1:]]
                ints = [x for x in ints if isinstance(x, int)]
                main = None
                if cross:
                    # mocowanie, rozstaw nośnych, rozstaw profili pod płyty (komórka bywa sklejona z rodzajem wełny)
                    lead = [int(x[1]) for t in rest[ci + 1:] if (x := re.match(r'^(\d{3,4})\b', t))]
                    fix, main, sp = lead[0] // 10, lead[1] // 10, lead[2] // 10
                else:
                    fix, sp = ints[0] // 10, ints[1] // 10
                mi = max(i for i, t in enumerate(rest) if is_mass(t))
                minh = num(rest[mi - 1])
                ei = ei_of(rest[mi + 1:])
                k = (typ, nl)
                vs = groups.setdefault(k, [])
                # rozdz. 9 (Nida Dach, klasyfikacja LBO-039-KZ/21) ma pierwszeństwo; z rozdz. 8 tylko płyty, których tam brak
                if ch == '08' and any(v['codes'] == codes and v['th'] == th for v in vs):
                    continue
                vs.append(dict(ch=ch, page=c['page'], code=code, codes=codes, th=th, fix=fix, sp=sp, main=main, mass=num(rest[mi]), ei=ei, minh=minh))
    out = []
    for (typ, nl), vs in groups.items():
        mount, hanger, title = ATTIC[typ]
        single = [v for v in vs if len(v['codes']) == 1]
        default = min(single or vs, key=lambda v: (PREF.index(v['codes'][-1]), v['th']))
        dcode, dth = default['codes'][-1], default['th']
        variants = []
        for v in sorted(vs, key=lambda v: (len(v['codes']), PREF.index(v['codes'][-1]), v['th'])):
            o = OrderedDict()
            o['code'] = v['code'].rsplit('/', 1)[0]
            lab = layer_desc(v['codes'], nl, v['th']) + f' · {"łaty" if typ == "LD" else "profile"} co {v["sp"]} cm' + (f' · nośne co {v["main"]} cm' if v['main'] else '') + f' · mocowanie co {v["fix"]} cm · zabudowa min. {pl(v["minh"])} mm'
            if v['ei']:
                lab += f' · REI {v["ei"]} ({"Nida Dach" if v["ch"] == "09" else "Nida Poddasze"})'
            o['label'] = lab
            o['board'] = board_id(v['codes'][-1], v['th'])
            if len(v['codes']) > 1:
                o['innerBoards'] = [board_id(v['codes'][0], v['th'])]
            if v['ei']:
                o['fire'] = v['ei']
            o['thickness'] = v['minh']
            o['mass'] = v['mass']
            variants.append(o)
        eis = sorted({v['ei'] for v in vs if v['ei']})
        pages = sorted({(v['ch'], v['page']) for v in vs})
        s = OrderedDict()
        cross = default['main'] is not None
        s['id'] = f'SN-P-{typ.replace("/", "")}-{nl}'
        s['name'] = f'Nida Dach {typ}{"/CD60" if typ in ("WP", "ES", "EL", "ES/DK", "EL/DK") else ""} – zabudowa poddasza {title}, {nl}×{pl(dth)}'
        s['kind'] = 'direct'
        s['layers'] = nl
        s['defaultBoard'] = board_id(dcode, dth)
        s['mainSpacing'] = default['main'] or default['sp']
        s['secondarySpacing'] = default['sp']
        s['hangerSpacing'] = default['fix']
        if hanger:
            s['hangerType'] = hanger
        s['screwsOuter'] = 30
        s['screwsInner'] = 12
        if eis:
            s['fire'] = f'REI {eis[0]}' if len(eis) == 1 else f'REI {eis[0]} – REI {eis[-1]}'
        if cross:
            fr = cross_frame(typ)
            info = [f'Ruszt krzyżowy: {fr["carrier"]["label"]} pod każdą krokwią (rozstaw krokwi maks. {default["main"]} cm), {fr["hangerLabel"]} co maks. {default["fix"]} cm',
                    f'{fr["profileLabel"]} w poprzek krokwi co {default["sp"]} cm']
        else:
            info = [f'{"Łaty drewniane" if typ == "LD" else "Profile " + ("PK48" if typ == "PK" else "CD 60")} co {default["sp"]} cm w układzie równoległym, mocowanie do krokwi co maks. {default["fix"]} cm']
        info += [
                 f'zabudowa min. {pl(default["minh"])} mm', 'klasa REI z konstrukcją dachu i wełną 150 mm (Nida Dach)']
        if typ == 'DK/MFC':
            info.append('karta podaje 0,5 kątownika/m², co nie zgadza się z mocowaniem co 100 cm – aplikacja liczy kątownik w każdym punkcie mocowania; wysokości profili MF przyjęte z nazw (44 i 26 mm)')
        if typ == 'LD':
            info.append('przekrój łat przyjęty 50×30 mm – karta go nie podaje')
        if typ == 'PK':
            info.append('profil PK48 liczony jako profil kapeluszowy 15/48')
        s['info'] = ' · '.join(info)
        src = sorted({v['ch'] for v in vs})
        s['source'] = ('SRC', 'Siniat – Katalog techniczny, ' + ', '.join(CHAPTER[ch] for ch in src) + ', karty s. ' + ', '.join(str(p) for _, p in pages))
        s['maker'] = 'siniat'
        s['attic'] = True
        if typ == 'PK':
            s['atticFrame'] = OrderedDict([('mount', 'direct'), ('profile', 'KAPELUSZ'), ('profileLabel', 'profil kapeluszowy PK48'), ('profileMm', 15),
                                           ('woodScrews', 2)])
        if cross:
            s['atticFrame'] = cross_frame(typ)
        if typ == 'LD':
            s['atticFrame'] = OrderedDict([('mount', 'direct'), ('profile', 'LATA5030'), ('profileLabel', 'łata drewniana'), ('profileMm', 30),
                                           ('woodScrews', 1)])
        s['variants'] = variants
        out.append(s)
    return out


# --- ściany z innym poszyciem z każdej strony (rozdz. 4): RTG z płytą ołowianą, kinowe SLA ----------------------
def make_side_b_walls():
    """
    Strona A = `layers`/`defaultBoard` (+ `innerBoard`), strona B = `sideB` (płyty od rusztu, jak w zapisie karty
    „1x(12,5+0,5)+1x12,5” – pierwsza = przy ruszcie). Wartości z tabel „Parametry techniczne” i „Zużycie materiałów”.
    """
    out = []
    rtg = OrderedDict()
    sla = []
    for c in load('04'):
        if '(NIDA RTG)' in c['title']:
            for r in c['rows']:
                m = re.match(r'^([\d,]+)A(\d+)/RTG-([\d,]+)$', r[0])
                two = '2x12,5/' in ' '.join(r)
                rtg.setdefault((int(m[2]), 2 if two else 1), []).append(dict(page=c['page'], code=r[0], thk=num(m[1]), lead=num(m[3]),
                    wool=num(r[-8]), dens=num(r[-7]), maxh=num(r[-6]) // 10, rw=num(r[-5]), ra1=num(r[-4]), mass=num(r[-3]), ei=ei_of([r[-2]])))
        elif 'KINOWYCH' in c['title']:
            for r in c['rows']:
                sla.append(dict(page=c['page'], code=r[0], ua='UA' in r[1], spacing=int(r[2]) // 10, maxh=num(r[-6]) // 10, rw=num(r[-5]),
                                ra1=num(r[-4]), mass=num(r[-3]), ei=ei_of([r[-2]])))
    for (prof, nl), vs in rtg.items():
        d = vs[0]
        rtg_b = lambda v: ([f'SN-RTG{v["lead"]:g}'] if nl == 1 else [f'SN-RTG{v["lead"]:g}', 'SN-OP12.5'])
        variants = []
        for v in vs:
            o = OrderedDict()
            o['code'] = v['code']
            o['label'] = (f'{nl}×12,5 Ogień+ / ' + ('1×RTG' if nl == 1 else '1×RTG (od rusztu) + 1×12,5 Ogień+') +
                          f' z ołowiem {pl(v["lead"])} mm · słupki co 62,5 cm · wełna {pl(v["wool"])} mm ({pl(v["dens"])} kg/m³)')
            o['board'] = 'SN-OP12.5'
            o['sideB'] = rtg_b(v)
            o['studSpacing'] = 62.5
            o['maxHeight'] = v['maxh']
            if v['ei']:
                o['fire'] = v['ei']
            o['rw'] = v['rw']
            o['ra1'] = v['ra1']
            o['wool'] = v['wool']
            o['thickness'] = v['thk']
            o['mass'] = v['mass']
            variants.append(o)
        w = OrderedDict()
        w['id'] = f'SN-W-A{prof}-RTG-{nl}'
        w['name'] = (f'Nida Ściana {pl(d["thk"])}A{prof}/RTG – ściana działowa C{prof} z płytą RTG (ołów) po jednej stronie, '
                     + ('1×12,5 Ogień Plus / 1×RTG' if nl == 1 else '2×12,5 Ogień Plus / RTG + Ogień Plus'))
        w['category'] = 'działowa'
        w['frame'] = 'single'
        w['profile'] = prof
        w['layers'] = nl
        w['sides'] = 2
        w['defaultBoard'] = 'SN-OP12.5'
        w['sideB'] = rtg_b(d)
        w['studSpacing'] = 62.5
        w['maxHeight'] = {62.5: d['maxh']}
        w['insulationDefault'] = True
        w['fire'] = f'EI {d["ei"]}'
        w['acoustic'] = f'Rw do {max(v["rw"] for v in vs):g} dB'
        w['info'] = ' · '.join([
            f'Grubość {pl(d["thk"])} mm (bez ołowiu)',
            f'strona A: {nl}×12,5 Ogień Plus, strona B: ' + ('płyta Nida RTG' if nl == 1 else 'płyta Nida RTG przy ruszcie + Ogień Plus 12,5'),
            'grubość ołowiu (0,5–3,0 mm) wg projektu osłon – wybierz w „Płyty strony B”',
            f'słupki C{prof} co 62,5 cm (pod płyty szer. 625 mm) do {pl(d["maxh"] / 100)} m',
            'samoprzylepna taśma z ołowiem na słupkach pod płytą RTG: 2,4 mb/m² wg karty (grubość jak ołów w płycie)',
            'karta dopuszcza słupki co 312,5 mm (zużycie w nawiasach) – aplikacja liczy rozstaw 62,5 cm',
        ])
        w['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER["04"]}, karty s. ' + ', '.join(str(p) for p in sorted({v["page"] for v in vs})))
        w['maker'] = 'siniat'
        w['variants'] = variants
        out.append(w)
    # ściany kinowe SLA: dwa rzędy rozsunięte (350–700 mm), łączniki Phoni SL, A: 2×15 + 18, B: 15 + 2×18
    for ua in (False, True):
        vs = [v for v in sla if v['ua'] == ua]
        if not vs:
            continue
        d = vs[0]
        prof = 'UA100' if ua else 'C100'
        variants = []
        for v in vs:
            o = OrderedDict()
            o['code'] = v['code'].split('/')[0] + '/' + v['code'].split('/')[1]
            o['label'] = f'2×15 + 18 Ogień+ / 15 + 2×18 Ogień+ · słupki zdwojone {"UA100" if ua else "C100"} co {v["spacing"]} cm · wełna 2×100 mm'
            o['board'] = 'SN-OP18'
            o['innerBoards'] = ['SN-OP15']
            o['studSpacing'] = v['spacing']
            o['doubleStuds'] = True
            o['maxHeight'] = v['maxh']
            if v['ei']:
                o['fire'] = v['ei']
            o['rw'] = v['rw']
            o['ra1'] = v['ra1']
            o['wool'] = 100
            o['thickness'] = 350
            o['mass'] = v['mass']
            variants.append(o)
        w = OrderedDict()
        w['id'] = 'SN-W-SLA-' + ('UAUA100' if ua else 'CC100')
        w['name'] = f'Nida Ściana SLA – akustyczna ściana kinowa na dwóch rzędach zdwojonych {prof}, 2×15 + 18 / 15 + 2×18 Ogień Plus'
        w['category'] = 'podwójna'
        w['frame'] = 'separate'
        w['profile'] = 100
        w['layers'] = 3
        w['sides'] = 2
        w['defaultBoard'] = 'SN-OP18'
        w['innerBoard'] = 'SN-OP15'
        w['innerLayers'] = 2
        w['sideB'] = ['SN-OP15', 'SN-OP18', 'SN-OP18']
        if ua:
            w['studKind'] = 'UA'
        w['studSpacing'] = d['spacing']
        # minimalna grubość 350 mm wg rysunku karty (350–700 mm): 350 − 2×100 − 48 − 51 = 51 mm między rzędami
        w['gap'] = 5.1
        w['rowTie'] = OrderedDict([('product', 'PHONI_SL'), ('perM2', {40: 1.0} if ua else {60: 0.8, 40: 1.0, 30: 1.6})])
        w['insulationDefault'] = True
        w['fire'] = f'EI {d["ei"]}'
        w['acoustic'] = f'Rw {d["rw"]:g} dB, RA1 {d["ra1"]:g} dB'
        w['info'] = ' · '.join([
            'Grubość 350–700 mm (aplikacja przyjmuje minimalną 350 mm)',
            'strona A: 2×15 + 1×18 Ogień Plus, strona B: 1×15 + 2×18 Ogień Plus (warstwy od rusztu)',
            f'dwa rzędy słupków zdwojonych {prof} połączone łącznikami akustycznymi Phoni SL wg zużycia z karty',
            'wełna 2×100 mm (65 kg/m³) w obu rzędach',
            f'do {pl(max(v["maxh"] for v in vs) / 100)} m',
            'profil U100/80 specjalny przy stropie i wkręty 4,2×70 / FLAT HEAD wg karty – aplikacja liczy U100 i wkręty wg głębokości',
        ] + (['kątowniki UA i śruby M8 jak w ścianach UAUA'] if ua else []))
        w['source'] = ('SRC', f'Siniat – Katalog techniczny, {CHAPTER["04"]}, karta s. {d["page"]}')
        w['maker'] = 'siniat'
        w['variants'] = variants
        out.append(w)
    return out


# --- podstawowe -----------------------------------------------------------------------------------
BASIC = {'SN-W-A50-1', 'SN-W-A75-1', 'SN-W-A100-1', 'SN-W-A75-2', 'SN-W-A100-2', 'SN-W-B75-2', 'SN-W-C75-2', 'SN-O-C50-1', 'SN-O-C75-1',
         'SN-O-CDES-1', 'SN-O-FIX', 'SN-SZ-C75-2', 'SN-S-DKES-1', 'SN-S-DKWON-1', 'SN-S-ES-1', 'SN-P-WP-1', 'SN-P-ES-1'}

wr, tab = wall_rows()
walls = make_walls(wr, tab, None) + make_side_b_walls() + make_linings()
ceilings = make_ceilings() + make_attics()
for x in walls + ceilings:
    if x['id'] in BASIC:
        items = list(x.items())
        i = [k for k, _ in items].index('maker') + 1
        x.clear()
        x.update(items[:i] + [('basic', True)] + items[i:])
ids = [x['id'] for x in walls + ceilings]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
assert BASIC <= set(ids), BASIC - set(ids)


# --- zapis TS ---------------------------------------------------------------------------------
def ts(v):
    if isinstance(v, tuple) and v[0] == 'SRC':
        return f"src('{v[1]}')"
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return '%g' % v
    if isinstance(v, str):
        return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
    if isinstance(v, list):
        return '[' + ', '.join(ts(x) for x in v) + ']'
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{k if str(k).isidentifier() else k}: {ts(x)}' for k, x in v.items() if x is not None) + ' }'
    raise TypeError(v)


def obj(o, ind='  '):
    s = ind + '{\n'
    for k, v in o.items():
        if k == 'variants':
            s += ind + '  variants: [\n' + ''.join(ind + '    ' + ts(x) + ',\n' for x in v) + ind + '  ],\n'
        else:
            s += ind + f'  {k}: {ts(v)},\n'
    return s + ind + '},\n'


hdr = f'''// Katalog systemów suchej zabudowy Siniat (Nida) – ściany działowe, okładziny kotwione i wolnostojące,
// obudowy pionów, sufity podwieszane i zabudowa poddaszy.
//
// Źródło: Siniat – Katalog techniczny „Systemy suchej zabudowy” (rozdziały 2, 3, 4, 6, 8, 9, 10, wersje 2024–2026),
// {DOCS}
// Z kart: tabele „Parametry techniczne” (płyta, liczba warstw, profil, rozstaw, maksymalna wysokość, EI/REI, Rw, RA1,
// wełna, masa, minimalna wysokość zabudowy) i „Tablice doboru maksymalnych wysokości” (rozstaw 40/30 cm, profile zdwojone).
// Formaty płyt: cennik Siniat 08.2026 i strony produktów siniat.pl.
// Jedna pozycja = jedna konstrukcja (rodzaj ściany × profil × liczba warstw); płyty, rozstawy i profile zdwojone
// to odmiany (`variants`). Numer systemu Siniat (np. 100A75) jest w nazwie i w polu `code` odmian.
// Założenia spoza kart są w opisach (`info`): przekrój łat LD, liczba wkrętów w sufitach, uchwyty EL60 liczone jak ES,
// kolejność warstw w ścianach hybrydowych. Pominięte (silnik ich nie liczy) – lista w SINIAT_SKIPPED.
//
// Plik generowany: python3 scripts/gen-siniat.py data/siniat src/catalog/siniat.ts; importuje z `rigips.ts` wyłącznie typy.

import type {{ Board, CeilingSystem, Source, WallSystem }} from './rigips';

const src = (label: string): Source => ({{ label, url: '{DOCS}' }});

'''

out = hdr + 'export const SINIAT_BOARDS: Board[] = [\n'
for (code, t), (bid, name, sh, typ, wdt, lens, desc, color, extra) in BOARDS.items():
    b = OrderedDict([('id', bid), ('name', name), ('short', sh), ('type', typ), ('thickness', t), ('width', wdt), ('lengths', lens),
                     ('description', desc), ('color', color), ('maker', 'siniat')])
    b.update(extra)
    out += obj(b)
out += '];\n\nexport const SINIAT_WALL_SYSTEMS: WallSystem[] = [\n' + ''.join(obj(w) for w in walls)
out += '];\n\nexport const SINIAT_CEILING_SYSTEMS: CeilingSystem[] = [\n' + ''.join(obj(c) for c in ceilings)
out += '];\n\n/** Systemy z kart Siniat, których aplikacja nie liczy (powód: lista kodów) */\nexport const SINIAT_SKIPPED: string[] = [\n'
for why, names in skipped.items():
    out += '  ' + ts(f'{why}: ' + ', '.join(sorted(names))) + ',\n'
out += '];\n'
open(OUT, 'w', encoding='utf-8').write(out)
print(len(walls), 'walls', sum(len(w.get('variants', [])) for w in walls), 'wall variants;', len(ceilings), 'ceilings',
      sum(len(c['variants']) for c in ceilings), 'ceil variants')
if DEBUG:
    for x in walls + ceilings:
        print(x['id'], '|', x['name'], '|', len(x.get('variants', [])))
