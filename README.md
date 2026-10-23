<img width="4000" height="1080" alt="flood finder" src="https://github.com/user-attachments/assets/767455df-18ed-4cbf-bceb-0e062e0300bd" />


**Real community disaster reporting and response-team coordination.** Because powerful storms deserve powerful response.

## Features

Community reports are public: latitude/longitude, descriptions and any address/landmark typed by the reporter are exposed on the map. Avoid names, medical specifics, home addresses, phone numbers or other personally identifying information in reports. Account email addresses and crew contact details are restricted to authorized roles.

## Safety and scope

Flood Finder is a **coordination aid**, not a 911 service, government dispatch authority, official evacuation order, automatic flood prediction system, or an alternative to NWS/municipal advisories. It serves as a hub for people in a community to help report incidents during hurricanes, tropical storms, or other severe weather events. Officials can take advantage of this app to track and monitor when certain incidents appear, as well as deliver informed messages to their area. The application also uses real time weather data in compound with crowdsourced information. Public reports start `reported` and remain unverified until reviewed. Estimated route geometry from OSRM is **not verified flood-safe**. Do not use the platform as a sole source for immediate life-safety decisions. Always call local emergency services for life-threatening situations.

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
