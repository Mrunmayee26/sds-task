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

## Future backend

`src/services/apiClient.js` is an optional Fetch wrapper configured by `VITE_API_BASE_URL`. It supplies response and network error handling but intentionally does not guess API endpoints or response contracts. The existing booking workflow remains local until FastAPI endpoints and their schemas are agreed. Keep database credentials and Supabase service keys out of client-side environment variables.
