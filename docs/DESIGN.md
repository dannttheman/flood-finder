# Design direction: Local Hazard Map

## Primary task

Find a local situation, understand its source and affected area, and report or review it. Map is the initial view. The interface should look like a usable local information tool rather than a marketing landing page or a general weather dashboard.

## Applied Sites guidance

The Sites skill was used in local-only mode: build around the primary task, preserve the existing brand, use readable responsive layouts, keep interactions accessible, implement bounded functionality, and verify the local preview. No Site was registered or published, because publishing was explicitly deferred. The current Node/SQLite backend remains intact.

## Layout

A compact white header contains the brand and Map/About/How it works navigation. Search an address, select a radius, or use Search this map. A short source/status line precedes the main workspace. The situation list sits beside the map on desktop; the map comes first on narrow screens. The oversized hero illustration and temperature/forecast dashboard have been removed.

The list separates Official from Community records through source labels, filtering, and distinct visual treatment. Official areas have subdued amber/red boundaries; community reports are pins with priority information. A dashed radius shows the search scope. Shapes communicate affected regions, not exact disaster locations.

## Visual system

System Arial/Helvetica typography, white and light-gray surfaces, dark gray text, restrained green actions, thin borders, and small corner radii. No decorative gradients, oversized slogans, floating mock reports, avatar stacks, or fake incident activity. Map content and source evidence provide the visual detail.

## Interaction rules

- Map is the default view; About explains scope and data sources.
- Street address entry is primary for a new report. Map/coordinate adjustment is optional.
- Multiple community report types can be selected. Official types have a separate filter.
- Source filters offer All sources, Official, and Community.
- Official layer starts enabled. Turning it off hides polygons; feed notices retain their source.
- Official alert details preserve issuer description, instructions, affected geography, timing, and a source link.
- Errors/partial coverage are visible, and empty results are not presented as a safety finding.
- Keyboard focus, menu expansion state, skip navigation, dialog labels, and reduced-motion handling remain supported.

## Future publishing

Keep this same task-first direction when hosting is selected. The current work does not claim that Sites/Render has hosted the application or that a public launch/security review is complete.

## Field-guide interface revision

Warm ivory, charcoal typography, a restrained orange map-pin mark, and a serif “Around here.” heading establish a local field-guide identity. The map carries the page; source tabs stay visible while advanced controls live inside an accessible native details disclosure, “Refine the map.” The duplicate category dropdown was removed. ZIP centers are explicitly approximate. Mobile places the map before the feed. Sites local-build guidance informed this implementation. Higgsfield mockup generation was attempted but the service required a Basic plan or higher; no generated image or mockup is claimed or used.
