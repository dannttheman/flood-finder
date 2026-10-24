# Flood Finder — Local Hazard Map user guide

## What this app is for

Find local situations around a chosen address: official weather-related hazard areas and reports from people in the community. The map is the starting point. It is not a general weather forecast app, and it does not automatically detect every kind of disaster.

**Official** records come from the National Weather Service. **Community** records come from registered users and start unverified. The source label remains visible in the situation list and details.

## Open the application

The current local preview is **http://localhost:3002** while its server is running. To start it later, open Terminal in `flood-finder-local-hazard-map` and run:

```sh
PORT=3002 npm start
```

Use Node >=22.13.0 and <25. No `npm install` or API key is required. Keep Terminal running; Control+C stops the server. This URL is local to this computer, not a public website. Publishing will be handled separately.

The original and the earlier interface draft are documented in [Versions](VERSIONS.md). Their databases/accounts are separate. The repository branch names identify the actual source versions; a draft pull request is the review page for changes.

## 1. Choose your area

1. Enter a full U.S. street address in **Search your area**. Include street number, street name, city, state, and preferably ZIP.
2. Select **Find area**. A single match updates the map automatically. If several addresses match, choose the correct one.
3. Select a search radius: 10, 25, 50, or 100 km (approximately 6, 16, 31, or 62 miles).
4. You can also pan the map and select **Search this map** to use its current center.

The dashed circle shows the search radius. Community reports are included when their coordinates are inside it. Official areas are included when their boundaries intersect the search area; the original affected boundary can extend outside the circle. Pan/zoom alone does not silently change the search center—select Search this map when ready.

Address lookup uses the U.S. Census geocoder. It needs a street address, not just a business name or landmark. The entered address is sent to Census; your account details and incident description are not sent. It calculates approximate address coordinates. If lookup fails, correct the address or select an area by moving the map.

## 2. Read the map

### Official shaded areas

Amber/red shading represents an official warning, watch, advisory, or relevant statement. Click the area or its list item for the issuing source, affected area, timing, description, and instructions.

A solid alert boundary comes from the alert polygon. A dashed affected-zone boundary is an official zone that can be broader than the actual hazard. Neither means every street inside it is damaged. A notice without usable geometry stays in the list as **Area notice · no boundary** rather than receiving a made-up location pin.

A watch may describe a threat; it is not proof of current damage. Check onset/expiry and the issuer's own text. The app preserves those distinctions rather than labeling every alert a confirmed disaster.

### Community pins

Pins show submitted incident locations. Priority colors help sort urgency; review status describes whether the report is new, reviewed, dispatched, being worked, resolved, or rejected. A report starts Reported/unverified. Administrative verification is a human review recorded in the app, not certification by NWS.

### Missing or partial data

The short status line tells you when official data was fetched. **Partial coverage** means some provider requests or area boundaries could not be loaded. **Unavailable** means the official feed could not load for that location. Community reports can remain usable independently. The app never invents hazards to fill an empty map, and no returned alerts/reports does not establish safety.

Official coverage is weather-related and scoped to supported U.S. point/state data. Surrounding alerts from neighboring states can be missed. Automatic outage detection, road-closure feeds, structure-fire detection, earthquake feeds, and live emergency dispatch are not implemented.

## 3. Filter situations

Select **All sources**, **Official**, or **Community**.

For official records, choose an **Official hazard type**: flooding, severe storms, wind/dust, fire weather, winter/cold, heat, coastal/marine, or other official alerts. Fire weather describes an official weather condition, not necessarily an active fire.

For community records, select one or more report-type buttons: Flooding, Roads, Power, Medical/safety, Debris, Shelter, or Other. Selected buttons are highlighted. Select a button again to remove it, or All reports to remove category restrictions. The Report type dropdown is a compact single-category alternative and replaces the button selection.

Community filters also include Status, Priority, Sort by, and Only my reports after sign-in. Priority first puts open urgent reports ahead of closed/lower-priority ones. Newest first sorts submissions by time. These community filters do not hide official areas; use the official-type or source control for those.

Text search matches community titles/descriptions/addresses/IDs and official event/headline/area text. It searches the returned situations; it is not the same as street-address lookup.

**Fit reports** frames matching community pins and official areas. With no matching geometry it frames the search circle. The reset arrow clears text/source/type/status/priority/sort/ownership filters, while keeping your chosen area and radius. The Official areas map toggle hides/shows official polygons and does not change their source attribution in the list.

The API currently returns at most 1,500 public community records and 200 own records per request. Client filters use those returned records, not an unlimited historical archive.

## 4. Create an account

Browsing needs no account. Select Create account or Report a situation to register. Use your name, email, and a password with at least 12 characters. New accounts are residents. Sign in for an existing account. If you selected Report a situation first, the form opens after login.

Sign out on a shared computer. Accounts created in another local copy are not automatically copied here.

## 5. Report a situation by address

1. Select **Report a situation** and sign in if necessary.
2. Choose the incident type and severity.
3. Write a factual short title (5–120 characters) and description (15–2,000 characters). Explain what you saw, when, and relevant access issues.
4. Enter the incident's full street address.
5. Select **Publish community report**. The address is resolved to coordinates before submission; no map click is required.

Use Find address first if you want to check the match. Multiple matches require choosing one before publication. If lookup returns no match, add street number/city/state/ZIP or use the optional map.

For addressless hazards or corrections, expand **Optional: adjust on map or enter coordinates**. Click or drag the marker, enter coordinates, or use device location with permission. Device location is where your device is, which may not be the incident. Editing the address clears its old coordinates. Confirm address text and the selected location agree.

After submission, the search center moves to your report and its details open. The report remains unverified until reviewed. Use Only my reports and clear restrictive filters if you cannot find it.

### Public content

Report titles, descriptions, addresses, coordinates, and operational histories are public to people with access to this application. Avoid names, phone numbers, sensitive medical details, and other private information. Account email/password data is not sent to the address/weather providers.

## 6. Open details

Community details show report content, review status, priority, location, assigned team, and history. Show on map centers the report; Copy coordinates uses the clipboard if available; Open navigation sends the selected destination to Google Maps. Routes are not verified to avoid flooding or damage.

Official details preserve the alert's own event, certainty, severity, affected area, expiry, description, and issuer instructions. Show affected area frames its geographic boundary. Open official alert links to the source. The app does not create a community report merely because an official warning overlaps the area.

## 7. Administrator workflow

First register normally. The project owner promotes that registered account from the correct source folder/deployed service and database:

```sh
npm run admin -- promote your-registered-email@example.com
```

Sign in again afterward; promotion revokes the prior sessions.

In Command center:
1. Give a registered crew lead the Responder role.
2. Create a response team with name, specialty, contact channel, availability, base coordinates if routing is needed, and a registered lead.
3. Open a community incident, review status/priority, select a team, and add a public operational note.
4. Select Save and dispatch.

Assigning a team to a reported/verified incident moves it to Dispatched. Rejecting an incident cancels active assignments. Resolving it completes active work. Reopening with the same team creates a fresh assignment. Team availability is manually managed, not live GPS/staffing data.

Official alerts are read-only source records and are not manually edited through the community incident controls.

## 8. Team lead workflow

A registered responder assigned as the team's lead sees My assignments after dispatch. Advance one step at a time:

**Assigned → Acknowledged → En route → On scene → Completed**

Completing the assignment resolves the incident. Skipped/backward progress and cancelled/reassigned work are rejected. A responder cannot update another team's work; administrators have broader permissions.

## 9. Updates and troubleshooting

- Reports can arrive through live server-sent events and periodic refresh while visible.
- Official hazards refresh roughly every two minutes while visible; server caching means Refresh may reuse a recent response.
- Reconnecting refers to the live community-update connection. Use Refresh; visible data can be older than current conditions.
- A report-refresh warning retains the last visible records and explicitly warns about stale information.
- For official-feed failure, try again or check weather.gov. Missing official data does not prevent a community report.
- A blank map can indicate external tile/library loading failure. Text records may still work.
- Missing Command center/My assignments means the account lacks the required role or team-lead assignment.
- If changes are missing, verify you are viewing the Local Hazard Map draft on port 3002, not an older local version. Do not reload an unfinished form without saving its contents elsewhere.

## Scope

Flood Finder is an experimental local awareness and coordination tool. It is not an emergency service, evacuation authority, flood-depth sensor, or universal disaster detector. For immediate danger, contact local emergency services. Never drive through floodwater or treat this map or estimated routes as proof of safety.
