import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  AlertCircle,
  Printer,
  X,
  RotateCcw,
  Ban,
  CalendarPlus,
  Sparkles,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import { StatusBadge, GradientButton } from '../components';
import {
  cancelBooking,
  resubmitBooking,
  getAllVenues,
} from '../services/bookingService';
import { useBookings } from '../hooks/useBookingData';
import styles from './ApplicantApplications.module.css';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

const STATUS_TABS = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'];
const getTomorrowDateKey = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ApplicantApplications() {
  const navigate = useNavigate();
  const bookings = useBookings('applicant');
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  // Selected booking ID for details drawer
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Resubmit modal state
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [resubmitForm, setResubmitForm] = useState({
    venue: '',
    date: '',
    startTime: '',
    endTime: '',
  });
  const detailsDialogRef = useRef(null);
  const detailsCloseRef = useRef(null);
  const detailsTriggerRef = useRef(null);
  const resubmitDialogRef = useRef(null);
  const resubmitCloseRef = useRef(null);
  const resubmitTriggerRef = useRef(null);

  const venues = useMemo(() => getAllVenues(), []);

  const selectedBooking = useMemo(
    () => (selectedBookingId ? bookings.find((b) => b.id === selectedBookingId) : null),
    [bookings, selectedBookingId]
  );

  useAccessibleDialog(Boolean(selectedBooking), {
    containerRef: detailsDialogRef,
    initialFocusRef: detailsCloseRef,
    triggerRef: detailsTriggerRef,
    onClose: () => setSelectedBookingId(null),
  });
  useAccessibleDialog(Boolean(resubmitTarget), {
    containerRef: resubmitDialogRef,
    initialFocusRef: resubmitCloseRef,
    triggerRef: resubmitTriggerRef,
    onClose: () => setResubmitTarget(null),
  });

  // Tab counts
  const counts = useMemo(() => {
    return {
      All: bookings.length,
      Pending: bookings.filter((b) => b.status === 'Pending').length,
      Approved: bookings.filter((b) => b.status === 'Approved').length,
      Rejected: bookings.filter((b) => b.status === 'Rejected').length,
      Cancelled: bookings.filter((b) => b.status === 'Cancelled').length,
    };
  }, [bookings]);

  // Filtered & sorted bookings
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Tab filter
        if (activeTab !== 'All' && b.status !== activeTab) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = b.id?.toLowerCase().includes(q);
          const matchEvent = b.eventName?.toLowerCase().includes(q);
          const matchVenue = b.venue?.toLowerCase().includes(q);
          if (!matchId && !matchEvent && !matchVenue) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date);
        }
        if (sortOrder === 'date') {
          return new Date(a.date) - new Date(b.date);
        }
        return 0;
      });
  }, [bookings, activeTab, searchQuery, sortOrder]);

  // Handle Cancellation
  const handleCancel = (booking) => {
    if (!window.confirm(`Are you sure you want to cancel the booking request "${booking.eventName}" (${booking.id})?`)) return false;
    try {
      cancelBooking(booking.id);
      return true;
    } catch (err) {
      alert(`Failed to cancel: ${err.message}`);
      return false;
    }
  };

  const openDetails = (booking, event) => {
    detailsTriggerRef.current = event.currentTarget;
    setSelectedBookingId(booking.id);
  };

  // Open Resubmit Modal
  const openResubmitModal = (booking, event) => {
    const rowDetailsButton = event?.currentTarget.closest('tr')?.querySelector('button[title="View complete request breakdown"]');
    resubmitTriggerRef.current = rowDetailsButton || event?.currentTarget || detailsTriggerRef.current;
    setResubmitTarget(booking);
    setResubmitForm({
      venue: booking.venue,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  };

  // Submit Resubmit
  const handleResubmitSubmit = (e) => {
    e.preventDefault();
    if (!resubmitTarget) return;

    try {
      resubmitBooking(resubmitTarget.id, resubmitForm);
      setResubmitTarget(null);
      alert(`Booking ${resubmitTarget.id} was saved as Pending in local demo data.`);
    } catch (err) {
      alert(`Resubmission failed: ${err.message}`);
    }
  };

  // Printable slip
  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <ApplicantLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>My Booking Applications</h1>
            <p className={styles.subtitle}>
              Track status, review faculty feedback, cancel or resubmit reservations for your campus activities.
            </p>
          </div>

          <GradientButton
            size="md"
            variant="solid"
            onClick={() => navigate('/applicant/book')}
          >
            <CalendarPlus size={16} style={{ marginRight: 6 }} />
            New Booking Request
          </GradientButton>
        </header>

        {/* Status Filter Tabs */}
        <div className={styles.tabsRow} role="tablist" aria-label="Booking status tabs">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span>{tab}</span>
                <span className={styles.tabCount}>{counts[tab] || 0}</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search & Sort */}
        <section className={styles.toolbarCard} aria-label="Search and filter applications">
          <div className={styles.searchBox}>
            <Search size={17} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by event title, venue name, or ID (e.g. REQ-2026-041)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search applications"
            />
          </div>

          <div className={styles.sortGroup}>
            <span className={styles.sortLabel}>Sort By:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={styles.sortSelect}
              aria-label="Sort applications"
            >
              <option value="newest">Submission: Newest First</option>
              <option value="date">Event Date: Soonest First</option>
            </select>
          </div>
        </section>

        {/* Applications Table / Card List */}
        <section className={styles.tableContainer} aria-label="Booking applications table">
          {filteredBookings.length === 0 ? (
            <div className={styles.emptyState}>
              <Sparkles size={32} color="#7047EB" />
              <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                No applications found in this view
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>
                {searchQuery
                  ? 'No bookings matched your search query. Try clearing the search box.'
                  : `You have no ${activeTab === 'All' ? '' : activeTab.toLowerCase()} booking applications right now.`}
              </p>
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={() => {
                  setActiveTab('All');
                  setSearchQuery('');
                }}
                style={{ marginTop: 8 }}
              >
                View all applications
              </button>
            </div>
          ) : (
            <table className={styles.appTable}>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Event Name &amp; Type</th>
                  <th>Venue</th>
                  <th>Date &amp; Timeslot</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id} className={styles.tableRow}>
                    <td>
                      <span className={styles.idBadge}>{b.id}</span>
                    </td>

                    <td>
                      <div className={styles.eventNameCell}>
                        <span className={styles.eventNameText}>{b.eventName}</span>
                        <span className={styles.eventTypeTag}>{b.eventType || 'Activity'}</span>
                      </div>
                    </td>

                    <td>
                      <div className={styles.venueCell}>
                        <span>{b.venue}</span>
                      </div>
                    </td>

                    <td>
                      <div className={styles.dateSlotCell}>
                        <span>{b.date}</span>
                        <span className={styles.slotTimeText}>
                          {b.startTime} - {b.endTime}
                        </span>
                      </div>
                    </td>

                    <td>
                      <StatusBadge status={b.status} size="sm" />
                    </td>

                    <td>
                      <div className={styles.actionBtnGroup} style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className={styles.actionIconBtn}
                          onClick={(event) => openDetails(b, event)}
                          title="View complete request breakdown"
                        >
                          View Details
                        </button>

                        {b.status === 'Rejected' && (
                          <button
                            type="button"
                            className={styles.resubmitActionBtn}
                            onClick={(event) => openResubmitModal(b, event)}
                            title="Resubmit this booking with new time or venue"
                          >
                            <RotateCcw size={13} style={{ display: 'inline', marginRight: 4 }} />
                            Resubmit
                          </button>
                        )}

                        {b.status === 'Pending' && (
                          <button
                            type="button"
                            className={styles.cancelActionBtn}
                            onClick={() => handleCancel(b)}
                            title="Cancel booking"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Slide-out Details Drawer */}
        {selectedBooking && (
          <div
            className={styles.drawerBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            <div ref={detailsDialogRef} className={styles.drawerPanel}>
              <div className={styles.drawerHeader}>
                <div className={styles.drawerTitleGroup}>
                  <span className={styles.idBadge}>{selectedBooking.id}</span>
                  <h2 id="drawer-title" className={styles.drawerTitle}>
                    {selectedBooking.eventName}
                  </h2>
                </div>

                <button
                  ref={detailsCloseRef}
                  type="button"
                  className={styles.closeDrawerBtn}
                  onClick={() => setSelectedBookingId(null)}
                  aria-label="Close details"
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.drawerBody}>
                {/* Visual Status Progression Timeline */}
                <div className={styles.timelineTrack}>
                  {/* Step 1: Submitted */}
                  <div className={`${styles.timelineNode} ${styles.timelineDone}`}>
                    <div className={styles.timelineDot}>✓</div>
                    <span className={styles.timelineLabel}>Submitted</span>
                  </div>

                  {/* Step 2: Under Review */}
                  <div
                    className={`${styles.timelineNode} ${
                      selectedBooking.status === 'Pending'
                        ? styles.timelineActive
                        : styles.timelineDone
                    }`}
                  >
                    <div className={styles.timelineDot}>
                      {selectedBooking.status === 'Pending' ? '•' : '✓'}
                    </div>
                    <span className={styles.timelineLabel}>Faculty Review</span>
                  </div>

                  {/* Step 3: Final Decision */}
                  <div
                    className={`${styles.timelineNode} ${
                      selectedBooking.status === 'Approved'
                        ? styles.timelineDone
                        : selectedBooking.status === 'Rejected'
                        ? styles.timelineRejected
                        : ''
                    }`}
                  >
                    <div className={styles.timelineDot}>
                      {selectedBooking.status === 'Approved'
                        ? '✓'
                        : selectedBooking.status === 'Rejected'
                        ? '✕'
                        : '3'}
                    </div>
                    <span className={styles.timelineLabel}>
                      {selectedBooking.status === 'Approved'
                        ? 'Approved'
                        : selectedBooking.status === 'Rejected'
                        ? 'Rejected'
                        : 'Decision'}
                    </span>
                  </div>
                </div>

                {/* Reviewer Note Warning if Rejected */}
                {selectedBooking.status === 'Rejected' && (
                  <div className={styles.reviewerNoteBox} role="alert">
                    <span className={styles.reviewerNoteTitle}>
                      <AlertCircle size={15} />
                      Review note ({selectedBooking.decisionBy || 'Approver'}):
                    </span>
                    <p className={styles.reviewerNoteText}>
                      &ldquo;
                      {selectedBooking.reviewerNotes ||
                        selectedBooking.previousReviewerNotes ||
                        'Venue reservation declined due to academic scheduling priority.'}
                      &rdquo;
                    </p>
                  </div>
                )}

                {/* Approved Confirmation Box */}
                {selectedBooking.status === 'Approved' && (
                  <div className={styles.slipPreviewBox}>
                    <div>
                      <strong style={{ color: '#065F46', display: 'block', fontSize: '14px' }}>
                        Marked Approved in Demo Data
                      </strong>
                      <span style={{ fontSize: '12px', color: '#047857' }}>
                        Demo approval recorded by {selectedBooking.decisionBy || 'Approver'}.
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      onClick={handlePrintSlip}
                      style={{ background: '#FFFFFF', color: '#065F46' }}
                    >
                      <Printer size={14} />
                      Print Slip
                    </button>
                  </div>
                )}

                {/* Full Breakdown Grid */}
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Assigned Facility</span>
                    <span className={styles.detailValue}>{selectedBooking.venue}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Event Category</span>
                    <span className={styles.detailValue}>{selectedBooking.eventType || 'Activity'}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Reserved Date</span>
                    <span className={styles.detailValue}>{selectedBooking.date}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Time Window</span>
                    <span className={styles.detailValue}>
                      {selectedBooking.startTime} - {selectedBooking.endTime}
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Expected Attendance</span>
                    <span className={styles.detailValue}>{selectedBooking.attendance} Attendees</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Organization</span>
                    <span className={styles.detailValue}>
                      {selectedBooking.applicant?.department || 'COEP Club'}
                    </span>
                  </div>
                </div>

                {/* Purpose */}
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Purpose of Booking</span>
                  <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {selectedBooking.purpose || 'Academic & student club demonstration.'}
                  </p>
                </div>

                {/* Facilities requested */}
                {selectedBooking.equipment && selectedBooking.equipment.length > 0 && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Equipment Allocated</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 4 }}>
                      {selectedBooking.equipment.map((eq) => (
                        <span
                          key={eq}
                          style={{
                            fontSize: '12px',
                            background: '#F3F2F8',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Instructions */}
                {selectedBooking.specialInstructions && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Technical Instructions</span>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {selectedBooking.specialInstructions}
                    </p>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className={styles.drawerFooter}>
                {selectedBooking.status === 'Rejected' && (
                  <button
                    type="button"
                    className={styles.resubmitActionBtn}
                    onClick={() => {
                      const target = selectedBooking;
                      setSelectedBookingId(null);
                      openResubmitModal(target);
                    }}
                  >
                    <RotateCcw size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Edit &amp; Resubmit Request
                  </button>
                )}

                {selectedBooking.status === 'Pending' && (
                  <button
                    type="button"
                    className={styles.cancelActionBtn}
                    onClick={() => {
                      if (handleCancel(selectedBooking)) setSelectedBookingId(null);
                    }}
                  >
                    <Ban size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Cancel Booking
                  </button>
                )}

                <button
                  type="button"
                  className={styles.actionIconBtn}
                  onClick={() => setSelectedBookingId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resubmit Modal */}
        {resubmitTarget && (
          <div
            className={styles.drawerBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resubmit-modal-title"
            style={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <div ref={resubmitDialogRef} className={styles.resubmitModalCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 id="resubmit-modal-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Resubmit Booking: {resubmitTarget.eventName}
                  </h2>
                  <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                    Original ID: {resubmitTarget.id}
                  </span>
                </div>
                <button
                  ref={resubmitCloseRef}
                  type="button"
                  className={styles.closeDrawerBtn}
                  onClick={() => setResubmitTarget(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Choose Alternate Venue</label>
                  <select
                    value={resubmitForm.venue}
                    onChange={(e) => setResubmitForm((p) => ({ ...p, venue: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #DFDCE8' }}
                  >
                    {venues.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name} ({typeof v.capacity === 'number' ? `Capacity: ${v.capacity}` : 'capacity details unavailable'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>New Booking Date</label>
                  <input
                    type="date"
                    min={getTomorrowDateKey()}
                    value={resubmitForm.date}
                    onChange={(e) => setResubmitForm((p) => ({ ...p, date: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #DFDCE8' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Start Time</label>
                    <input
                      type="time"
                      value={resubmitForm.startTime}
                      onChange={(e) => setResubmitForm((p) => ({ ...p, startTime: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #DFDCE8' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>End Time</label>
                    <input
                      type="time"
                      value={resubmitForm.endTime}
                      onChange={(e) => setResubmitForm((p) => ({ ...p, endTime: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #DFDCE8' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className={styles.actionIconBtn}
                    onClick={() => setResubmitTarget(null)}
                  >
                    Cancel
                  </button>

                  <GradientButton type="submit" size="md" variant="solid">
                    Resubmit Request
                  </GradientButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ApplicantLayout>
  );
}
