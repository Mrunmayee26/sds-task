import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PortalLayout from '../layouts/PortalLayout';
import { DataState, PageHeading, Status } from '../components/BookingUI';
import { useAuth } from '../hooks/useAuth';
import {
  cancelBooking,
  decideBooking,
  getBooking,
} from '../services/bookingService';
import { dateLabel, timeLabel } from '../services/format';

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
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

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

  const isOwner = booking?.applicant_user_id === user.user_id;
  const pending =
    booking?.approvals.filter((approval) => approval.status === 'pending') ||
    [];
  const firstStep = pending.length
    ? Math.min(...pending.map((approval) => approval.approval_step))
    : null;
  const myGroups = user.approval_groups
    .filter((group) => group.can_approve)
    .map((group) => group.access_id);
  const myTurn =
    !isOwner &&
    booking?.status === 'submitted' &&
    pending.some(
      (approval) =>
        approval.approval_step === firstStep &&
        myGroups.includes(approval.access_id) &&
        !booking.events.some(
          (event) =>
            event.approval_id === approval.approval_id &&
            event.actor_user_id === user.user_id,
        ),
    );
  const future =
    booking?.slots.length &&
    booking.slots.every((slot) => new Date(slot.start_time).getTime() > now);

  return (
    <PortalLayout>
      <PageHeading
        title={booking?.purpose || 'Booking details.'}
        action={
          <Link
            className="button secondary"
            to={`/${session.role}/${session.role === 'approver' ? 'approvals' : 'applications'}`}
          >
            Back to requests
          </Link>
        }
      >
        Request #{bookingId}
      </PageHeading>
      <DataState loading={!booking && !error} error={error} refresh={refresh} />
      {booking && !error && (
        <>
          {message && (
            <p className="notice success" role="status">
              {message}
            </p>
          )}
          <section className="panel detail-panel">
            <div className="section-heading">
              <h2>{booking.venue_name}</h2>
              <Status value={booking.status} />
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Applicant</dt>
                <dd>{booking.applicant_name}</dd>
              </div>
              <div>
                <dt>Event type</dt>
                <dd>{booking.application_type}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{dateLabel(booking.submitted_at)}</dd>
              </div>
              <div>
                <dt>Time zone</dt>
                <dd>India Standard Time (IST)</dd>
              </div>
            </dl>
            <h3>Description</h3>
            <p className="description-text">
              {booking.description || 'No additional description.'}
            </p>
            <h3>Reserved time</h3>
            {booking.slots.map((slot) => (
              <p key={slot.slot_id}>
                {dateLabel(slot.start_time)} · {timeLabel(slot.start_time)} –{' '}
                {timeLabel(slot.end_time)}
              </p>
            ))}
          </section>
          <section className="panel detail-panel">
            <h2>Approval progress</h2>
            <ol className="approval-steps">
              {booking.approvals.map((approval) => (
                <li key={approval.approval_id}>
                  <div>
                    <strong>{approval.group_name}</strong>
                    <small>
                      Stage {approval.approval_step} · {approval.approval_count}{' '}
                      of {approval.required_approvals} approvals
                    </small>
                    {approval.remarks && <p>{approval.remarks}</p>}
                  </div>
                  <Status value={approval.status} />
                </li>
              ))}
            </ol>
          </section>
          {booking.events.length > 0 && (
            <section className="panel detail-panel">
              <h2>Decision history</h2>
              <ul className="group-list">
                {booking.events.map((event) => (
                  <li key={event.event_id}>
                    <strong>
                      {event.decision
                        ? 'Approval recorded'
                        : 'Rejection recorded'}{' '}
                      · {dateLabel(event.created_at)}{' '}
                      {timeLabel(event.created_at)}
                    </strong>
                    <span>{event.remarks || 'No remarks.'}</span>
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
          {isOwner &&
            ['submitted', 'approved'].includes(booking.status) &&
            future && (
              <section className="panel detail-panel">
                <h2>Change of plans?</h2>
                <p className="muted">
                  Cancelling releases the venue for other applicants. This
                  cannot be undone.
                </p>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Cancel this booking and release its time slot?',
                      )
                    )
                      act('cancelled');
                  }}
                >
                  {busy ? 'Saving…' : 'Cancel booking'}
                </button>
              </section>
            )}
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
