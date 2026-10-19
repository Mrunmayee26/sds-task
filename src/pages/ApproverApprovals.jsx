import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { GradientButton } from '../components';
import ApproverLayout from '../layouts/ApproverLayout';
import { SAMPLE_APPROVAL_REQUESTS } from './sampleData/approverApprovals.sample';
import styles from './ApproverApprovals.module.css';

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const STATUSES = ['All statuses', 'Pending', 'Approved', 'Rejected'];
const SUMMARY_STATS = [
  { id: 'pending', label: 'Needs review' },
  { id: 'approved', label: 'Approved today' },
  { id: 'rejected', label: 'Rejected today' },
];

const formatDate = (value) => {
  if (!value) return 'Date not provided';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
};

const RequestStatus = ({ status }) => (
  <span className={`${styles.status} ${styles[`status${status}`] || ''}`}>
    <span className={styles.statusDot} aria-hidden="true" />{status}
  </span>
);

RequestStatus.propTypes = { status: PropTypes.string.isRequired };

const ApproverApprovals = ({
  requests,
  stats,
  loading = false,
  error = null,
  onApprove,
  onDecline,
}) => {
  const requestData = useMemo(() => (
    requests === undefined && !loading && !error
      ? SAMPLE_APPROVAL_REQUESTS
      : requests || []
  ), [requests, loading, error]);
  // Local state is only for this UI demo. A parent can own requests and update
  // them from API responses once the real data layer is added. New request
  // props replace this snapshot; explicit empty arrays remain empty.
  const [localStatusUpdates, setLocalStatusUpdates] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [sort, setSort] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const processingIdRef = useRef(null);
  const [actionError, setActionError] = useState('');
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const detailTriggerRef = useRef(null);

  // Incoming records remain the source of truth. A confirmed local action only
  // overlays its status while the incoming record still has its original one.
  const localRequests = useMemo(() => requestData.map((request) => {
    const update = localStatusUpdates[request.id];
    if (!update || request.status !== update.baseStatus) return request;
    return { ...request, status: update.status, decisionDate: update.decisionDate };
  }), [requestData, localStatusUpdates]);

  const selectedRequest = localRequests.find((request) => request.id === selectedId);
  const hasSelectedRequest = selectedRequest !== undefined;
  const availability = selectedRequest?.availability;
  const availabilityChecked = availability?.checked === false
    ? false
    : availability?.checked === true || typeof availability?.conflict === 'boolean';
  const availabilityConflict = availabilityChecked && availability?.conflict === true;
  const availabilityMessage = !availabilityChecked
    ? 'Availability not checked'
    : availabilityConflict
      ? 'Availability conflict found'
      : 'Availability check passed';

  useEffect(() => {
    if (!selectedId || !hasSelectedRequest) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedId(null);
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled)'
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
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
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      detailTriggerRef.current?.focus();
    };
  }, [selectedId, hasSelectedRequest]);

  const today = getLocalDate();
  const derivedCounts = useMemo(() => ({
    pending: localRequests.filter((request) => request.status === 'Pending').length,
    approved: localRequests.filter((request) => request.status === 'Approved' && request.decisionDate === today).length,
    rejected: localRequests.filter((request) => request.status === 'Rejected' && request.decisionDate === today).length,
  }), [localRequests, today]);
  // Supplied summary statistics are authoritative. This avoids adding local
  // decision deltas on top of server counts that may already include them.
  const counts = stats === undefined
    ? derivedCounts
    : SUMMARY_STATS.reduce((result, stat) => ({
      ...result,
      [stat.id]: (Array.isArray(stats) ? stats : []).find((item) => item?.id === stat.id)?.value ?? 0,
    }), {});

  const visibleRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return localRequests
      .filter((request) => statusFilter === 'All statuses' || request.status === statusFilter)
      .filter((request) => !normalizedQuery || [
        request.eventName,
        request.applicant?.name,
        request.venue,
        request.id,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => {
        if (sort === 'pending') return Number(b.status === 'Pending') - Number(a.status === 'Pending');
        if (sort === 'date') return String(a.date).localeCompare(String(b.date));
        return String(b.id).localeCompare(String(a.id));
      });
  }, [localRequests, query, sort, statusFilter]);

  const decide = async (request, status) => {
    if (!request || request.status !== 'Pending' || processingIdRef.current !== null) return;
    const isApproval = status === 'Approved';
    const actionLabel = isApproval ? 'approve' : 'decline';
    const callback = isApproval ? onApprove : onDecline;
    processingIdRef.current = request.id;
    setActionError('');
    if (callback) setProcessingId(request.id);
    try {
      if (callback) {
        const result = await callback(request, notes[request.id] || '');
        const confirmed = result === true || result?.success === true;
        if (!confirmed) {
          throw new Error(result?.error || `The ${actionLabel} action was not confirmed. The request remains pending.`);
        }
      }

      const sourceRequest = requestData.find((item) => item.id === request.id);
      setLocalStatusUpdates((current) => ({
        ...current,
        [request.id]: { baseStatus: sourceRequest?.status || request.status, status, decisionDate: getLocalDate() },
      }));
    } catch (error) {
      setActionError(error.message || `Could not ${actionLabel} this request. It remains pending.`);
    } finally {
      processingIdRef.current = null;
      setProcessingId(null);
    }
  };

  const openDetails = (request, event) => {
    detailTriggerRef.current = event.currentTarget;
    setSelectedId(request.id);
  };

  return (
    <ApproverLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>REQUEST MANAGEMENT</p>
            <h1 className={styles.title}>Booking approvals</h1>
            <p className={styles.subtitle}>Review, approve, or decline venue requests from across campus.</p>
          </div>
          <div className={styles.headerIcon} aria-hidden="true"><FileCheck2 size={22} /></div>
        </header>

        <section className={styles.stats} aria-label="Booking approval summary">
          <article className={`${styles.statCard} ${styles.statPending}`}>
            <span className={styles.statIcon}><Clock3 size={19} /></span>
            <div><span className={styles.statLabel}>{SUMMARY_STATS[0].label}</span><strong>{counts.pending}</strong></div>
          </article>
          <article className={`${styles.statCard} ${styles.statApproved}`}>
            <span className={styles.statIcon}><CheckCircle2 size={19} /></span>
            <div><span className={styles.statLabel}>{SUMMARY_STATS[1].label}</span><strong>{counts.approved}</strong></div>
          </article>
          <article className={`${styles.statCard} ${styles.statRejected}`}>
            <span className={styles.statIcon}><XCircle size={19} /></span>
            <div><span className={styles.statLabel}>{SUMMARY_STATS[2].label}</span><strong>{counts.rejected}</strong></div>
          </article>
        </section>

        <section className={styles.requestsSection} aria-labelledby="requests-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="requests-title">Booking requests</h2><p>Review the latest requests from your campus.</p></div>
            <span className={styles.requestCount}>{visibleRequests.length} requests</span>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.visuallyHidden}>Search requests</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, applicant, venue or ID" />
            </label>
            <label className={styles.selectLabel}>
              <span className={styles.visuallyHidden}>Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className={styles.selectLabel}>
              <span className={styles.visuallyHidden}>Sort requests</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="pending">Pending first</option>
                <option value="date">Date: soonest</option>
                <option value="newest">Request: newest</option>
              </select>
            </label>
          </div>

          <div className={styles.requestList}>
            {loading && <div className={styles.stateMessage} role="status">Loading booking requests…</div>}
            {!loading && error && <div className={`${styles.stateMessage} ${styles.errorMessage}`} role="alert">{error}</div>}
            {!loading && !error && actionError && !selectedRequest && <div className={`${styles.stateMessage} ${styles.errorMessage}`} role="alert">{actionError}</div>}
            {!loading && !error && visibleRequests.length === 0 && (
              <div className={styles.stateMessage}>No booking requests match your search.</div>
            )}
            {!loading && !error && visibleRequests.map((request) => (
              <article className={styles.requestRow} key={request.id}>
                <div className={styles.requestMain}>
                  <div className={styles.requestTitleLine}>
                    <h3>{request.eventName}</h3><RequestStatus status={request.status} />
                  </div>
                  <p className={styles.applicantLine}>{request.applicant?.name || 'Applicant not provided'} <span>·</span> {request.applicant?.department || 'Department not provided'}</p>
                  <div className={styles.requestMeta}>
                    <span><FileCheck2 size={14} />{request.id}</span>
                    <span><MapPin size={14} />{request.venue}</span>
                    <span><CalendarDays size={14} />{formatDate(request.date)}</span>
                    <span><Clock3 size={14} />{request.startTime}–{request.endTime}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.detailsButton} type="button" onClick={(event) => openDetails(request, event)}>View details</button>
                  {request.status === 'Pending' && (
                    <button className={styles.quickApprove} type="button" disabled={processingId !== null} onClick={() => decide(request, 'Approved')} aria-label={`Approve ${request.eventName}`}><Check size={16} /> {processingId === request.id ? 'Saving…' : 'Approve'}</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {selectedRequest && (
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label="Close booking details" onClick={() => setSelectedId(null)} />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div><span className={styles.drawerId}>{selectedRequest.id}</span><h2 id="drawer-title">Booking request details</h2></div>
              <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={() => setSelectedId(null)} aria-label="Close details"><X size={20} /></button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.detailTitle}><div><h3>{selectedRequest.eventName}</h3><span>{selectedRequest.eventType || 'Event type not provided'}</span></div><RequestStatus status={selectedRequest.status} /></div>
              <section className={styles.detailSection}>
                <h3>Applicant information</h3>
                <dl className={styles.detailGrid}>
                  <div><dt>Applicant</dt><dd>{selectedRequest.applicant?.name || 'Not provided'}</dd></div>
                  <div><dt>Department</dt><dd>{selectedRequest.applicant?.department || 'Not provided'}</dd></div>
                  <div><dt>Verification</dt><dd className={selectedRequest.applicant?.verified ? styles.verified : styles.unverified}>{selectedRequest.applicant?.verified ? 'Verified' : 'Not verified'}</dd></div>
                  <div><dt>Expected attendance</dt><dd>{selectedRequest.attendance ?? 'Not provided'} people</dd></div>
                </dl>
              </section>
              <section className={styles.detailSection}>
                <h3>Venue &amp; schedule</h3>
                <dl className={styles.detailGrid}>
                  <div><dt>Venue</dt><dd>{selectedRequest.venue || 'Not provided'}</dd></div>
                  <div><dt>Date</dt><dd>{formatDate(selectedRequest.date)}</dd></div>
                  <div><dt>Time</dt><dd>{selectedRequest.startTime}–{selectedRequest.endTime}</dd></div>
                  <div><dt>Attendees</dt><dd><Users size={14} /> {selectedRequest.attendance ?? 'Not provided'}</dd></div>
                </dl>
              </section>
              <section className={styles.detailSection}><h3>Purpose of booking</h3><p className={styles.purpose}>{selectedRequest.purpose || 'No purpose provided.'}</p></section>
              <section className={`${styles.availability} ${availabilityConflict ? styles.hasConflict : ''} ${!availabilityChecked ? styles.availabilityNotChecked : ''}`}>
                {availabilityConflict ? <XCircle size={18} /> : availabilityChecked ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                <div><strong>{availabilityMessage}</strong><p>{availability?.note || (availabilityChecked ? 'No availability issues were reported.' : 'Availability has not been checked yet.')}</p></div>
              </section>
              <label className={styles.noteLabel} htmlFor="review-note">Internal review note</label>
              <textarea id="review-note" className={styles.noteInput} rows="4" value={notes[selectedRequest.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [selectedRequest.id]: event.target.value }))} placeholder="Add a note for the review record…" />
              {actionError && <p className={styles.errorMessage} role="alert">{actionError}</p>}
            </div>
            {selectedRequest.status === 'Pending' && (
              <div className={styles.drawerActions}>
                <button type="button" className={styles.declineButton} disabled={processingId !== null} onClick={() => decide(selectedRequest, 'Rejected')}><XCircle size={17} /> {processingId === selectedRequest.id ? 'Saving…' : 'Decline'}</button>
                <GradientButton disabled={processingId !== null} onClick={() => decide(selectedRequest, 'Approved')}><Check size={17} /> {processingId === selectedRequest.id ? 'Saving…' : 'Approve request'}</GradientButton>
              </div>
            )}
          </aside>
        </div>
      )}
    </ApproverLayout>
  );
};

ApproverApprovals.propTypes = {
  requests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    eventName: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['Pending', 'Approved', 'Rejected']).isRequired,
  })),
  stats: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, value: PropTypes.number.isRequired })),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onApprove: PropTypes.func,
  onDecline: PropTypes.func,
};

export default ApproverApprovals;
