# COEP VenueFlow

The FastAPI/PostgreSQL backend for Person 3 and Person 4 is now implemented.
See [backend/README.md](backend/README.md) for Supabase configuration,
API examples and tests. React's booking pages currently use the local
demo service; connect them using the documented backend contract.

COEP VenueFlow is a React + Vite frontend for browsing campus venues and submitting, reviewing, and tracking venue booking requests. It currently runs in local demo mode: bookings and notifications are stored in the browser's `localStorage`. They are not shared between users or backed by a database.

## Run locally

```sh
npm install
npm run dev
```

Mock login works in Vite development mode without an environment file. To customize local settings, create your own ignored file from the shareable template:

```sh
cp .env.example .env.development
```

In Windows PowerShell, use `Copy-Item .env.example .env.development`. The local `.env.development` file is ignored by Git and should not be committed. `.env.example` is the shareable template teammates can commit and copy.

Set `VITE_API_BASE_URL=http://localhost:8000` for FastAPI login and registration.
`VITE_ENABLE_DEMO_AUTH=false` disables the development-only offline login fallback.
The current booking pages still use the browser-local demo service.

Available checks:

```sh
npm run lint
npm run build
```

## Portals and routes

The login page is at `/`; the registration form is at `/register`. During local development, use the fictional test accounts in `src/services/demoAuth.js` and select the matching role. The Applicant account opens `/applicant/dashboard`; the Approver account opens `/approver/dashboard`. Applicant routes: `/applicant/dashboard`, `/applicant/venues`, `/applicant/book`, `/applicant/applications`, `/applicant/schedule`, and `/applicant/settings`. `/applicant` redirects to the dashboard after login.

Approver routes: `/approver/dashboard`, `/approver/approvals`, `/approver/schedule`, `/approver/venues`, and `/approver/settings`. `/approver` and `/approvers` redirect to the dashboard after login. Portal routes require the matching frontend demo role; a user signed in for the other role is sent to their own dashboard. Portal switching clears the current demo session and returns to login.

## Authentication

- Login calls FastAPI, saves the returned JWT and user profile in session storage,
  and sends the token on later API calls. Passwords are not stored.
- Applicant registration verifies a six-digit email OTP. Configure SMTP on the backend.
- Public signup cannot grant approver access. A database administrator assigns
  group memberships to reviewers, as explained in `backend/README.md`.
- If the API is unavailable, development builds can use the fictional accounts
  in `src/services/demoAuth.js` when the mock flag is enabled. These preview accounts
  do not authorize backend requests. Production builds disable the fallback.

## Demo data and services

- `src/data/venues.js` is the shared 56-item venue catalog. Venue IDs are stable; unverified capacities, amenities, descriptions, and rules remain `null` or empty.
- `src/data/demo/` contains browser-local bookings, notifications, and other page-specific fixtures.
- `src/services/bookingService.js` provides local booking, conflict-check, and notification operations. It validates date/time ranges and booking status transitions and broadcasts same-tab change events. Browser storage cannot provide server-side concurrency guarantees.
- `src/data/demo/approverVenues.js` holds illustrative availability labels and sample bookings separately from venue specifications. Availability is not live or calculated from booking records.
- `src/hooks/useBookingData.js` subscribes pages and layouts to the local service's change events.
- Settings preferences are saved in this browser only. Uploaded supporting documents are not sent or persisted; only their filename appears in a booking record.

## Booking API integration

The backend booking APIs are ready; see `backend/README.md` for their contract.
`src/services/apiClient.js` provides a Fetch wrapper with Bearer token handling.
The current booking workflow remains local until the frontend service and hooks
are connected to the asynchronous booking APIs.

Never place Supabase credentials, service-role keys, or other secrets in Vite client environment variables. Supabase access and authorization belong behind the backend.
