# Flood Finder

A map for finding nearby hazards and reporting local disruptions: flooding, blocked roads, outages, storm debris, shelter needs, and safety concerns.

The **Local Hazard Map** draft combines two clearly labeled sources:
- **Official areas:** active National Weather Service warnings, watches, advisories, and relevant statements. These are shaded regions, not invented incident pins.
- **Community reports:** location-based submissions. New submissions remain unverified until reviewed.

Weather is supporting evidence for affected areas. The main interface is the map and situation feed, not temperature cards or a general forecast dashboard. The application does not infer a flood, road closure, outage, or fire merely from a weather reading.

## Development and contribution record

Daniel Ladyzhensky (@dannttheman) directed the feature requirements, hazard-map scope, usability fixes and design revisions in this draft. Codex assisted with implementation, tests and documentation. The original application remains credited to its existing repository history. See the [specific contribution record](docs/CONTRIBUTIONS.md) and [documentation index](docs/INDEX.md) for evidence, source attribution and verification limits.

## Start here

- [How to use the application](docs/USER_GUIDE.md)
- [Languages, runtime, libraries, and architecture](docs/ARCHITECTURE.md)
- [Data sources, map boundaries, and coverage limits](docs/DATA_SOURCES.md)
- [API endpoints](docs/API.md)
- [File and branch organization](docs/VERSIONS.md)
- [Design decisions and Sites guidance](docs/DESIGN.md)
- [Testing and verification](docs/TESTING.md)
- [Publishing plan](docs/PUBLISHING.md)
- [Change history](docs/CHANGELOG.md)

## Languages and technologies

| Technology | Role |
| --- | --- |
| JavaScript | Browser interactions and Node.js server/provider logic; ES modules on the server |
| HTML5 | Page structure, forms, dialogs, accessibility labels |
| CSS3 | Responsive layout, map workspace, interface styling |
| SQL | SQLite schema, queries, and transactions |
| YAML | GitHub Actions, the proposed Render configuration, and Docker Compose |
| Dockerfile syntax | Optional container setup |
| JSON / GeoJSON | API data and geographic boundaries; data formats rather than application languages |
| Node.js | Server runtime; tested with 24.15.0, supports >=22.13.0 and <25 |
| SQLite | Embedded persistent database, through built-in `node:sqlite` |
| Leaflet 1.9.4 | Browser map library, loaded from unpkg |
| OpenStreetMap | External base-map tiles |

There is no React, TypeScript, Python application server, or npm runtime dependency to install. Development scripts used to edit files are not part of the application runtime.

## Run locally

1. Install a supported Node.js version.
2. Open this version's source folder in Terminal.
3. Run `PORT=3002 npm start`.
4. Open **http://localhost:3002**. The map is the initial view.

`npm start` alone defaults to port 3000. Use port 3002 for this draft when another local version is already running. No `npm install`, government-data API key, or separate database account is required. Internet access is needed for map assets, tiles, address lookup, and official hazard data.

Local accounts, sessions, and community reports are saved in `data/flood-finder.sqlite`. Runtime data is ignored by Git and is not copied between the local versions. Keep the server running while using the local preview; stop it with Control+C.

Run `npm test` for the automated checks. The tests use temporary databases and mock government responses rather than depending on live emergencies.

## Administrator setup

Register normally in the app first. In the same source folder and with the same database setting, run:

```sh
npm run admin -- promote your-registered-email@example.com
```

Sign in again afterward. Registration creates a resident account; it never grants administrator access. Administrators can review incidents, set roles, create teams, and assign work. Team leads use My assignments.

## Current draft names

- `main`: original project.
- `community-interface`: earlier interface draft.
- `flood-finder-v2-weather-addresses`: current map-focused draft; requested rename to `local-hazard-map` is pending browser access.

Draft comparisons are alternatives for review against `main`; do not merge both without reviewing the combined result. Previous branch names and historical drafts are recorded in [Versions](docs/VERSIONS.md).

## Configuration

Use `.env.example` as a reference. Node does not automatically load `.env`; use shell/provider environment variables or `node --env-file=.env server.js`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/flood-finder.sqlite` | Persistent SQLite file |
| `NODE_ENV` | `development` | `production` makes session cookies HTTPS-only |
| `TRUST_PROXY` | `0` | Only enable behind a trusted proxy that overwrites forwarded headers |
| `NWS_USER_AGENT` | Application identifier | Set an appropriate public project contact before publishing |
| `NWS_AREAS` | `FL` | Legacy statewide `/api/alerts` endpoint; the main local hazard map discovers the selected location's state |
| `OSRM_URL` | Public OSRM demo endpoint | Estimated team routing; not a guaranteed production service |

No publishing occurs as part of the current draft. See the publishing plan before choosing hosting or paying for resources. The existing Render file is a proposal, not a deployment.

## Scope and limitations

Official hazard coverage is weather-related and limited to supported U.S. areas. This app does not automatically detect every road closure, outage, structure fire, earthquake, crime, or other emergency. Community reporting supplements that gap. Official boundaries can cover more territory than the actual hazard; local geometry matching is approximate. Missing alerts or reports are not evidence that an area is safe.

Public report descriptions, addresses, coordinates, and operational histories are visible to people who can access the app. Do not put private names, phone numbers, or medical details in them. For immediate danger, contact local emergency services. Estimated routes are not verified flood-safe routes.

## License

MIT. See [LICENSE](LICENSE).

### ZIP search and restrained interface

Enter a five-digit ZIP, ZIP+4, or full street address and select **Locate ↗**. ZIP results use an approximate area center from Zippopotam.us; incident reports still need a street address or precise optional pin. Advanced controls are under **Refine the map**. See [User Guide](docs/USER_GUIDE.md), [Data Sources](docs/DATA_SOURCES.md), and [Design](docs/DESIGN.md).

Address fields now offer Photon/OpenStreetMap suggestions as you type, using the MIT-licensed Awesomplete library sourced from GitHub. Fonts use a single native sans-serif family. Report details include category-specific external resources. See [Third-party sources](docs/THIRD_PARTY.md) for reuse, licenses and service limits.
