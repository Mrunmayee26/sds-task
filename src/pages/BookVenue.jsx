import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import PortalLayout from '../layouts/PortalLayout';
import { DataState, PageHeading } from '../components/BookingUI';
import { AttendanceNotice, CapacityMeter } from '../components';
import { useBookingData } from '../hooks/useBookingData';
import { useAuth } from '../hooks/useAuth';
import { fetchFacultyAdvisors } from '../services/auth';
import { checkAvailability, createBooking } from '../services/bookingService';
import { campusTimestamp, dateKey, dateLabel, timeLabel } from '../services/format';

export default function BookVenue() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const venues = useBookingData('venues');
  const [advisors, setAdvisors] = useState([]);
  const [form, setForm] = useState({
    venue_id: query.get('venue') || '',
    faculty_advisor_id: '',
    purpose: '',
    description: '',
    application_type: 'Academic',
    expected_attendance: '',
    date: query.get('date') || '',
    start_time: query.get('start_time') || query.get('start') || '',
    end_time: query.get('end_time') || query.get('end') || '',
  });

  useEffect(() => {
    fetchFacultyAdvisors().then((data) => {
      setAdvisors(data);
      if (data.length > 0) {
        setForm((prev) => ({
          ...prev,
          faculty_advisor_id: prev.faculty_advisor_id || data[0].user_id,
        }));
      }
    });
  }, []);


  useEffect(() => {
    const qVenue = query.get('venue');
    const qDate = query.get('date');
    const qStart = query.get('start_time') || query.get('start');
    const qEnd = query.get('end_time') || query.get('end');

    if (qVenue || qDate || qStart || qEnd) {
      setForm((prev) => ({
        ...prev,
        ...(qVenue ? { venue_id: qVenue } : {}),
        ...(qDate ? { date: qDate } : {}),
        ...(qStart ? { start_time: qStart } : {}),
        ...(qEnd ? { end_time: qEnd } : {}),
      }));
    }
  }, [query]);
  const [availability, setAvailability] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const selected = venues.data.find(
    (venue) => venue.venue_id === Number(form.venue_id),
  );
  const attendance = form.expected_attendance
    ? Number(form.expected_attendance)
    : 0;
  const exceedsCapacity = Boolean(
    selected?.capacity && attendance > selected.capacity,
  );
  const nearCapacity = Boolean(
    selected?.capacity &&
      attendance > selected.capacity * 0.85 &&
      !exceedsCapacity,
  );
  const fillPercentage =
    selected?.capacity && attendance
      ? Math.min(100, Math.round((attendance / selected.capacity) * 100))
      : 0;
  const suggestedVenues = exceedsCapacity
    ? venues.data.filter(
        (v) =>
          v.venue_id !== selected?.venue_id &&
          v.is_active !== false &&
          v.capacity &&
          v.capacity >= attendance,
      )
    : [];

  const update = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    setError('');
  };
  const { venue_id, date, start_time, end_time } = form;

  useEffect(() => {
    if (!venue_id || !date || !start_time || !end_time) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkAvailability(
        venue_id,
        campusTimestamp(date, start_time),
        campusTimestamp(date, end_time),
        controller.signal,
      )
        .then((result) => {
          if (!controller.signal.aborted)
            setAvailability({
              key: `${venue_id}/${date}/${start_time}/${end_time}`,
              available: result.available,
            });
        })
        .catch((failure) => {
          if (!controller.signal.aborted)
            setAvailability({
              key: `${venue_id}/${date}/${start_time}/${end_time}`,
              error: failure.message,
            });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [venue_id, date, start_time, end_time]);
  const currentAvailability =
    availability?.key === `${venue_id}/${date}/${start_time}/${end_time}`
      ? availability
      : null;

  async function submit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    if (!selected) {
      setError('Choose an active venue.');
      return;
    }
    if (selected.capacity && Number(form.expected_attendance) > selected.capacity) {
      setError(
        `Expected attendance (${form.expected_attendance}) exceeds the maximum capacity of ${selected.venue_name} (${selected.capacity} seats). Please reduce attendance or select a larger venue.`,
      );
      return;
    }
    if (Number(form.expected_attendance) <= 0) {
      setError('Expected attendance must be at least 1 person.');
      return;
    }
    if (end_time <= start_time) {
      setError('End time must be after start time.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const saved = await createBooking({
        venue_id: Number(venue_id),
        faculty_advisor_id: form.faculty_advisor_id ? Number(form.faculty_advisor_id) : undefined,
        purpose: form.purpose.trim(),
        description: form.description.trim(),
        application_type: form.application_type,
        expected_attendance: Number(form.expected_attendance),
        start_time: campusTimestamp(date, start_time),
        end_time: campusTimestamp(date, end_time),
      });
      navigate(`/${session?.role || user?.role || 'applicant'}/bookings/${saved.application_id}`, {
        state: { message: 'Your booking request has been submitted.' },
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <PortalLayout>
      <PageHeading title="Make room for your next idea.">
        Choose a venue and a time. Your request will go to its assigned
        reviewers.
      </PageHeading>
      <DataState {...venues} />
      {!venues.loading &&
        !venues.error &&
        (!venues.data.length ? (
          <div className="empty-state">
            <h3>No active venues available</h3>
            <p>Contact the campus administrator.</p>
          </div>
        ) : (
          <div className="booking-form-layout">
            <form className="panel booking-form" onSubmit={submit}>
              <div className="section-heading">
                <h2>Booking details</h2>
                <span className="muted">All times in IST</span>
              </div>
              {date && start_time && end_time && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f5f2ff 0%, #ede7ff 100%)',
                    border: '1px solid #d4c4fb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    color: '#5329b3',
                  }}
                >
                  <Clock size={18} style={{ color: '#7047eb', flexShrink: 0 }} />
                  <span>
                    Selected Time Slot:{' '}
                    <strong>{dateLabel(date)}</strong> from{' '}
                    <strong>{timeLabel(campusTimestamp(date, start_time))}</strong> to{' '}
                    <strong>{timeLabel(campusTimestamp(date, end_time))}</strong>.
                    {!venue_id && ' Select a venue below to check availability.'}
                  </span>
                </div>
              )}
              {currentAvailability?.available === false && (
                <div
                  style={{
                    background: '#fff9e6',
                    border: '1px solid #ffd8a8',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px',
                    color: '#9a3412',
                  }}
                >
                  <Clock size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
                  <span>
                    <strong>Notice:</strong> This venue is currently reserved for this time. You can still submit this request; if approved as high-priority, approvers will revoke and dynamically reassign the previous booking.
                  </span>
                </div>
              )}
              <label>
                Venue
                <select
                  name="venue_id"
                  value={venue_id}
                  onChange={update}
                  required
                >
                  <option value="">Select a venue</option>
                  {venues.data.map((venue) => (
                    <option key={venue.venue_id} value={venue.venue_id}>
                      {venue.venue_name}
                      {venue.capacity ? ` · ${venue.capacity} seats` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {advisors.length > 0 && (
                <label>
                  Faculty Advisor (Level 1 Reviewer)
                  <select
                    name="faculty_advisor_id"
                    value={form.faculty_advisor_id}
                    onChange={update}
                    required
                  >
                    <option value="">Choose your Faculty Advisor</option>
                    {advisors.map((adv) => (
                      <option key={adv.user_id} value={adv.user_id}>
                        {adv.full_name} ({adv.email})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: '#685f74', fontSize: '11px', marginTop: '4px' }}>
                    Your request will first be routed to this Faculty Advisor for endorsement, followed by Department HOD review.
                  </small>
                </label>
              )}
              <label>
                Event title
                <input
                  name="purpose"
                  value={form.purpose}
                  onChange={update}
                  maxLength={255}
                  required
                  placeholder="What are you planning?"
                />
              </label>
              <div className="form-two-col">
                <label>
                  Event type
                  <select
                    name="application_type"
                    value={form.application_type}
                    onChange={update}
                  >
                    {[
                      'Academic',
                      'Workshop',
                      'Seminar',
                      'Cultural',
                      'Meeting',
                      'Other',
                    ].map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span>Expected attendance</span>
                    {selected?.capacity && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: exceedsCapacity ? '#b02c48' : '#7047eb',
                        }}
                      >
                        Max: {selected.capacity} seats
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    name="expected_attendance"
                    value={form.expected_attendance}
                    onChange={update}
                    min="1"
                    step="1"
                    required
                    placeholder={
                      selected?.capacity
                        ? `Up to ${selected.capacity} attendees`
                        : 'Number of attendees'
                    }
                    style={
                      exceedsCapacity
                        ? { borderColor: '#ff4d5b', backgroundColor: '#fff8f9' }
                        : {}
                    }
                  />
                </label>
              </div>
              <AttendanceNotice
                selected={selected}
                attendance={attendance}
                exceedsCapacity={exceedsCapacity}
                nearCapacity={nearCapacity}
                fillPercentage={fillPercentage}
                suggestedVenues={suggestedVenues}
                onSelectVenue={(vId) => {
                  setForm((prev) => ({ ...prev, venue_id: vId }));
                  setError('');
                }}
              />
              <label>
                Event description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={update}
                  maxLength={5000}
                  rows={4}
                  placeholder="Tell the reviewer about your event and any special requirements."
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  name="date"
                  value={date}
                  onChange={update}
                  min={dateKey()}
                  required
                />
              </label>
              <div className="form-two-col">
                <label>
                  Start time
                  <input
                    type="time"
                    name="start_time"
                    value={start_time}
                    onChange={update}
                    required
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    name="end_time"
                    value={end_time}
                    onChange={update}
                    required
                  />
                </label>
              </div>
              {currentAvailability && (
                <p
                  role="status"
                  className={`notice ${currentAvailability.available ? 'success' : 'warning'}`}
                >
                  {currentAvailability.error ||
                    (currentAvailability.available
                      ? 'Venue is currently free for this time slot.'
                      : 'This venue already has an existing reservation. You can still submit this request for priority review.')}
                </p>
              )}
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Link className="button secondary" to="/applicant/venues">
                  Back to venues
                </Link>
                <button
                  className="button primary"
                  type="submit"
                  disabled={submitting || exceedsCapacity}
                >
                  {submitting
                    ? 'Submitting…'
                    : exceedsCapacity
                      ? 'Exceeds venue capacity'
                      : currentAvailability?.available === false
                        ? 'Submit Priority Request'
                        : 'Submit request'}
                </button>
              </div>
            </form>
            <aside className="panel booking-aside">
              <p className="eyebrow">YOUR RESERVATION</p>
              <h2>{selected?.venue_name || 'Choose your venue'}</h2>
              <p className="muted">
                {selected?.building_name || 'Explore spaces across the campus.'}
              </p>
              {selected && (
                <>
                  <p>
                    {selected.capacity
                      ? `${selected.capacity} seats capacity`
                      : 'Capacity not specified'}
                  </p>
                  <CapacityMeter
                    selected={selected}
                    attendance={attendance}
                    exceedsCapacity={exceedsCapacity}
                    nearCapacity={nearCapacity}
                    fillPercentage={fillPercentage}
                  />
                  <hr />
                  <p className="eyebrow">REVIEWED BY</p>
                  <p>{selected.primary_approval_group}</p>
                </>
              )}
              <hr />
              <p className="eyebrow">APPLICANT</p>
              <strong>{user.full_name}</strong>
              <p className="muted">{user.email}</p>
              <hr />
              <h3>What happens next?</h3>
              <p className="muted">
                Your selected time is reserved while reviewers consider your
                request. Track its progress in My bookings.
              </p>
            </aside>
          </div>
        ))}
    </PortalLayout>
  );
}
