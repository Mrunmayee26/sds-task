import { useCallback, useEffect, useState } from 'react';
import { getBookings, getVenues } from '../services/bookingService';

export function useBookingData(kind, scope = 'mine') {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const request =
      kind === 'venues'
        ? getVenues(controller.signal)
        : getBookings(scope, controller.signal);
    request
      .then((rows) => {
        if (!controller.signal.aborted) {
          setData(rows);
          setError('');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, scope, version]);

  useEffect(() => {
    window.addEventListener('venueflow_bookings_changed', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 30000);
    return () => {
      window.removeEventListener('venueflow_bookings_changed', refresh);
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [refresh]);
  return { data, loading, error, refresh };
}
