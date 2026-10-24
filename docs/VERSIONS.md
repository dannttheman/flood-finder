# Flood Finder versions

Each GitHub branch contains a complete source version. The draft pull request is its review page; code is stored in the branch's real files.

| Version | GitHub branch | Local folder | Local preview |
| --- | --- | --- | --- |
| Original | `main` | `flood-finder` | http://localhost:3000 |
| v1 — Community Interface | `codex/flood-finder-redesign` | `flood-finder-edits` | http://localhost:3001 |
| v2 — Weather & Address Reporting | `flood-finder-v2-weather-addresses` | `flood-finder-v2-weather-addresses` | http://localhost:3002 |

The original and v1 are preserved. The v1 and v2 draft pull requests are alternative complete versions against main; review the version you want before merging. v2 is a separate draft based on v1. It adds direct-address reporting, multi-type report filters, independent NWS observations and forecasts, and an expanded user guide.

## File organization

- `server.js`: HTTP routes, authentication, permissions, and API caching/rate limits.
- `services/location-weather.js`: Census geocoding and NWS weather adapters.
- `store.js`: persistent SQLite schema and transactions.
- `public/index.html`: browser screens and forms.
- `public/app.js`: browser interactions, filtering, address lookup, and weather display.
- `public/styles.css`: responsive interface styling.
- `test/api.test.js`: account, incident, team, and assignment integration tests.
- `test/client.test.js`: report filters, automatic address location, and live-update regression tests.
- `test/location-weather.test.js`: provider adapters and new API endpoint tests.
- `docs/USER_GUIDE.md`: detailed instructions for residents, administrators, and responders.
- `docs/API.md`: new endpoint contracts and data-source behavior.
- `docs/DESIGN.md`: visual and interaction plan.
- `docs/RENDER.md` and `render.yaml`: deployment proposal; not a live deployment.
- `.github/workflows/test.yml`: GitHub test workflow.
- `data/`: local runtime data only; excluded from GitHub.
