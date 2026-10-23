# Flood Finder

**Real community disaster reporting and response-team coordination.** A functioning web app, not a static mockup. Built with Node.js 22+, the built-in SQLite database, vanilla browser JavaScript, and Leaflet + OpenStreetMap.

## Features

- Public landing page, interactive incident map, severity/type/status/search filters, and live counts from the database
- Secure community account registration and login using salted Node.js `scrypt` password hashes, server-side expiring sessions, and `HttpOnly` session cookies
- Real geolocated incident submissions, audit history, severity classifications, and report verification
- Administrator-only incident triage, status changes, team creation, crew-lead permissions and dispatch assignment
- Responder assignments with acknowledgment, en-route, on-scene and completed stages, available to the assigned team's signed-in lead
- Real persistent SQLite database, transactions, foreign keys, input validation, role enforcement, HTTP security headers, basic request throttling and CSRF protection
- Live report and assignment updates via Server-Sent Events (plus periodic polling), with real charts of persisted records
- Official National Weather Service alerts via `api.weather.gov` (default Florida; separate from unverified reports), with geographic warning polygons when available
- Road-route overlays via OSRM when reachable and **explicitly labeled straight-line fallback when road routing is unavailable**
- Automated HTTP integration tests for registration, permissions, reporting, dispatch, field progress and logout

**No fake incident data:** the app starts empty. Users populate it by making real reports. The landing page illustration is decorative, clearly separated from the real incident map and statistics.

## Run locally

1. Install **Node.js 22.13 or later** (the built-in `node:sqlite` module is required). No `npm install` or database account is needed.
2. From this folder run:

   ```sh
   npm start
   ```

3. Open **http://localhost:3000**.
4. Register your account using the UI. Accounts default to `resident` (this prevents arbitrary admin signup).
5. Stop the server, promote the initial administrator, and restart:

   ```sh
   npm run admin -- promote you@example.com
   npm start
   ```

   You can also run the command from a second terminal while the server is running. **Sign out and sign back in** to refresh the UI. The admin command revokes old sessions.
6. As admin, open **Command center** to create response teams and give selected accounts the `responder` role. Assign a responder account as a team lead, enter real base coordinates, and dispatch the team to an incident. Team leads see their work in **My assignments**.

```sh
npm test
```

## Configuration

Copy `.env.example` as a reference. Set environment variables in your shell or hosting provider. Node does **not** automatically read `.env` files; if you want local `.env` loading with Node 22 use `node --env-file=.env server.js`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/flood-finder.sqlite` | Durable SQLite location; **mount a persistent volume in production** |
| `NODE_ENV` | `development` | `production` sets cookies `Secure`; requires HTTPS front-end |
| `TRUST_PROXY` | `0` | Set `1` **only** behind a trusted reverse proxy that overwrites client forwarding headers |
| `NWS_AREAS` | `FL` | State code for official alerts (e.g. `FL`, `NC`, `TX`) |
| `NWS_USER_AGENT` | Sample | Replace with a public contact as recommended by NWS |
| `OSRM_URL` | `https://router.project-osrm.org` | Road route engine (demo public endpoint is not suitable for guaranteed production dispatch) |

The weather alert feed and OSRM road routing require an internet connection. Base map imagery and Leaflet assets use OpenStreetMap and pinned unpkg CDN resources, respectively. All other application functionality is local and database-backed.

## Production deployment

- Deploy as a **long-lived Node server**; static-only hosts such as GitHub Pages cannot run this backend.
- Provide **HTTPS** through a trusted reverse proxy and set `NODE_ENV=production`. Only configure `TRUST_PROXY=1` if proxy forwarding headers are cleaned and trusted.
- Persist the database directory on an attached disk/volume, and implement **automated, tested SQLite backups**. Do not run multiple isolated containers each using its own SQLite copy; use one writer/instance or move to a shared database.
- Host/pin your own map tiles and Leaflet assets for resiliency; respect OpenStreetMap usage policy. For real agency operations, host a supported routing service and validate road closures/evacuation information independently.
- Configure monitoring, logs, throttling at the edge, incident-moderation processes, privacy retention, and an emergency-operations policy before advertising the system publicly.
- Admin accounts are created by a server operator with the command shown above; there is deliberately **no public 'make me admin' button**.

## Security and privacy

Password hashes are salted and derived with Node's `scrypt` (`N=16384,r=8,p=1`) rather than stored as plaintext. Sessions are 256-bit random bearer tokens; only the SHA-256 digest is stored in SQLite. Sessions expire after seven days. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when deployed with `NODE_ENV=production`. Mutation endpoints require JSON and the non-simple `X-FloodFinder: 1` header to reduce browser CSRF risk; browsers are not given cross-origin API access. Every admin and responder write is authorized server-side.

**Community reports are public:** latitude/longitude, descriptions and any address/landmark typed by the reporter are exposed on the map. Avoid names, medical specifics, home addresses, phone numbers or other personally identifying information in reports. Account email addresses and crew contact details are restricted to authorized roles.

## Safety and scope

Flood Finder is a **coordination aid**, not a 911 service, government dispatch authority, official evacuation order, automatic flood prediction system, or an alternative to NWS/municipal advisories. Public reports start `reported` and remain unverified until reviewed. Estimated route geometry from OSRM is **not verified flood-safe**. Do not use the platform as a sole source for immediate life-safety decisions. Always call local emergency services for life-threatening situations.

## Project layout

```text
server.js           HTTP API, authentication, authorization, NWS / routing proxy, SSE
store.js            Persistent database schema and transactions
public/index.html   Landing page, map, operations dashboard, dialogs
public/styles.css   Responsive visual system
public/app.js       Functional browser UI and state
public/favicon.svg  Brand mark
scripts/admin.js    Secure administrator bootstrap
 test/api.test.js   End-to-end HTTP API integration tests
```

## API quick reference

`GET /api/health`, `GET /api/stats`, `GET /api/incidents`, `GET /api/incidents/:id`, `GET /api/alerts`, and `GET /api/stream` are public.

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` implement account access. Signed-in users can `POST /api/incidents` and `GET /api/incidents/mine`.

`GET /api/teams` and `GET /api/assignments/mine` require responder/admin access. `PATCH /api/assignments/:id` requires the assigned team lead or admin.

`GET /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/teams`, `PATCH /api/admin/teams/:id`, `PATCH /api/admin/incidents/:id`, and `GET /api/admin/metrics` require an administrator. `GET /api/route` requires responder/admin access.

## License

MIT; see `LICENSE`.
