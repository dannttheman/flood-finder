# HTTP API reference

All endpoints are same-origin JSON unless noted. Mutating JSON requests require `Content-Type: application/json` and `X-FloodFinder: 1`. Sessions use an HttpOnly cookie. Errors return an `error` string with an appropriate HTTP status.

## Public reads

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service health and server time |
| `GET /api/stats` | Community totals, active/critical/resolved counts |
| `GET /api/incidents` | Public community incidents; optional category/status/severity/q/bbox filters, maximum 1,500 |
| `GET /api/incidents/:id` | Community incident details and public update history |
| `GET /api/stream` | Server-sent `change` events; not JSON |
| `GET /api/locations?query=...` | ZIP / ZIP+4 area lookup or Census street lookup; returns source, kind, matches and precision |
| `GET /api/geocode?address=...` | Census street address resolution |
| `GET /api/hazards?lat=...&lon=...&radius=25` | Current nearby official hazard areas |
| `GET /api/alerts` | Retained state-configured NWS alert endpoint |
| `GET /api/weather?lat=...&lon=...` | Retained station/forecast endpoint; not used by main map |

## Authentication and community reporting

| Endpoint | Access / fields |
| --- | --- |
| `POST /api/auth/register` | Public; name, email, password. Creates Resident account |
| `POST /api/auth/login` | Public; email, password |
| `POST /api/auth/logout` | Clears session |
| `GET /api/auth/me` | Current user or null |
| `POST /api/incidents` | Signed in; title, description, category, severity, lat, lon, optional address |
| `GET /api/incidents/mine` | Signed in; maximum 200 own community incidents |

Browser address-first submission calls geocode before POST, which still requires validated coordinates. The server does not accept an unresolved address as a location.

## Teams, assignments, administration

| Endpoint | Access |
| --- | --- |
| `GET /api/teams` | Responder/Admin |
| `GET /api/assignments/mine` | Responder/Admin; responder results scoped to their lead role |
| `PATCH /api/assignments/:id` | Assigned lead/Admin; next progress state only |
| `GET /api/route` | Responder/Admin; valid from/to coordinates; estimated OSRM route |
| `GET /api/admin/users` | Admin |
| `PATCH /api/admin/users/:id` | Admin; resident/responder/admin role |
| `POST /api/admin/teams` | Admin; team fields and validated lead |
| `PATCH /api/admin/teams/:id` | Admin; team metadata/location/lead/availability |
| `PATCH /api/admin/incidents/:id` | Admin; review status, severity, team assignment, public note |
| `GET /api/admin/metrics` | Admin; community/operations counts and activity |

Official NWS records are read-only provider data; they do not use the community incident mutation endpoints.

## Geocoding contract

`GET /api/geocode?address=...` requires 8–250 characters and returns `source`, `matches`, and `message`. Each of up to five matches has `address`, `lat`, and `lon`. No match returns an empty array. Invalid input returns 400; provider failure returns 503. Limit: 20 requests/client IP/minute.

Provider: Census `locations/onelineaddress`, benchmark `Public_AR_Current`, JSON format. Supported street-address coverage and interpolation limitations are described in Data Sources.

## Local hazards contract

`GET /api/hazards?lat=...&lon=...&radius=...` validates latitude/longitude and radius 1–100 km; default radius is 25. Invalid input returns 400. Limit: 30 requests/client IP/minute.

Response:
- `source`: National Weather Service.
- `status`: `live`, `partial`, or `unavailable`.
- `location`: requested lat/lon and discovered city/state label.
- `radiusKm`: selected radius.
- `fetchedAt`: server fetch timestamp.
- `hazards`: deduplicated official records whose geometry intersects the search radius, or identified point-applicable text notices.
- `message`: explicit empty/partial/unavailable information.

Each hazard preserves `id`, `event`, grouped `category`, `severity`, `urgency`, `certainty`, `headline`, `description`, `instruction`, `area`, effective/onset/expiry/sent times, a source `url`, `geometry`, `geometrySource`, and `locationNote`.

`geometrySource` is `alert_polygon`, `affected_zone`, or `text_only`. A geometry is returned as GeoJSON MultiPolygon; text-only records have null geometry. No exact hazard coordinates or invented centroids are generated. Empty results and unavailable data remain distinct.

The adapter fetches NWS point/state alerts, resolves zone boundaries, and filters expired/test/cancelled messages. Linked zone requests must stay on `https://api.weather.gov`. Geometry/proximity limitations, caps, and cross-state coverage limits are in Data Sources.

Cache: two minutes per rounded 0.001-degree center/radius, 30 seconds for unavailable responses, up to 100 keys. Identical pending requests share one fetch. Zone shapes cache for one day, bounded to 100 entries. Each provider request times out after eight seconds. A zone budget/deadline prevents unlimited expansion; incomplete results are partial.

## Legacy station/forecast contract

`/api/weather` still returns source/status/fetch time/location, nearby station observation, up to four forecast periods, and a message. Missing measurements stay null; old observations are flagged; documented temperature/wind/rain units are converted. It is retained for compatibility and is not the main product interface or an incident-detection algorithm.

## Configuration

No government provider API keys are currently required by the documented public interfaces. Set `NWS_USER_AGENT` to a suitable application identifier/public project contact before deployment. `.env` is not auto-loaded.

Provider references:
- https://www.weather.gov/documentation/services-web-api
- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

## ZIP area search

`GET /api/locations?query=02108` accepts five digits, ZIP+4, or a full street address. ZIP+4 resolves its five-digit area. ZIP matches include `precision: "postal-area"` and the original five-digit `zip`. A missing ZIP returns an empty matches array; malformed input is 400, provider failure 503. Requests are limited to 20 per IP per minute. ZIP lookup has an eight-second timeout and sends only the ZIP to Zippopotam.us. `/api/geocode` remains street-only for precise report placement.
