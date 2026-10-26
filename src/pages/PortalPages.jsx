import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  MapPin,
  Users,
} from 'lucide-react';
import PortalLayout from '../layouts/PortalLayout';
import { useAuth } from '../hooks/useAuth';
import { useBookingData } from '../hooks/useBookingData';
import { BookingTable, DataState, PageHeading } from '../components/BookingUI';
import { dateKey } from '../services/format';

export function Dashboard() {
  const { session, user } = useAuth();
  const reviewer = session.role === 'approver';
  const result = useBookingData('bookings', reviewer ? 'review' : 'mine');
  const [now] = useState(Date.now);
  const stats = [
    [
      'Pending review',
      result.data.filter((row) => row.status === 'submitted').length,
    ],
    ['Approved', result.data.filter((row) => row.status === 'approved').length],
    [
      'Upcoming approved',
      result.data.filter(
        (row) =>
          row.status === 'approved' && new Date(row.start_time).getTime() > now,
      ).length,
    ],
    ['Total bookings', result.data.length],
  ];
  return (
    <PortalLayout>
      <PageHeading
        title={`Welcome, ${user.full_name.split(' ')[0]}.`}
        action={
          <Link
            className="button primary"
            to={reviewer ? '/approver/approvals' : '/applicant/book'}
          >
            {reviewer ? 'Review requests' : 'Book a venue'}
            <ArrowRight size={17} />
          </Link>
        }
      >
        Your campus plans, all in one place.
      </PageHeading>
      <DataState {...result} />
      {!result.loading && !result.error && (
        <>
          <section className="stats-grid" aria-label="Booking summary">
            {stats.map(([label, value]) => (
              <article className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h2>Recent requests</h2>
              </div>
              <Link
                className="text-link"
                to={`/${session.role}/${reviewer ? 'approvals' : 'applications'}`}
              >
                View all →
              </Link>
            </div>
            <BookingTable
              bookings={result.data.slice(0, 5)}
              role={session.role}
            />
          </section>
        </>
      )}
    </PortalLayout>
  );
}

export function Venues() {
  const { session } = useAuth();
  const result = useBookingData('venues');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const types = [
    ...new Set(result.data.map((venue) => venue.venue_type)),
  ].sort();
  const venues = result.data.filter(
    (venue) =>
      (!type || venue.venue_type === type) &&
      (!capacity || venue.capacity >= Number(capacity)) &&
      [venue.venue_name, venue.building_name, venue.location_description].some(
        (value) => value?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <PortalLayout>
      <PageHeading title="Find your next space.">
        Explore campus venues, capacities and locations.
      </PageHeading>
      <div className="filter-bar">
        <label className="search-field">
          Search venues
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a venue or building…"
          />
        </label>
        <label>
          Venue type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {types.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Minimum seats
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Any capacity"
          />
        </label>
      </div>
      <DataState {...result} />
      {!result.loading && !result.error && (
        <>
          <p className="result-count">
            {venues.length} of {result.data.length} venues
          </p>
          <section className="venue-grid" aria-label="Campus venues">
            {venues.map((venue) => (
              <article className="venue-card" key={venue.venue_id}>
                <div className="venue-art">
                  <Building2 size={38} />
                  <span>{venue.venue_type.replaceAll('_', ' ')}</span>
                </div>
                <div className="venue-body">
                  <p className="eyebrow">{venue.unit_name}</p>
                  <h2>{venue.venue_name}</h2>
                  <p className="venue-meta">
                    <MapPin size={16} />
                    {venue.building_name ||
                      venue.location_description ||
                      'Location not specified'}
                  </p>
                  <p className="venue-meta">
                    <Users size={16} />
                    {venue.capacity
                      ? `${venue.capacity} seats`
                      : 'Capacity not specified'}
                  </p>
                  {venue.location_description && (
                    <p className="muted">{venue.location_description}</p>
                  )}
                  <p className="muted">
                    Reviewed by {venue.primary_approval_group}
                  </p>
                  {session.role === 'applicant' && (
                    <Link
                      className="button primary"
                      to={`/applicant/book?venue=${venue.venue_id}`}
                    >
                      <CalendarPlus size={17} />
                      Request this venue
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </section>
          {!venues.length && (
            <div className="empty-state">
              <h3>No venues found</h3>
              <p>Try a different search or filter.</p>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
}

export function Bookings() {
  const { session } = useAuth();
  const reviewer = session.role === 'approver';
  const result = useBookingData('bookings', reviewer ? 'review' : 'mine');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const bookings = result.data.filter(
    (row) =>
      (!status || row.status === status) &&
      `${row.purpose} ${row.venue_name} ${row.applicant_name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <PortalLayout>
      <PageHeading
        title={reviewer ? 'Review booking requests.' : 'My bookings.'}
      >
        {reviewer
          ? 'Requests assigned to your approval groups. Open a request to review its details.'
          : 'Track your requests, decisions and upcoming events.'}
      </PageHeading>
      <div className="filter-bar">
        <label className="search-field">
          Search requests
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search an event or venue…"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="submitted">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button className="button secondary" onClick={result.refresh}>
          Refresh
        </button>
      </div>
      <DataState {...result} />
      {!result.loading && !result.error && (
        <section className="panel">
          <BookingTable
            bookings={bookings}
            role={session.role}
            empty={search || status ? 'No matching requests.' : undefined}
          />
        </section>
      )}
    </PortalLayout>
  );
}

export function Schedule() {
  const { session } = useAuth();
  const result = useBookingData(
    'bookings',
    session.role === 'approver' ? 'review' : 'mine',
  );
  const [date, setDate] = useState(dateKey());
  const [status, setStatus] = useState('approved');
  const bookings = result.data
    .filter(
      (row) =>
        row.start_time &&
        (!date || dateKey(row.start_time) === date) &&
        (!status || row.status === status),
    )
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return (
    <PortalLayout>
      <PageHeading title="Campus schedule.">
        Plan around your bookings. All times are in India Standard Time.
      </PageHeading>
      <div className="filter-bar">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="approved">Approved</option>
            <option value="submitted">Pending</option>
            <option value="">All statuses</option>
          </select>
        </label>
        <button className="button secondary" onClick={() => setDate('')}>
          Show all dates
        </button>
      </div>
      <DataState {...result} />
      {!result.loading && !result.error && (
        <section className="panel">
          <BookingTable
            bookings={bookings}
            role={session.role}
            empty="No bookings for this selection."
          />
        </section>
      )}
    </PortalLayout>
  );
}

export function Profile() {
  const { user } = useAuth();
  return (
    <PortalLayout>
      <PageHeading title="Your profile.">
        Your registered campus account and review permissions.
      </PageHeading>
      <section className="panel profile-panel">
        <span className="profile-initial">{user.full_name[0]}</span>
        <h2>{user.full_name}</h2>
        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{user.user_type}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{user.unit_name || 'Not assigned'}</dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>{user.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
        </dl>
        <h3>Approval groups</h3>
        {user.approval_groups.length ? (
          <ul className="group-list">
            {user.approval_groups.map((group) => (
              <li key={group.access_id}>
                <strong>{group.group_name}</strong>
                <span>
                  {group.member_role} ·{' '}
                  {group.can_approve ? 'Can review' : 'Member'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No approval groups assigned.</p>
        )}
        <p className="muted">
          Contact the campus administrator to update account details or review
          permissions.
        </p>
      </section>
    </PortalLayout>
  );
}
