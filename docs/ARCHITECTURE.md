# Architecture and technology

## Product boundary

Flood Finder answers: **What situations have been reported or officially identified around this location?** It presents official weather-related affected areas beside community incident pins. A temperature or rain forecast alone never creates an incident. Officials can separately review community submissions and coordinate response teams.

## Languages and formats

Application code is JavaScript, HTML, CSS, and SQL. YAML configures CI and proposed deployment. Dockerfile syntax configures the optional image. JSON carries API responses; GeoJSON describes map geometry. Node.js is a JavaScript runtime, SQLite a database, and Leaflet a map library—not additional programming languages. No React, TypeScript, Python backend, build framework, or npm runtime package is required.

Browser code uses modern JavaScript features and native dialogs/forms. Server files use ES modules (`type: module`). Node 22.13 introduced the required built-in SQLite availability; the declared supported range is >=22.13.0 and <25, with local/CI validation on 24.15.0.

## Browser

`public/index.html` defines Map, About, How it works, Command center, and My assignments plus authentication/report/team/incident/official-alert dialogs. Map is the initial route. Hash navigation switches views without a separate frontend framework.

`public/app.js` maintains signed-in state, incident filters, selected search center/radius, official hazards, and map layers. It calls the same-origin HTTP API. Public reports and official alerts remain separate records and layers. User-controlled and provider strings are escaped before HTML rendering.

Leaflet draws:
1. OpenStreetMap tiles as the base map.
2. A dashed search-radius circle.
3. Official warning/advisory polygons, with dashed boundaries for broader affected-zone geometry.
4. Community incident pins, colored by priority or closed status.
5. Estimated response routes only when requested by an authorized user.

No official warning area is reduced to a fabricated incident point. A point-applicable alert with unavailable geometry stays a labeled text notice. Source filters can show all, official, or community records. Community category/status/priority/ownership filters apply to community records; the official hazard type filter applies to official records. Text search can match both.

## HTTP server

`server.js` uses built-in `node:http`. It serves an explicit allowlist of static files and handles authentication, role checks, JSON parsing, API routes, request limits, caches, and server-sent events. There is no Express server or build step.

`services/hazards.js` fetches NWS point metadata and active alerts for the selected point/state, resolves affected-zone boundaries where needed, removes expired/test/cancelled messages, and filters geography to the requested radius. It deduplicates alerts by ID and returns provider/source/geometry information.

`services/location-weather.js` provides Census street-address lookup and the earlier optional station/forecast adapter. The station/forecast endpoint remains available for compatibility and testing but is not fetched or shown by the map-focused interface.

## Persistence and roles

`store.js` creates the SQLite database and defines users, sessions, incidents, updates, teams, assignments, and audit records. It uses prepared statements and transactions for related changes. Records persist on the server's disk, not browser localStorage.

- Resident: submit reports and read their own records.
- Responder: read authorized team/assignment information and advance work for their team.
- Administrator: review and dispatch incidents, manage roles and teams, and inspect operational metrics.

Passwords use salted scrypt hashes; session tokens are random and stored as hashes server-side. Cookies are HttpOnly and SameSite=Lax, with Secure enabled in production. JSON mutations require a custom application header and role authorization. Public provider requests do not send account details or report descriptions to providers.

These are implementation protections, not a claim that the app has passed an exhaustive security audit. Before public release, review authentication abuse limits, backup/recovery, administrative access, dependency delivery, privacy, and monitoring in the intended hosting environment.

## Live updates and caches

Server-sent events announce incident/team/assignment changes. The client batches event kinds without dropping report refreshes. Public reports also refresh periodically while visible. Official hazards refresh about every two minutes while visible; address lookup is explicit rather than per keystroke.

Hazard responses are cached for two minutes (30 seconds when unavailable), up to 100 location/radius keys. Location keys round coordinates to 0.001 degrees. Requests for the same key share one pending fetch. Official zone geometries are cached up to one day, bounded to 100 entries. Each external request has an eight-second timeout. Geometry resolution has a request budget and deadline; incomplete results are labeled partial. See Data Sources for limitations.

## Request flow

1. User enters an address or chooses the current map area.
2. Census resolves a street address to coordinates, if needed.
3. The selected center/radius updates community proximity filtering.
4. `/api/hazards` discovers NWS location metadata and official alert areas.
5. The browser displays labeled official areas and community pins.
6. Clicking a record opens its own source-specific details.
7. Reporting and response actions use the database-backed authenticated API.

## Hosting implications

The current server needs a long-running Node.js process, HTTPS in production, and durable storage for SQLite. It cannot be published correctly by uploading only `public/`. Sites hosting uses a Worker runtime and would require a deliberate backend/storage migration; no such migration has been performed. Render is one possible Node-compatible host, but its existing configuration is only a proposal. Publishing is deferred at the user's request.
