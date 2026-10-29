import { Link } from 'react-router-dom';
import { useState } from 'react';
import { dateLabel, statusLabel, timeLabel } from '../services/format';

export function PageHeading({
  eyebrow = 'CAMPUS SPACES',
  title,
  children,
  action,
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="page-subtitle">{children}</p>}
      </div>
      {action}
    </header>
  );
}

export function DataState({ loading, error, refresh }) {
  if (loading)
    return (
      <p className="data-state" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <div className="data-state error" role="alert">
        <p>{error}</p>
        <button className="button secondary" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  return null;
}

export function Status({ value }) {
  return (
    <span className={`booking-status status-${value}`}>
      {statusLabel(value)}
    </span>
  );
}

export function BookingTable({ bookings, role, empty = 'No bookings yet.' }) {
  const [now] = useState(Date.now);
  if (!bookings.length)
    return (
      <div className="empty-state">
        <h3>{empty}</h3>
        <p>
          {role === 'approver'
            ? 'Requests for your approval groups will appear here.'
            : 'Browse the campus venues to plan your next event.'}
        </p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Venue</th>
            <th>Date & time (IST)</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.application_id}>
              <td>
                <strong>{booking.purpose}</strong>
                {booking.status === 'submitted' &&
                  new Date(booking.submitted_at).getTime() <
                    now - 24 * 3600000 && (
                    <small style={{ color: '#a96d0e' }}>
                      Waiting over 24 hours
                    </small>
                  )}
                <small>
                  #{booking.application_id} ·{' '}
                  {booking.applicant_name || booking.application_type}
                </small>
              </td>
              <td>{booking.venue_name}</td>
              <td>
                {dateLabel(booking.start_time)}
                <small>
                  {timeLabel(booking.start_time)} –{' '}
                  {timeLabel(booking.end_time)}
                </small>
              </td>
              <td>
                <Status value={booking.status} />
              </td>
              <td>
                <Link
                  className="text-link"
                  to={`/${role}/bookings/${booking.application_id}`}
                >
                  View details →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
