import { useEffect, useState } from 'react';
import {
  getAllBookings,
  getApplicantBookings,
  getNotifications,
} from '../services/bookingService';

/** Subscribe React views to the local development store's change events. */
export function useBookings(scope = 'all') {
  const read = scope === 'applicant' ? getApplicantBookings : getAllBookings;
  const eventName = 'coep_bookings_changed';
  const [bookings, setBookings] = useState(read);

  useEffect(() => {
    const refresh = () => setBookings(read());
    window.addEventListener(eventName, refresh);
    return () => window.removeEventListener(eventName, refresh);
  }, [read]);

  return bookings;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState(getNotifications);

  useEffect(() => {
    const refresh = () => setNotifications(getNotifications());
    window.addEventListener('coep_notifications_changed', refresh);
    return () => window.removeEventListener('coep_notifications_changed', refresh);
  }, []);

  return notifications;
}
