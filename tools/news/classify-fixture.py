#!/usr/bin/env python3
"""Runs the reference title classifier (analyze-news.py) over the synthetic news fixture and prints JSON.

Usage: python3 tools/news/classify-fixture.py [titles.json] [rules.json] > test/fixtures/news/expected.json
The TypeScript port (src/features/info/news.ts) must give the same output (INF-2.2 parity test).
"""
import importlib.util, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('analyze_news', os.path.join(here, 'analyze-news.py'))
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)

titles = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'test/fixtures/news/titles.json', encoding='utf-8'))['titles']
rules = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'data/news/news-rules.json', encoding='utf-8'))
out = [dict(title=t, **ref.classify(t, rules)) for t in titles]
print(json.dumps({'generatedBy': 'tools/news/classify-fixture.py', 'items': out}, ensure_ascii=False, indent=1))
