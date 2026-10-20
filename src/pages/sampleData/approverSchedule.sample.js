const addDays = (date, days) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
};

const today = new Date();

// Official 56 venues (Main Auditorium, Mini Auditorium, NC01-NC32, SC01-SC20)
export const SAMPLE_SCHEDULE_BOOKINGS = [
  {
    id: 'SCH-101', eventName: 'Campus Innovation Forum', venue: 'Main Auditorium',
    applicant: 'Maya Kulkarni', date: addDays(today, 0), startTime: '09:30', endTime: '12:00', status: 'Approved',
  },
  {
    id: 'SCH-102', eventName: 'Design Thinking Workshop', venue: 'Mini Auditorium',
    applicant: 'Rohan Deshpande', date: addDays(today, 0), startTime: '13:00', endTime: '15:30', status: 'Pending',
  },
  {
    id: 'SCH-103', eventName: 'Robotics Club Build Night', venue: 'NC05',
    applicant: 'Aarav Shah', date: addDays(today, 2), startTime: '16:00', endTime: '19:00', status: 'Completed',
  },
  {
    id: 'SCH-104', eventName: 'Literary Society Open Mic', venue: 'SC02',
    applicant: 'Ananya Joshi', date: addDays(today, 5), startTime: '17:00', endTime: '20:00', status: 'Approved',
  },
  {
    id: 'SCH-105', eventName: 'Research Colloquium', venue: 'NC12',
    applicant: 'Kabir Patil', date: addDays(today, 8), startTime: '10:00', endTime: '12:30', status: 'Rejected',
  },
  {
    id: 'SCH-106', eventName: 'Photography Exhibition', venue: 'Main Auditorium',
    applicant: 'Isha Nair', date: addDays(today, 12), startTime: '11:00', endTime: '16:00', status: 'Pending',
  },
];
