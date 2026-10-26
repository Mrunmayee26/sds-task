# VenueFlow backend

FastAPI with ordinary parameterized SQL queries using psycopg2. The database is
your existing Supabase PostgreSQL project. The API does not create or alter tables,
seed accounts or run migrations.

## Setup

From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
# New checkout only; do not overwrite an existing configured .env:
Copy-Item .env.example .env
```

Edit `backend/.env`:

- `DATABASE_URL`: copy the PostgreSQL URI from Supabase's Connect panel. Use the
  session pooler if the direct host is unreachable. Include the actual database
  password, URL-encode reserved characters in it, and use `sslmode=require`.
- `JWT_SECRET_KEY`: a random secret of at least 32 characters. Generate one with
  `.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `CORS_ORIGINS`: frontend origins allowed to call the API directly.
- SMTP settings: required for email registration. With `SMTP_ENABLED=false`,
  registration and resend return 503 with a configuration message. Existing
  users can still log in. Verification codes are not logged.

Start the API:

```powershell
.venv/Scripts/python -m uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for interactive API documentation and `/health`
for the database health check. Keep `.env` ignored by Git. The schema is documented
in `DATABASE_CONTEXT.md`; OTP registration additionally uses the existing
`email_otps` table. No Supabase anon/service key is needed by this backend.

## Code map

| File | Responsibility |
| --- | --- |
| `app/main.py` | Application, CORS, startup and health |
| `app/config.py` | Environment settings |
| `app/db/session.py` | PostgreSQL pool and transaction handling |
| `app/models/booking.py` | Booking request validation |
| `app/api/v1/venues.py` | Catalog, details and availability routes |
| `app/api/v1/bookings.py` | Authenticated booking routes |
| `app/repositories/venue_repo.py` | Catalog SQL and overlap checks |
| `app/repositories/booking_repo.py` | Booking, cancellation and approval rules |
| `app/api/v1/auth.py` | Login, email registration and current profile |

## API contract

All paths below start with `/api/v1`. Fields use `snake_case`, IDs are database
integers, and timestamps must include a timezone such as `+05:30` or `Z`.
All booking endpoints require `Authorization: Bearer <access_token>` from login.
Catalog endpoints are public. Lists return arrays with `limit` (1–200) and `offset`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/venues` | Active catalog; optional search, venue_type, min_capacity |
| GET | `/venues/{venue_id}` | Venue, location and managing group |
| GET | `/venues/{venue_id}/availability?start_time=...&end_time=...` | Check a future time range |
| POST | `/bookings` | Submit a request |
| GET | `/bookings` | Your requests; optional status filter |
| GET | `/bookings?scope=review` | Requests assigned to your approval groups |
| GET | `/bookings/{application_id}` | Request, slots, approval stages and history |
| POST | `/bookings/{application_id}/cancel` | Owner cancellation, no body |
| PATCH | `/bookings/{application_id}/status` | Reviewer decision |
| POST | `/auth/register` | Start email verification for an applicant |
| POST | `/auth/verify-otp` | Verify code, create account and issue token |
| POST | `/auth/resend-otp` | Send another verification email |
| POST | `/auth/login` | Issue token for an existing account |
| GET | `/auth/me` | Current profile and active memberships |

Example booking (use an existing venue ID and future times):

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

Creation returns 201 with the stored application, `slots`, `approvals` and
`events`. Attendance is validated against capacity and stored as a readable line
in the existing description field. No extra column is required.

Decision body: `{"status":"approved","remarks":"OK"}` or `rejected`.
Validation errors return 422, authentication 401, permissions 403, missing records
404, conflicts/invalid transitions 409, and database/email unavailability 503.

## Rules

- Start must be in the future, end after start, and attendance positive and within
  known capacity. All booking writes lock the venue until commit.
- Pending and confirmed slots block overlaps. Back-to-back slots are allowed.
  Availability checks do not reserve a slot; creation checks again while saving.
- Primary review comes first, then additional configured stages. Groups at the
  same stage can act in either order. Group thresholds are saved at submission.
- A reviewer must have current active membership with `can_approve=true`.
  Self-review and repeated votes are rejected. A role label alone grants no access.
- All stages must approve before the application is approved. Rejection and
  cancellation release the slot. Owners can cancel pending or approved future
  bookings. Existing decision history is retained.
- Application statuses: `submitted`, `approved`, `rejected`, `cancelled`.
  Slot statuses: `pending`, `confirmed`, `cancelled`. The UI labels submitted
  requests as Pending.
- A venue must have enough eligible reviewers before it can accept a booking.
- Reapply after rejection with a new request; keep the old decision history.

Administrators assign reviewers in the existing `group_members` table. Public
registration cannot assign permissions. Account profiles are read-only in this
simple app; administrators maintain account details. Attachments and stored
cancellation reasons are outside this schema.

## Verification

```powershell
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest tests -q
```

Tests use pgserver to start a disposable local PostgreSQL instance. Test schema and
records live under `tests/fixtures`; they are never applied to Supabase.

To manually test browser workflows without modifying campus records:

```powershell
# From backend/, starts an isolated API at port 8001:
.venv/Scripts/python tests/serve_browser_test.py
```

In a second PowerShell terminal from the repository root:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Only in that isolated test instance, sign in as `applicant@coep.ac.in` or
`reviewer@coep.ac.in` with `BrowserTest42`. The second account has a faculty role
and a reviewer membership, verifying that permissions come from group membership.
Stop both test processes afterwards. The normal app on port 5173 uses the real API.
