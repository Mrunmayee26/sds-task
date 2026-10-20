// Illustrative availability and schedule only; venue specifications stay in data/venues.js.
// Status values are not live or calculated from bookings.
export const SAMPLE_VENUE_STATUS_BY_ID = {
  'venue-main-auditorium': 'In Use',
  'venue-mini-auditorium': 'Available',
  'venue-nc01': 'Available',
  'venue-nc02': 'Unavailable',
  'venue-sc01': 'Available',
  'venue-sc02': 'In Use',
};

export const SAMPLE_VENUE_BOOKINGS = {
  'venue-main-auditorium': [
    { id: 'VB-101', event: 'Campus Innovation Forum', date: '2026-10-22', startTime: '09:30', endTime: '12:00', status: 'Approved' },
    { id: 'VB-102', event: 'Student Film Showcase', date: '2026-10-24', startTime: '17:00', endTime: '20:00', status: 'Pending' },
  ],
  'venue-nc01': [
    { id: 'VB-201', event: 'Literary Society Open Mic', date: '2026-10-23', startTime: '17:00', endTime: '20:00', status: 'Approved' },
  ],
  'venue-sc01': [
    { id: 'VB-301', event: 'Department Research Colloquium', date: '2026-10-25', startTime: '10:00', endTime: '12:30', status: 'Pending' },
  ],
};
