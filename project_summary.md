# COEP VenueFlow — Complete Project Summary

> **Stack:** React + Vite · JavaScript · CSS Modules · Lucide React icons · React Router v6

---

## 🗂️ Project Structure

```
src/
├── App.jsx                        ← Root router (all routes defined here)
├── index.css                      ← Global CSS design tokens & base styles
├── components/
│   ├── Sidebar/                   ← Reusable sidebar navigation component
│   ├── StatusBadge/               ← Color-coded status pill (Pending/Approved/Rejected/Cancelled)
│   ├── VenueCard/                 ← Venue card display component
│   ├── GradientButton/            ← Branded gradient CTA button
│   └── FormInput/                 ← Styled form input wrapper
├── layouts/
│   ├── ApplicantLayout.jsx        ← Applicant portal shell (sidebar + top banner + content)
│   ├── ApplicantLayout.module.css
│   ├── ApproverLayout.jsx         ← Approver portal shell
│   └── ApproverLayout.module.css
├── pages/
│   ├── ApplicantDashboard.jsx     ← Applicant home page
│   ├── ApplicantVenues.jsx        ← Browse & search all 56 COEP venues
│   ├── ApplicantBookVenue.jsx     ← Booking form with validation
│   ├── ApplicantApplications.jsx  ← My Applications with cancel/resubmit
│   ├── ApplicantSchedule.jsx      ← Applicant's personal booking calendar
│   ├── ApplicantSettings.jsx      ← Profile, notifications, preferences
│   ├── ApproverDashboard.jsx      ← Approver home with live stats
│   ├── ApproverApprovals.jsx      ← Review & approve/reject requests
│   ├── ApproverSchedule.jsx       ← Venue-level booking calendar
│   └── sampleData/
│       ├── venuesData.js          ← All 56 official COEP venues
│       ├── approverDashboard.sample.js
│       ├── approverApprovals.sample.js
│       └── approverSchedule.sample.js
└── services/
    └── bookingService.js          ← Central data service (localStorage-backed)
```

---

## 🏛️ Venue Catalog (`venuesData.js`)

All **56 official COEP venues** are registered:

| Category | Venues |
|---|---|
| **Auditoriums** | Main Auditorium, Mini Auditorium |
| **North Complex** | NC01 – NC32 (32 classrooms) |
| **South Complex** | SC01 – SC20 (20 classrooms) |

Each venue record contains: `id`, `name`, `category`, `location`, `capacity`, `amenities`, `description`, `rules`.  
*(Capacity and equipment marked "Details not available" — to be filled in once official room specs are provided.)*

---

## 👩‍🎓 Applicant Portal

**Base URL:** `/applicant/*`  
**Default Landing:** `/` and `/applicant` both redirect to `/applicant/dashboard`

### Layout — `ApplicantLayout.jsx`
- **Sidebar** with 5 main navigation items + badge counts
- **Top banner** showing "Viewing as Applicant Portal" with user name & club
- **Portal switcher button** — one-click switch to Approver Portal
- **Notification bell** with unread count badge
- **User avatar pill** linking to Settings

### 1. Dashboard — `/applicant/dashboard`
- **Time-aware greeting** (Good morning / afternoon / evening)
- **4 stat cards:** Total Bookings · Pending · Approved · Rejected
- **Upcoming bookings** list (next scheduled events)
- **Recent activity** feed (latest application status changes)
- **Quick-action buttons:** Book a Venue · Browse Venues · My Applications · My Schedule

### 2. Browse Venues — `/applicant/venues`
- Shows all **56 COEP venues** in a responsive grid
- **Live search** by venue name (e.g. "NC01", "Auditorium", "SC")
- **Category filter** dropdown (All / Auditorium / North Complex / South Complex)
- **Venue count badge** — "Showing X of 56 Facilities"
- Each **venue card** displays: name, category badge, location, capacity, equipment
- **"View Details"** → modal with full specifications + Rules
- **"Book Facility"** → navigates to booking form with venue pre-filled

### 3. Book a Venue — `/applicant/book`
- Accepts `?venue=<name>` query param from Browse Venues
- **Form fields:** Event Name · Venue (dropdown of all 56) · Date · Start Time · End Time · Expected Attendees · Purpose · Equipment Needed · Special Requirements
- **Real-time validation** on all fields (future dates only, end > start time, etc.)
- On submit: creates booking in `bookingService`, fires `coep_bookings_changed` event, shows success confirmation

### 4. My Applications — `/applicant/applications`
- **Status tabs:** All · Pending · Approved · Rejected · Cancelled
- **Search** by event name or venue
- **Sort** by newest / oldest
- Each row shows: event, venue, date, time, status badge
- **Details drawer** → full booking details (applicant info, purpose, equipment, approver notes)
- **Cancel** button on Pending bookings (with confirmation)
- **Resubmit** modal for Rejected bookings (change venue/date and re-send)
- **Print** button for Approved bookings

### 5. My Schedule — `/applicant/schedule`
- **Monthly calendar** with dot indicators on booked dates
- **Day timeline** showing all bookings on selected date
- **Status-color-coded** time blocks
- Clicking a block opens full booking details modal

### 6. Profile & Settings — `/applicant/settings`
- **Profile card** with name, role, club/department, email, student ID
- **Notification preferences** panel
- **Recent notifications** list with read/unread states
- **App preferences** (display settings)

---

## 🏢 Approver Portal

**Base URL:** `/approver/*`  
**Access:** Click "Switch to Approver" in Applicant sidebar, or navigate to `/approver/dashboard` directly  
**Redirects:** `/approver` and `/approvers` both redirect to `/approver/dashboard`

### Layout — `ApproverLayout.jsx`
- Sidebar with: Overview · Approvals (pending badge) · Venues · Schedule · Settings · Sign Out
- Switch to Applicant Portal button

### 1. Dashboard — `/approver/dashboard`
- **Live stats** connected to `bookingService`:
  - Pending Approval count (real-time)
  - Approved Today count (real-time)
  - Venues in Use
  - Total Bookings
- **Today's Schedule** — upcoming bookings for the day
- **Needs Attention** section — pending requests needing review
- **Quick links:** Review Requests · View Calendar · View All Activity

### 2. Approvals — `/approver/approvals`
- **Stats bar:** Total · Pending · Approved · Rejected counts
- **Full bookings table** with search, filter by status, and sort
- **Review drawer** → opens detailed booking card with:
  - Full applicant info (name, club, contact)
  - Event details, venue, date/time, equipment needed
  - **Approve** button (with optional notes field)
  - **Decline** button (with required reason field)
- Approval/Rejection updates propagate instantly via `bookingService` event bus

### 3. Schedule — `/approver/schedule`
- **Monthly calendar** with booking indicators
- **Day timeline** showing all venue bookings across all applicants
- **Venue filter** and **status filter**
- Clicking a slot opens full booking details modal

---

## 🔗 Data & Services — `bookingService.js`

Central localStorage-backed data layer:

| Export | Purpose |
|---|---|
| `CURRENT_APPLICANT` | Logged-in applicant profile (name, club, avatar, etc.) |
| `getAllBookings()` | All bookings in the system (used by Approver) |
| `getApplicantBookings()` | Bookings for current applicant only |
| `getAllVenues()` | Full 56-venue catalog |
| `submitBooking(data)` | Create a new booking request |
| `cancelBooking(id)` | Cancel a pending booking |
| `resubmitBooking(id, newData)` | Resubmit a rejected booking with changes |
| `updateBookingStatus(id, status, notes, approver)` | Approve or reject (Approver action) |
| `getNotifications()` | Applicant notification list |

**Event Bus:** All mutations fire `window.dispatchEvent(new Event('coep_bookings_changed'))` so all open pages/components stay in sync automatically.

---

## 🚦 Full Route Map

| URL | Portal | Component |
|---|---|---|
| `/` | → | Redirects to `/applicant/dashboard` |
| `/applicant` | → | Redirects to `/applicant/dashboard` |
| `/applicant/dashboard` | Applicant | `ApplicantDashboard` |
| `/applicant/venues` | Applicant | `ApplicantVenues` |
| `/applicant/book` | Applicant | `ApplicantBookVenue` |
| `/applicant/applications` | Applicant | `ApplicantApplications` |
| `/applicant/schedule` | Applicant | `ApplicantSchedule` |
| `/applicant/settings` | Applicant | `ApplicantSettings` |
| `/approver` | → | Redirects to `/approver/dashboard` |
| `/approvers` | → | Redirects to `/approver/dashboard` |
| `/approver/dashboard` | Approver | `ApproverDashboard` (live data) |
| `/approver/approvals` | Approver | `ApproverApprovals` (live data) |
| `/approver/schedule` | Approver | `ApproverSchedule` (live data) |
| `*` (any unknown) | → | Redirects to `/applicant/dashboard` |

---

## ⏳ What's Still Pending (Backend Integration)

> Currently everything runs on **localStorage** (no backend). To go production-ready:

1. **Authentication** — Replace `CURRENT_APPLICANT` constant with real login/session
2. **Database** — Swap `bookingService.js` calls with real API endpoints (REST or GraphQL)
3. **Venue details** — Fill in actual capacity, equipment lists, and rules for all 56 venues
4. **Email notifications** — Wire approval/rejection notifications to actual email
5. **File uploads** — Add support for attaching event letters/permission slips to bookings
6. **Role-based access control** — Prevent applicants from directly accessing `/approver/*`
