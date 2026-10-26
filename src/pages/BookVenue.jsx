import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
                  Expected attendance
                  <input
                    type="number"
                    name="expected_attendance"
                    value={form.expected_attendance}
                    onChange={update}
                    min="1"
                    max={selected?.capacity || undefined}
                    step="1"
                    required
                  />
                </label>
              </div>
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
                    submitting || currentAvailability?.available === false
                  }
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
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
                      ? `${selected.capacity} seats`
                      : 'Capacity not specified'}
                  </p>
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
