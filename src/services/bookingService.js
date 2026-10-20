/**
 * @file bookingService.js
 * Centralized browser-local demo service for bookings, overlap checks, and same-tab synchronization.
 * Strictly uses the official 56 COEP venues (Main Auditorium, Mini Auditorium, NC01-NC32, SC01-SC20).
 *
 * This local overlap check is a convenience for the demo only. It is not an
 * authoritative availability decision or a concurrency guarantee.
 */

import { COEP_VENUES } from '../data/venues.js';
import { INITIAL_BOOKINGS } from '../data/demo/bookings.js';
import { INITIAL_NOTIFICATIONS } from '../data/demo/notifications.js';

const BOOKINGS_STORAGE_KEY = 'coep_venue_bookings_v2';
const NOTIFICATIONS_STORAGE_KEY = 'coep_venue_notifications_v2';

const replaceInvalidStoredValue = (storage, key, rawValue, fallback) => {
  try {
    const recoveryKey = `${key}_recovery`;
    if (!storage.getItem(recoveryKey)) storage.setItem(recoveryKey, rawValue);
    storage.setItem(key, JSON.stringify(fallback));
  } catch {
    // Keep the in-memory fallback available if recovery storage is also unavailable.
  }
};

const getStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isValidDateKey = (value) => {
  const dateKey = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const [year, month, day] = dateKey.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};
const timeToMinutes = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
const createUniqueId = (prefix, existingIds) => {
  const timestamp = Date.now().toString(36);
  let suffix = Math.random().toString(36).slice(2, 10);
  let id = `${prefix}-${timestamp}-${suffix}`;
  while (existingIds.has(id)) {
    suffix = Math.random().toString(36).slice(2, 10);
    id = `${prefix}-${Date.now().toString(36)}-${suffix}`;
  }
  return id;
};

const isBookingRecord = (booking) => booking && typeof booking === 'object'
  && typeof booking.id === 'string' && typeof booking.eventName === 'string'
  && typeof booking.venue === 'string' && typeof booking.date === 'string'
  && typeof booking.status === 'string';
const isNotificationRecord = (notification) => notification && typeof notification === 'object'
  && typeof notification.id === 'string' && typeof notification.title === 'string'
  && typeof notification.message === 'string' && typeof notification.date === 'string';
const normalizeBookings = (bookings) => bookings.map((booking) => {
  const venue = getVenueById(booking.venueId) || getVenueById(booking.venue);
  return venue && booking.venueId !== venue.id ? { ...booking, venueId: venue.id } : booking;
});

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

/**
 * Loads bookings from localStorage or seeds with INITIAL_BOOKINGS
 */
export function getAllBookings() {
  let storage;
  let raw;
  try {
    storage = getStorage();
    if (!storage) return normalizeBookings(INITIAL_BOOKINGS);
    raw = storage.getItem(BOOKINGS_STORAGE_KEY);
    if (!raw) {
      storage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(INITIAL_BOOKINGS));
      return normalizeBookings(INITIAL_BOOKINGS);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isBookingRecord)) {
      replaceInvalidStoredValue(storage, BOOKINGS_STORAGE_KEY, raw, INITIAL_BOOKINGS);
      return normalizeBookings(INITIAL_BOOKINGS);
    }
    return normalizeBookings(parsed);
  } catch (err) {
    console.error('Failed to load bookings from storage', err);
    if (storage && raw) replaceInvalidStoredValue(storage, BOOKINGS_STORAGE_KEY, raw, INITIAL_BOOKINGS);
    return normalizeBookings(INITIAL_BOOKINGS);
  }
}

/**
 * Saves bookings to localStorage and notifies listeners
 */
export function saveBookings(bookings) {
  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    throw new Error(`Browser storage is unavailable: ${error.message}`, { cause: error });
  }
  if (!storage) throw new Error('Booking storage is unavailable in this environment.');
  try {
    storage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
  } catch (error) {
    throw new Error(`Could not save the booking update in this browser: ${error.message}`, { cause: error });
  }
  window.dispatchEvent(new CustomEvent('coep_bookings_changed', { detail: bookings }));
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
  const normalized = String(idOrName).toLowerCase().trim();
  return (
    COEP_VENUES.find(
      (v) => v.id.toLowerCase() === normalized || v.name.toLowerCase() === normalized
    ) || null
  );
}

/**
 * Checks if a requested timeslot conflicts with existing Approved or Pending bookings.
 */
export function checkTimeslotConflict(venueName, date, startTime, endTime, excludeBookingId = null) {
  const all = getAllBookings();
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const venue = getVenueById(venueName);
  const normalizedVenue = venue?.id || String(venueName || '').trim().toLowerCase();
  if (!isValidDateKey(date) || startMin === null || endMin === null || endMin <= startMin || !normalizedVenue) {
    return { hasConflict: false, conflictingBooking: null, message: 'Choose a valid date and time range to check availability.' };
  }

  const conflicting = all.find((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (!['Pending', 'Approved'].includes(b.status)) return false;
    if (b.date !== date) return false;

    const bVenue = getVenueById(b.venueId || b.venue)?.id || String(b.venue || '').trim().toLowerCase();
    if (bVenue !== normalizedVenue) return false;

    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    if (bStart === null || bEnd === null || bEnd <= bStart) return false;

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
  const normalizedName = String(applicantName || '').trim().toLowerCase();
  return all.filter((b) => {
    if (!b.applicant) return false;
    if (typeof b.applicant === 'string') {
      return b.applicant.toLowerCase() === normalizedName;
    }
    return (
      b.applicant.id === CURRENT_APPLICANT.id && normalizedName === CURRENT_APPLICANT.name.toLowerCase()
      || b.applicant.name?.toLowerCase() === normalizedName
    );
  });
}

/**
 * Create a new booking submitted by applicant
 */
export function createBooking(data) {
  const input = data && typeof data === 'object' ? data : {};
  const all = getAllBookings();
  const venueObj = getVenueById(input.venue);
  validateBookingDetails(input, venueObj);
  const conflictCheck = checkTimeslotConflict(venueObj.id, input.date, input.startTime, input.endTime);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  const existingIds = new Set(all.map((booking) => booking.id));
  const newId = createUniqueId('REQ', existingIds);

  const newBooking = {
    id: newId,
    eventName: input.eventName.trim(),
    eventType: input.eventType || 'Academic Session',
    applicant: {
      id: CURRENT_APPLICANT.id,
      name: input.applicantName || CURRENT_APPLICANT.name,
      department: input.department || CURRENT_APPLICANT.club,
      email: input.email || CURRENT_APPLICANT.email,
      phone: input.phone || CURRENT_APPLICANT.phone,
      verified: true,
    },
    venueId: venueObj.id,
    venue: venueObj.name,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    attendance: Number(input.attendance),
    purpose: input.purpose.trim(),
    equipment: Array.isArray(input.equipment) ? [...input.equipment] : [],
    specialInstructions: input.specialInstructions || '',
    supportingDocument: input.supportingDocument || null,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    availability: { conflict: false, note: 'No overlapping local demo booking was found at submission time.' },
  };

  const updated = [newBooking, ...all];
  saveBookings(updated);

  // Add in-app notification
  addNotification({
    title: 'Booking Request Submitted',
    message: `Your request "${data.eventName}" (${newId}) for ${venueObj.name} was saved in local demo data with status Pending.`,
    type: 'info',
    link: '/applicant/applications',
  });

  return newBooking;
}

function validateBookingDetails(data, venue) {
  if (!venue) throw new Error(`"${data.venue || ''}" is not a valid COEP venue. Please select a venue from the catalog.`);
  if (!String(data.eventName || '').trim()) throw new Error('Event name is required.');
  if (!String(data.purpose || '').trim()) throw new Error('Event purpose is required.');
  if (!isValidDateKey(data.date) || data.date <= localDateKey()) throw new Error('Choose a future booking date.');
  const start = timeToMinutes(data.startTime);
  const end = timeToMinutes(data.endTime);
  if (start === null || end === null || end <= start) throw new Error('Enter a valid time range with an end time after the start time.');
  const attendance = Number(data.attendance);
  if (!Number.isInteger(attendance) || attendance < 1) throw new Error('Expected attendance must be a positive whole number.');
  if (typeof venue.capacity === 'number' && attendance > venue.capacity) {
    throw new Error(`Expected attendance exceeds the configured capacity of ${venue.capacity} for ${venue.name}.`);
  }
  const email = data.email || data.applicant?.email;
  const phone = data.phone || data.applicant?.phone;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) throw new Error('Enter a valid college email address.');
  if (!String(phone || '').trim()) throw new Error('A contact number is required.');
}

/**
 * Update a booking status (Approver action or cancellation).
 * Re-checks local demo records before approval. This cannot prevent concurrent conflicts.
 */
export function updateBookingStatus(id, newStatus, reviewerNotes = '', decisionBy = 'Dr. Sharma') {
  if (!['Approved', 'Rejected'].includes(newStatus)) throw new Error('Only approve or reject decisions are supported.');
  const all = getAllBookings();
  const index = all.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Booking not found');

  const existing = all[index];
  if (existing.status !== 'Pending') throw new Error(`Only pending bookings can be reviewed. This booking is ${existing.status}.`);

  // Re-check conflict upon approval
  if (newStatus === 'Approved') {
    const conflict = checkTimeslotConflict(
      existing.venueId || existing.venue,
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
    reviewerNotes: String(reviewerNotes || '').trim(),
    decisionDate: localDateKey(),
    decisionBy,
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
      message: `Your local demo booking "${existing.eventName}" at ${existing.venue} was marked ${newStatus}.${
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
  if (existing.status !== 'Pending') throw new Error(`Only pending bookings can be cancelled. This booking is ${existing.status}.`);

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
    message: `You cancelled the local demo reservation for "${existing.eventName}" (${existing.id}) at ${existing.venue}.`,
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
  if (existing.status !== 'Rejected') throw new Error(`Only rejected bookings can be resubmitted. This booking is ${existing.status}.`);
  const fields = updatedFields && typeof updatedFields === 'object' ? updatedFields : {};

  // Validate venue in official list
  const venue = fields.venue || existing.venue;
  const venueObj = getVenueById(venue);
  if (!venueObj) {
    throw new Error(`"${venue}" is not a valid COEP venue.`);
  }

  const date = fields.date || existing.date;
  const startTime = fields.startTime || existing.startTime;
  const endTime = fields.endTime || existing.endTime;
  const candidate = { ...existing, ...fields, venue, date, startTime, endTime };
  validateBookingDetails(candidate, venueObj);

  const conflictCheck = checkTimeslotConflict(venueObj.id, date, startTime, endTime, id);
  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  const updated = {
    ...existing,
    ...fields,
    venueId: venueObj.id,
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
    message: `"${updated.eventName}" (${id}) for ${venueObj.name} was resubmitted in local demo data with status Pending.`,
    type: 'info',
    link: '/applicant/applications',
  });

  return updated;
}

/**
 * In-App Notification Utilities
 */
export function getNotifications() {
  let storage;
  let raw;
  try {
    storage = getStorage();
    if (!storage) return INITIAL_NOTIFICATIONS;
    raw = storage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isNotificationRecord)) {
      replaceInvalidStoredValue(storage, NOTIFICATIONS_STORAGE_KEY, raw, INITIAL_NOTIFICATIONS);
      return INITIAL_NOTIFICATIONS;
    }
    return parsed;
  } catch {
    if (storage && raw) replaceInvalidStoredValue(storage, NOTIFICATIONS_STORAGE_KEY, raw, INITIAL_NOTIFICATIONS);
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveNotifications(notifs) {
  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    throw new Error(`Browser storage is unavailable: ${error.message}`, { cause: error });
  }
  if (!storage) throw new Error('Notification storage is unavailable in this environment.');
  try {
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
  } catch (error) {
    throw new Error(`Could not save notification changes in this browser: ${error.message}`, { cause: error });
  }
  window.dispatchEvent(new CustomEvent('coep_notifications_changed', { detail: notifs }));
}

export function addNotification({ title, message, type = 'info', link = '/applicant/applications' }) {
  const current = getNotifications();
  const item = {
    id: createUniqueId('notif', new Set(current.map((notification) => notification.id))),
    title,
    message,
    date: new Date().toISOString(),
    read: false,
    type,
    link,
  };
  const updated = [item, ...current];
  try {
    saveNotifications(updated);
  } catch (error) {
    console.error('Booking data was saved, but its notification could not be stored.', error);
  }
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
