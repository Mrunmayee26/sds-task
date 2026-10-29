# Admin and reliability upgrades

## What changed

| Area | Implementation |
| --- | --- |
| Regression testing | pytest rule/security tests, PostgreSQL API tests, Redis tests and an automated three-account browser workflow |
| GitHub Actions | Every push and pull-request update runs backend pytest, frontend calendar tests/lint/build and browser jobs; no production credentials |
| Admin | Dedicated `/admin/login`, dashboard, paginated user management, review permissions, reviewer requests, venue editing, blackouts, all bookings, audit log and operations screen |
| Registration | Email OTP for applicants and department reviewer requests; reviewer signup creates an ordinary account with a pending access request, and only an administrator grants reviewer permissions |
| Abuse protection | Shared Redis limits for login, OTP attempts, registration, resend, password recovery and drafting notices; configured college email domains |
| Account security | Disabling an account stops API access immediately; re-enabling does not revive old sessions. Password reset also revokes old sessions |
| Password recovery | Email links with hashed, single-use tokens and a 30-minute expiry; new password screen |
| Competing bookings | Requests may overlap pending or confirmed requests. Only one overlapping booking may become confirmed; reviewers explicitly choose replacement when appropriate |
| Cancellation policy | Applicants, assigned reviewers and admins can cancel only at least eight hours before the event; replacement obeys the same deadline |
| Campus approval stages | When configured, the selected faculty advisor reviews first, followed by the venue's primary committee and the Dean for larger venue types. Additional venue committees and their any/all/minimum rules are preserved |
| Revocation and reassignment | An assigned reviewer can revoke an approved booking at least eight hours before it starts. The applicant selects a new venue or time; a new request restarts approvals while the original votes and audit history remain intact |
| Profile and calendar | Applicants and reviewers can edit their name/department and switch between monthly and weekly schedules; weekly slots open a booking form with the chosen date and time |
| Redis drafting notices | Per-user/per-venue, five-minute expiring entries; atomic overlap warning with no identity disclosure; advisory only |
| Catalog caching | 60-second Redis catalog cache with version invalidation after admin edits. Live availability is never cached |
| Notifications | Durable in-app updates for submission, reviewer requests, approval/rejection/cancellation and priority replacement; email outbox in the same booking transaction |
| Reminders | A separate worker creates reminders after 24 hours, for the current review stage, at most once per recipient/request/day |
| Filtering/calendar | Venue location, amenities, capacity, type, time availability; monthly calendar and paginated request search |
| Booking policies | Configurable opening hours, maximum duration, advance-booking window, cancellation deadline and reminder age |
| Reliability | Request IDs and structured log fields, dependency health check, admin error/latency/queue dashboard, retryable email delivery, private backup and core-data restore drill |

The SQL setup is additive, explicitly run through `manage.py setup`; the API never
creates tables on startup. Existing records are preserved. New backend-only tables
enable row-level security without granting anonymous/public Supabase policies.

## Configuration

Put these values in `backend/.env`, never in frontend environment variables:

```env
REDIS_URL=rediss://USER:PASSWORD@YOUR_REDIS_HOST:PORT/0
FRONTEND_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAINS=coep.ac.in
CANCELLATION_HOURS=8
MAX_BOOKING_HOURS=12
ADVANCE_BOOKING_DAYS=180
OPENING_HOUR=0
CLOSING_HOUR=24
APPROVAL_REMINDER_HOURS=24
SMTP_ENABLED=true
# Configure the existing SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
# SMTP_FROM_EMAIL, SMTP_FROM_NAME and SMTP_USE_TLS settings as well.
```

Use the exact Redis URI from the provider; local Redis normally uses `redis://`,
hosted encrypted connections commonly use `rediss://`. Authentication protections
require Redis and fail with 503 if it is absent or unreachable. The app never
pretends to use a process-local cache in production. Catalog reads can fall back to
PostgreSQL; drafting notices return a visible unavailable error during an outage.
Redis does not replace PostgreSQL transaction locks.

Opening hours are in IST. `0` to `24` allows any one-day time range; set campus
opening/closing hours to the desired policy. The default maximum duration is 12
hours and advance limit 180 days. Dates outside the policy return a clear 422.

SMTP enables self-registration, password recovery and notification email. In-app
notifications persist even if email is disabled. Real delivery requires valid
credentials and a verified sender where your provider requires it.

From `backend/`, run the API and the notification worker in separate terminals:

```powershell
.venv/Scripts/python -m uvicorn app.main:app --reload
.venv/Scripts/python worker.py
```

The worker retries failed messages at ten-minute intervals, up to five attempts.
Delivery is at-least-once: a process failure just after sending may produce a
duplicate email. Admin → Service health shows queued/failed counts and a worker
heartbeat. Deploy the worker as a long-running process alongside the API.

## Administrator setup and rotation

No default admin email or password exists. The app does not grant admin access
through signup. A trusted database owner can promote an existing verified account
later without changing its password:

```powershell
cd backend
.venv/Scripts/python manage.py promote-admin --email someone@coep.ac.in
```

Sign in at `/admin/login`. To change administrators, promote the successor first,
then demote the previous account:

```powershell
.venv/Scripts/python manage.py demote-admin --email previous@coep.ac.in
```

The command refuses to demote the last active administrator, and revokes sessions
on role changes. `manage.py create-admin` instead prompts locally for a new name,
email and password. It never overwrites an existing account. The CLI is an owner
operation, requiring backend database credentials; it is not a public API.

Reviewers first create/verify an ordinary account, then use **Request reviewer
access** to identify their group and explain their appointment. Admin approval
grants membership; rejection grants no access. Disabled users cannot be approved.
Admins can revoke a group independently of disabling the whole account. Disable
preserves historical bookings and audit data, rather than deleting records.

## Priority and cancellation rules

- Submission never treats a drafting notice as an exclusive hold. Other applicants
  can submit competing requests for an already requested or approved slot.
- An administrator blackout is a hard prohibition. It prevents both submission
  and approval. Creating a blackout over a confirmed reservation is refused;
  cancel the reservation first, respecting its deadline.
- Approvers follow group thresholds and stage order. The final vote confirms the
  request only if no conflicting booking is already confirmed.
- To prioritize a competing request, the reviewer must explicitly check the
  replacement box. The backend verifies authority over every affected booking and
  requires at least eight hours until each affected event begins. It cancels the
  conflicting confirmations and confirms the chosen booking in one transaction.
- A denied replacement rolls back the vote, events and all booking changes.
  Exactly eight hours is allowed; anything later is refused. Admin cancellation
  follows the same deadline. Rejection is a review decision on a pending request;
  it cannot be used to change an already approved booking.
- Other pending requests remain pending after one is approved, allowing a later
  priority decision. Only confirmed reservations must be mutually exclusive.

## Tests and CI

```powershell
backend/.venv/Scripts/python -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python -m pytest backend/tests -q
npm test
npm run lint
npm run build
```

The default pytest suite uses a disposable local PostgreSQL server and a faithful
Redis test implementation. In CI, the backend job instead uses dedicated
PostgreSQL 17 and Redis 7 service containers. `TEST_DATABASE_URL` must contain a
database name with `test` in it; it must never point to Supabase. Browser tests run
in a separate CI job with isolated fixtures and no production secrets.

To run the automated browser suite locally, start only Vite on 5174 using the API
origin `http://127.0.0.1:8001`; leave 8001 free because the test starts its own API:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

In another terminal from the repository root:

```powershell
backend/.venv/Scripts/python -m playwright install chromium
$env:RUN_BROWSER_TESTS='1'
backend/.venv/Scripts/python -m pytest backend/tests/test_browser.py -q
```

GitHub checks run on pushes and PR updates. A repository owner should require the
`backend`, `frontend` and `browser` checks in the protected branch's ruleset if
merging with failed checks must be prevented. This setting is separate from the
workflow itself; it has not been changed automatically.

## Backup and monitoring operations

Create private PostgreSQL archives with `backend/backup_database.py`. The script
passes database credentials through environment variables, not shell arguments,
and refuses to overwrite an existing archive:

```powershell
backend/.venv/Scripts/python backend/backup_database.py --output backups/campus-YYYYMMDD.dump --pg-dump "C:/Program Files/PostgreSQL/18/bin/pg_dump.exe"
```

`backups/` and `*.dump` are ignored by Git. Copy backups to protected off-machine
storage according to your institution's retention policy. Verify restores into a
separate database, never the live campus database. Use a PostgreSQL client/server
version compatible with the archive; Supabase auth/storage extension schemas need
their own compatible environment for a full project restore.

During implementation, the pre-change backup's public core data was restored into
a disposable local database and checked: 27 users, 84 venues, 10 applications.
This is a core-data drill, not a claim of a full Supabase auth/storage restore.

`/health` returns 200 only when both PostgreSQL and Redis work; otherwise 503.
Connect a deployment uptime monitor to this endpoint after hosting is selected.
Application logs include request ID, method, path, status and duration, while
excluding passwords, authorization headers, reset tokens and OTP codes. The admin
operations screen reports daily request/error counts and average latency from
Redis plus persistent email queue state. Daily counters use UTC and expire after
two days; they are operational indicators, not a permanent analytics store.
