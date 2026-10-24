# Change history

## Local Hazard Map — current direction

- Renames the earlier interface branch to `community-interface`; the current branch is intended to become `local-hazard-map`, with that rename pending browser access.
- Opens directly to nearby situations and the map.
- Removes the general weather dashboard and decorative hero presentation.
- Adds a local official-hazard API with real alert/affected-zone geometry, expiry/test filtering, bounded caching, and partial/unavailable states.
- Preserves clear separation of community pins and official affected areas.
- Adds source and official hazard-type filters, search radius, and proximity filtering for community reports.
- Keeps direct-address reporting and optional map adjustment.
- Expands GitHub documentation to include the exact languages, runtime, architecture, sources, APIs, file organization, usage, testing, and publishing considerations.
- Uses Sites guidance for local interface development; publishing remains deferred.

## Earlier weather/address draft

Added address-only location lookup, multi-type community filters, and NWS observations/forecasts. Its large weather dashboard was subsequently removed in favor of the hazard-map workflow. Legacy data endpoints remain documented for compatibility.

## Community Interface draft

Improved interface structure and reporting flow, added ownership/priority filtering, and fixed live-event batching, team availability, and cancelled/reopened response assignments. The original `main` source is preserved.

## ZIP search and field-guide interface
- Separate ZIP / ZIP+4 area lookup, preserving leading zeroes, with explicit approximate-location labels and provider error states.
- Map-first ivory/charcoal interface, small orange identity mark, serif heading, and collapsible advanced filters.
- Removed duplicate category dropdown and retained multi-category filters.
- Updated API, provider, usage, design and validation documentation; 24 passing tests.
