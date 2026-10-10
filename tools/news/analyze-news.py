#!/usr/bin/env python3
"""Classify a FAP news dump with data/news/news-rules.json and print coverage.

Usage: python3 tools/news/analyze-news.py <news-list.json> [rules.json]
The dump is the output of tools/news/news-scraper.js (rows of FAP /News table cells).
"""
import json, re, sys, collections, unicodedata
from datetime import date

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn').replace('đ', 'd')
    return re.sub(r'\s+', ' ', s).strip()

def classify(title, rules):
    t = norm(title)
    tag = next((x['id'] for x in rules['tags'] if x['match'] and re.search(x['match'], t)), 'other')
    fams = [f for f in rules['families'] if re.search(f['match'], t)]
    prio = min((f['priority'] for f in fams), default='P4')
    boost = sum(fl['boost'] for fl in rules['flags'] if re.search(fl['match'], t))
    level = max(1, int(prio[1]) - boost)
    deadline = None
    for rx in rules['deadline']:
        m = re.search(rx, t)
        if m:
            d_, mo, y = map(int, m.groups()[-3:])
            try: deadline = date(y, mo, d_).isoformat()
            except ValueError: pass
            break
    term = {k: (m.group(0) if (m := re.search(rx, t)) else None) for k, rx in rules['term'].items()}
    return {'tag': tag, 'families': [f['id'] for f in fams], 'priority': f'P{level}', 'deadline': deadline, 'term': term}

def main():
    dump = json.load(open(sys.argv[1]))
    rules = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'data/news/news-rules.json'))
    rows = [r for r in dump['rows'] if len(r['cells']) >= 6]
    out = [dict(title=r['cells'][1], created=r['cells'][5], **classify(r['cells'][1], rules)) for r in rows]
    fams = collections.Counter(f for o in out for f in o['families'])
    print(f"items {len(out)}, classified {sum(1 for o in out if o['families'])}, with deadline in title {sum(1 for o in out if o['deadline'])}")
    print('priority', dict(sorted(collections.Counter(o['priority'] for o in out).items())))
    print('tags', dict(collections.Counter(o['tag'] for o in out).most_common()))
    print('families', dict(fams.most_common()))
    left = [o['title'] for o in out if not o['families']]
    print('unclassified', len(left))
    for t in left[:25]: print('  ', t[:140])

if __name__ == '__main__':
    main()
