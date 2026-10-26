# COEP VenueFlow — Current Project Notes

## Stack and structure

The project uses React, Vite, React Router, CSS Modules, and Lucide icons. `src/App.jsx` owns the route table. Applicant and Approver layouts provide separate sidebars and portal switching. Shared controls and the status badge are under `src/components/`; pages and their development fixtures are under `src/pages/`.

## Routes

| URL | Behavior |
|---|---|
| `/` and `/applicant` | Redirect to `/applicant/dashboard` |
| `/applicant/dashboard` | Applicant booking overview |
| `/applicant/venues` | Browse the shared venue catalog |
| `/applicant/book` | Submit a local demo booking |
| `/applicant/applications` | View and manage applicant bookings |
| `/applicant/schedule` | Applicant booking calendar |
| `/applicant/settings` | Profile, local preferences, and notifications |
| `/approver` and `/approvers` | Redirect to `/approver/dashboard` |
| `/approver/dashboard` | Approver overview |
| `/approver/approvals` | Review local demo requests |
| `/approver/schedule` | Browse the supplied booking schedule |
| `/approver/venues` | Read-only catalog and sample availability |
| `/approver/settings` | Temporary redirect to the dashboard |

Unknown routes redirect to the Applicant dashboard.

## Data boundaries

`src/pages/sampleData/venuesData.js` contains the shared catalog of 56 venue names with stable IDs. Capacities, amenities, descriptions, and rules that are not verified remain unspecified. Applicant booking records store the venue name for existing page compatibility and add the stable `venueId` when known.

`src/services/bookingService.js` is a browser-local demo store for bookings and notifications. It seeds initial records when storage is missing, validates stored shapes, preserves explicit empty arrays, and emits same-tab change events after saved mutations. It is not a shared database, and its overlap check cannot guarantee concurrency between browsers or users.

The initial local booking and notification records are maintained separately in `src/pages/sampleData/bookingStore.sample.js`.

Approver venue sample statuses and example bookings are in `src/pages/sampleData/approverVenues.sample.js`, separate from venue specifications. These statuses are illustrative and are not live availability. The rest of the page data can be supplied through component props; an explicit empty array remains empty.

Applicant notification preferences are stored in local browser storage and are not sent to a backend. Booking attachments are not uploaded; the demo record holds a filename only.

## Backend & Connected Database

The Supabase PostgreSQL database is active and connected with all 11 ER tables:
- Venues table: 84 verified official campus venues with capacities, types, and buildings
- Master tables: `buildings` (18 rows), `organizational_units` (20 rows), `approval_groups` (17 rows), `venue_additional_approvals` (4 rows)
- Transactional tables: `users`, `applications`, `booking_slots`, `application_approvals`, `approval_events` (ready with 0 rows)

For the complete schema, column types, relationships, and queries, refer to `backend/DATABASE_CONTEXT.md`.

## Future backend

Person 3/4 implementation is available under `backend/app`: `/api/v1/venues`,
availability, authenticated `/api/v1/bookings`, cancellation and multi-stage group
decisions. `backend/README.md` is the current setup and API contract. Existing
The backend uses the existing documented Supabase schema without requiring schema
changes. The live connection has not been verified here.
Tests use a separate disposable PostgreSQL database.

`src/services/apiClient.js` is a Fetch wrapper configured by `VITE_API_BASE_URL`.
Authentication is connected; the booking workflow still uses its local demo service.
Keep database credentials and Supabase service keys out of client-side environment variables.
