#!/usr/bin/env python3
"""Odczyt tabel z rozdziałów Katalogu technicznego Siniat (PDF) do data/siniat/<rozdział>.json.

Strony PDF to rozkładówki A3 – każdą dzielimy na lewą i prawą połowę (pdftotext -layout).
Na prawej połowie karty są tabele „PARAMETRY TECHNICZNE” i „ZUŻYCIE MATERIAŁÓW NA 1 M2”.
Uruchomienie: python3 scripts/siniat-extract.py <katalog z PDF> data/siniat
Pliki PDF: https://www.siniat.pl/pl-pl/dokumenty/?filter=documentType.eq.TechnicalCatalogue
(02 okładziny kotwione, 03 okładziny wolnostojące, 04 ściany działowe, 06 sufity podwieszane,
08 zabudowa poddaszy, 09 zabudowa dachów skośnych, 10 obudowy pionów).
"""
import json
import os
import re
import subprocess
import sys

UNITS = {'m2', 'mb', 'szt.', 'kg', 'szt', 'm', 'l', 'm3', 'kpl.', 'op.'}


def halves(pdf):
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    n = int(re.search(r'Pages:\s+(\d+)', info)[1])
    w, h = (float(x) for x in re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', info).groups())
    hw = int(w) // 2
    for p in range(1, n + 1):
        for x in (0, hw):
            t = subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), '-x', str(x), '-y', '0', '-W', str(hw), '-H', str(int(h)),
                                '-layout', pdf, '-'], capture_output=True, text=True).stdout
            yield (p, x), [re.sub(r'   +', '  ', l) for l in t.replace('\f', '').split('\n')]


def cells(l):
    return [c.strip() for c in re.split(r'\s{2,}', l.strip()) if c.strip()]


def parse(pdf):
    cards = []
    for (p, x), lines in halves(pdf):
        if not any('PARAMETRY TECHNICZNE' in l for l in lines):
            continue
        i = next(k for k, l in enumerate(lines) if 'PARAMETRY TECHNICZNE' in l)
        title = ' '.join(l.strip() for l in lines[:i] if l.strip() and not re.fullmatch(r'\s*\d{3,4}\s*', l))
        rows, foot, cons, mode = [], [], [], 'param'
        for l in lines[i + 1:]:
            c = cells(l)
            if mode == 'param':
                if (rows and re.match(r'^\s*1\)\s*$', l)) or 'ZUŻYCIE' in l:
                    mode = 'foot'
                elif c and len(c) >= 5 and (re.match(r'^[\d,]+[A-Z]', c[0]) or ('/' in c[0] and not c[0].startswith(('Nida', '[')))) \
                        and sum(bool(re.match(r'^[\d,.]+$', v)) for v in c) >= 2:
                    rows.append(c)
            if mode == 'foot':
                if 'ZUŻYCIE' in l:
                    mode = 'cons'
                elif l.strip():
                    foot.append(l.strip())
            elif mode == 'cons':
                if len(c) >= 3 and c[1] in UNITS:
                    cons.append(c)
                elif c and cons and c[0].startswith('Normy'):
                    break
                elif len(c) >= 2 and cons and re.match(r'^[\d,\-]', c[0]):
                    cons[-1] += c
        cards.append(dict(page=p, x=x, title=title, rows=rows, cons=cons, foot=foot))
    return cards


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    for f in sorted(os.listdir(src)):
        if f.endswith('.pdf'):
            d = parse(os.path.join(src, f))
            json.dump(d, open(os.path.join(out, f[:-4] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
            print(f, len(d), 'kart', sum(len(c['rows']) for c in d), 'wierszy')
