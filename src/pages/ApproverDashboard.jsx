import PropTypes from 'prop-types';
import {
  ClipboardCheck,
  CheckCircle2,
  DoorOpen,
  CalendarDays,
  ArrowRight,
  Clock,
  ListChecks,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { StatusBadge } from '../components';
import ApproverLayout from '../layouts/ApproverLayout';
import {
  SAMPLE_APPROVER_USER,
  SAMPLE_STATS,
  SAMPLE_SCHEDULE,
  SAMPLE_ACTIVITY,
} from './sampleData/approverDashboard.sample';
import styles from './ApproverDashboard.module.css';

// ─── Frontend-only icon and colour mapping ────────────────────────────────────
//
// Icons and colour keys are a UI concern. They are NOT part of the API contract.
// When the backend sends { id: 'pending', value: 3 }, this map enriches it here.

const STAT_UI_MAP = {
  pending:  { icon: <ClipboardCheck size={22} />, colorKey: 'amber'  },
  approved: { icon: <CheckCircle2   size={22} />, colorKey: 'green'  },
  'in-use': { icon: <DoorOpen       size={22} />, colorKey: 'purple' },
  total:    { icon: <CalendarDays   size={22} />, colorKey: 'blue'   },
};

// Cycles through distinguishable bar colours by list-index when no explicit
// colour is assigned. Never asks the backend for a colour.
const SCHEDULE_COLOUR_CYCLE = ['purple', 'blue', 'teal', 'amber'];

// ─── Time-of-day greeting helper ─────────────────────────────────────────────

/**
 * Returns "Good morning", "Good afternoon", or "Good evening"
 * based on the current local hour.
 * @returns {string}
 */
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────

/** Shown while an async section is loading. */
const SectionLoader = () => (
  <div className={styles.stateBox} role="status" aria-live="polite">
    <Loader2 size={20} className={styles.spinIcon} aria-hidden="true" />
    <span>Loading…</span>
  </div>
);

/** Shown when a section loaded successfully but returned no items. */
const EmptyState = ({ message }) => (
  <div className={styles.stateBox}>
    <Inbox size={20} aria-hidden="true" />
    <span>{message}</span>
  </div>
);
EmptyState.propTypes = { message: PropTypes.string.isRequired };

/** Shown when a section fails to load. */
const ErrorState = ({ message }) => (
  <div className={`${styles.stateBox} ${styles.stateBoxError}`}>
    <AlertCircle size={20} aria-hidden="true" />
    <span>{message}</span>
  </div>
);
ErrorState.propTypes = { message: PropTypes.string.isRequired };

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ApproverDashboard
 *
 * Renders the main Approver portal landing page inside ApproverLayout.
 * All data is received via props so the component is display-only and fully
 * testable without a network. Sample data is passed as defaults so the UI
 * previews immediately.
 *
 * ── How to wire to the real backend ─────────────────────────────────────────
 *
 *  1. Create a data-fetching wrapper (e.g. ApproverDashboardPage) that calls
 *     the API endpoints listed in approverDashboard.sample.js.
 *  2. Pass the responses as props: approver, stats, schedule, activity.
 *  3. Pass the corresponding loading/error booleans.
 *  4. Remove the default prop values once the real data layer is in place.
 *
 * ── Navigation integration points ───────────────────────────────────────────
 *
 *  - onReviewRequests  → navigate('/approver/approvals')
 *  - onViewCalendar    → navigate('/approver/schedule')
 *  - onViewAllActivity → navigate('/approver/approvals')
 *
 * @param {object}  props
 * @param {object}  props.approver            - Authenticated approver user object.
 * @param {Array}   props.stats               - Dashboard stat values from the API.
 * @param {boolean} props.statsLoading        - True while stats are being fetched.
 * @param {string|null} props.statsError      - Error message if stats fetch failed.
 * @param {Array}   props.schedule            - Today's bookings from the API.
 * @param {boolean} props.scheduleLoading     - True while schedule is being fetched.
 * @param {string|null} props.scheduleError   - Error message if schedule fetch failed.
 * @param {Array}   props.activity            - Recent booking activity from the API.
 * @param {boolean} props.activityLoading     - True while activity is being fetched.
 * @param {string|null} props.activityError   - Error message if activity fetch failed.
 * @param {Function} props.onReviewRequests   - Called when the "Review requests" button is clicked.
 * @param {Function} props.onViewCalendar     - Called when the "View calendar" button is clicked.
 * @param {Function} props.onViewAllActivity  - Called when the "View all activity" button is clicked.
 */
const ApproverDashboard = ({
  approver         = SAMPLE_APPROVER_USER,
  stats            = SAMPLE_STATS,
  statsLoading     = false,
  statsError       = null,
  schedule         = SAMPLE_SCHEDULE,
  scheduleLoading  = false,
  scheduleError    = null,
  activity         = SAMPLE_ACTIVITY,
  activityLoading  = false,
  activityError    = null,
  onReviewRequests  = () => { /* TODO: navigate('/approver/approvals') */ },
  onViewCalendar    = () => { /* TODO: navigate('/approver/schedule')  */ },
  onViewAllActivity = () => { /* TODO: navigate('/approver/approvals') */ },
}) => {
  const greeting = `${getTimeGreeting()}, ${approver.name}`;

  return (
    <ApproverLayout>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className={styles.pageHeader}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>{greeting}</h1>
          <p className={styles.greetingSubtitle}>
            Review requests and monitor today&apos;s campus schedule.
          </p>
        </div>

        <button
          type="button"
          className={styles.reviewBtn}
          aria-label="Review pending booking requests"
          onClick={onReviewRequests}
        >
          <ListChecks size={17} />
          Review requests
        </button>
      </header>

      {/* ── Statistics ───────────────────────────────────────────────────── */}
      <section aria-label="Summary statistics" className={styles.statsGrid}>
        {statsLoading && (
          // Render placeholder skeleton cards so the grid holds its shape
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.statCard} ${styles.statCardSkeleton}`} aria-hidden="true" />
          ))
        )}

        {statsError && !statsLoading && (
          <div className={styles.statsErrorBanner}>
            <AlertCircle size={16} aria-hidden="true" />
            {statsError}
          </div>
        )}

        {!statsLoading && !statsError && stats.map((stat) => {
          const ui = STAT_UI_MAP[stat.id] ?? { icon: <CalendarDays size={22} />, colorKey: 'blue' };
          return (
            <div
              key={stat.id}
              className={`${styles.statCard} ${styles[`stat_${ui.colorKey}`]}`}
            >
              <div className={styles.statIconWrap}>{ui.icon}</div>
              <div className={styles.statBody}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Lower two-column section ─────────────────────────────────────── */}
      <div className={styles.lowerGrid}>

        {/* Today's schedule ─────────────────────────────────────────────── */}
        <section className={styles.card} aria-label="Today's schedule">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <Clock size={17} className={styles.cardTitleIcon} />
              <h2 className={styles.cardTitle}>Today&apos;s Schedule</h2>
            </div>
            <button
              type="button"
              className={styles.linkBtn}
              aria-label="View full calendar"
              onClick={onViewCalendar}
            >
              View calendar
              <ArrowRight size={14} />
            </button>
          </div>

          {scheduleLoading && <SectionLoader />}
          {scheduleError && !scheduleLoading && <ErrorState message={scheduleError} />}
          {!scheduleLoading && !scheduleError && schedule.length === 0 && (
            <EmptyState message="No bookings scheduled for today." />
          )}
          {!scheduleLoading && !scheduleError && schedule.length > 0 && (
            <ul className={styles.scheduleList} role="list">
              {schedule.map((item, index) => {
                // colorKey may come from the data file or fall back to a cycle
                const colorKey = item.colorKey ?? SCHEDULE_COLOUR_CYCLE[index % SCHEDULE_COLOUR_CYCLE.length];
                return (
                  <li key={item.id} className={styles.scheduleRow}>
                    <span className={styles.scheduleTime}>{item.time}</span>
                    <span
                      className={`${styles.scheduleBar} ${styles[`bar_${colorKey}`]}`}
                      aria-hidden="true"
                    />
                    <div className={styles.scheduleInfo}>
                      <span className={styles.scheduleEvent}>{item.event}</span>
                      <span className={styles.scheduleVenue}>{item.venue}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent activity ──────────────────────────────────────────────── */}
        <section className={styles.card} aria-label="Recent booking activity">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <ClipboardCheck size={17} className={styles.cardTitleIcon} />
              <h2 className={styles.cardTitle}>Needs Attention</h2>
            </div>
            <button
              type="button"
              className={styles.linkBtn}
              aria-label="View all booking activity"
              onClick={onViewAllActivity}
            >
              View all activity
              <ArrowRight size={14} />
            </button>
          </div>

          {activityLoading && <SectionLoader />}
          {activityError && !activityLoading && <ErrorState message={activityError} />}
          {!activityLoading && !activityError && activity.length === 0 && (
            <EmptyState message="No pending activity to review." />
          )}
          {!activityLoading && !activityError && activity.length > 0 && (
            <ul className={styles.activityList} role="list">
              {activity.map((item) => (
                <li key={item.id} className={styles.activityRow}>
                  <div className={styles.activityInfo}>
                    <span className={styles.activityEvent}>{item.event}</span>
                    {/* venue and date are separate fields — formatted here, not in the data */}
                    <span className={styles.activityMeta}>
                      {item.venue} &middot; {item.date}
                    </span>
                  </div>
                  <StatusBadge status={item.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </ApproverLayout>
  );
};

// ─── Prop types ───────────────────────────────────────────────────────────────

ApproverDashboard.propTypes = {
  approver: PropTypes.shape({
    id:         PropTypes.string.isRequired,
    name:       PropTypes.string.isRequired,
    role:       PropTypes.string.isRequired,
    department: PropTypes.string,
  }).isRequired,

  stats: PropTypes.arrayOf(
    PropTypes.shape({
      id:    PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  ),
  statsLoading: PropTypes.bool,
  statsError:   PropTypes.string,

  schedule: PropTypes.arrayOf(
    PropTypes.shape({
      id:       PropTypes.string.isRequired,
      time:     PropTypes.string.isRequired,
      venue:    PropTypes.string.isRequired,
      event:    PropTypes.string.isRequired,
      colorKey: PropTypes.string, // optional; frontend assigns via SCHEDULE_COLOUR_CYCLE
    })
  ),
  scheduleLoading: PropTypes.bool,
  scheduleError:   PropTypes.string,

  activity: PropTypes.arrayOf(
    PropTypes.shape({
      id:     PropTypes.string.isRequired,
      event:  PropTypes.string.isRequired,
      venue:  PropTypes.string.isRequired,
      date:   PropTypes.string.isRequired,
      status: PropTypes.oneOf(['Approved', 'Pending', 'Rejected']).isRequired,
    })
  ),
  activityLoading: PropTypes.bool,
  activityError:   PropTypes.string,

  onReviewRequests:  PropTypes.func,
  onViewCalendar:    PropTypes.func,
  onViewAllActivity: PropTypes.func,
};


export default ApproverDashboard;

