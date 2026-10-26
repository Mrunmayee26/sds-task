import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import PortalLayout from '../layouts/PortalLayout';
import { DataState, PageHeading } from '../components/BookingUI';
import { useBookingData } from '../hooks/useBookingData';
import { useAuth } from '../hooks/useAuth';
import { checkAvailability, createBooking } from '../services/bookingService';
import { campusTimestamp, dateKey } from '../services/format';

export default function BookVenue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const venues = useBookingData('venues');
  const [form, setForm] = useState({
    venue_id: query.get('venue') || '',
    purpose: '',
    description: '',
    application_type: 'Academic',
    expected_attendance: '',
    date: '',
    start_time: '',
    end_time: '',
  });
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
    if (currentAvailability?.available === false) {
      setError('This venue is already reserved for that time.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const saved = await createBooking({
        venue_id: Number(venue_id),
        purpose: form.purpose.trim(),
        description: form.description.trim(),
        application_type: form.application_type,
        expected_attendance: Number(form.expected_attendance),
        start_time: campusTimestamp(date, start_time),
        end_time: campusTimestamp(date, end_time),
      });
      navigate(`/applicant/bookings/${saved.application_id}`, {
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
              {exceedsCapacity && (
                <div
                  className="notice error"
                  style={{
                    margin: '0',
                    display: 'grid',
                    gap: 10,
                    borderRadius: 10,
                  }}
                  role="alert"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertTriangle
                      size={18}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <div>
                      <strong>Capacity Exceeded:</strong> You entered{' '}
                      {attendance} attendees, but {selected.venue_name} only
                      accommodates up to {selected.capacity} seats (
                      {attendance - selected.capacity} seats over capacity).
                    </div>
                  </div>
                  {suggestedVenues.length > 0 ? (
                    <div
                      style={{
                        borderTop: '1px solid #ffd4dc',
                        paddingTop: 8,
                        fontSize: 11,
                      }}
                    >
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
                        Suggested venues that fit your attendance:
                      </p>
                      <div
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                      >
                        {suggestedVenues.slice(0, 3).map((v) => (
                          <button
                            key={v.venue_id}
                            type="button"
                            className="button secondary"
                            style={{
                              minHeight: 32,
                              padding: '5px 12px',
                              fontSize: 11,
                              background: '#fff',
                            }}
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                venue_id: String(v.venue_id),
                              }));
                              setError('');
                            }}
                          >
                            Switch to {v.venue_name} ({v.capacity} seats)
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 11 }}>
                      Please reduce the expected attendance to reserve this space.
                    </p>
                  )}
                </div>
              )}
              {nearCapacity && (
                <p
                  className="notice warning"
                  style={{ margin: 0, padding: '10px 14px', fontSize: 11 }}
                >
                  ℹ️ Note: This booking utilizes {fillPercentage}% of{' '}
                  {selected.venue_name}'s capacity ({selected.capacity} seats).
                </p>
              )}
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
                      ? 'Venue is available for this time. Availability is checked again when you submit.'
                      : 'This venue is reserved for an overlapping time. Choose another slot.')}
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
                  disabled={
                    submitting ||
                    currentAvailability?.available === false ||
                    exceedsCapacity
                  }
                >
                  {submitting
                    ? 'Submitting…'
                    : exceedsCapacity
                      ? 'Exceeds venue capacity'
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
                  {attendance > 0 && selected.capacity && (
                    <div style={{ margin: '10px 0' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          marginBottom: 6,
                        }}
                      >
                        <span>Capacity utilization</span>
                        <strong
                          style={{
                            color: exceedsCapacity
                              ? '#b02c48'
                              : nearCapacity
                                ? '#a96d0e'
                                : '#22815d',
                          }}
                        >
                          {attendance} / {selected.capacity} ({fillPercentage}%)
                        </strong>
                      </div>
                      <div
                        style={{
                          background: '#eee8f5',
                          borderRadius: 6,
                          height: 7,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, (attendance / selected.capacity) * 100)}%`,
                            height: '100%',
                            background: exceedsCapacity
                              ? '#ff4d5b'
                              : nearCapacity
                                ? '#f2c080'
                                : '#80c8a7',
                            borderRadius: 6,
                            transition: 'width 0.2s',
                          }}
                        />
                      </div>
                      {exceedsCapacity ? (
                        <small
                          style={{
                            color: '#b02c48',
                            display: 'block',
                            marginTop: 5,
                            fontWeight: 600,
                          }}
                        >
                          Exceeds by {attendance - selected.capacity} seats
                        </small>
                      ) : nearCapacity ? (
                        <small
                          style={{
                            color: '#a96d0e',
                            display: 'block',
                            marginTop: 5,
                          }}
                        >
                          Near venue capacity
                        </small>
                      ) : null}
                    </div>
                  )}
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
