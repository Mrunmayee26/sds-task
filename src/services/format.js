export const CAMPUS_TIMEZONE = 'Asia/Kolkata';
export const statusLabel = (status) => {
  if (!status) return '—';
  if (status === 'submitted') return 'Pending';
  if (status === 'needs_reassignment') return 'Needs Reassignment';
  return status.charAt(0).toUpperCase() + status.slice(1);
};
export function dateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function dateLabel(value) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: CAMPUS_TIMEZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '—';
}
export function timeLabel(value) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: CAMPUS_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';
}
export const campusTimestamp = (date, time) => `${date}T${time}:00+05:30`;
