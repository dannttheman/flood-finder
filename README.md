<img width="4000" height="1080" alt="flood finder" src="https://github.com/user-attachments/assets/767455df-18ed-4cbf-bceb-0e062e0300bd" />


**Real community disaster reporting and response-team coordination.** Because powerful storms deserve powerful response.

## Flood Finder v2 — Weather & Address Reporting

**Start here: [Detailed User Guide](docs/USER_GUIDE.md)** · [Version index](docs/VERSIONS.md) · [API documentation](docs/API.md)

This is the `flood-finder-v2-weather-addresses` editing branch. The original `main` and the earlier interface draft are preserved.

- Enter a full U.S. street address when reporting; coordinates are looked up automatically without selecting the map.
- Select one or more report-type filters, combined with status, urgency, ownership, and search.
- Read independent National Weather Service observations, forecasts, and official alerts; no community report is needed for weather data.
- See source times, stale readings, missing values, and provider outages explicitly.

For this local preview, run `PORT=3002 npm start` and open http://localhost:3002. The default `npm start` still uses port 3000 unless `PORT` is set. Each local copy keeps its own `data` directory.

The Render Blueprint is a deployment proposal, not a live deployment. Review paid compute and persistent storage before applying it. See [Render notes](docs/RENDER.md).

## Features

Community reports are public: latitude/longitude, descriptions and any address/landmark typed by the reporter are exposed on the map. Avoid names, medical specifics, home addresses, phone numbers or other personally identifying information in reports. Account email addresses and crew contact details are restricted to authorized roles.

## Safety and scope

Flood Finder is a **coordination aid**, is not intended as an emergency services provider. It is an experimental application not yet intended for or verified as a commercial monitoring tool. 

Flood finder serves as the hub for people in a community to help report incidents during hurricanes, tropical storms, or other severe weather events. Officials can take advantage of this app to track and monitor when certain incidents appear, as well as deliver informed messages to their area. The application also uses real time weather data in compound with crowdsourced information. Public reports start `reported` and remain unverified until reviewed. Estimated route geometry from OSRM is **not verified flood-safe**. Do not use the platform as a sole source for immediate life-safety decisions. Always call local emergency services for life-threatening situations.

## Project layout

```text
server.js           HTTP API, authentication, authorization, NWS / routing proxy, SSE
store.js            Persistent database schema and transactions
public/index.html   Landing page, map, operations dashboard, dialogs
public/styles.css   Responsive visual system
public/app.js       Functional browser UI and state
public/favicon.svg  Brand mark
scripts/admin.js    Secure administrator bootstrap
services/location-weather.js  Government geocoding and weather adapters
test/api.test.js   End-to-end HTTP API integration tests
test/client.test.js  Browser logic regression tests
test/location-weather.test.js  Provider and endpoint tests
docs/USER_GUIDE.md Detailed instructions for every role
```
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

## API quick reference

`GET /api/geocode?address=...`, `GET /api/weather?lat=...&lon=...`, `GET /api/health`, `GET /api/stats`, `GET /api/incidents`, `GET /api/incidents/:id`, `GET /api/alerts`, and `GET /api/stream` are public.

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` implement account access. Signed-in users can `POST /api/incidents` and `GET /api/incidents/mine`.

`GET /api/teams` and `GET /api/assignments/mine` require responder/admin access. `PATCH /api/assignments/:id` requires the assigned team lead or admin.

`GET /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/teams`, `PATCH /api/admin/teams/:id`, `PATCH /api/admin/incidents/:id`, and `GET /api/admin/metrics` require an administrator. `GET /api/route` requires responder/admin access.

## License

MIT; see `LICENSE`.
