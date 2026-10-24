# Report sources and interface update — 24 October 2026

Daniel requested clearer source references for local reports, explicit identification of user inputs, and a restrained UI polish. Codex implemented these changes in the existing Local Hazard Map draft.

## What each source means

- Official hazard records come from the National Weather Service. **Open official alert** opens the exact NWS alert data record supplied by the app, including issuer text and timing.
- Community pins originate from user submissions to Flood Finder. Each detail now identifies this source explicitly, explains review status, and links to the original record through `/?incident=REPORT_ID#map`. Sharing that URL opens the report dialog after loading the app. Missing/deleted records show the existing not-found error.
- Community submissions currently have no external citation field. The interface says so; it does not invent a news article or government confirmation. An internal verified status is not proof of outside confirmation.
- **Safety guidance** links to the existing curated NWS/Red Cross general advice. It is explicitly distinct from evidence for the individual event.

## Design

Preserves the existing map-first ivory/olive visual direction and native sans-serif font. Raises feed text size and contrast, adds a compact source explanation and an understated provenance panel, and improves spacing. No new libraries, schema changes, or provider integrations.

## Validation

Run `npm test` for the existing API/provider checks. Check a community record URL in a new browser tab, its source explanation, an official alert source link, safety guidance, and narrow-screen layout. Browser verification is recorded separately from automated tests; it is not personal acceptance testing by Daniel.
