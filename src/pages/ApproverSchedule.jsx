import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  X,
} from 'lucide-react';
import { StatusBadge } from '../components';
import ApproverLayout from '../layouts/ApproverLayout';
import { SAMPLE_SCHEDULE_BOOKINGS } from './sampleData/approverSchedule.sample';
import styles from './ApproverSchedule.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUSES = ['Approved', 'Pending', 'Rejected', 'Completed'];

const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const formatDate = (value, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => {
  const date = parseDateKey(value);
  return date ? new Intl.DateTimeFormat('en-IN', options).format(date) : 'Date not provided';
};
const monthLabel = (date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
const timeValue = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) ? hours * 60 + (minutes || 0) : 0;
};

const ApproverSchedule = ({
  bookings: bookingsProp = SAMPLE_SCHEDULE_BOOKINGS,
  loading = false,
  error = null,
  onReviewRequests = () => {},
}) => {
  const bookings = useMemo(() => (Array.isArray(bookingsProp)
    ? bookingsProp.filter((booking) => booking && typeof booking === 'object')
    : []), [bookingsProp]);
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [venueFilter, setVenueFilter] = useState('All venues');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const bookingsByDate = useMemo(() => bookings.reduce((groups, booking) => {
    if (parseDateKey(booking.date)) groups[booking.date] = [...(groups[booking.date] || []), booking];
    return groups;
  }, {}), [bookings]);
  const venues = useMemo(() => [...new Set(bookings.map((booking) => booking.venue).filter(Boolean))].sort(), [bookings]);
  const selectedBookings = (bookingsByDate[selectedDate] || [])
    .filter((booking) => venueFilter === 'All venues' || booking.venue === venueFilter)
    .filter((booking) => statusFilter === 'All statuses' || booking.status === statusFilter)
    .sort((a, b) => timeValue(a.startTime) - timeValue(b.startTime));
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId);

  const todaysBookings = bookings.filter((booking) => booking.date === today);
  const occupiedVenues = new Set(todaysBookings
    .filter((booking) => ['Approved', 'Completed'].includes(booking.status))
    .map((booking) => booking.venue).filter(Boolean)).size;
  const pendingCount = bookings.filter((booking) => booking.status === 'Pending').length;

  const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) return null;
    const day = index - firstWeekday + 1;
    return toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
  });

  useEffect(() => {
    if (!selectedBooking) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedBookingId(null);
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [selectedBooking]);

  const changeMonth = (offset) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(toDateKey(nextMonth));
  };

  const selectToday = () => {
    const date = new Date();
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDate(toDateKey(date));
  };

  const openBooking = (booking, event) => {
    triggerRef.current = event.currentTarget;
    setSelectedBookingId(booking.id);
  };

  return (
    <ApproverLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>CAMPUS BOOKINGS</p>
            <h1 className={styles.title}>Schedule &amp; Calendar</h1>
            <p className={styles.subtitle}>View venue availability and reservations across your campus.</p>
          </div>
        </header>

        <section className={styles.summaryGrid} aria-label="Schedule summary">
          <article className={styles.summaryCard}><span>Today&apos;s bookings</span><strong>{todaysBookings.length}</strong><small>Reservations scheduled for today</small></article>
          <article className={styles.summaryCard}><span>Venues occupied today</span><strong>{occupiedVenues}</strong><small>Approved or completed reservations</small></article>
          <article className={styles.summaryCard}><span>Pending requests</span><strong>{pendingCount}</strong><small>Across the provided booking data</small></article>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.calendarCard} aria-label="Monthly booking calendar">
            <div className={styles.calendarHeader}>
              <div><h2>{monthLabel(visibleMonth)}</h2><p>Select a date to see its reservations.</p></div>
              <div className={styles.calendarControls}>
                <button type="button" className={styles.todayButton} onClick={selectToday}>Today</button>
                <button type="button" className={styles.iconButton} onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
                <button type="button" className={styles.iconButton} onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className={styles.calendarGrid}>
              {WEEKDAYS.map((day) => <span className={styles.weekday} key={day}>{day}</span>)}
              {calendarCells.map((date, index) => {
                if (!date) return <span className={styles.blankDay} key={`blank-${index}`} aria-hidden="true" />;
                const dateBookings = bookingsByDate[date] || [];
                const dateNumber = parseDateKey(date).getDate();
                const isToday = date === today;
                const isSelected = date === selectedDate;
                return (
                  <button
                    type="button"
                    key={date}
                    className={`${styles.dayCell} ${isSelected ? styles.daySelected : ''} ${isToday ? styles.dayToday : ''}`}
                    aria-label={`${formatDate(date)}${dateBookings.length ? `, ${dateBookings.length} bookings` : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDate(date)}
                  >
                    <span className={styles.dayNumber}>{dateNumber}</span>
                    <span className={styles.dayIndicators} aria-hidden="true">
                      {dateBookings.slice(0, 3).map((booking) => <i key={booking.id} className={styles[`indicator${booking.status}`] || styles.indicatorDefault} />)}
                      {dateBookings.length > 3 && <small>+{dateBookings.length - 3}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={styles.legend} aria-label="Booking status legend">
              {STATUSES.map((status) => <span key={status}><i className={styles[`indicator${status}`]} />{status}</span>)}
            </div>
          </section>

          <section className={styles.scheduleCard} aria-labelledby="day-schedule-title">
            <div className={styles.scheduleHeader}>
              <div><p className={styles.eyebrow}>DAY OVERVIEW</p><h2 id="day-schedule-title">{formatDate(selectedDate)}</h2></div>
              <CalendarDays size={20} aria-hidden="true" />
            </div>
            <div className={styles.filters}>
              <label>Venue<select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)}><option>All venues</option>{venues.map((venue) => <option key={venue}>{venue}</option>)}</select></label>
              <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            </div>
            {loading && <p className={styles.stateMessage} role="status">Loading bookings…</p>}
            {!loading && error && <p className={`${styles.stateMessage} ${styles.errorMessage}`} role="alert">{error}</p>}
            {!loading && !error && selectedBookings.length === 0 && (
              <p className={styles.stateMessage}>{bookings.length ? 'No bookings match this date and your selected filters.' : 'No bookings are available for this schedule.'}</p>
            )}
            {!loading && !error && selectedBookings.length > 0 && (
              <ul className={styles.bookingList}>
                {selectedBookings.map((booking) => (
                  <li key={booking.id}>
                    <button type="button" className={styles.bookingItem} onClick={(event) => openBooking(booking, event)}>
                      <span className={styles.bookingTime}><Clock3 size={14} />{booking.startTime || 'Time TBD'}<span>– {booking.endTime || 'TBD'}</span></span>
                      <span className={styles.bookingName}>{booking.eventName || 'Untitled event'}</span>
                      <span className={styles.bookingVenue}><MapPin size={13} />{booking.venue || 'Venue not provided'}</span>
                      <span className={styles.bookingBottom}><span>{booking.applicant || 'Applicant not provided'}</span><StatusBadge status={booking.status || 'Unknown'} size="sm" className={styles[`badge${booking.status}`] || ''} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {selectedBooking && (
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label="Close booking details" onClick={() => setSelectedBookingId(null)} />
          <aside ref={dialogRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="booking-detail-title">
            <div className={styles.drawerHeader}><div><p className={styles.eyebrow}>BOOKING DETAILS</p><h2 id="booking-detail-title">{selectedBooking.eventName || 'Untitled event'}</h2></div><button ref={closeButtonRef} type="button" className={styles.iconButton} onClick={() => setSelectedBookingId(null)} aria-label="Close details"><X size={19} /></button></div>
            <dl className={styles.detailList}>
              <div><dt>Applicant</dt><dd>{selectedBooking.applicant || 'Applicant not provided'}</dd></div>
              <div><dt>Venue</dt><dd>{selectedBooking.venue || 'Venue not provided'}</dd></div>
              <div><dt>Date</dt><dd>{formatDate(selectedBooking.date)}</dd></div>
              <div><dt>Time</dt><dd>{selectedBooking.startTime || 'TBD'} – {selectedBooking.endTime || 'TBD'}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={selectedBooking.status || 'Unknown'} size="sm" className={styles[`badge${selectedBooking.status}`] || ''} /></dd></div>
            </dl>
            {selectedBooking.status === 'Pending' && <button type="button" className={styles.reviewLink} onClick={onReviewRequests}>Go to Approvals</button>}
          </aside>
        </div>
      )}
    </ApproverLayout>
  );
};

ApproverSchedule.propTypes = {
  bookings: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    eventName: PropTypes.string,
    venue: PropTypes.string,
    applicant: PropTypes.string,
    date: PropTypes.string.isRequired,
    startTime: PropTypes.string,
    endTime: PropTypes.string,
    status: PropTypes.oneOf(STATUSES),
  })),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onReviewRequests: PropTypes.func,
};

export default ApproverSchedule;
