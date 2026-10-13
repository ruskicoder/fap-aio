#!/usr/bin/env python3
"""Split capture batches (ignore/fixtures-raw/_batches/<culture>/*.json) into one file per page plus index.json.

Raw pages hold personal data and stay under the git-ignored ignore/ folder. The anonymizer
(tools/fixtures/anonymize.mjs, task PLT-5.1) turns them into committed fixtures under test/fixtures/.
Usage: split-capture.py [culture]   (default: en; output ignore/fixtures-raw/<culture>/)
"""
import hashlib, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'ignore' / 'fixtures-raw'
culture = sys.argv[1] if len(sys.argv) > 1 else 'en'
out = root / culture
out.mkdir(parents=True, exist_ok=True)
index_path = out / 'index.json'
index = {e['slug']: e for e in json.loads(index_path.read_text())} if index_path.exists() else {}

for batch in sorted((root / '_batches' / culture).glob('*.json')):
    data = json.loads(batch.read_text())
    if isinstance(data, str):
        data = json.loads(data)
    for r in data:
        body = r.get('body') or ''
        ctype = (r.get('headers') or {}).get('content-type') or ''
        ext = 'json' if 'json' in ctype else 'html'
        name = f"{r['slug']}.{ext}"
        (out / name).write_text(body)
        index[r['slug']] = {
            'slug': r['slug'], 'file': name, 'path': r['path'], 'partial': r.get('partial', False),
            'status': r.get('status'), 'finalUrl': r.get('url'), 'headers': r.get('headers'),
            'bytes': len(body.encode()), 'sha256': hashlib.sha256(body.encode()).hexdigest(),
            'capturedAt': r.get('at'), 'batch': batch.name, 'culture': culture,
        }

index_path.write_text(json.dumps(sorted(index.values(), key=lambda e: e['slug']), ensure_ascii=False, indent=1))
for e in sorted(index.values(), key=lambda e: e['capturedAt'] or ''):
    flag = '' if e['status'] == 200 else '  <-- check'
    print(f"{e['status']} {e['bytes']:>8} {e['slug']:<34} {e['finalUrl']}{flag}")
