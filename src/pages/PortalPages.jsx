import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  MapPin,
  Users,
  Edit2,
  Save,
  X,
  CheckCircle2,
} from 'lucide-react';
import PortalLayout from '../layouts/PortalLayout';
import { useAuth } from '../hooks/useAuth';
import { useBookingData } from '../hooks/useBookingData';
import { BookingTable, DataState, PageHeading } from '../components/BookingUI';
import { dateKey } from '../services/format';
import { fetchDepartments, updateProfile } from '../services/auth';

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
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [homeUnitId, setHomeUnitId] = useState(
    user?.home_unit_id ? String(user.home_unit_id) : '',
  );
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setHomeUnitId(user.home_unit_id ? String(user.home_unit_id) : '');
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    fetchDepartments().then((data) => {
      if (active && Array.isArray(data)) {
        setDepartments(data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleStartEdit = () => {
    setFullName(user?.full_name || '');
    setHomeUnitId(user?.home_unit_id ? String(user.home_unit_id) : '');
    setStatusMsg({ type: '', text: '' });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFullName(user?.full_name || '');
    setHomeUnitId(user?.home_unit_id ? String(user.home_unit_id) : '');
    setStatusMsg({ type: '', text: '' });
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setStatusMsg({ type: 'error', text: 'Full name cannot be blank.' });
      return;
    }
    setSaving(true);
    setStatusMsg({ type: '', text: '' });
    const res = await updateProfile({
      full_name: fullName.trim(),
      home_unit_id: homeUnitId ? Number(homeUnitId) : null,
    });
    setSaving(false);
    if (res.ok) {
      setStatusMsg({ type: 'success', text: 'Profile successfully updated.' });
      setIsEditing(false);
    } else {
      setStatusMsg({
        type: 'error',
        text: res.message || 'Failed to update profile.',
      });
    }
  };

  return (
    <PortalLayout>
      <PageHeading
        title="Your profile."
        action={
          !isEditing && (
            <button className="button secondary" onClick={handleStartEdit}>
              <Edit2 size={16} />
              Edit Profile
            </button>
          )
        }
      >
        Your registered campus account and review permissions.
      </PageHeading>

      <section className="panel profile-panel">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span className="profile-initial">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </span>
            <div>
              <h2>{user?.full_name}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {user?.user_type === 'approver'
                  ? 'Campus Approver & Reviewer'
                  : 'Campus Applicant'}{' '}
                · {user?.email}
              </p>
            </div>
          </div>
          {!isEditing && (
            <span
              className="booking-status status-approved"
              style={{ fontSize: 11, padding: '6px 12px' }}
            >
              ● {user?.is_active ? 'Active Account' : 'Inactive'}
            </span>
          )}
        </div>

        {statusMsg.text && (
          <p
            className={`notice ${statusMsg.type}`}
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
          >
            {statusMsg.text}
          </p>
        )}

        {isEditing ? (
          <form onSubmit={handleSave} style={{ display: 'grid', gap: 20 }}>
            <div className="form-two-col">
              <label>
                Full Name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  required
                  maxLength={150}
                />
              </label>

              <label>
                Department / Unit
                <select
                  value={homeUnitId}
                  onChange={(e) => setHomeUnitId(e.target.value)}
                >
                  <option value="">No department assigned</option>
                  {departments.map((dept) => (
                    <option key={dept.unit_id} value={dept.unit_id}>
                      {dept.unit_name}{' '}
                      {dept.unit_code ? `(${dept.unit_code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-two-col">
              <label>
                Email Address
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  style={{
                    background: '#f8f7fa',
                    color: '#7a7287',
                    cursor: 'not-allowed',
                  }}
                />
                <small className="muted">
                  Campus email address cannot be changed.
                </small>
              </label>

              <label>
                Account Role
                <input
                  type="text"
                  value={
                    user?.user_type === 'approver'
                      ? 'Approver / Faculty'
                      : 'Applicant / Student'
                  }
                  disabled
                  style={{
                    background: '#f8f7fa',
                    color: '#7a7287',
                    cursor: 'not-allowed',
                  }}
                />
                <small className="muted">Assigned during registration.</small>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X size={15} />
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                <Save size={15} />
                {saving ? 'Saving changes…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="detail-grid">
            <div>
              <dt>Full Name</dt>
              <dd>
                <strong>{user?.full_name}</strong>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd style={{ textTransform: 'capitalize' }}>
                {user?.user_type}
              </dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{user?.unit_name || 'Not assigned'}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{user?.is_active ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>
        )}

        <hr />

        <h3>Approval groups</h3>
        {user?.approval_groups?.length ? (
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
          Contact the campus administrator to assign approval permissions or
          change your institutional credentials.
        </p>
      </section>
    </PortalLayout>
  );
}
