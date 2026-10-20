// Browser-local demo notification seed records. Do not treat these as live data.

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Booking Approved',
    message: 'Your request for "AI Model Deployment Bootcamp" at NC12 has been approved.',
    date: '2026-10-17T15:00:00Z',
    read: false,
    type: 'success',
    link: '/applicant/applications',
  },
  {
    id: 'notif-2',
    title: 'Reviewer Feedback Received',
    message: 'Your request for "Autonomous Rover Sensor Calibration" was rejected with reviewer remarks.',
    date: '2026-10-11T12:00:00Z',
    read: false,
    type: 'warning',
    link: '/applicant/applications',
  },
  {
    id: 'notif-3',
    title: 'Upcoming Booking Reminder',
    message: 'Drone Navigation Flight Test Briefing is scheduled at SC05 on 24th Oct.',
    date: '2026-10-19T08:30:00Z',
    read: true,
    type: 'info',
    link: '/applicant/schedule',
  },
];

