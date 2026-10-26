# VenueFlow backend — Person 3 and Person 4

FastAPI and PostgreSQL, using the existing Supabase tables documented in
`DATABASE_CONTEXT.md`. Queries use psycopg2 and ordinary SQL. No additional ORM,
Docker, or Supabase client library is required.

## Run with your existing Supabase database

From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` locally:

- Set `DATABASE_URL` to the PostgreSQL connection string from your Supabase
  project's **Connect** panel, with the database password and `sslmode=require`.
  A Supabase HTTP project URL or anon key is not a PostgreSQL connection string.
  Use the session pooler if the direct database address is unreachable.
- Set `JWT_SECRET_KEY` to a random secret. Generate one with
  `.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Keep `SEED_DEMO_ACCOUNTS=false` for Supabase.
- Configure SMTP for real registration emails. With `SMTP_ENABLED=false`, OTPs
  appear in the server's INFO logs for local development.

Start the API using the existing database:

```powershell
.venv/Scripts/python -m uvicorn app.main:app --reload --log-level info
```

Booking operations use the documented existing Supabase tables. The application
does not create or alter tables automatically. OTP registration requires the
existing `email_otps` table from the authentication backend; if that table is
absent, email registration cannot work until its storage is provided. Login for
existing users and booking operations do not require that table.
Do **not** run `sql/schema.sql` or `sql/demo_catalog.sql` on your existing Supabase
database; those files are only for a fresh local database.

Open http://localhost:8000/docs to try the API, or `/health` to check the database.
Database credentials remain in `backend/.env`, which is ignored by Git. No
Supabase credentials were available when the backend was implemented, so the live
connection has not been verified here.

## Code map

| File | Responsibility |
| --- | --- |
| `app/main.py` | Application, CORS, startup, health check |
| `app/config.py` | Read settings from environment / `.env` |
| `app/db/session.py` | PostgreSQL pool and transaction handling |
| `app/models/booking.py` | Validate booking inputs |
| `app/api/v1/venues.py` | Venue and availability routes |
| `app/api/v1/bookings.py` | Booking routes and authenticated user |
| `app/repositories/venue_repo.py` | Catalog queries and overlap check |
| `app/repositories/booking_repo.py` | Booking, cancellation and approval rules |
| `app/api/v1/auth.py` | Existing login, registration, OTP and profile APIs |
| `sql/schema.sql` | Complete schema for a fresh local database |

## API contract

All routes below start with `/api/v1`. Request and response fields use
`snake_case`. IDs are database integers, not the browser demo's `venue-nc01`
strings. Use IDs returned by the venue API. Dates must include a timezone, e.g.
`2027-01-15T10:00:00+05:30`. PostgreSQL stores absolute instants.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/venues` | Active catalog; `search`, `venue_type`, `min_capacity`, `limit`, `offset` |
| GET | `/venues/{venue_id}` | Venue details, building and managing unit |
| GET | `/venues/{venue_id}/availability?start_time=...&end_time=...` | Availability without disclosing other applicants' details |
| POST | `/bookings` | Submit a booking as the authenticated applicant |
| GET | `/bookings` | Your bookings; optional `status`, `limit`, `offset` |
| GET | `/bookings?scope=review` | Bookings assigned to your active approval groups |
| GET | `/bookings/{application_id}` | Details, time slots, approval stages and decision history |
| POST | `/bookings/{application_id}/cancel` | Owner cancellation; no request body required |
| PATCH | `/bookings/{application_id}/status` | Assigned reviewer decision; body `{"status":"approved","remarks":"OK"}` or `rejected` |
| POST | `/auth/register` | Start applicant registration and send OTP |
| POST | `/auth/verify-otp` | Verify email and create applicant account |
| POST | `/auth/resend-otp` | Request another verification code |
| POST | `/auth/login` | Obtain access token |
| GET | `/auth/me` | Your profile and active group memberships |

Catalog endpoints are public. Booking endpoints require
`Authorization: Bearer <access_token>` from login. Swagger's **Authorize** button
accepts the token. Availability is advisory: submission checks again while saving.
Encode the `+` in query parameters as `%2B`, or use URLSearchParams on the frontend.

Example booking body (substitute a real venue ID and future times):

```json
{
  "venue_id": 169,
  "purpose": "Python workshop",
  "description": "An introductory session for first year students",
  "application_type": "Workshop",
  "expected_attendance": 30,
  "start_time": "2027-01-15T10:00:00+05:30",
  "end_time": "2027-01-15T12:00:00+05:30"
}
```

Creation returns HTTP 201 with the saved application, `slots`, `approvals`, and
`events`. List endpoints return arrays, defaulting to 100 rows (maximum 200).
Validation errors return 422, authentication failures 401, permission failures
403, missing records 404, booking conflicts/invalid transitions 409, and database
connection failures 503.

## Booking and approval rules

- Start time must be in the future; end time must be after start time. Attendance
  must be positive and cannot exceed a known venue capacity.
  Attendance is validated at submission but is not saved because the existing
  database has no attendance column. Cancellation updates the existing status and
  slot timestamps; cancellation reasons are not collected or stored.
- Each submission creates one application, one pending time slot, and its
  approval stages in one transaction. There is no second `bookings` table:
  the existing `applications` and `booking_slots` tables hold bookings.
- Pending and confirmed slots both reserve the venue. Overlap means
  `existing.start < requested.end AND existing.end > requested.start`.
  Back-to-back bookings are allowed.
- Every booking write locks the venue row until commit. Concurrent submissions
  through this backend are serialized before checking and saving. Raw SQL writers
  must follow the same locking rule.
- Primary venue approval comes first, followed by additional configured stages.
  Groups at the same stage can review in either order. An `any` group uses
  `minimum_approvals`; an `all` group requires all eligible members counted at
  submission. Required counts are saved on the application, so later membership
  changes do not silently change that application's threshold.
- Only active users with current, active group membership and `can_approve=true`
  can vote. An approver label alone grants no booking decision rights. Applicants
  cannot review their own requests; repeat votes do not increase the count.
- A venue needs sufficient assigned approvers before a booking can be submitted.
  Otherwise submission returns 409 so an administrator can fix its configuration.
- A rejection releases the reserved slot. Final approval confirms it. The owner
  may cancel submitted or approved bookings before they start; cancellation also
  releases the slot. Completed decisions cannot be edited.
- Application status values are `submitted`, `approved`, `rejected`, `cancelled`,
  matching Supabase's existing schema. Slot values are `pending`, `confirmed`,
  `cancelled`. Frontend labels can display Submitted as Pending.
- Reapply after rejection with a new POST; the original decision history remains.

Approver accounts and memberships are assigned by a trusted database administrator,
not public signup. The existing frontend approver signup option will receive 403.
After the intended reviewer has registered, an administrator can assign a venue's
group in Supabase's SQL editor (replace the email and group ID):

```sql
INSERT INTO group_members (access_id, user_id, member_role, can_approve)
SELECT 1, user_id, 'Reviewer', TRUE FROM users WHERE email = 'reviewer@coep.ac.in'
ON CONFLICT (access_id, user_id)
DO UPDATE SET can_approve = TRUE, left_at = NULL;
```

Use the venue's actual `access_id`, including additional groups where applicable.
The account gains review rights from membership; a role name is not required.

Uploads, profile editing and browser notification preferences are outside these
booking APIs. The React booking pages still use their existing local demo service;
the backend contract above is ready for frontend integration.

## Optional local demo

Create an empty local PostgreSQL database, put its URL in `backend/.env`, and run:

```powershell
.venv/Scripts/python manage.py init-local
.venv/Scripts/python manage.py seed-local
.venv/Scripts/python -m uvicorn app.main:app --reload
```

These commands create a clearly labelled sample classroom and local test accounts:
`applicant@venueflow.test` / `ApplicantDemo!42` and
`approver@venueflow.test` / `ApproverDemo!42`. Local setup commands reject remote
database URLs. Run `seed-local` once on a fresh schema.

## Tests

```powershell
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest tests -q
```

Tests start and stop their own disposable local PostgreSQL server with `pgserver`.
They never connect to Supabase. They cover persistence, auth, ownership,
availability, validation, adjacent slots, rejection/cancellation, approval ordering,
multi-vote approval and simultaneous conflicting requests.
