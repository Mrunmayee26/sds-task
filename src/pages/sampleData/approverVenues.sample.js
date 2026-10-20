// Local development examples. These statuses and bookings are not live campus data.
export const SAMPLE_APPROVER_VENUES = [
  {
    id: 'VEN-001', name: 'Main Auditorium', building: 'Arts & Events Centre', location: 'North Campus · Ground floor',
    capacity: 500, type: 'Auditorium', facilities: ['Stage', 'Projector', 'Air conditioning', 'Wi-Fi'], status: 'Available',
    bookings: [
      { id: 'VB-101', event: 'Campus Innovation Forum', date: '2026-10-22', time: '09:30–12:00', status: 'Approved' },
      { id: 'VB-102', event: 'Student Film Showcase', date: '2026-10-24', time: '17:00–20:00', status: 'Pending' },
    ],
  },
  {
    id: 'VEN-002', name: 'Seminar Hall B', building: 'Learning Commons', location: 'Central Campus · Level 2',
    capacity: 120, type: 'Seminar Hall', facilities: ['Projector', 'Air conditioning', 'Wi-Fi', 'Whiteboard'], status: 'In Use',
    bookings: [
      { id: 'VB-201', event: 'Design Thinking Workshop', date: '2026-10-20', time: '13:00–15:30', status: 'Approved' },
    ],
  },
  {
    id: 'VEN-003', name: 'Engineering Lab 2', building: 'Engineering Block', location: 'East Campus · Level 1',
    capacity: 48, type: 'Laboratory', facilities: ['Workstations', 'Projector', 'Wi-Fi', 'Air conditioning'], status: 'Available',
    bookings: [
      { id: 'VB-301', event: 'Robotics Club Build Night', date: '2026-10-22', time: '16:00–19:00', status: 'Approved' },
    ],
  },
  {
    id: 'VEN-004', name: 'Lecture Room C14', building: 'Science Building', location: 'West Campus · Level 1',
    capacity: 80, type: 'Classroom', facilities: ['Projector', 'Whiteboard', 'Wi-Fi'], status: 'Unavailable',
    bookings: [],
  },
  {
    id: 'VEN-005', name: 'Conference Room 2', building: 'Administration Building', location: 'Central Campus · Level 3',
    capacity: 24, type: 'Classroom', facilities: ['Display screen', 'Video conferencing', 'Wi-Fi'], status: 'Available',
    bookings: [
      { id: 'VB-501', event: 'Research Colloquium', date: '2026-10-23', time: '10:00–12:30', status: 'Approved' },
    ],
  },
  {
    id: 'VEN-006', name: 'Innovation Studio', building: 'Technology Centre', location: 'South Campus · Ground floor',
    capacity: 36, type: 'Laboratory', facilities: ['Maker equipment', 'Projector', 'Air conditioning', 'Wi-Fi'], status: 'Available',
    bookings: [],
  },
];
