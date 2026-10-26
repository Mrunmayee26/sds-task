# COEP VenueFlow — Current Project Notes

React/Vite communicates with FastAPI over `/api/v1`. FastAPI connects to the
existing Supabase PostgreSQL database using psycopg2. There are no runtime demo
records, offline authentication fallbacks, database migrations or automatic schema
creation. Synthetic records exist only in isolated test fixtures.

Both portals use shared pages and a shared layout. Applicant routes include
overview, venue discovery, booking submission, requests, request details, schedule
and profile. Reviewer routes show group-assigned requests, stage progress,
approval/rejection, schedule and profile. The original `/applicant/*` and
`/approver/*` entry URLs remain; details use `/{portal}/bookings/{application_id}`.

All venue, request, profile, schedule and dashboard records come from API responses.
The frontend submits integer database venue IDs, actual authenticated users, and
timezone-aware dates. It does not connect to PostgreSQL directly. Display times
use India Standard Time. Pages refresh on focus, mutations and a 30-second timer.

Applications and booking_slots hold reservations. Pending and approved requests
reserve their time. Venue locks serialize concurrent writes. Reviewers need active
group membership, cannot review their own requests, and must follow stage order.
Rejection and owner cancellation release the reserved slot. Attendance is checked
against capacity and included in the existing description field so reviewers can
see it without adding a database column.

Registration requires SMTP and the existing email_otps table. It creates applicant
accounts only. Missing or failed email delivery returns an actionable error.
Administrators assign reviewer memberships and maintain account details directly
in the existing database. Unsupported uploads and fictional notification/profile
preferences were removed.

The live Supabase schema and catalog were checked read-only. Browser workflow
tests use a separate local PostgreSQL database to avoid adding test bookings to
Supabase. See `readme.md` and `backend/README.md` for setup and verification.
