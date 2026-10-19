/**
 * @file approverDashboard.sample.js
 *
 * SAMPLE DATA — for UI development and preview only.
 * Replace with real API responses when backend integration is complete.
 *
 * Each exported object mirrors the shape the component expects.
 * The backend team must agree to return data in this exact structure,
 * or an adapter layer must be added before passing it to the component.
 *
 * ─── API CONTRACT NOTES ──────────────────────────────────────────────────────
 *
 * SAMPLE_APPROVER_USER
 *   Source: GET /api/v1/auth/me  (authenticated session)
 *   Notes:
 *     - `id` should be the approver's unique user ID.
 *     - `name` is the display name used in the greeting.
 *     - `role` must equal 'approver' for this layout to be shown.
 *     - `department` is optional; reserved for future personalisation.
 *
 * SAMPLE_STATS
 *   Source: GET /api/v1/approver/dashboard/stats
 *   Notes:
 *     - `id` is a stable key used for React rendering; must never change.
 *     - `value` is a number. Backend must NOT return strings.
 *     - `label` and `colorKey` are presentation hints kept here in the
 *       frontend; the backend only needs to return `id` and `value`.
 *     - `pendingCount` may also be used to drive the sidebar badge.
 *
 * SAMPLE_SCHEDULE
 *   Source: GET /api/v1/approver/schedule?date=<ISO-date>
 *   Notes:
 *     - `id` is the booking ID from the database.
 *     - `time` must be a 24-hour HH:MM string in the campus local timezone.
 *     - `venue` is the venue display name (not the venue ID).
 *     - `event` is the event/booking title.
 *     - `colorKey` is a frontend-only field; assign by hashing the venue
 *       name or using a palette index — do NOT ask the backend for colours.
 *
 * SAMPLE_ACTIVITY
 *   Source: GET /api/v1/approver/bookings/recent?limit=10
 *   Notes:
 *     - `id` is the booking ID.
 *     - `event` is the booking title.
 *     - `venue` and `date` are kept separate so the UI can format them.
 *     - `status` must be one of: 'Approved' | 'Pending' | 'Rejected'.
 *       StatusBadge already handles 'Approved' and 'Pending' visually.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Approver user ─────────────────────────────────────────────────────────────

/** @type {ApproverUser} */
export const SAMPLE_APPROVER_USER = {
  id: 'user-001',          // string  — backend user ID
  name: 'Dr. Sharma',      // string  — display name (no hardcoding in JSX)
  role: 'approver',        // string  — role guard
  department: 'Academic Affairs', // string | null — optional
};

// ── Dashboard statistics ──────────────────────────────────────────────────────

/**
 * @type {Array<{ id: string, label: string, value: number, colorKey: string }>}
 *
 * `id` maps to a backend stat key.
 * `label` and `colorKey` are frontend-only; never expect them from the API.
 * `value` will be replaced by the integer returned by /dashboard/stats.
 */
export const SAMPLE_STATS = [
  { id: 'pending',  label: 'Pending Approval', value: 3,  colorKey: 'amber'  },
  { id: 'approved', label: 'Approved Today',   value: 8,  colorKey: 'green'  },
  { id: 'in-use',   label: 'Venues in Use',    value: 7,  colorKey: 'purple' },
  { id: 'total',    label: 'Total Bookings',   value: 24, colorKey: 'blue'   },
];

// ── Today's schedule ──────────────────────────────────────────────────────────

/**
 * @type {Array<{ id: string, time: string, venue: string, event: string }>}
 *
 * `colorKey` is assigned by the frontend palette; do not request from backend.
 * Times are 24-hour strings in campus local timezone (IST / UTC+5:30).
 */
export const SAMPLE_SCHEDULE = [
  { id: 'sch-1', time: '09:00', venue: 'Seminar Hall A',  event: 'Faculty Workshop' },
  { id: 'sch-2', time: '11:30', venue: 'Auditorium',      event: 'Guest Lecture'    },
  { id: 'sch-3', time: '14:00', venue: 'Classroom 204',   event: 'Design Meetup'    },
  { id: 'sch-4', time: '16:00', venue: 'Computer Lab 2',  event: 'Lab Session'      },
];

// ── Recent booking activity ───────────────────────────────────────────────────

/**
 * @type {Array<{ id: string, event: string, venue: string, date: string, status: string }>}
 *
 * `venue` and `date` are separate fields. The component formats them for display.
 * `status` must be 'Approved' | 'Pending' | 'Rejected'.
 */
export const SAMPLE_ACTIVITY = [
  { id: 'act-1', event: 'Department Seminar',       venue: 'Seminar Hall A', date: 'Today, 09:00',    status: 'Approved' },
  { id: 'act-2', event: 'Design Club Meetup',        venue: 'Classroom 204',  date: 'Today, 14:00',    status: 'Pending'  },
  { id: 'act-3', event: 'Annual Cultural Briefing',  venue: 'Auditorium',     date: 'Tomorrow, 10:00', status: 'Pending'  },
];
