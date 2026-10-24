# Branches, drafts, and files

| Branch | Purpose | Local folder | Local preview |
| --- | --- | --- | --- |
| `main` | Original project | `flood-finder` | http://localhost:3000 |
| `community-interface` | Earlier interface/workflow draft | `flood-finder-community-interface` | http://localhost:3001 when started |
| `flood-finder-v2-weather-addresses` (rename to `local-hazard-map` pending) | Current nearby-hazard map draft | `flood-finder-local-hazard-map` | http://localhost:3002 |

The first working branch was previously `codex/flood-finder-redesign`; the requested new name for `flood-finder-v2-weather-addresses` is `local-hazard-map`. The second rename is pending because the Mac is locked. GitHub's rename operation may close head-branch draft comparisons; replacement named drafts preserve review access. Historical drafts remain in repository history. Each branch holds complete real source files; the draft pull request is the review page, not a separate copy of the files.

`main` remains unchanged. The two working drafts are alternative complete versions against `main`; review the version you want rather than merging both blindly. Runtime databases are ignored and remain separate between local copies.

## Source map

| File/directory | Language/format | Responsibility |
| --- | --- | --- |
| `server.js` | JavaScript | HTTP server, authentication, role checks, routes, caches, live events |
| `store.js` | JavaScript + SQL | SQLite schema, transactions, queries, audit records |
| `services/hazards.js` | JavaScript | Official local hazard retrieval, area geometry, proximity, sources |
| `services/location-weather.js` | JavaScript | Census geocoding and retained optional observation/forecast adapter |
| `public/index.html` | HTML5 | Application views and dialogs |
| `public/app.js` | JavaScript | Client state, area search, filters, map layers, forms, role interfaces |
| `public/styles.css` | CSS3 | Responsive styling and interaction states |
| `public/favicon.svg` | SVG/XML | Brand icon |
| `scripts/admin.js` | JavaScript + SQL | Promote/demote an existing account |
| `test/` | JavaScript | Disposable integration and browser-logic tests |
| `.github/workflows/test.yml` | YAML | GitHub Actions test workflow |
| `render.yaml` | YAML | Unapplied hosting proposal |
| `Dockerfile`, `compose.yaml` | Dockerfile syntax / YAML | Optional container configuration |
| `.env.example` | Environment reference | Configuration examples; not auto-loaded |
| `docs/` | Markdown | Usage, architecture, sources, API, design, testing, release notes |
| `data/` | SQLite runtime files | Local account/report data; never committed |
