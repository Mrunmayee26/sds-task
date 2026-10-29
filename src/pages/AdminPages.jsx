import { useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../layouts/PortalLayout';
import { PageHeading, DataState, BookingTable } from '../components/BookingUI';
import { useApiData } from '../hooks/useApiData';
import { apiRequest } from '../services/apiClient';
import { campusTimestamp, dateLabel, timeLabel } from '../services/format';

export default function AdminPage({ section = 'dashboard' }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const paths = {
    dashboard: 'admin/summary',
    users: `admin/users?limit=25&offset=${page * 25}&search=${encodeURIComponent(search)}`,
    requests: 'admin/approver-requests',
    venues: 'admin/venues',
    blackouts: 'admin/blackouts',
    audit: `admin/audit?limit=25&offset=${page * 25}`,
    bookings: `admin/bookings?limit=25&offset=${page * 25}`,
    operations: 'admin/operations',
  };
  const result = useApiData(paths[section]);
  const venues = useApiData('admin/venues');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState(null);
  const [notice, setNotice] = useState('');
  async function mutate(path, method, body) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`api/v1/${path}`, { method, body });
      result.refresh();
      venues.refresh();
      setSelected(null);
      setNotice('Changes saved.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    dashboard: 'Campus administration.',
    users: 'Manage campus accounts.',
    requests: 'Reviewer access requests.',
    venues: 'Manage venues.',
    blackouts: 'Venue unavailable periods.',
    audit: 'Administrator audit trail.',
    bookings: 'All campus bookings.',
    operations: 'Service health & delivery.',
  };
  return (
    <PortalLayout>
      <PageHeading title={titles[section]}>
        Manage access and campus spaces. Account and venue changes are recorded
        in the audit trail.
      </PageHeading>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      <DataState {...result} />
      {section === 'operations' && !result.loading && !result.error && (
        <section className="panel detail-panel">
          <h2>Operations overview</h2>
          <p className="muted">
            Request counters reset daily (UTC). The worker sends queued email
            and creates approval reminders. Connect an uptime monitor to /health
            to detect outages outside this app.
          </p>
          <dl className="detail-grid">
            {Object.entries(result.data).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll('_', ' ')}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {section === 'dashboard' && !result.loading && !result.error && (
        <>
          <div className="stats-grid">
            {Object.entries(result.data).map(([key, value]) => (
              <article className="stat-card" key={key}>
                <span>{key.replaceAll('_', ' ')}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          {result.data.pending_requests > 0 && (
            <section
              className="panel detail-panel"
              style={{ borderLeft: '4px solid #f59e0b' }}
            >
              <h2>
                Reviewer requests awaiting approval (
                {result.data.pending_requests})
              </h2>
              <p>
                Review the requested department and role before approving
                reviewer access.
              </p>
              <Link className="button primary" to="/admin/requests">
                Open reviewer requests
              </Link>
            </section>
          )}

          <section className="panel detail-panel">
            <h2>Administrator workflow</h2>
            <p>
              Review access requests, assign reviewer groups, disable inactive
              accounts, and set venue blackout periods. Existing approved
              bookings must be cancelled before their venue can be blocked; the
              eight-hour deadline applies.
            </p>
            <Link className="button primary" to="/admin/requests">
              Review access requests
            </Link>
          </section>
        </>
      )}
      {section === 'users' && (
        <>
          <div className="filter-bar">
            <label>
              Search users
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Name or email"
              />
            </label>
          </div>
          <div className="panel table-scroll">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <strong>{user.full_name}</strong>
                      <small>{user.email}</small>
                    </td>
                    <td>{user.user_type}</td>
                    <td>{user.is_active ? 'Active' : 'Disabled'}</td>
                    <td>
                      {user.user_type !== 'admin' && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `${user.is_active ? 'Disable' : 'Enable'} this account?`,
                              )
                            )
                              mutate(`admin/users/${user.user_id}`, 'PATCH', {
                                is_active: !user.is_active,
                              });
                          }}
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}{' '}
                      <button
                        className="text-link"
                        onClick={async () => {
                          try {
                            setMembers(
                              await apiRequest(
                                `api/v1/admin/users/${user.user_id}/groups`,
                              ),
                            );
                            setSelected(user);
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Permissions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && members && (
            <section className="panel detail-panel">
              <h2>{selected.full_name}: reviewer groups</h2>
              {!members.length && (
                <p>
                  No groups assigned. This user can request access from their
                  profile.
                </p>
              )}
              {members.map((member) => (
                <div key={member.access_id} className="section-heading">
                  <span>{member.group_name}</span>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        `admin/users/${selected.user_id}/groups/${member.access_id}`,
                        'PATCH',
                        { can_approve: !member.can_approve },
                      )
                    }
                  >
                    {member.can_approve ? 'Revoke' : 'Restore'} review access
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      {section === 'requests' && (
        <section className="panel detail-panel">
          {!result.loading && !result.data.length && (
            <p>No reviewer requests.</p>
          )}
          {result.data.map((request) => (
            <article className="panel detail-panel" key={request.request_id}>
              <h2>{request.full_name}</h2>
              <p>
                {request.email} · {request.group_name}
              </p>
              <p>{request.reason}</p>
              <p>Status: {request.status}</p>
              {request.status === 'pending' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    mutate(
                      `admin/approver-requests/${request.request_id}`,
                      'PATCH',
                      {
                        status: data.get('decision'),
                        remarks: data.get('remarks'),
                      },
                    );
                  }}
                >
                  <label>
                    Decision remarks
                    <textarea name="remarks" maxLength={2000} />
                  </label>
                  <div className="form-actions">
                    <select name="decision" aria-label="Decision">
                      <option value="approved">Approve access</option>
                      <option value="rejected">Reject access</option>
                    </select>
                    <button className="button primary" disabled={busy}>
                      Save decision
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {section === 'venues' && (
        <section className="panel detail-panel">
          {result.data.map((venue) => (
            <article className="section-heading" key={venue.venue_id}>
              <div>
                <h3>{venue.venue_name}</h3>
                <p className="muted">
                  {venue.capacity || 'Unspecified'} seats ·{' '}
                  {venue.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => setSelected(venue)}
              >
                Edit
              </button>
            </article>
          ))}
          {selected && (
            <form
              className="booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                mutate(`admin/venues/${selected.venue_id}`, 'PATCH', {
                  venue_name: data.get('name'),
                  capacity: data.get('capacity')
                    ? Number(data.get('capacity'))
                    : null,
                  location_description: data.get('location'),
                  is_active: data.get('active') === 'on',
                  amenities: data
                    .get('amenities')
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                });
              }}
              key={selected.venue_id}
            >
              <h2>Edit {selected.venue_name}</h2>
              <label>
                Name
                <input
                  name="name"
                  defaultValue={selected.venue_name}
                  required
                  maxLength={150}
                />
              </label>
              <label>
                Capacity
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  defaultValue={selected.capacity || ''}
                />
              </label>
              <label>
                Location
                <textarea
                  name="location"
                  defaultValue={selected.location_description || ''}
                />
              </label>
              <label>
                Amenities, separated by commas
                <input
                  name="amenities"
                  defaultValue={selected.amenities.join(', ')}
                />
              </label>
              <label>
                Active
                <input
                  style={{ width: 20 }}
                  type="checkbox"
                  name="active"
                  defaultChecked={selected.is_active}
                />
              </label>
              <button disabled={busy} className="button primary">
                Save venue
              </button>
            </form>
          )}
        </section>
      )}
      {section === 'blackouts' && (
        <>
          <form
            className="panel booking-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              mutate('admin/blackouts', 'POST', {
                venue_id: Number(data.get('venue')),
                start_time: campusTimestamp(
                  data.get('date'),
                  data.get('start'),
                ),
                end_time: campusTimestamp(data.get('endDate'), data.get('end')),
                reason: data.get('reason'),
              });
            }}
          >
            <h2>Mark a venue unavailable</h2>
            <label>
              Venue
              <select name="venue" required>
                {venues.data.map((v) => (
                  <option value={v.venue_id} key={v.venue_id}>
                    {v.venue_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-two-col">
              <label>
                Start date
                <input type="date" name="date" required />
              </label>
              <label>
                Start time (IST)
                <input type="time" name="start" required />
              </label>
              <label>
                End date
                <input type="date" name="endDate" required />
              </label>
              <label>
                End time (IST)
                <input type="time" name="end" required />
              </label>
            </div>
            <label>
              Reason
              <textarea name="reason" required minLength={3} maxLength={2000} />
            </label>
            <button className="button primary" disabled={busy}>
              Block this period
            </button>
          </form>
          <section className="panel detail-panel">
            {result.data.map((b) => (
              <div className="section-heading" key={b.blackout_id}>
                <div>
                  <strong>{b.venue_name}</strong>
                  <p>
                    {dateLabel(b.start_time)} {timeLabel(b.start_time)} –{' '}
                    {dateLabel(b.end_time)} {timeLabel(b.end_time)}
                  </p>
                  <p>{b.reason}</p>
                </div>
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    mutate(`admin/blackouts/${b.blackout_id}`, 'DELETE')
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </section>
        </>
      )}
      {section === 'audit' && (
        <section className="panel detail-panel">
          {result.data.map((row) => (
            <div key={row.event_id}>
              <strong>
                {row.full_name} · {row.action.replaceAll('_', ' ')}
              </strong>
              <p className="muted">
                Target #{row.target_id} · {dateLabel(row.created_at)}{' '}
                {timeLabel(row.created_at)} · {row.details}
              </p>
            </div>
          ))}
        </section>
      )}
      {section === 'bookings' && !result.loading && !result.error && (
        <section className="panel">
          <BookingTable bookings={result.data} role="admin" />
        </section>
      )}
      {['users', 'audit', 'bookings'].includes(section) && (
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={page === 0 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            className="button secondary"
            disabled={result.data.length < 25 || busy}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </PortalLayout>
  );
}
