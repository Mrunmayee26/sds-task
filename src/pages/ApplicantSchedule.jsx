import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  CalendarPlus,
  X,
  Sparkles,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import { StatusBadge, GradientButton } from '../components';
import { getApplicantBookings } from '../services/bookingService';
import styles from './ApplicantSchedule.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export default function ApplicantSchedule() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayStr = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedVenueFilter, setSelectedVenueFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Approved');
  const [activeModalBooking, setActiveModalBooking] = useState(null);

  useEffect(() => {
    const load = () => {
      setBookings(getApplicantBookings());
    };
    load();

    const handler = () => load();
    window.addEventListener('coep_bookings_changed', handler);
    return () => window.removeEventListener('coep_bookings_changed', handler);
  }, []);

  // Venue list from applicant bookings
  const venues = useMemo(() => {
    return ['All', ...new Set(bookings.map((b) => b.venue).filter(Boolean))];
  }, [bookings]);

  // Bookings mapped by date key
  const bookingsByDate = useMemo(() => {
    return bookings.reduce((acc, b) => {
      if (b.date) {
        acc[b.date] = [...(acc[b.date] || []), b];
      }
      return acc;
    }, {});
  }, [bookings]);

  // Calendar cells computation
  const { monthLabel, calendarCells } = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const label = new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
    }).format(visibleMonth);

    const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
      if (index < firstWeekday) return null;
      const day = index - firstWeekday + 1;
      return toDateKey(new Date(year, month, day));
    });

    return { monthLabel: label, calendarCells: cells };
  }, [visibleMonth]);

  const handlePrevMonth = () => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Agenda items for the selected date (or all upcoming if no bookings on selected date)
  const agendaBookings = useMemo(() => {
    const onDate = bookingsByDate[selectedDate] || [];
    return onDate
      .filter((b) => selectedVenueFilter === 'All' || b.venue === selectedVenueFilter)
      .filter((b) => selectedStatusFilter === 'All' || b.status === selectedStatusFilter);
  }, [bookingsByDate, selectedDate, selectedVenueFilter, selectedStatusFilter]);

  // All upcoming approved bookings for overview
  const allUpcoming = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'Approved' && b.date >= todayStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [bookings, todayStr]);

  return (
    <ApplicantLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>My Activity Schedule</h1>
            <p className={styles.subtitle}>
              Personal calendar of your approved bookings, workshops, and lab sessions at COEP.
            </p>
          </div>

          <GradientButton
            size="md"
            variant="solid"
            onClick={() => navigate('/applicant/book')}
          >
            <CalendarPlus size={16} style={{ marginRight: 6 }} />
            Book a Facility
          </GradientButton>
        </header>

        <div className={styles.scheduleGrid}>
          {/* Calendar Card */}
          <section className={styles.calendarCard} aria-label="Monthly Calendar">
            <div className={styles.calendarNav}>
              <h2 className={styles.monthLabel}>{monthLabel}</h2>

              <div className={styles.navArrows}>
                <button
                  type="button"
                  className={styles.arrowBtn}
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className={styles.arrowBtn}
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className={styles.weekdaysRow}>
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className={styles.daysGrid}>
              {calendarCells.map((dateKey, index) => {
                if (!dateKey) {
                  return <div key={`empty-${index}`} className={styles.emptyCell} />;
                }

                const dayNum = parseInt(dateKey.slice(8), 10);
                const isToday = dateKey === todayStr;
                const isSelected = dateKey === selectedDate;
                const dayBookings = bookingsByDate[dateKey] || [];
                const hasApproved = dayBookings.some((b) => b.status === 'Approved');
                const hasPending = dayBookings.some((b) => b.status === 'Pending');

                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={`${styles.dayCell} ${isToday ? styles.todayCell : ''} ${
                      isSelected ? styles.selectedCell : ''
                    }`}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <span className={styles.dayNum}>{dayNum}</span>
                    {hasApproved && (
                      <span className={`${styles.bookingDot} ${styles.dot_approved}`} title="Approved booking" />
                    )}
                    {hasPending && !hasApproved && (
                      <span className={`${styles.bookingDot} ${styles.dot_pending}`} title="Pending booking" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right Panel: Day Agenda */}
          <section className={styles.agendaCard} aria-label="Daily Schedule Agenda">
            <div className={styles.agendaHeader}>
              <div>
                <h2 className={styles.agendaDateTitle}>
                  {selectedDate === todayStr ? `Today (${selectedDate})` : selectedDate}
                </h2>
              </div>

              <div className={styles.agendaFilterRow}>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className={styles.agendaSelect}
                >
                  <option value="Approved">Approved only</option>
                  <option value="All">All statuses</option>
                </select>

                <select
                  value={selectedVenueFilter}
                  onChange={(e) => setSelectedVenueFilter(e.target.value)}
                  className={styles.agendaSelect}
                >
                  {venues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {agendaBookings.length === 0 ? (
              <div className={styles.emptyAgenda}>
                <Sparkles size={28} color="#7047EB" />
                <p>No bookings scheduled for this date.</p>
                {allUpcoming.length > 0 && (
                  <div style={{ width: '100%', marginTop: 12 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B687E', display: 'block', marginBottom: 8 }}>
                      NEXT UPCOMING EVENT:
                    </span>
                    <div
                      className={styles.agendaItem}
                      onClick={() => setActiveModalBooking(allUpcoming[0])}
                    >
                      <div className={styles.agendaItemHeader}>
                        <span className={styles.agendaEventTitle}>{allUpcoming[0].eventName}</span>
                        <StatusBadge status={allUpcoming[0].status} size="sm" />
                      </div>
                      <div className={styles.agendaMetaRow}>
                        <span className={styles.metaTag}>
                          <MapPin size={13} /> {allUpcoming[0].venue}
                        </span>
                        <span className={styles.metaTag}>
                          <Clock size={13} /> {allUpcoming[0].date} ({allUpcoming[0].startTime} - {allUpcoming[0].endTime})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.agendaList}>
                {agendaBookings.map((b) => (
                  <div
                    key={b.id}
                    className={styles.agendaItem}
                    onClick={() => setActiveModalBooking(b)}
                  >
                    <div className={styles.agendaItemHeader}>
                      <span className={styles.agendaEventTitle}>{b.eventName}</span>
                      <StatusBadge status={b.status} size="sm" />
                    </div>

                    <div className={styles.agendaMetaRow}>
                      <span className={styles.metaTag}>
                        <MapPin size={13} />
                        {b.venue}
                      </span>
                      <span className={styles.metaTag}>
                        <Clock size={13} />
                        {b.startTime} - {b.endTime}
                      </span>
                      <span className={styles.metaTag}>
                        <Users size={13} />
                        {b.attendance} attendees
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Modal: Booking Details */}
        {activeModalBooking && (
          <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
          >
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 id="booking-modal-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {activeModalBooking.eventName}
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    ID: {activeModalBooking.id} • {activeModalBooking.eventType}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModalBooking(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '13.5px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    VENUE
                  </strong>
                  {activeModalBooking.venue}
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    SCHEDULE
                  </strong>
                  {activeModalBooking.date} ({activeModalBooking.startTime} - {activeModalBooking.endTime})
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    STATUS
                  </strong>
                  <StatusBadge status={activeModalBooking.status} size="sm" />
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    ATTENDANCE
                  </strong>
                  {activeModalBooking.attendance} Expected
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  PURPOSE
                </strong>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {activeModalBooking.purpose}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className={styles.arrowBtn}
                  style={{ width: 'auto', padding: '6px 14px', borderRadius: '9999px' }}
                  onClick={() => setActiveModalBooking(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ApplicantLayout>
  );
}
