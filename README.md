# Flood Finder | floodfinderusa.com
<img width="1726" height="996" alt="Screenshot 2026-10-25 at 8 40 16 PM" src="https://github.com/user-attachments/assets/27984f4f-17ff-41cb-a380-a218a17ba5f1" />



Monitoring tool for finding nearby hazards and reporting local disruptions: flooding, blocked roads, outages, storm debris, shelter needs, and safety concerns.

The **Local Hazard Map** draft combines two clearly labeled sources:
- **Official areas:** active National Weather Service warnings, watches, advisories, and relevant statements. These are shaded regions, not invented incident pins.
- **Community reports:** location-based submissions. New submissions remain unverified until reviewed.

Weather is supporting evidence for affected areas. The main interface is the map and situation feed, not temperature cards or a general forecast dashboard. The application does not infer a flood, road closure, outage, or fire merely from a weather reading.

## Start here

- [How to use the application](docs/USER_GUIDE.md)
- [Languages, runtime, libraries, and architecture](docs/ARCHITECTURE.md)
- [Data sources, map boundaries, and coverage limits](docs/DATA_SOURCES.md)
- [API endpoints](docs/API.md)
- [File and branch organization](docs/VERSIONS.md)
- [Design decisions and Sites guidance](docs/DESIGN.md)
- [Testing and verification](docs/TESTING.md)
- [Publishing plan](docs/PUBLISHING.md)
- [Change history](docs/CHANGELOG.md)

## Languages and technologies

| Technology | Role |
| --- | --- |
| JavaScript | Browser interactions and Node.js server/provider logic; ES modules on the server |
| HTML5 | Page structure, forms, dialogs, accessibility labels |
| CSS3 | Responsive layout, map workspace, interface styling |
| SQL | SQLite schema, queries, and transactions |
| YAML | GitHub Actions, the proposed Render configuration, and Docker Compose |
| Dockerfile syntax | Optional container setup |
| JSON / GeoJSON | API data and geographic boundaries; data formats rather than application languages |
| Node.js | Server runtime; tested with 24.15.0, supports >=22.13.0 and <25 |
| SQLite | Embedded persistent database, through built-in `node:sqlite` |
| Leaflet 1.9.4 | Browser map library, loaded from unpkg |
| OpenStreetMap | External base-map tiles |

There is no React, TypeScript, Python application server, or npm runtime dependency to install. Development scripts used to edit files are not part of the application runtime.



## Scope and limitations

Official hazard coverage is weather-related and limited to supported U.S. areas. This app does not automatically detect every road closure, outage, structure fire, earthquake, crime, or other emergency. Community reporting supplements that gap. Official boundaries can cover more territory than the actual hazard; local geometry matching is approximate. Missing alerts or reports are not evidence that an area is safe.

Public report descriptions, addresses, coordinates, and operational histories are visible to people who can access the app. Do not put private names, phone numbers, or medical details in them. For immediate danger, contact local emergency services. Estimated routes are not verified flood-safe routes.

## License

MIT. See [LICENSE](LICENSE).

### ZIP search and restrained interface

Enter a five-digit ZIP, ZIP+4, or full street address and select **Locate ↗**. ZIP results use an approximate area center from Zippopotam.us; incident reports still need a street address or precise optional pin. Advanced controls are under **Refine the map**. See [User Guide](docs/USER_GUIDE.md), [Data Sources](docs/DATA_SOURCES.md), and [Design](docs/DESIGN.md).

Address fields now offer Photon/OpenStreetMap suggestions as you type, using the MIT-licensed Awesomplete library sourced from GitHub. Fonts use a single native sans-serif family. Report details include category-specific external resources. See [Third-party sources](docs/THIRD_PARTY.md) for reuse, licenses and service limits.
