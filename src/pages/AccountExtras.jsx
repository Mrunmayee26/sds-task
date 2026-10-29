import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient';
import { useApiData } from '../hooks/useApiData';
import PortalLayout from '../layouts/PortalLayout';
import { PageHeading, DataState } from '../components/BookingUI';
import { dateLabel, timeLabel } from '../services/format';
import { AuthBrandPanel } from '../components';
import styles from './Login.module.css';

export function Recovery({ reset = false }) {
  const [query] = useSearchParams();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(e.currentTarget);
    try {
      const result = await apiRequest(
        `api/v1/auth/${reset ? 'reset-password' : 'forgot-password'}`,
        {
          method: 'POST',
          body: reset
            ? {
                token: query.get('token') || '',
                password: data.get('password'),
              }
            : { email: data.get('email') },
        },
      );
      setMessage(result.message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <AuthBrandPanel />
      <section className={styles.formPanel}>
        <div className={styles.formContent}>
          <h2>{reset ? 'Set a new password' : 'Forgot your password?'}</h2>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor="recovery-field">
                {reset ? 'New password' : 'College email'}
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="recovery-field"
                  name={reset ? 'password' : 'email'}
                  type={reset ? 'password' : 'email'}
                  minLength={reset ? 6 : undefined}
                  maxLength={reset ? 72 : 254}
                  required
                  autoComplete={reset ? 'new-password' : 'email'}
                />
              </div>
            </div>
            {message && <p role="status">{message}</p>}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button className={styles.submit} disabled={busy}>
              {busy
                ? 'Sending…'
                : reset
                  ? 'Update password'
                  : 'Send recovery link'}
            </button>
            <Link to="/">Back to sign in</Link>
          </form>
        </div>
      </section>
    </main>
  );
}

export function AccessRequests() {
  const groups = useApiData('groups');
  const requests = useApiData('approver-requests');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await apiRequest('api/v1/approver-requests', {
        method: 'POST',
        body: {
          access_id: Number(data.get('group')),
          reason: data.get('reason'),
        },
      });
      requests.refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalLayout>
      <PageHeading title="Request reviewer access.">
        Create and verify your account first. An administrator reviews each
        group request before granting permissions.
      </PageHeading>
      <DataState {...groups} />
      <form className="panel booking-form" onSubmit={submit}>
        <label>
          Approval group
          <select required name="group">
            {groups.data.map((group) => (
              <option value={group.access_id} key={group.access_id}>
                {group.group_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position and reason for access
          <textarea required name="reason" minLength={10} maxLength={2000} />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || !groups.data.length}
        >
          Submit access request
        </button>
      </form>
      <DataState {...requests} />
      <section className="panel detail-panel">
        <h2>Your access requests</h2>
        {!requests.data.length && <p>No requests yet.</p>}
        {requests.data.map((row) => (
          <div key={row.request_id}>
            <strong>
              {row.group_name} · {row.status}
            </strong>
            <p>{row.remarks || row.reason}</p>
          </div>
        ))}
      </section>
    </PortalLayout>
  );
}

export function Notifications() {
  const [page, setPage] = useState(0);
  const result = useApiData(`notifications?limit=25&offset=${page * 25}`);
  const [error, setError] = useState('');
  return (
    <PortalLayout>
      <PageHeading title="Notifications.">
        Booking updates and approval reminders.
      </PageHeading>
      <DataState {...result} />
      {error && <p role="alert">{error}</p>}
      <section className="panel detail-panel">
        {!result.loading && !result.data.length && <p>No notifications.</p>}
        {result.data.map((row) => (
          <article className="section-heading" key={row.notification_id}>
            <div>
              <p>{row.message}</p>
              <small>
                {dateLabel(row.created_at)} {timeLabel(row.created_at)}
              </small>
            </div>
            {!row.read_at && (
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    await apiRequest(
                      `api/v1/notifications/${row.notification_id}/read`,
                      { method: 'POST' },
                    );
                    result.refresh();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Mark read
              </button>
            )}
          </article>
        ))}
      </section>
      <div className="form-actions">
        <button
          className="button secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
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
