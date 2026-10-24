# Flood Finder v2 — User Guide

Flood Finder combines public community reports with National Weather Service observations, forecasts, and alerts. Residents report what they see; authorized coordinators review those reports and assign response crews. Weather data loads independently and does not require someone to submit a report.

## 1. Open the right version

For the local v2 preview, open **http://localhost:3002** while its server is running. The original uses port 3000, and the earlier interface draft uses port 3001. These are local previews on this computer, not public websites. A deployed Render version will have its own HTTPS address.

To start this version later, open Terminal in the `flood-finder-v2-weather-addresses` folder and run:

```sh
PORT=3002 npm start
```

Node.js 22.13 or newer, below version 25, is required. No package installation, weather API key, geocoding API key, or separate database account is needed. Keep Terminal running. Press Control+C to stop it. Accounts and reports are saved in this version's `data` folder; do not delete it if you want to keep them.

The GitHub branch for this version is **`flood-finder-v2-weather-addresses`**. See [Versions](VERSIONS.md) for the original and earlier draft. A draft pull request is a reviewable set of changes, not a running website. The source files live in the named branch.

## 2. Browse without an account

From Overview, select **Explore incident map**, or use **Incident map** in navigation. You can browse community reports, use filters, open report details, and read weather without signing in. On narrow screens, open the menu to see navigation links.

An empty report list means no matching community submissions exist. Weather observations and forecasts still load independently. The illustration on Overview is labeled **Illustration** and is not a live incident map. Community counts reflect submitted reports.

## 3. Choose the weather location

The weather section initially uses the app's South Florida starting point. It does not infer your home address or automatically request device location.

For a different location:

1. Enter a full U.S. street address under **Weather location**. Include street number, street name, city, state, and preferably ZIP code.
2. Select **Find weather**.
3. If the geocoder returns one match, the map centers on it and the weather updates automatically. If multiple matches appear, select the correct one.
4. Alternatively, pan the incident map to your area and select **Use current map area**.

Weather address searches change the viewing area; they do not submit incidents.

### What the weather readings mean

The weather section includes:

- **Temperature:** the nearby station's latest reported temperature, converted to Fahrenheit.
- **Wind:** the station's reported wind speed, converted to miles per hour.
- **Relative humidity:** the station's humidity reading, when available.
- **Rain · last hour:** the station's reported precipitation during the preceding hour, in millimeters.
- **Upcoming forecast:** up to four NWS forecast periods, including forecast temperature, conditions, wind, and rain probability where supplied.

The **station ID**, **observation time**, and **fetch time** are displayed. Fetch time is when Flood Finder retrieved the data, not when the station measured it. Observations older than two hours are flagged. Forecasts describe upcoming periods and are not station measurements.

**Not reported** means the provider did not return a usable reading. It does not mean zero rain, zero wind, or clear weather. If observations or the forecast are missing, the section says **Partial / older data**. If NWS cannot serve the location or its service is unavailable, the app shows an unavailable notice and keeps community reporting usable.

NWS data covers supported U.S. locations. Nearby station conditions can differ from the incident location. Weather is not used to invent community incidents or automatically verify flood depth or road safety.

### Official weather alerts

Below the incident workspace is the **National Weather Service alerts** section. These alerts come from NWS, not community submissions. The server's `NWS_AREAS` setting selects the state; its default is Florida. Changing the weather address does not change this state-wide alert feed.

Enable **NWS alerts** on the map to show alert polygons where NWS supplies them. Some alerts have no map geometry and appear only as text. The text section shows up to eight returned alerts; the source label displays the number returned by the API. Check weather.gov for the full official information.

## 4. Filter specific report types

The report panel provides **Quick report types** buttons:

- **Flooding:** flooding or high water.
- **Roads:** blocked or damaged roads and access issues.
- **Power:** electrical and utility outages.
- **Medical / safety:** reported medical or safety concerns.
- **Debris:** storm debris and damage.
- **Shelter:** shelter or supply needs.
- **Other:** reports outside the listed categories.

Select one type to show that category. Select additional types to combine them—for example, Flooding and Roads. Selected buttons are filled blue. Select a type again to remove it, or select **All reports** to remove the type restriction.

The **Report type** dropdown is a compact alternative for choosing one category. Changing it replaces the quick-type selection. Selecting All incidents clears the category selection.

You can combine type selections with:

- **Search reports or area:** searches report titles, descriptions, landmarks/addresses, and IDs. This searches existing reports; it does not look up a new street address.
- **Status:** Reported, Verified, Dispatched, In progress, Resolved, or Rejected.
- **Priority:** Low, Moderate, High, or Critical.
- **Sort by:** Priority first puts open urgent reports ahead of lower-priority or closed reports. Newest first orders by submission time.
- **Only my reports:** available after sign-in; shows your own submissions within the returned records.

The report count and map markers reflect the filtered results. Select **Fit reports** to frame those markers on the map. Use the reset-arrow button beside Ground reports to clear search, types, status, priority, sorting, and ownership filters. The app returns up to 1,500 public incidents and up to 200 of your reports per request; it does not promise an unlimited archive.

## 5. Create an account or sign in

Select **Create account**, or select **New report** and create an account from the dialog. Enter your name, an email address, and a password with at least 12 characters. New accounts are residents. Creating an account does not grant administrative or responder access.

If you selected New report first, the app opens the report form after successful sign-in. Use **Sign in** for an existing account and **Sign out** when finished, especially on a shared computer. Local copies use separate databases: an account created in v1 is not automatically copied into v2.

## 6. Submit an incident using an address

1. Select **New report** on the incident page or **Report an incident** on Overview.
2. Choose the **incident type** and **severity**.
3. Write a short title of 5–120 characters.
4. Describe what you observed in 15–2,000 characters. Include useful facts, timing, and access conditions.
5. Enter the incident's full U.S. street address in **Incident address**.
6. Select **Publish community report**. The app looks up the address and fills its coordinates automatically before submitting. You do **not** have to click the map.

You can select **Find address** before publishing to check the match. If multiple matches appear, select the correct address and then publish. If the address is incomplete or unmatched, add the street number, city, state, and ZIP code. The Census geocoder looks up street addresses; a business name or landmark alone may not match.

For an addressless incident or a correction, expand **Optional: adjust on map or enter coordinates**. Click the optional map, drag its marker, enter latitude/longitude, or select **Use my location** and approve your browser's location request. Device location identifies where your device is, which may differ from the incident.

Editing the address clears the previous coordinates so the report cannot silently use an old address's location. Selecting or adjusting the map sets a manual location. Confirm the address text and coordinates refer to the same incident before publishing.

After publication, the app opens the report details and shows its map location. Its initial status is **Reported**, which means unverified. Use **Only my reports** to find it later. If a filter hides your report, clear the filters.

### Public information and address lookup

Report titles, descriptions, addresses, coordinates, and operational history are public to people who can access the app. Avoid personal names, phone numbers, medical details, or other private information in reports. Address lookup sends the entered address to the **U.S. Census Bureau**. It does not send your account email, password, or incident description. The service calculates coordinates from address data; the match is not a guarantee of exact building-entrance placement.

## 7. Read report details

Select a report in the list or a marker on the map. The details show category, priority, review status, description, location, reporting time, assigned team, and incident history.

- **Show on map** centers the incident.
- **Copy coordinates** copies its location if clipboard access is available.
- **Open navigation** opens Google Maps with that destination. Routes are not verified to avoid floodwater or storm damage.

A community report is different from an official alert. A Verified status records an administrator's review; it is not an automated weather-provider certification.

## 8. Administrator: review reports and manage teams

The initial administrator must first register normally. The project owner then promotes that registered account using the server's database:

```sh
npm run admin -- promote your-registered-email@example.com
```

Run the command in the correct local version or deployed service shell, with the same `DATABASE_PATH` as the server. Sign in again afterward. The command revokes the account's existing sessions.

As an administrator:

1. Open **Command center**.
2. In **User directory**, give a registered crew lead the Responder role.
3. Select **Add response team**. Enter a team name, specialty, contact channel, availability, base coordinates if routing is needed, and the registered lead.
4. Open an incident from the priority queue or map.
5. Review the report, set its status and priority, choose a response team, and add a useful public operational note.
6. Select **Save and dispatch**. Assigning a team to a reported or verified incident moves it to Dispatched.

Rejection cancels active assignments. Resolving a report completes active assignments. Reopening a closed incident with its team creates a fresh assignment. Team availability is an administrator-managed field, not a live GPS or automatic staffing guarantee.

## 9. Responder: update assigned work

A registered responder sees **My assignments** after an administrator assigns that account as a team's lead and dispatches the team.

Open the assignment to review location and details. Advance in this order:

**Assigned → Acknowledged → En route → On scene → Completed**

The app exposes the next step and rejects skipped or backward steps. Completing an assignment marks the incident Resolved. Cancelled or reassigned work cannot be advanced. Responders cannot manage other teams' assignments; administrators have broader access.

## 10. Refreshing and troubleshooting

- **Live updates connected:** report/team changes can arrive automatically. Reports also refresh periodically while the tab is visible.
- **Reconnecting:** the live connection was interrupted. Use Refresh; visible report data can be older than current conditions.
- **Report refresh notice:** the app could not refresh reports. It keeps the last displayed information and warns that it may be out of date.
- **Weather unavailable:** the provider is down, the location is outside supported coverage, or no usable data was returned. Use Refresh or check weather.gov. Missing weather does not prevent a community report.
- **Address lookup unavailable:** try again later or use the optional map/coordinates. A no-match message differs from a provider outage.
- **Blank map:** confirm internet access. The map library and OpenStreetMap tiles load externally; reports and text weather may still work.
- **No command center / assignments:** sign in with the appropriate role. Account registration alone creates a resident.
- **Changes do not appear:** make sure you opened v2 on port 3002 and not an older preview. Reload only after saving any unfinished form.

Weather is cached for about ten minutes, including coordinate grouping to roughly 0.001 degrees, and refreshes periodically when the tab is visible. Unavailable responses are cached briefly to avoid hammering the provider. Refresh does not bypass those server caches. Address lookup is submitted explicitly or during publication, not on every keystroke.

## 11. Intended scope

Flood Finder is an experimental coordination app, not an emergency dispatch service or a flood prediction system. For immediate danger, contact local emergency services. Do not drive through floodwater or rely on this app's community reports, station data, or estimated routes as proof of safety.

## Data sources

- [National Weather Service API](https://www.weather.gov/documentation/services-web-api): official observations, forecasts, and alerts.
- [U.S. Census Geocoding API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html): address-to-coordinate lookup for supported U.S. areas.
- OpenStreetMap / Leaflet: interactive map display.
- OSRM: estimated team-to-incident road routing, when requested by authorized users.
