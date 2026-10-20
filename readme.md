# COEP VenueFlow

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

`VITE_ENABLE_DEMO_AUTH` keeps its existing name. The development mock login is enabled by default in Vite development mode, and setting `VITE_ENABLE_DEMO_AUTH=false` in `.env.development` disables it. The auth service also checks Vite's development flag, so production builds never enable mock authentication. `VITE_API_BASE_URL` is the optional base URL for future API integration; the current demo booking workflow does not call it.

Available checks:

```sh
npm run lint
npm run build
```

## Portals and routes

The login page is at `/`; the registration form is at `/register`. During local development, use the fictional test accounts in `src/services/demoAuth.js` and select the matching role. The Applicant account opens `/applicant/dashboard`; the Approver account opens `/approver/dashboard`. Applicant routes: `/applicant/dashboard`, `/applicant/venues`, `/applicant/book`, `/applicant/applications`, `/applicant/schedule`, and `/applicant/settings`. `/applicant` redirects to the dashboard after login.

Approver routes: `/approver/dashboard`, `/approver/approvals`, `/approver/schedule`, `/approver/venues`, and `/approver/settings`. `/approver` and `/approvers` redirect to the dashboard after login. Portal routes require the matching frontend demo role; a user signed in for the other role is sent to their own dashboard. Portal switching clears the current demo session and returns to login.

## Demo login and future authentication

- `src/services/demoAuth.js` validates fictional development-only email/password pairs and the selected role, then stores only the `development-mock` mode and role in `sessionStorage`. Passwords are never stored by the application.
- The test credentials are included in browser-delivered source and are not secrets or real accounts. The mock is only for UI testing; it is not secure authentication or authorization and does not protect data or APIs.
- The production build disables the role preview even if the environment flag is set. Since no authentication API is connected yet, production login stays unavailable and protected portal routes fail closed.
- Replace `authenticate` and `getDemoSession` with the FastAPI authentication service and its supported session/token strategy when the backend contract is ready. Keep authorization decisions on the server.
- The `/register` page validates form fields but does not call an API or store registration details. `registerAccount` reports that registration is unavailable until the backend provides a real endpoint. Approver role selection does not grant privileges.
- `/register` includes client-side validation but does not submit or store registration data. `registerAccount` returns an unavailable result until the backend defines a real registration endpoint; selecting Approver does not grant privileges.

## Demo data and services

- `src/data/venues.js` is the shared 56-item venue catalog. Venue IDs are stable; unverified capacities, amenities, descriptions, and rules remain `null` or empty.
- `src/data/demo/` contains browser-local bookings, notifications, and other page-specific fixtures.
- `src/services/bookingService.js` provides local booking, conflict-check, and notification operations. It validates date/time ranges and booking status transitions and broadcasts same-tab change events. Browser storage cannot provide server-side concurrency guarantees.
- `src/data/demo/approverVenues.js` holds illustrative availability labels and sample bookings separately from venue specifications. Availability is not live or calculated from booking records.
- `src/hooks/useBookingData.js` subscribes pages and layouts to the local service's change events.
- Settings preferences are saved in this browser only. Uploaded supporting documents are not sent or persisted; only their filename appears in a booking record.

## Future API integration

When the FastAPI service is available, set `VITE_API_BASE_URL` in your local `.env.development` to its base URL. `src/services/apiClient.js` provides a small native Fetch wrapper for future service modules. It deliberately defines no endpoint paths or response schemas. The current booking workflow remains local and does not call the API client.

Never place Supabase credentials, service-role keys, or other secrets in Vite client environment variables. Supabase access and authorization belong behind the backend.
