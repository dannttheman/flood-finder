# Third-party software and services

## Awesomplete

Vendored unchanged from https://github.com/nudeui/awesomplete/blob/v1.1.7/awesomplete.js (blob `42642e086cf955248a12c2949f9ad3c2bac0f9a8`). MIT; copyright 2015 Lea Verou. Full license: `public/vendor/awesomplete.LICENSE.txt`. Provides combobox/listbox behavior and keyboard selection. Provider integration and text-only result rendering are application code.

## Photon / OpenStreetMap

Photon: https://github.com/komoot/photon (Apache-2.0), used as a remote service, not copied into the app. Data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. Public demo usage limits and deployment constraints are documented in DATA_SOURCES.md.

## Leaflet

Leaflet 1.9.4, https://github.com/Leaflet/Leaflet, BSD-2-Clause, loaded from unpkg. OpenStreetMap map attribution remains visible on the map.

## Locally served Leaflet

Leaflet 1.9.4 JavaScript, stylesheet, and marker images are vendored from the npm `leaflet@1.9.4` package under `public/vendor/leaflet`. Its BSD-2-Clause license is included there. Serving these files locally removes the runtime unpkg script dependency. OpenStreetMap tiles remain external and require attribution and compliance with their tile usage policy.
