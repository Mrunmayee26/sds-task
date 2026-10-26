import { apiRequest } from './apiClient';

// The database is the only source of venue and booking records.
async function readAll(path, signal) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const page = await apiRequest(
      `${path}${path.includes('?') ? '&' : '?'}limit=200&offset=${offset}`,
      { signal },
    );
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}

export const getVenues = (signal) => readAll('api/v1/venues', signal);
export const getBookings = (scope, signal) =>
  readAll(`api/v1/bookings?scope=${scope}`, signal);
export const getBooking = (id, signal) =>
  apiRequest(`api/v1/bookings/${id}`, { signal });

export function checkAvailability(venueId, startTime, endTime, signal) {
  const query = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
  });
  return apiRequest(`api/v1/venues/${venueId}/availability?${query}`, {
    signal,
  });
}

async function changeBooking(path, method, body) {
  const saved = await apiRequest(`api/v1/bookings${path}`, { method, body });
  window.dispatchEvent(new Event('venueflow_bookings_changed'));
  return saved;
}

export const createBooking = (data) => changeBooking('', 'POST', data);
export const cancelBooking = (id) => changeBooking(`/${id}/cancel`, 'POST');
export const decideBooking = (id, status, remarks) =>
  changeBooking(`/${id}/status`, 'PATCH', { status, remarks });
