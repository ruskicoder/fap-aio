---
id: architecture.fap-v2
type: section
status: draft
owner: unassigned
summary: "External system: the rewritten FAP portal (v2.0.0.0) that FAP-AIO enhances."
sources: []
verified: {commit: "", date: ""}
---

# FAP v2 (external system)

FAP (`https://fap.fpt.edu.vn`) was rewritten from ASP.NET WebForms (`*.aspx`, `ctl00_*` ids, `__VIEWSTATE`) to an ASP.NET MVC application on the Jidox Bootstrap 5 admin template. The footer reads `Version: 2.0.0.0`. Every legacy route, including `/Student.aspx`, returns 404.

FAP-AIO does not own this system. Everything in this section was observed from a logged-in student session on 2026-10-04 by read-only GET requests and by reading the site's own JavaScript. No form was submitted and no POST endpoint was called. See [the scrape record](../../70-work/investigations/2026-10-04-fap-v2-scrape.md).

`sources` is empty because the code lives on FAP's servers. Re-verify with [00-verification-guide.md](00-verification-guide.md) instead of `verify`.

| Document | Holds |
|---|---|
| [00-verification-guide.md](00-verification-guide.md) | How to re-scrape and re-check this section, read-only |
| [endpoints.md](endpoints.md) | Every endpoint found: method, path, parameters, response, evidence |
| [pages.md](pages.md) | DOM contracts (tables, columns, selectors, `data-*` hooks) of the pages FAP-AIO reads |
| [platform.md](platform.md) | CSP, headers, CSRF, partial rendering, auth and other cross-cutting behavior |
| [route-map.md](route-map.md) | Legacy FAP-AIO feature routes mapped to their v2 replacements |
