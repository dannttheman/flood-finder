# Publishing plan — deferred

This draft is saved to GitHub and previewed locally. The user explicitly requested moving into publishing later. No Site, public URL, paid hosting resource, or new sharing permission has been created for this revision.

## Current runtime requirements

- A long-running Node.js server supporting `node:sqlite`.
- Durable writable storage for the SQLite database.
- HTTPS for production Secure session cookies.
- External HTTPS access to NWS, Census, and optional OSRM.
- Browser access to Leaflet assets and OpenStreetMap tiles.
- An initial administrator created through the documented promotion command.

## Options to evaluate later

**Node-compatible hosting:** retain the current server and SQLite model. The existing `render.yaml` is a proposal using paid compute and a disk, not a deployed service. Revalidate current plan IDs, costs, account/repository access, region, secrets/contact configuration, and storage behavior before applying it.

**Sites hosting:** its server runtime is Cloudflare Workers. Publishing this application through Sites would require migrating the Node HTTP server, session handling, and SQLite storage to supported Worker/D1 patterns. Uploading only `public/` would leave reports, authentication, and APIs nonfunctional. No migration has been attempted or implied.

## Before public launch

1. Select the hosting approach and review actual costs.
2. Preserve the original and review the Local Hazard Map draft.
3. Configure HTTPS, durable storage, and the provider's appropriate public project contact.
4. Test backup and recovery using non-sensitive test data.
5. Review administrative access, abuse limits, public report moderation, privacy, logging, and dependency/network delivery.
6. Validate browser/mobile functionality and geographic source limitations.
7. Confirm current challenge requirements and disclose contributions accurately in submission materials.
8. Deploy only after the user authorizes that publishing step and any required paid resources.
