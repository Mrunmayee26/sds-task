import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import PortalLayout from '../layouts/PortalLayout';
import { DataState, PageHeading, Status } from '../components/BookingUI';
import {
  ApprovalStepper,
  ConflictBanner,
  GuardrailNotice,
  ReassignPanel,
  RevokePanel,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import {
  cancelBooking,
  decideBooking,
  getBooking,
  getVenues,
  reassignBooking,
  revokeBooking,
} from '../services/bookingService';
import { campusTimestamp, dateLabel, timeLabel } from '../services/format';

export default function BookingDetails() {
  const { bookingId } = useParams();
  const { user, session } = useAuth();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(Date.now);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [venueList, setVenueList] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    getBooking(bookingId, controller.signal)
      .then((saved) => {
        if (!controller.signal.aborted) {
          setBooking(saved);
          setError('');
          setNow(Date.now());
          if (saved.status !== 'submitted') setMessage('');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [bookingId, version]);

  useEffect(() => {
    getVenues()
      .then((data) => setVenueList(data.filter((v) => v.is_active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  async function act(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      const saved =
        action === 'cancelled'
          ? await cancelBooking(bookingId)
          : await decideBooking(bookingId, action, remarks);
      setBooking(saved);
      setRemarks('');
      setMessage(
        action === 'cancelled'
          ? 'Your booking has been cancelled.'
          : saved.status === 'submitted'
            ? 'Your decision was recorded. Further approvals are required.'
            : `Booking ${saved.status}.`,
      );
    } catch (failure) {
      setActionError(failure.message);
      refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleRevoke(reason) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError('');
    try {
      const saved = await revokeBooking(bookingId, reason);
      setBooking(saved);
      setMessage(
        'Booking has been revoked. The applicant must dynamically reassign a new venue or timing.',
      );
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleReassign(form) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError('');
    try {
      const saved = await reassignBooking(bookingId, {
        venue_id: Number(form.venue_id),
        start_time: campusTimestamp(form.date, form.start_time),
        end_time: campusTimestamp(form.date, form.end_time),
        remarks: form.remarks.trim(),
      });
      setBooking(saved);
      setMessage(
        'Booking reassigned successfully! The multi-level approval pipeline has restarted.',
      );
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const isOwner = booking?.applicant_user_id === user.user_id;
  const pending =
    booking?.approvals?.filter((a) => a.status === 'pending') || [];
  const firstStep = pending.length
    ? Math.min(...pending.map((a) => a.approval_step))
    : null;
  const myGroups =
    user.approval_groups
      ?.filter((g) => g.can_approve)
      ?.map((g) => g.access_id) || [];

  const myTurn =
    !isOwner &&
    booking?.status === 'submitted' &&
    pending.some(
      (a) =>
        a.approval_step === firstStep &&
        myGroups.includes(a.access_id) &&
        (a.access_id !== 18 ||
          !booking.faculty_advisor_id ||
          booking.faculty_advisor_id === user.user_id) &&
        !booking.events?.some(
          (e) =>
            e.approval_id === a.approval_id && e.actor_user_id === user.user_id,
        ),
    );

  const activeSlots =
    booking?.slots?.filter((s) => s.slot_status !== 'cancelled') || [];
  const earliestSlotTime = activeSlots.length
    ? Math.min(...activeSlots.map((s) => new Date(s.start_time).getTime()))
    : booking?.slots?.length
      ? Math.min(...booking.slots.map((s) => new Date(s.start_time).getTime()))
      : null;

  const within24h =
    earliestSlotTime !== null && earliestSlotTime - now <= 24 * 60 * 60 * 1000;
  const future = earliestSlotTime !== null && earliestSlotTime > now;

  const canApproverRevoke =
    session.role === 'approver' &&
    booking?.status === 'approved' &&
    booking?.approvals?.some((a) => myGroups.includes(a.access_id));

  return (
    <PortalLayout>
      <PageHeading title="Reservation details">
        {booking
          ? `${booking.purpose} · ${booking.venue_name}`
          : 'Loading reservation'}
      </PageHeading>
      <DataState loading={!booking && !error} error={error} />
      {booking && (
        <>
          {message && (
            <p className="notice success" role="status">
              {message}
            </p>
          )}

          {/* 1-Day Guardrail Banner */}
          <GuardrailNotice
            status={booking.status}
            within24h={within24h}
            future={future}
          />

          {/* Conflict Banner when booking needs reassignment */}
          <ConflictBanner status={booking.status} isOwner={isOwner} />

          <section className="panel detail-panel">
            <div className="section-heading">
              <h2>{booking.purpose}</h2>
              <Status value={booking.status} />
            </div>
            <p className="description">{booking.description}</p>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">VENUE</span>
                <span className="stat-value">{booking.venue_name}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">TYPE</span>
                <span className="stat-value">{booking.application_type}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">ATTENDANCE</span>
                <span className="stat-value">
                  {booking.expected_attendance}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">APPLICANT</span>
                <span className="stat-value">{booking.applicant_name}</span>
              </div>
            </div>
          </section>

          <section className="panel detail-panel">
            <h2>Requested schedule</h2>
            {booking.slots.map((slot) => (
              <p
                key={slot.slot_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration:
                    slot.slot_status === 'cancelled'
                      ? 'line-through'
                      : 'none',
                  color:
                    slot.slot_status === 'cancelled' ? '#999' : 'inherit',
                }}
              >
                <Calendar size={16} />
                <span>
                  {dateLabel(slot.start_time)}, {timeLabel(slot.start_time)} –{' '}
                  {timeLabel(slot.end_time)}
                </span>
                {slot.slot_status === 'cancelled' && (
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    Cancelled
                  </span>
                )}
              </p>
            ))}
          </section>

          {/* Multi-Level Approval Stepper */}
          <ApprovalStepper
            approvals={booking.approvals}
            facultyAdvisorName={booking.faculty_advisor_name}
          />

          {/* Decision and Event History */}
          {booking.events?.length > 0 && (
            <section className="panel detail-panel">
              <h2>Decision History & Audit Trail</h2>
              <ul className="group-list">
                {booking.events.map((event) => (
                  <li key={event.event_id}>
                    <strong>
                      {event.decision
                        ? 'Approval recorded'
                        : 'Revocation / Rejection recorded'}{' '}
                      · {dateLabel(event.created_at)}{' '}
                      {timeLabel(event.created_at)}
                    </strong>
                    <span>{event.remarks || 'No remarks provided.'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {actionError && (
            <p className="notice error" role="alert">
              {actionError}
            </p>
          )}

          {/* Dynamic Reassignment Form for Applicants */}
          {isOwner && booking.status === 'needs_reassignment' && (
            <ReassignPanel
              booking={booking}
              venueList={venueList}
              busy={busy}
              onReassign={handleReassign}
            />
          )}

          {/* Applicant & Admin Cancellation (Guardrail protected) */}
          {(isOwner || session.role === 'admin') &&
            ['submitted', 'approved', 'needs_reassignment'].includes(
              booking.status,
            ) &&
            future && (
              <section className="panel detail-panel">
                <h2>Change of plans?</h2>
                {within24h && session.role !== 'admin' ? (
                  <p className="muted" style={{ color: '#b45309' }}>
                    <strong>Cancellation Locked:</strong> Events scheduled
                    within 24 hours cannot be cancelled under the 1-Day Guardrail
                    policy.
                  </p>
                ) : (
                  <>
                    <p className="muted">
                      Cancelling releases the venue for other applicants. This
                      cannot be undone.
                    </p>
                    <button
                      className="button danger"
                      disabled={
                        busy ||
                        (session.role !== 'admin' &&
                          booking.can_cancel === false)
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this booking and release its time slot?',
                          )
                        ) {
                          act('cancelled');
                        }
                      }}
                    >
                      {busy ? 'Saving…' : 'Cancel booking'}
                    </button>
                  </>
                )}
              </section>
            )}

          {/* Approver Revocation Section (Guardrail protected) */}
          {canApproverRevoke && (
            <RevokePanel
              within24h={within24h}
              busy={busy}
              onRevoke={handleRevoke}
            />
          )}

          {/* Approver Review (Submitted status) */}
          {session.role === 'approver' && booking.status === 'submitted' && (
            <section className="panel detail-panel">
              <h2>Review this request</h2>
              {myTurn && future ? (
                <>
                  <label>
                    Reviewer remarks
                    <textarea
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Add a note for the applicant"
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => act('rejected')}
                    >
                      Reject request
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => act('approved')}
                    >
                      {busy ? 'Saving…' : 'Approve request'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">
                  {isOwner
                    ? 'You cannot review your own request.'
                    : !future
                      ? 'This booking has already started and cannot be reviewed.'
                      : 'Waiting for another reviewer or an earlier approval stage.'}
                </p>
              )}
            </section>
          )}

          {isOwner && booking.status === 'rejected' && (
            <Link
              className="button primary"
              to={`/applicant/book?venue=${booking.venue_id}`}
            >
              Create a new request
            </Link>
          )}
        </>
      )}
    </PortalLayout>
  );
}
