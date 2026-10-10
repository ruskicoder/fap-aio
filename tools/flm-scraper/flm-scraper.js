/*
 * FLM syllabus scraper (browser side, no dependencies).
 *
 * Run on https://flm.fpt.edu.vn while signed in (student role is enough):
 *   - DevTools console: paste this file, then `await flmScrape({ download: true })`.
 *   - chrome-devtools MCP: evaluate `async () => { <this file>; return flmScrape(); }`.
 *
 * Read-only: GET requests to the student routes only, same origin, session cookie.
 * Output: { meta, syllabi: [{ sylId, list, detail, tables, error }] } in FLM's own
 * labels. Normalisation into subject-list.json is done by build-subject-list.mjs.
 */
(function (root) {
  'use strict';

  const LIST_URL = '/gui/role/student/SyllabusManagement';
  const DETAIL_URL = '/gui/role/student/SyllabusDetails?sylID=';
  // Every subject code contains a letter or digit, so the union of these
  // substring searches is the full list (empty keyword returns nothing).
  const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  const TABLES = ['gvMaterial', 'gvLO', 'gvSchedule', 'gvCQ', 'gvAssessment'];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (el) => (el ? el.textContent.replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim() : '');

  async function getDoc(url, retries = 2) {
    for (let i = 0; ; i++) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch (e) {
        if (i >= retries) throw e;
        await sleep(1000 * (i + 1));
      }
    }
  }

  function parseTable(table) {
    if (!table) return null;
    const rows = [...table.rows];
    const headers = rows.length ? [...rows[0].cells].map(text) : [];
    const body = rows.slice(1).map((r) =>
      [...r.cells].map((c) => {
        const box = c.querySelector('input[type=checkbox]');
        if (box) return box.checked;
        const v = text(c);
        const a = c.querySelector('a[href]');
        return a && /^https?:/i.test(a.getAttribute('href')) && !v.includes(a.getAttribute('href')) ? v + ' <' + a.getAttribute('href') + '>' : v;
      })
    );
    return { headers, rows: body };
  }

  async function listSyllabi(delayMs) {
    const all = new Map();
    for (const kw of KEYS) {
      const doc = await getDoc(`${LIST_URL}?searchOn=Code&keyword=${kw}`);
      const t = parseTable(doc.querySelector('table.table-striped'));
      for (const r of t ? t.rows : []) {
        all.set(String(r[0]), { sylId: String(r[0]), code: r[1], subjectName: r[2], syllabusName: r[3], isActive: r[4], isApproved: r[5], decision: r[6] });
      }
      await sleep(delayMs);
    }
    return [...all.values()];
  }

  async function scrapeDetail(sylId) {
    const doc = await getDoc(DETAIL_URL + encodeURIComponent(sylId));
    const det = doc.querySelector('#table-detail');
    if (!det) throw new Error('no #table-detail (signed out or layout changed)');
    const detail = {};
    for (const r of det.rows) {
      if (r.cells.length >= 2) detail[text(r.cells[0]).replace(/:\s*$/, '')] = text(r.cells[1]);
    }
    const tables = {};
    for (const id of TABLES) tables[id] = parseTable(doc.getElementById(id));
    return { detail, tables };
  }

  async function flmScrape(opts = {}) {
    const { delayMs = 150, concurrency = 3, limit = Infinity, only = null, download = false, onProgress = null } = opts;
    if (location.hostname !== 'flm.fpt.edu.vn') throw new Error('run on https://flm.fpt.edu.vn');
    const started = new Date().toISOString();
    let list = await listSyllabi(delayMs);
    if (only) list = list.filter((s) => only.includes(s.code));
    list = list.slice(0, limit);

    const out = new Array(list.length);
    let next = 0;
    let done = 0;
    async function worker() {
      while (next < list.length) {
        const i = next++;
        const s = list[i];
        try {
          out[i] = { sylId: s.sylId, list: s, ...(await scrapeDetail(s.sylId)) };
        } catch (e) {
          out[i] = { sylId: s.sylId, list: s, error: String(e && e.message ? e.message : e) };
        }
        done++;
        if (onProgress) onProgress(done, list.length, s.code);
        await sleep(delayMs);
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

    const result = {
      meta: { source: location.origin, tool: 'tools/flm-scraper/flm-scraper.js', startedAt: started, finishedAt: new Date().toISOString(), count: out.length, errors: out.filter((x) => x.error).length },
      syllabi: out,
    };
    if (download) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: 'application/json' }));
      a.download = `flm-raw-${started.slice(0, 10)}.json`;
      a.click();
    }
    return result;
  }

  root.flmScrape = flmScrape;
})(typeof globalThis !== 'undefined' ? globalThis : window);
