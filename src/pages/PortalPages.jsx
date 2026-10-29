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
import { dateKey, campusTimestamp } from '../services/format';
import { useApiData } from '../hooks/useApiData';
export function Dashboard() {
  const { session, user } = useAuth();
  const reviewer = session.role === 'approver';
  const result = useBookingData('bookings', reviewer ? 'review' : 'mine');
  const summary = useApiData(
    `bookings/summary?scope=${reviewer ? 'review' : 'mine'}`,
  );
  const stats = [
    ['Pending review', summary.data.pending || 0],
    ['Approved', summary.data.approved || 0],
    ['Upcoming approved', summary.data.upcoming || 0],
    ['Total bookings', summary.data.total || 0],
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
  const [availabilityQuery, setAvailabilityQuery] = useState('');
  const result = useBookingData('venues', 'mine', availabilityQuery);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [location, setLocation] = useState('');
  const [amenity, setAmenity] = useState('');
  const types = [
    ...new Set(result.data.map((venue) => venue.venue_type)),
  ].sort();
  const venues = result.data.filter(
    (venue) =>
      (!location ||
        `${venue.building_name || ''} ${venue.location_description || ''}`
          .toLowerCase()
          .includes(location.toLowerCase())) &&
      (!amenity ||
        venue.amenities.some((item) =>
          item.toLowerCase().includes(amenity.toLowerCase()),
        )) &&
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
      <div className="filter-bar">
        <label>
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Building or location"
          />
        </label>
        <label>
          Amenity
          <input
            value={amenity}
            onChange={(e) => setAmenity(e.target.value)}
            placeholder="Projector, Wi-Fi…"
          />
        </label>
      </div>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setAvailabilityQuery(
            new URLSearchParams({
              start_time: campusTimestamp(data.get('date'), data.get('start')),
              end_time: campusTimestamp(data.get('date'), data.get('end')),
            }).toString(),
          );
        }}
      >
        <label>
          Date
          <input type="date" name="date" required />
        </label>
        <label>
          Start (IST)
          <input type="time" name="start" required />
        </label>
        <label>
          End (IST)
          <input type="time" name="end" required />
        </label>
        <button className="button primary">Find available venues</button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setAvailabilityQuery('')}
        >
          Clear time filter
        </button>
      </form>
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
                  {venue.amenities.length > 0 && (
                    <p className="muted">{venue.amenities.join(' · ')}</p>
                  )}
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
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const result = useBookingData(
    'bookings',
    reviewer ? 'review' : 'mine',
    new URLSearchParams({ offset: String(page * 25), status, search })
      .toString()
      .replace('status=&', ''),
  );
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search an event or venue…"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
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
      <div className="form-actions">
        <button
          className="button secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          disabled={result.data.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </PortalLayout>
  );
}
export function Schedule() {
  const { session } = useAuth();
  const [month, setMonth] = useState(() => dateKey().slice(0, 7));
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(0);
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const start = campusTimestamp(`${month}-01`, '00:00');
  const next = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);
  const result = useBookingData(
    'bookings',
    session.role === 'approver' ? 'review' : 'mine',
    new URLSearchParams({
      offset: String(page * 25),
      start_time: start,
      end_time: campusTimestamp(next, '00:00'),
    }).toString(),
  );
  const visible = result.data
    .filter((row) => !selected || dateKey(row.start_time) === selected)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return (
    <PortalLayout>
      <PageHeading title="Campus calendar.">
        Month view of your requests. All times in India Standard Time. Booking
        list is paginated.
      </PageHeading>
      <div className="filter-bar">
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setSelected('');
                setPage(0);
              }
            }}
          />
        </label>
        <button className="button secondary" onClick={() => setSelected('')}>
          All days
        </button>
      </div>
      <div className="panel calendar-grid" aria-label="Monthly calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <strong key={day} className="muted">
            {day}
          </strong>
        ))}
        {Array.from(
          { length: new Date(year, monthNumber - 1, 1).getDay() },
          (_, i) => (
            <span key={`empty-${i}`} />
          ),
        )}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const rows = result.data.filter(
            (row) => dateKey(row.start_time) === date,
          );
          return (
            <button
              className={
                selected === date ? 'calendar-day selected' : 'calendar-day'
              }
              key={date}
              onClick={() => setSelected(date)}
            >
              <strong>{i + 1}</strong>
              {rows.slice(0, 2).map((row) => (
                <span key={row.application_id}>{row.purpose}</span>
              ))}
              {rows.length > 2 && <small>+{rows.length - 2} more</small>}
            </button>
          );
        })}
      </div>
      <DataState {...result} />
      {!result.loading && !result.error && (
        <section className="panel">
          <BookingTable
            bookings={visible}
            role={session.role}
            empty="No bookings in this selection."
          />
        </section>
      )}
      <div className="form-actions">
        <button
          className="button secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous 25
        </button>
        <button
          className="button secondary"
          disabled={result.data.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          Next 25
        </button>
      </div>
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
