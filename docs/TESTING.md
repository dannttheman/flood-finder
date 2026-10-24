# Testing and verification

Run `npm test` with Node >=22.13.0 and <25. Local checks use Node 24.15.0. Tests use disposable SQLite files and bound local HTTP servers; they do not modify the preview's accounts or incidents.

## Test files

- `test/api.test.js`: registration, hashed passwords, role authorization, request headers, incident creation, teams, dispatch, progress ordering, cancelled/reopened assignments, and legacy endpoints.
- `test/client.test.js`: priority/ownership/type combinations, burst live events, automatic address coordinates, invalidation after editing the address, source separation, and excluding distant community records.
- `test/hazards.test.js`: area intersection, polygon holes, distance filtering, official vs zone geometry, expired/test alert exclusion, geometryless text notices, outages, request validation, caching, and nearby coastal zones after many distant statewide notices.
- `test/location-weather.test.js`: Census conversion and the retained legacy weather adapter's units, null/stale values, provider failure, cache behavior, and discovery URL restrictions.

The browser-logic tests run the browser script in a controlled JavaScript context. They are not a substitute for physical phone, assistive-technology, or full browser interaction testing.

## Live checks

Use a public civic address and the application's default map point rather than personal addresses. Verify that Census supplies the intended coordinates and that official hazard records have real NWS geometry or an explicitly labeled text-only state. Do not seed fake incidents into production to make the map look active.

## Release checklist still to perform

Before publishing, verify the chosen host's supported Node version, persistent database storage, HTTPS cookies, provider contact identification, backups and restoration, account/role boundaries, actual mobile interaction, external map delivery, and concurrent report/assignment behavior. Confirm current government API and map tile terms for the intended traffic and use.

There has been no exhaustive security audit, public deployment, Docker image build, or production load test as part of this local draft. Passing tests do not establish that emergency-response use is safe.

## This revision's verification

All 21 automated tests passed locally. A live request for the default Boca Raton search returned seven nearby official coastal notices with affected-zone geometry and a live status. No fabricated incidents were inserted. Visual verification of the new layout and the remaining GitHub rename are pending because the Mac is locked; the earlier weather-dashboard screenshot does not represent this revision.

## ZIP and field-guide revision — October 23, 2026

All 24 automated tests passed. Added ZIP+4, leading-zero, malformed ZIP, missing ZIP, invalid coordinate, provider failure, and HTTP area-route checks. Live provider responses for 33432 and 02108 and the running `/api/locations?query=33432` endpoint were verified. Browser verification remains incomplete: the in-app browser refused the local preview connection despite a working local HTTP endpoint, and native browser automation was interrupted by user control. Do not treat the old screenshots as this design.

## Address suggestions, fonts and resource links — October 23, 2026

All 28 automated tests pass, including provider parsing, foreign/invalid result filtering, duplicate removal, upstream failure, HTTP validation, pinned library serving and resource-source selection. Live Photon lookup returned Boca Raton City Hall with street-address coordinates. Browser verification at 127.0.0.1:3002 confirmed the sans-serif design, a visible address suggestion and keyboard Down/Enter selection populating the full address and moving the map. All curated resource destinations were opened through web verification; no dead placeholder or hash links are used for View resources.
