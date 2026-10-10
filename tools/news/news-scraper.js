/*
 * FAP news reader (browser side, no dependencies). Read-only GETs, paced.
 *
 * Run on https://fap.fpt.edu.vn while signed in, in the DevTools console:
 *   paste this file, then `await fapNewsScrape({ pages: 6, details: [] , download: true })`.
 * Uses XMLHttpRequest, which FAP's fetch wrapper does not touch, and stops at once on a
 * Cloudflare challenge (HTTP 403 with `cf-mitigated: challenge`); reload FAP to clear it.
 * Output: { meta, types, headers, rows: [{ cells, href }], details: [...] }.
 * Classify with: python3 tools/news/analyze-news.py <file> data/news/news-rules.json
 */
(function (root) {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = (u) =>
    new Promise((res) => {
      const x = new XMLHttpRequest();
      x.open('GET', u);
      x.onload = () => res({ status: x.status, challenge: x.getResponseHeader('cf-mitigated') === 'challenge', html: x.responseText });
      x.onerror = () => res({ status: 0, challenge: false, html: '' });
      x.send();
    });
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  async function fapNewsScrape({ pages = 6, pageSize = 100, details = [], delayMs = 2500, download = false } = {}) {
    if (location.hostname !== 'fap.fpt.edu.vn') throw new Error('run on https://fap.fpt.edu.vn');
    const out = { meta: { startedAt: new Date().toISOString(), stoppedBy: null }, types: [], headers: [], rows: [], details: [] };
    for (let p = 1; p <= pages; p++) {
      const r = await get(`/News?pageIndex=${p}&pageSize=${pageSize}&SortBy=CreatedAt&IsDesc=true`);
      if (r.challenge || r.status !== 200) { out.meta.stoppedBy = r.challenge ? 'cloudflare-challenge' : `http-${r.status}`; break; }
      const d = parse(r.html);
      if (p === 1) {
        out.types = [...d.querySelectorAll('select[name=FAPNewsTypeId] option')].map((o) => [o.value, text(o)]);
        out.headers = [...d.querySelectorAll('table thead th')].map(text);
      }
      const trs = [...d.querySelectorAll('table tbody tr')];
      for (const tr of trs) out.rows.push({ cells: [...tr.children].map(text), href: tr.querySelector('a[href*="/News/Detail/"]')?.getAttribute('href') || null });
      if (trs.length < pageSize) break;
      await sleep(delayMs);
    }
    for (const h of details) {
      if (out.meta.stoppedBy) break;
      await sleep(delayMs);
      const r = await get(h);
      if (r.challenge || r.status !== 200) { out.meta.stoppedBy = r.challenge ? 'cloudflare-challenge' : `http-${r.status}`; break; }
      const d = parse(r.html);
      const body = d.querySelector('.fap-news-content');
      out.details.push({
        href: h,
        type: text(d.querySelector('.fap-news-badge--type')),
        title: text(d.querySelector('.fap-news-detail-title')),
        meta: [...d.querySelectorAll('.fap-news-detail-meta__item')].map(text),
        body: body ? body.innerText : '',
        links: [...(body?.querySelectorAll('a[href]') || [])].map((a) => a.getAttribute('href')).filter((u) => !u.startsWith('/cdn-cgi/')),
        attachments: [...d.querySelectorAll('.fap-news-attachment [data-file-ref]')].map((b) => b.getAttribute('data-file-ref')),
      });
    }
    out.meta.finishedAt = new Date().toISOString();
    if (download) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
      a.download = `fap-news-${out.meta.startedAt.slice(0, 10)}.json`;
      a.click();
    }
    return out;
  }
  root.fapNewsScrape = fapNewsScrape;
})(typeof globalThis !== 'undefined' ? globalThis : window);
