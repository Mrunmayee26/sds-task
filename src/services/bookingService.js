/**
 * @file bookingService.js
 * Centralized data service managing venue bookings, availability checking,
 * conflict prevention, and cross-portal synchronization for COEP Venue Booking System.
 * Strictly uses the official 56 COEP venues (Main Auditorium, Mini Auditorium, NC01-NC32, SC01-SC20).
 *
 * NOTE FOR BACKEND INTEGRATION:
 * When FastAPI endpoints are wired in, replace localStorage read/writes
 * with async fetch calls to /api/v1/bookings, /api/v1/venues, etc.
 */

import { COEP_VENUES } from '../pages/sampleData/venuesData';

const BOOKINGS_STORAGE_KEY = 'coep_venue_bookings_v2';
const NOTIFICATIONS_STORAGE_KEY = 'coep_venue_notifications_v2';

export const CURRENT_APPLICANT = {
  id: 'applicant-001',
  name: 'Maya Kulkarni',
  prn: '112103042',
  email: 'kulkarnim21.comp@coep.ac.in',
  department: 'Computer Engineering',
  club: 'Robotics & AI Club',
  role: 'Student Club Lead',
  phone: '+91 98234 56789',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
};

// Seed initial bookings using ONLY the 56 official COEP venues
const INITIAL_BOOKINGS = [
  {
    id: 'REQ-2026-041',
    eventName: 'Annual Robotics Showcase',
    eventType: 'Exhibition',
    applicant: {
      id: 'applicant-001',
      name: 'Maya Kulkarni',
      department: 'Robotics & AI Club',
      email: 'kulkarnim21.comp@coep.ac.in',
      phone: '+91 98234 56789',
      verified: true,
    },
    venue: 'Main Auditorium',
    date: '2026-11-04',
    startTime: '10:00',
    endTime: '16:00',
    attendance: 280,
    purpose: 'Showcase student-built robotics projects and host demonstrations for the campus community.',
    equipment: [],
    specialInstructions: 'Need power extensions for live robot demonstration stations.',
    status: 'Pending',
    submittedAt: '2026-10-18T14:30:00Z',
    availability: { conflict: false, note: 'No booking conflicts were found for this venue and time.' },
  },
  {
    id: 'REQ-2026-040',
    eventName: 'Design Thinking Workshop',
    eventType: 'Workshop',
    applicant: {
      id: 'applicant-002',
      name: 'Rohan Deshpande',
      department: 'Innovation Cell',
      email: 'deshpander20.mech@coep.ac.in',
      phone: '+91 98765 43210',
      verified: true,
    },
    venue: 'Mini Auditorium',
    date: '2026-11-06',
    startTime: '13:30',
    endTime: '17:00',
    attendance: 72,
    purpose: 'A hands-on workshop introducing human-centered design methods to student teams.',
    equipment: [],
    status: 'Pending',
    submittedAt: '2026-10-19T09:15:00Z',
    availability: { conflict: true, note: 'A tentative reservation overlaps from 15:00 to 16:00.' },
  },
  {
    id: 'REQ-2026-039',
    eventName: 'Literary Society Open Mic',
    eventType: 'Student event',
    applicant: {
      id: 'applicant-003',
      name: 'Ananya Joshi',
      department: 'Literary & Debate Society',
      email: 'joshia22.entc@coep.ac.in',
      phone: '+91 91234 56780',
      verified: true,
    },
    venue: 'NC01',
    date: '2026-11-08',
    startTime: '17:00',
    endTime: '20:00',
    attendance: 60,
    purpose: 'An evening of poetry, short readings, and student performances.',
    equipment: [],
    status: 'Approved',
    submittedAt: '2026-10-17T11:00:00Z',
    decisionDate: '2026-10-19',
    decisionBy: 'Dr. Sharma (Academic Affairs)',
    availability: { conflict: false, note: 'No booking conflicts were found for this venue and time.' },
  },
  {
    id: 'REQ-2026-038',
    eventName: 'Department Research Colloquium',
    eventType: 'Academic event',
    applicant: {
      id: 'applicant-004',
      name: 'Kabir Patil',
      department: 'Mechanical Engineering',
      email: 'patilk.faculty@coep.ac.in',
      phone: '+91 94567 12345',
      verified: false,
    },
    venue: 'SC01',
    date: '2026-11-10',
    startTime: '09:30',
    endTime: '12:30',
    attendance: 48,
    purpose: 'Faculty and postgraduate researchers will present current department projects.',
    equipment: [],
    status: 'Rejected',
    submittedAt: '2026-10-16T16:45:00Z',
    decisionDate: '2026-10-19',
    decisionBy: 'Dr. Sharma (Academic Affairs)',
    reviewerNotes: 'SC01 is reserved for department mid-term tests on 10th Nov morning. Please select another classroom.',
    availability: { conflict: false, note: 'No booking conflicts were found for this venue and time.' },
  },
  {
    id: 'REQ-2026-035',
    eventName: 'AI Model Deployment Bootcamp',
    eventType: 'Workshop',
    applicant: {
      id: 'applicant-001',
      name: 'Maya Kulkarni',
      department: 'Robotics & AI Club',
      email: 'kulkarnim21.comp@coep.ac.in',
      phone: '+91 98234 56789',
      verified: true,
    },
    venue: 'NC12',
    date: '2026-10-28',
    startTime: '14:00',
    endTime: '17:00',
    attendance: 55,
    purpose: 'Hands-on training on deploying machine learning and robotics algorithms.',
    equipment: [],
    status: 'Approved',
    submittedAt: '2026-10-15T10:00:00Z',
    decisionDate: '2026-10-17',
    decisionBy: 'Dr. Sharma (Academic Affairs)',
    reviewerNotes: 'Department key assistant will open the classroom at 13:45.',
    availability: { conflict: false, note: 'No booking conflicts.' },
  },
  {
    id: 'REQ-2026-031',
    eventName: 'Drone Navigation Flight Test Briefing',
    eventType: 'Competition / Practice',
    applicant: {
      id: 'applicant-001',
      name: 'Maya Kulkarni',
      department: 'Robotics & AI Club',
      email: 'kulkarnim21.comp@coep.ac.in',
      phone: '+91 98234 56789',
      verified: true,
    },
    venue: 'SC05',
    date: '2026-10-24',
    startTime: '16:00',
    endTime: '18:30',
    attendance: 40,
    purpose: 'Autonomous drone flight path theory and pre-flight parameter reviews.',
    equipment: [],
    status: 'Approved',
    submittedAt: '2026-10-12T13:20:00Z',
    decisionDate: '2026-10-14',
    decisionBy: 'Dr. Sharma (Academic Affairs)',
    availability: { conflict: false, note: 'No booking conflicts.' },
  },
  {
    id: 'REQ-2026-028',
    eventName: 'Autonomous Rover Sensor Calibration',
    eventType: 'Lab / Testing',
    applicant: {
      id: 'applicant-001',
      name: 'Maya Kulkarni',
      department: 'Robotics & AI Club',
      email: 'kulkarnim21.comp@coep.ac.in',
      phone: '+91 98234 56789',
      verified: true,
    },
    venue: 'NC04',
    date: '2026-10-14',
    startTime: '09:00',
    endTime: '12:00',
    attendance: 35,
    purpose: 'Indoor mapping and lidar sensor calibration across level classroom floor.',
    equipment: [],
    status: 'Rejected',
    submittedAt: '2026-10-10T08:00:00Z',
    decisionDate: '2026-10-11',
    decisionBy: 'Dr. Sharma (Academic Affairs)',
    reviewerNotes: 'NC04 was reserved for regular second-year evaluation. Please select another slot.',
    availability: { conflict: false, note: 'No booking conflicts.' },
  },
];

const INITIAL_NOTIFICATIONS = [
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

/**
 * Loads bookings from localStorage or seeds with INITIAL_BOOKINGS
 */
export function getAllBookings() {
  try {
    const raw = localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    }
    const parsed = JSON.parse(raw);
    // Sanity check: Ensure only valid bookings exist
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_BOOKINGS;
  } catch (err) {
    console.error('Failed to load bookings from storage', err);
    return INITIAL_BOOKINGS;
  }
}

/**
 * Saves bookings to localStorage and notifies listeners
 */
export function saveBookings(bookings) {
  try {
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
    window.dispatchEvent(new CustomEvent('coep_bookings_changed', { detail: bookings }));
  } catch (err) {
    console.error('Failed to save bookings', err);
  }
}

/**
 * Get all 56 official COEP venues catalog
 */
export function getAllVenues() {
  return COEP_VENUES;
}

/**
 * Find venue by name or ID (Strictly matching official 56 venues)
 */
export function getVenueById(idOrName) {
  if (!idOrName) return null;
  const normalized = idOrName.toLowerCase().trim();
  return (
    COEP_VENUES.find(
      (v) => v.id.toLowerCase() === normalized || v.name.toLowerCase() === normalized
    ) || null
  );
}

/**
 * Convert time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if a requested timeslot conflicts with existing Approved or Pending bookings.
 */
export function checkTimeslotConflict(venueName, date, startTime, endTime, excludeBookingId = null) {
  const all = getAllBookings();
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  const normalizedVenue = String(venueName || '').trim().toLowerCase();

  const conflicting = all.find((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (b.status === 'Rejected' || b.status === 'Cancelled') return false;
    if (b.date !== date) return false;

    const bVenue = String(b.venue || '').trim().toLowerCase();
    if (bVenue !== normalizedVenue) return false;

    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);

    // Overlap condition: startA < endB and endA > startB
    return startMin < bEnd && endMin > bStart;
  });

  if (conflicting) {
    return {
      hasConflict: true,
      conflictingBooking: conflicting,
      message: `Conflict detected: "${conflicting.eventName}" is already scheduled at ${conflicting.venue} from ${conflicting.startTime} to ${conflicting.endTime} (Status: ${conflicting.status}).`,
    };
  }

  return { hasConflict: false, conflictingBooking: null, message: 'Venue is available for this slot.' };
}

/**
 * Filter bookings belonging specifically to the logged in applicant (Maya Kulkarni)
 */
export function getApplicantBookings(applicantName = CURRENT_APPLICANT.name) {
  const all = getAllBookings();
  return all.filter((b) => {
    if (!b.applicant) return false;
    if (typeof b.applicant === 'string') {
      return b.applicant.toLowerCase().includes(applicantName.toLowerCase());
    }
    return (
      b.applicant.name?.toLowerCase().includes(applicantName.toLowerCase()) ||
      b.applicant.id === CURRENT_APPLICANT.id
    );
  });
}

/**
 * Create a new booking submitted by applicant
 */
export function createBooking(data) {
  const all = getAllBookings();

  // Validate times
  const startMin = timeToMinutes(data.startTime);
  const endMin = timeToMinutes(data.endTime);
  if (endMin <= startMin) {
    throw new Error('End time must be later than start time.');
  }

  // Validate venue exists in official 56 list
  const venueObj = getVenueById(data.venue);
  if (!venueObj) {
    throw new Error(`"${data.venue}" is not a valid COEP venue. Please select from the official 56 facilities.`);
  }

  // Validate capacity only if officially configured
  if (typeof venueObj.capacity === 'number' && Number(data.attendance) > venueObj.capacity) {
    throw new Error(
      `Expected attendance (${data.attendance}) exceeds maximum configured capacity of ${venueObj.capacity} seats for ${venueObj.name}.`
    );
  }

  // Check conflicts
  const conflictCheck = checkTimeslotConflict(data.venue, data.date, data.startTime, data.endTime);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  // Generate ID
  const nextNum = all.length + 42;
  const newId = `REQ-2026-${String(nextNum).padStart(3, '0')}`;

  const newBooking = {
    id: newId,
    eventName: data.eventName,
    eventType: data.eventType || 'Academic Session',
    applicant: {
      id: CURRENT_APPLICANT.id,
      name: data.applicantName || CURRENT_APPLICANT.name,
      department: data.department || CURRENT_APPLICANT.club,
      email: data.email || CURRENT_APPLICANT.email,
      phone: data.phone || CURRENT_APPLICANT.phone,
      verified: true,
    },
    venue: venueObj.name, // Ensure exact official name stored
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    attendance: Number(data.attendance) || 1,
    purpose: data.purpose || '',
    equipment: data.equipment || [],
    specialInstructions: data.specialInstructions || '',
    supportingDocument: data.supportingDocument || null,
    status: 'Pending', // Enforced: applicants cannot self-approve
    submittedAt: new Date().toISOString(),
    availability: { conflict: false, note: 'Availability checked at submission time.' },
  };

  const updated = [newBooking, ...all];
  saveBookings(updated);

  // Add in-app notification
  addNotification({
    title: 'Booking Request Submitted',
    message: `Your request "${data.eventName}" (${newId}) for ${venueObj.name} was submitted and is pending faculty review.`,
    type: 'info',
    link: '/applicant/applications',
  });

  return newBooking;
}

/**
 * Update a booking status (Approver action or cancellation).
 * Enforces availability recheck upon approval to prevent overlapping confirmed bookings!
 */
export function updateBookingStatus(id, newStatus, reviewerNotes = '', decisionBy = 'Dr. Sharma') {
  const all = getAllBookings();
  const index = all.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Booking not found');

  const existing = all[index];

  // Re-check conflict upon approval
  if (newStatus === 'Approved') {
    const conflict = checkTimeslotConflict(
      existing.venue,
      existing.date,
      existing.startTime,
      existing.endTime,
      existing.id
    );
    if (conflict.hasConflict) {
      throw new Error(`Cannot approve booking: ${conflict.message}`);
    }
  }

  const updated = {
    ...existing,
    status: newStatus,
    reviewerNotes: reviewerNotes || existing.reviewerNotes || '',
    decisionDate: new Date().toISOString().slice(0, 10),
    decisionBy: decisionBy,
  };

  const nextList = [...all];
  nextList[index] = updated;
  saveBookings(nextList);

  // If this belongs to Maya Kulkarni, trigger in-app notification
  if (
    existing.applicant?.name?.toLowerCase().includes('maya') ||
    existing.applicant?.id === CURRENT_APPLICANT.id
  ) {
    addNotification({
      title: `Booking ${newStatus}`,
      message: `Your booking "${existing.eventName}" at ${existing.venue} has been marked as ${newStatus}.${
        reviewerNotes ? ` Remarks: ${reviewerNotes}` : ''
      }`,
      type: newStatus === 'Approved' ? 'success' : newStatus === 'Rejected' ? 'warning' : 'info',
      link: '/applicant/applications',
    });
  }

  return updated;
}

/**
 * Cancel a booking by the applicant
 */
export function cancelBooking(id, reason = 'Cancelled by applicant') {
  const all = getAllBookings();
  const index = all.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Booking not found');

  const existing = all[index];
  if (existing.status === 'Cancelled') return existing;

  const updated = {
    ...existing,
    status: 'Cancelled',
    cancellationReason: reason,
    cancelledAt: new Date().toISOString(),
  };

  const nextList = [...all];
  nextList[index] = updated;
  saveBookings(nextList);

  addNotification({
    title: 'Booking Cancelled',
    message: `You cancelled the reservation for "${existing.eventName}" (${existing.id}) at ${existing.venue}.`,
    type: 'info',
    link: '/applicant/applications',
  });

  return updated;
}

/**
 * Resubmit a previously rejected booking with updated date/time/venue
 */
export function resubmitBooking(id, updatedFields) {
  const all = getAllBookings();
  const index = all.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Booking not found');

  const existing = all[index];

  // Validate venue in official list
  const venue = updatedFields.venue || existing.venue;
  const venueObj = getVenueById(venue);
  if (!venueObj) {
    throw new Error(`"${venue}" is not a valid COEP venue.`);
  }

  const date = updatedFields.date || existing.date;
  const startTime = updatedFields.startTime || existing.startTime;
  const endTime = updatedFields.endTime || existing.endTime;

  const conflictCheck = checkTimeslotConflict(venue, date, startTime, endTime, id);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  const updated = {
    ...existing,
    ...updatedFields,
    venue: venueObj.name,
    date,
    startTime,
    endTime,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    previousReviewerNotes: existing.reviewerNotes,
    reviewerNotes: '',
    decisionDate: null,
    resubmitted: true,
  };

  const nextList = [...all];
  nextList[index] = updated;
  saveBookings(nextList);

  addNotification({
    title: 'Booking Resubmitted',
    message: `"${updated.eventName}" (${id}) for ${venueObj.name} has been resubmitted for faculty approval.`,
    type: 'info',
    link: '/applicant/applications',
  });

  return updated;
}

/**
 * In-App Notification Utilities
 */
export function getNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveNotifications(notifs) {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('coep_notifications_changed', { detail: notifs }));
  } catch (err) {
    console.error('Failed to save notifications', err);
  }
}

export function addNotification({ title, message, type = 'info', link = '/applicant/applications' }) {
  const current = getNotifications();
  const item = {
    id: `notif-${Date.now()}`,
    title,
    message,
    date: new Date().toISOString(),
    read: false,
    type,
    link,
  };
  const updated = [item, ...current];
  saveNotifications(updated);
  return item;
}

export function markNotificationAsRead(id) {
  const current = getNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
}

export function markAllNotificationsAsRead() {
  const current = getNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
}
