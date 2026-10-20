import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  Building2,
  ClipboardList,
  CheckCircle2,
  Clock3,
  XCircle,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import { StatusBadge, GradientButton } from '../components';
import {
  CURRENT_APPLICANT,
  getApplicantBookings,
} from '../services/bookingService';
import styles from './ApplicantDashboard.module.css';

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatShortDate = (isoDate) => {
  if (!isoDate) return { month: 'NOV', day: '01' };
  const d = new Date(`${isoDate}T00:00:00`);
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  };
};

export default function ApplicantDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const load = () => {
      setBookings(getApplicantBookings());
    };
    load();

    const handler = () => load();
    window.addEventListener('coep_bookings_changed', handler);
    return () => window.removeEventListener('coep_bookings_changed', handler);
  }, []);

  // Summary counts
  const stats = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === 'Pending').length;
    const approved = bookings.filter((b) => b.status === 'Approved').length;
    const rejected = bookings.filter((b) => b.status === 'Rejected').length;
    return { total, pending, approved, rejected };
  }, [bookings]);

  // Upcoming approved or pending events
  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'Approved' || b.status === 'Pending')
      .slice(0, 4);
  }, [bookings]);

  // Check for rejected booking with reviewer remarks that needs attention
  const rejectedWithRemarks = useMemo(() => {
    return bookings.find(
      (b) => b.status === 'Rejected' && (b.reviewerNotes || b.previousReviewerNotes)
    );
  }, [bookings]);

  return (
    <ApplicantLayout>
      <div className={styles.dashboard}>
        {/* Hero Welcome Banner */}
        <section className={styles.heroBanner}>
          <div className={styles.heroContent}>
            <h1 className={styles.greetingTitle}>
              {getTimeGreeting()}, {CURRENT_APPLICANT.name.split(' ')[0]}! 👋
            </h1>
            <p className={styles.greetingSubtitle}>
              Welcome to the COEP Classroom &amp; Venue Booking Portal. Reserve academic halls,
              labs, and conference centers for your club activities and workshops.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.outlineActionBtn}
              onClick={() => navigate('/applicant/venues')}
            >
              <Building2 size={16} />
              Browse Venues
            </button>

            <GradientButton
              size="md"
              variant="solid"
              onClick={() => navigate('/applicant/book')}
            >
              <CalendarPlus size={16} style={{ marginRight: 6 }} />
              Book a Venue
            </GradientButton>
          </div>
        </section>

        {/* Needs Attention / Notification Banner (if any rejected item has notes) */}
        {rejectedWithRemarks && (
          <section className={styles.attentionSection} role="alert">
            <div className={styles.attentionLeft}>
              <div className={styles.attentionIconWrap}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className={styles.attentionTitle}>Action Required: Reviewer Feedback</h2>
                <p className={styles.attentionDesc}>
                  Your request for &ldquo;{rejectedWithRemarks.eventName}&rdquo; ({rejectedWithRemarks.id})
                  was rejected: &ldquo;{rejectedWithRemarks.reviewerNotes || rejectedWithRemarks.previousReviewerNotes}&rdquo;
                </p>
              </div>
            </div>

            <button
              type="button"
              className={styles.attentionActionBtn}
              onClick={() => navigate('/applicant/applications')}
            >
              Review &amp; Resubmit
              <ArrowRight size={14} />
            </button>
          </section>
        )}

        {/* Summary Statistics Cards */}
        <section className={styles.statsGrid} aria-label="Booking statistics summary">
          <div className={`${styles.statCard} ${styles.stat_blue}`}>
            <div className={styles.statIconWrap}>
              <ClipboardList size={22} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Total Applications</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.stat_amber}`}>
            <div className={styles.statIconWrap}>
              <Clock3 size={22} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{stats.pending}</span>
              <span className={styles.statLabel}>Pending Review</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.stat_green}`}>
            <div className={styles.statIconWrap}>
              <CheckCircle2 size={22} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{stats.approved}</span>
              <span className={styles.statLabel}>Approved Bookings</span>
            </div>
          </div>

          <div className={`${styles.statCard} ${styles.stat_rose}`}>
            <div className={styles.statIconWrap}>
              <XCircle size={22} />
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{stats.rejected}</span>
              <span className={styles.statLabel}>Rejected / Revisions</span>
            </div>
          </div>
        </section>

        {/* Lower Two-Column Grid: Upcoming Bookings & Recent Activity */}
        <div className={styles.lowerGrid}>
          {/* Left: Upcoming Bookings */}
          <section className={styles.panelCard} aria-label="Upcoming bookings">
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <CalendarDays size={18} className={styles.panelTitleIcon} />
                <h2 className={styles.panelTitle}>Upcoming Bookings</h2>
              </div>
              <button
                type="button"
                className={styles.seeAllLink}
                onClick={() => navigate('/applicant/applications')}
              >
                View all applications
                <ArrowRight size={14} />
              </button>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className={styles.emptyState}>
                <Sparkles size={28} />
                <p>No upcoming bookings scheduled.</p>
                <button
                  type="button"
                  className={styles.outlineActionBtn}
                  onClick={() => navigate('/applicant/book')}
                  style={{ marginTop: 8 }}
                >
                  Create a booking request
                </button>
              </div>
            ) : (
              <div className={styles.bookingItemsList}>
                {upcomingBookings.map((b) => {
                  const { month, day } = formatShortDate(b.date);
                  return (
                    <div key={b.id} className={styles.bookingRow}>
                      <div className={styles.bookingLeft}>
                        <div className={styles.dateBadge}>
                          <span className={styles.dateMonth}>{month}</span>
                          <span className={styles.dateDay}>{day}</span>
                        </div>

                        <div className={styles.bookingInfo}>
                          <span className={styles.bookingTitle}>{b.eventName}</span>
                          <div className={styles.bookingMeta}>
                            <span className={styles.metaItem}>
                              <MapPin size={13} />
                              {b.venue}
                            </span>
                            <span className={styles.metaItem}>
                              <Clock size={13} />
                              {b.startTime} - {b.endTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.bookingRight}>
                        <StatusBadge status={b.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Recent Activity Feed */}
          <section className={styles.panelCard} aria-label="Recent booking activity">
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <Clock3 size={18} className={styles.panelTitleIcon} />
                <h2 className={styles.panelTitle}>Recent Activity</h2>
              </div>
              <button
                type="button"
                className={styles.seeAllLink}
                onClick={() => navigate('/applicant/schedule')}
              >
                My schedule
                <ArrowRight size={14} />
              </button>
            </div>

            <div className={styles.activityTimeline}>
              {bookings.slice(0, 4).map((item) => {
                const dotClass =
                  item.status === 'Approved'
                    ? styles.dot_approved
                    : item.status === 'Rejected'
                    ? styles.dot_rejected
                    : styles.dot_pending;

                return (
                  <div key={item.id} className={styles.activityItem}>
                    <span className={`${styles.activityDot} ${dotClass}`} />
                    <div className={styles.activityBody}>
                      <span className={styles.activityTitle}>
                        {item.eventName} ({item.id})
                      </span>
                      <span className={styles.activityMeta}>
                        {item.status} for {item.venue} • {item.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </ApplicantLayout>
  );
}
