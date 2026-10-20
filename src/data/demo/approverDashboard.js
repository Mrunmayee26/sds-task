// Dashboard preview values are derived from the same local seed bookings.
// They are component examples, not an API contract or live campus data.
import { INITIAL_BOOKINGS } from './bookings.js';

const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = toDateKey(new Date());
const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};
const now = new Date();
const nowMinutes = now.getHours() * 60 + now.getMinutes();
const todayBookings = INITIAL_BOOKINGS.filter((booking) => booking.date === today);
const currentVenues = new Set(todayBookings.filter((booking) => {
  if (booking.status !== 'Approved') return false;
  const start = timeToMinutes(booking.startTime);
  const end = timeToMinutes(booking.endTime);
  return start !== null && end !== null && start <= nowMinutes && nowMinutes < end;
}).map((booking) => booking.venue));

export const SAMPLE_APPROVER_USER = {
  id: 'approver-demo',
  name: 'Approver',
  role: 'approver',
  department: 'Academic Affairs',
};

export const SAMPLE_STATS = [
  { id: 'pending', label: 'Pending Approval', value: INITIAL_BOOKINGS.filter((booking) => booking.status === 'Pending').length, colorKey: 'amber' },
  { id: 'approved', label: 'Approved Today', value: INITIAL_BOOKINGS.filter((booking) => booking.status === 'Approved' && booking.decisionDate === today).length, colorKey: 'green' },
  { id: 'in-use', label: 'Venues in Use', value: currentVenues.size, colorKey: 'purple' },
  { id: 'total', label: 'Total Bookings', value: INITIAL_BOOKINGS.length, colorKey: 'blue' },
];

export const SAMPLE_SCHEDULE = todayBookings
  .filter((booking) => ['Pending', 'Approved'].includes(booking.status))
  .slice().sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
  .map((booking) => ({
    id: booking.id,
    time: `${booking.startTime || 'Time TBD'} – ${booking.endTime || 'TBD'}`,
    venue: booking.venue,
    event: booking.eventName,
  }));

export const SAMPLE_ACTIVITY = INITIAL_BOOKINGS
  .filter((booking) => booking.status === 'Pending')
  .slice().sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))
  .slice(0, 5).map((booking) => ({
    id: booking.id,
    event: booking.eventName,
    venue: booking.venue,
    date: booking.date,
    status: booking.status,
  }));
