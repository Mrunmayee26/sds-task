# COEP VenueFlow — Database & Backend Context

> Implementation update: venue, availability, booking, cancellation and multi-stage
> approval APIs now exist under `/api/v1`. See `README.md` in this directory for
> the current contract. Existing Supabase databases need
> `sql/migrations/001_booking_fields.sql` (attendance, cancellation reason and
> indexes). This checkout had no Supabase credentials, so the live migration has
> not been applied here. Historical record counts below have not been reverified.

> **Quick Reference Document**: This document caches the complete schema, relationships, row counts, and architectural status of the Supabase PostgreSQL database and FastAPI backend. Agents and developers should read this file directly to avoid re-querying or re-analyzing the live database.

---

## 1. Connection & Infrastructure

- **Engine:** PostgreSQL 17.11 (Supabase)
- **Host:** Supabase pooler / direct connection specified in `backend/.env` via `DATABASE_URL`
- **Backend Framework:** FastAPI (`backend/app/main.py`)
- **Connection Management:** Psycopg2 `ThreadedConnectionPool` in `backend/app/db/session.py`
  - Min connections: 1, Max connections: 10
  - Context managers: `get_db_connection()`, `get_db_cursor(commit=True/False)` (returns `RealDictCursor`)
- **Verification Script:** `backend/test_connection.py`

---

## 2. Table Summary & Record Counts (Verified)

| # | Table Name | Rows | Description |
|---|---|---|---|
| 1 | `organizational_units` | 20 | Academic departments, administrative offices, centres |
| 2 | `buildings` | 18 | Campus buildings, complexes, and locations |
| 3 | `users` | 4+ | Registered students, faculty, staff, and approvers |
| 4 | `approval_groups` | 17 | Authorities/bodies that review booking applications |
| 5 | `group_members` | 2+ | Users assigned to approval groups with review privileges |
| 6 | `venues` | 84 | Full official campus venue inventory with capacities |
| 7 | `venue_additional_approvals` | 4 | Extra multi-step approval rules for restricted venues |
| 8 | `applications` | 0 | Booking applications submitted by applicants |
| 9 | `booking_slots` | 0 | Specific date/time slots reserved for an application |
| 10 | `application_approvals` | 0 | Approval stages and tracking per application |
| 11 | `approval_events` | 0 | Audit log of individual approver decisions & remarks |

---

## 3. Detailed Table Schemas

### 3.1 `venues` (84 rows)
Primary catalog of bookable facilities on COEP campus.

| Column | Type | Nullable | Default | Relations / Notes |
|---|---|---|---|---|
| `venue_id` | `integer` (PK) | NO | - | Unique identifier (e.g., 169 to 252) |
| `venue_name` | `varchar(150)` | NO | - | e.g. "Main Auditorium", "NC01", "SC15", "Bhau Institute Classroom 1" |
| `venue_type` | `varchar(50)` | NO | - | See §4 for list of 14 distinct types |
| `building_id` | `integer` | YES | - | FK -> `buildings.building_id` |
| `managing_unit_id` | `integer` | NO | - | FK -> `organizational_units.unit_id` |
| `access_id` | `integer` | NO | - | FK -> `approval_groups.access_id` (primary approval group) |
| `capacity` | `integer` | YES | - | Real seating capacity (e.g., 1000, 300, 120, 60, 20) |
| `location_description` | `text` | YES | - | Descriptive floor/location within building |
| `is_active` | `boolean` | NO | `true` | Active status flag |

### 3.2 `buildings` (18 rows)
Physical structures across the campus.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `building_id` | `integer` (PK) | NO | Unique building ID |
| `building_name` | `varchar(150)` | NO | e.g. "Main Auditorium Complex", "Bhau Institute Building", "Academic Complex" |
| `owning_unit_id` | `integer` | YES | FK -> `organizational_units.unit_id` |
| `location_description` | `text` | YES | Campus location / address details |

### 3.3 `organizational_units` (20 rows)
Departments, institutes, and administrative units.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `unit_id` | `integer` (PK) | NO | Unique unit ID |
| `unit_name` | `varchar(150)` | NO | e.g. "Department of Computer Engineering", "Registrar's Office", "Gymkhana" |
| `unit_code` | `varchar(30)` | YES | Short identifier (e.g. "COMP", "REG") |
| `unit_type` | `varchar(40)` | NO | Type of unit (academic, administrative, etc.) |
| `parent_unit_id` | `integer` | YES | FK -> `organizational_units.unit_id` (hierarchical) |

### 3.4 `approval_groups` (17 rows)
Designated review committees and authority groups.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `access_id` | `integer` (PK) | NO | - | Primary key for approval authority |
| `group_name` | `varchar(150)` | NO | - | Group name (e.g., "Registrar Office Approval", "HOD Computer") |
| `unit_id` | `integer` | NO | - | FK -> `organizational_units.unit_id` |
| `approval_mode` | `varchar(20)` | NO | `'any'` | `'any'` (1 member sufficient) or `'all'` |
| `minimum_approvals`| `integer` | NO | `1` | Approvals threshold |
| `is_active` | `boolean` | NO | `true` | Active flag |

### 3.5 `group_members` (0 rows)
Mapping between individual users and approval groups.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `access_id` | `integer` (PK, FK) | NO | - | FK -> `approval_groups.access_id` |
| `user_id` | `integer` (PK, FK) | NO | - | FK -> `users.user_id` |
| `member_role` | `varchar(60)` | NO | - | Role title (e.g., "HOD", "Dean", "Faculty Advisor") |
| `can_approve` | `boolean` | NO | `false` | Authority to sign off |
| `joined_at` | `timestamptz` | NO | `now()` | - |
| `left_at` | `timestamptz` | YES | - | Exit date if removed |

### 3.6 `users` (0 rows)
All campus stakeholders (applicants and approvers).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `user_id` | `integer` (PK) | NO | - | Unique user ID |
| `full_name` | `varchar(150)` | NO | - | User display name |
| `email` | `varchar(255)` | NO | - | Unique login email (e.g. `@coep.ac.in`) |
| `user_type` | `varchar(30)` | NO | - | e.g. `'student'`, `'faculty'`, `'admin'` |
| `home_unit_id` | `integer` | YES | - | FK -> `organizational_units.unit_id` |
| `password_hash` | `varchar(255)` | YES | - | Bcrypt hashed password |
| `is_active` | `boolean` | NO | `true` | Status flag |
| `created_at` | `timestamptz` | YES | `now()` | Registration timestamp |

### 3.7 `venue_additional_approvals` (4 rows)
Multi-tier approval rules for special venues (e.g., Main Auditorium requiring Gymkhana + Registrar).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `venue_id` | `integer` (PK, FK) | NO | FK -> `venues.venue_id` |
| `access_id` | `integer` (PK, FK) | NO | FK -> `approval_groups.access_id` |
| `approval_step` | `integer` | NO | 1-based order of review |

### 3.8 `applications` (0 rows)
Booking requests created by applicants.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `application_id` | `integer` (PK) | NO | - | Unique booking ID |
| `applicant_user_id` | `integer` | NO | - | FK -> `users.user_id` |
| `venue_id` | `integer` | YES | - | FK -> `venues.venue_id` |
| `target_access_id` | `integer` | YES | - | FK -> `approval_groups.access_id` |
| `application_type` | `varchar(40)` | NO | - | Academic, Cultural, Workshop, etc. |
| `purpose` | `varchar(255)` | NO | - | Event title / purpose |
| `description` | `text` | YES | - | Detailed description |
| `expected_attendance` | `integer` | YES | - | Positive attendance; added by migration 001 |
| `cancellation_reason` | `text` | YES | - | Owner's reason; added by migration 001 |
| `status` | `varchar(30)` | NO | `'draft'` | `'draft'`, `'submitted'`, `'approved'`, `'rejected'`, `'cancelled'` |
| `created_at` | `timestamptz` | NO | `now()` | Created timestamp |
| `submitted_at` | `timestamptz` | YES | - | Submission timestamp |

### 3.9 `booking_slots` (0 rows)
Time blocks assigned to an application.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `slot_id` | `integer` (PK) | NO | - | Unique slot ID |
| `application_id` | `integer` | NO | - | FK -> `applications.application_id` |
| `venue_id` | `integer` | NO | - | FK -> `venues.venue_id` |
| `start_time` | `timestamptz` | NO | - | Slot start datetime |
| `end_time` | `timestamptz` | NO | - | Slot end datetime |
| `slot_status` | `varchar(30)` | NO | `'pending'` | `'pending'`, `'confirmed'`, `'cancelled'` |
| `confirmed_at` | `timestamptz` | YES | - | Confirmation timestamp |
| `cancelled_at` | `timestamptz` | YES | - | Cancellation timestamp |

### 3.10 `application_approvals` (0 rows)
Step-level approval tracker for an application.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `approval_id` | `integer` (PK) | NO | - | Unique approval step ID |
| `application_id` | `integer` | NO | - | FK -> `applications.application_id` |
| `access_id` | `integer` | NO | - | FK -> `approval_groups.access_id` |
| `approval_step` | `integer` | NO | - | Order index (1, 2, ...) |
| `required_approvals`| `integer` | NO | `1` | Threshold required |
| `approval_count` | `integer` | NO | `0` | Number received |
| `status` | `varchar(30)` | NO | `'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| `last_action_by_user_id`| `integer` | YES | - | User ID of approver |
| `last_action_at` | `timestamptz` | YES | - | Timestamp of action |
| `remarks` | `text` | YES | - | Approver notes |

### 3.11 `approval_events` (0 rows)
Immutable audit trail of actions taken on an approval step.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `event_id` | `integer` (PK) | NO | - | Unique audit log ID |
| `approval_id` | `integer` | NO | - | FK -> `application_approvals.approval_id` |
| `access_id` | `integer` | NO | - | FK -> `approval_groups.access_id` |
| `actor_user_id` | `integer` | NO | - | User ID who acted |
| `decision` | `boolean` | NO | - | `true` (approved) / `false` (rejected) |
| `remarks` | `text` | YES | - | Comments logged |
| `created_at` | `timestamptz` | NO | `now()` | Event timestamp |

---

## 4. Venue Inventory Breakdown (84 Venues)

| Venue Type | Count | Sample Venues |
|---|---|---|
| `classroom` | 50 | NC01–NC32 (North Complex), SC01–SC20 (South Complex), Bhau Classrooms |
| `seminar_hall` | 13 | Seminar Hall 1 & 2 (Admin Bldg), Civil Seminar Hall, Mech Seminar Hall |
| `open_space` | 4 | Bhau Terrace & Ground open spaces, Quadrangle, Boat Club grounds |
| `auditorium` | 3 | Main Auditorium (cap: 1000), Mini Auditorium (cap: 300), Bhau Auditorium (cap: 120) |
| `conference_room` | 3 | VC Conference Room, Bhau Conference Room, Dean Office Conf Room |
| `meeting_room` | 3 | Bhau Meeting Rooms 1 & 2, Bhau Experience Room |
| `sports_hall` | 1 | Gymkhana Indoor Sports Hall |
| `sports_ground` | 1 | COEP Main Ground |
| `outdoor_event_space` | 1 | Open Air Theatre |
| `computer_lab` | 1 | Central Computer Facility (CCF) |
| `lab` | 1 | Department specialized lab |
| `drawing_hall` | 1 | Central Drawing Hall |
| `workshop` | 1 | Mechanical Workshop |
| `hall` | 1 | Alumni Hall |

---

## 5. Current Architectural State & Integration Status

```
[ Supabase PostgreSQL (11 Tables, 84 Venues) ]
                    ▲
                    │ psycopg2 (ThreadedConnectionPool in session.py)
                    ▼
[ FastAPI Backend (backend/app/main.py) ]
  - GET /, GET /health, /api/v1/auth/*
  - /api/v1/venues, venue details and availability
  - /api/v1/bookings, retrieval, cancellation and status decisions
                    ▲
                    │ HTTP Fetch (via VITE_API_BASE_URL="http://localhost:8000")
                    ▼
[ React + Vite Frontend (src/) ]
  - Currently reads: src/data/venues.js (56 hardcoded items, null capacities)
  - Needs update: fetch live venues from GET /api/v1/venues and connect booking APIs
```

---

## 6. Ready-to-Use Query for Venues API

When creating `GET /api/venues`, use this optimized query:

```sql
SELECT 
    v.venue_id,
    v.venue_name,
    v.venue_type,
    v.capacity,
    v.location_description,
    v.is_active,
    b.building_id,
    b.building_name,
    u.unit_id,
    u.unit_name,
    ag.access_id,
    ag.group_name AS primary_approval_group
FROM venues v
LEFT JOIN buildings b ON v.building_id = b.building_id
LEFT JOIN organizational_units u ON v.managing_unit_id = u.unit_id
LEFT JOIN approval_groups ag ON v.access_id = ag.access_id
WHERE v.is_active = true
ORDER BY v.venue_name;
```
