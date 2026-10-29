# COEP VenueFlow

**Admin and reliability upgrade:** see [UPGRADES.md](UPGRADES.md) for admin login,
Redis/SMTP settings, account review, competing bookings, the eight-hour deadline,
CI, the notification worker, and backup/monitoring operations. The new additive
database setup is applied to this workspace's Supabase project; existing records
were preserved. New installations must run `backend/manage.py setup` explicitly.

A simple campus venue booking system built with React, FastAPI and the existing
Supabase PostgreSQL database. Frontend screens read and save through the API;
there are no demo records, hardcoded venue catalogs or offline login accounts.

## Start the application

Backend (PowerShell, from the repository root):

```powershell
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
# For a new checkout only: copy .env.example to .env and configure it.
.venv/Scripts/python -m uvicorn app.main:app --reload
```

Set `DATABASE_URL`, `REDIS_URL`, and a random `JWT_SECRET_KEY` in `backend/.env`. Use your
Supabase PostgreSQL connection string with `sslmode=require`. The backend uses
the existing records and requires the explicit additive admin setup described in UPGRADES.md. There is no automatic table creation.
See [backend setup](backend/README.md) for details.

Frontend (a separate terminal, from the repository root):

```powershell
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend on port
8000. If the API is hosted elsewhere, set `VITE_API_BASE_URL` to its origin in a
local frontend `.env` file. In production, configure that variable or have your
web server forward `/api` to FastAPI and serve `index.html` for frontend routes.
Only the API URL belongs in frontend settings; database secrets stay in the backend.

## Booking workflow

1. Sign in with an existing database account or create an applicant account using
   email verification. Registration requires working SMTP settings.
2. Browse the database venue catalog, search by venue or building, and filter by
   type or capacity.
3. Submit a booking with a future time slot, event details and attendance. Times
   are entered and displayed in India Standard Time.
4. The API creates approval stages; competing requests for the same slot are allowed. The reviewer decides priority.
5. An assigned reviewer signs in using the Approver option, opens the request,
   and approves or rejects it. Multiple stages and approval counts are supported.
6. The applicant sees the current decision in My bookings and Schedule. An owner
   can cancel a pending or approved booking at least eight hours before the event.

Pages refresh from the API on focus, after changes and every 30 seconds. Refreshing
the browser preserves database records. Empty lists stay empty and API failures
show an error with a retry action.

## Accounts and permissions

JWTs are stored for the current browser session. The app verifies the account with
`/api/v1/auth/me`, handles expired sessions, and uses the actual profile name and
approval memberships. An assigned reviewer may switch between their applicant
and reviewer workspaces without signing out.

Public registration verifies email and creates an ordinary applicant account. Choosing reviewer registration also submits a department access request; an administrator must approve it before reviewer sign-in is allowed. A venue needs enough eligible
reviewers before accepting requests. User roles alone do not authorize decisions.

When SMTP is disabled or delivery fails, registration reports that verification
is unavailable. It never claims an email was sent successfully. Existing accounts
can still sign in. Configure SMTP in `backend/.env` to enable self-registration.

Users can edit their name and department in their profile. Review permissions and
account status remain controlled by administrators. File uploads and browser-only
notification/settings controls have been removed from the simple booking flow.

## Main files

| File | Responsibility |
| --- | --- |
| `src/App.jsx` | Routes and signed-in portal guards |
| `src/services/auth.js` | API login, registration and session helpers |
| `src/components/Auth/AuthProvider.jsx` | Verify the current account with the API |
| `src/services/bookingService.js` | Venue and booking API calls |
| `src/hooks/useBookingData.js` | Loading, errors and refreshes |
| `src/pages/PortalPages.jsx` | Overview, venues, bookings, schedule and profile |
| `src/pages/BookVenue.jsx` | Venue selection, availability and submission |
| `src/pages/BookingDetails.jsx` | Approval stages, decisions and cancellation |
| `src/layouts/PortalLayout.jsx` | Shared applicant/reviewer navigation |
| `src/layouts/Portal.css` | Responsive portal styling |
| `backend/app/` | Authentication, booking rules and SQL queries |

## Checks

```powershell
npm test
npm run lint
npm run build
backend/.venv/Scripts/python -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python -m pytest backend/tests -q
```

Backend tests start a disposable local PostgreSQL database; they never use Supabase.
For browser testing without changing campus data, see `backend/README.md`.
