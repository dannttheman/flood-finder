# Data sources and geographic meaning

## Official hazard areas: National Weather Service

The map uses current NWS warnings, watches, advisories, and relevant statements as evidence of weather-related situations. It does not turn raw temperature or rainfall readings into claims of a disaster.

The adapter requests:
- `/points/{latitude},{longitude}` for city/state and point-related zones.
- `/alerts/active?area={state}` to find surrounding official areas.
- `/alerts/active?point={latitude},{longitude}` to supplement point-applicable notices.
- Official `/zones/...` URLs when an alert supplies affected zones instead of a polygon.

Expired alerts, cancelled messages, and non-Actual/test alerts are omitted. NWS event names are preserved. Categories group flooding, storms, wind, fire weather, winter/cold, heat, marine/coastal, and other official alerts. Fire weather means conditions identified by the issuer; it does not claim an active structure fire or a detected wildfire perimeter.

### What a shape means

- **Alert polygon:** geometry supplied on the alert itself. This is an official affected area, not an exact incident location.
- **Affected zone:** an official forecast/county/fire zone boundary associated with the alert. The UI uses a dashed border and explains that it may be broader than the actual hazard.
- **Text only:** an alert tied to the selected point/zone but with no usable geometry. It appears in the feed without an invented map pin.

A single alert with several nearby zones remains one record with combined geometry. Original boundaries are preserved rather than clipped to the search circle. An affected region may extend beyond the search radius; the application includes it if its geometry intersects that radius.

### Proximity and coverage limits

The selected search radius is 1–100 km (the UI offers 10, 25, 50, and 100). Community reports use great-circle distance. Official areas use a local geographic projection, point-in-polygon checks with holes, and minimum distance to polygon edges. That is an approximate proximity test, not survey-grade GIS or navigation guidance.

The official feed is scoped to the selected point and its state. It can miss surrounding alerts from neighboring states unless those messages also appear in the selected state's or point's feed. It is not a nationwide all-hazards detector. Other causes of disruptions require community reports or future verified integrations.

Processing is bounded to 200 alert records, 64 uncached zone lookups per request, and a zone-resolution deadline. Cached geometries are reused. Budget/time/provider failures mark the response partial rather than implying complete coverage. The UI explicitly identifies an unavailable feed and does not substitute fabricated data.

No returned alerts does not mean the area is safe. NWS warnings and watches may describe existing conditions or a future threat; onset/expiry and issuer text remain available in details. A watch is not presented as confirmed damage.

NWS API documentation: https://www.weather.gov/documentation/services-web-api

## Community incident reports

These come from the application's SQLite database, not NWS. Categories cover flooding, road/access issues, utility outages, medical/safety concerns, debris, shelter/supply needs, and other situations. They start Reported/unverified. Administrative review and response history are recorded separately.

Public report text, addresses, coordinates, and operational history are visible to people who can access the app. Do not include private contact or medical details. Report priority is a user/admin assessment, not a provider-verified measurement.

The API currently returns at most 1,500 public records and 200 own records per request. Client proximity and display filtering operate on these returned records; a historical archive or nationwide indexed incident search has not been implemented.

## Street-address lookup: U.S. Census Bureau

The `locations/onelineaddress` geocoder uses benchmark `Public_AR_Current`. It accepts supported U.S. street addresses and returns interpolated coordinates and a normalized address. It is not a generic landmark/business-name search and does not guarantee an exact entrance. Users may correct the result through the optional map or coordinates.

The typed address is sent to Census when Find area, Find address, or address-only report submission requests lookup. Account emails/passwords and report descriptions are not sent. Published report addresses are public; the geocoder is not an address privacy service.

Documentation: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

## Map and routes

Leaflet 1.9.4 renders OpenStreetMap base tiles. Attribution remains visible. Map assets and tiles require external network access.

Authorized team routing uses OSRM's estimated road geometry. The public demo route service is not a guaranteed dispatch service. Routes are not verified flood-safe and do not encode current closures, debris, or all reported hazards.

## Legacy weather endpoints

`/api/weather` retains the earlier station observation/forecast adapter. `/api/alerts` retains the earlier state-configured alert feed. They are documented for compatibility; the main map uses `/api/hazards` and does not display a weather dashboard. The legacy data must not be confused with official mapped incident detection.
