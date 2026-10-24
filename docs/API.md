# Location and weather APIs

These public read-only endpoints supplement community reporting. Account emails, passwords, and report descriptions are never sent to the providers. The browser calls this app's API; the server talks to government APIs with timeouts and a configured user agent.

## GET /api/geocode?address=...

An explicit U.S. street address lookup. Requires 8–250 characters. Uses the U.S. Census `locations/onelineaddress` endpoint with benchmark `Public_AR_Current` and JSON output. Returns up to five matches containing `address`, `lat`, and `lon`, plus provider and message fields. No match returns an empty `matches` array. Provider failures return HTTP 503; invalid input returns 400. Rate limit: 20 requests per client IP per minute.

Census interpolates address coordinates from its address data. It is not a general business/place-name search and does not guarantee exact entrances. Addresses are sent to Census only when lookup is requested or an address-only report is submitted.

## GET /api/weather?lat=...&lon=...

Requires valid latitude/longitude. Uses NWS `/points/{latitude},{longitude}` to discover a forecast and observation stations, then fetches the latest observation from a nearby listed station and up to four future forecast periods. Linked discovery URLs must remain on `https://api.weather.gov`.

Returns `source`, `status`, `fetchedAt`, `location`, `observation`, `forecast`, and `message`. Status is `live`, `partial`, or `unavailable`. Station observation times are retained; observations older than two hours are flagged. Null or unsupported unit values remain null. Temperature is converted from Celsius to Fahrenheit, wind from supported SI units to mph, and precipitation to millimeters. Forecast probabilities are not observations.

Cache: ten minutes per location rounded to 0.001 degrees; one minute for unavailable results; up to 100 cached locations. Concurrent requests for a cached location key share an in-flight fetch. Rate limit: 30 requests per client IP per minute. Invalid input returns 400. Provider or coverage failures return a structured unavailable result; no fake fallback readings are generated.

## Existing alerts

`GET /api/alerts` continues to serve NWS alerts for the state configured by `NWS_AREAS` (default `FL`). Selecting a weather address does not change the server's statewide alert feed. Community incidents remain a separate database-backed source.

## Configuration and tests

No provider API keys are required under the documented public API interfaces. Set `NWS_USER_AGENT` to an application identifier with an appropriate public project contact for deployment. Set it in the shell or hosting service; `.env` is not loaded automatically.

Run `npm test`. Mocked tests cover provider outages, missing values, stale observations, unit conversions, no address match, invalid coordinates, caching, unsafe discovery URLs, automatic location from an address, and report-type combinations. Live checks should use public civic addresses instead of personal addresses.

Provider documentation:
- https://www.weather.gov/documentation/services-web-api
- https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
