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
  const [step, setStep] = useState(reset ? 'password' : 'email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(query.get('token') || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setError('');
    setMessage('');
    if (
      step === 'password' &&
      data.get('password') !== data.get('confirmPassword')
    ) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (step === 'email') {
        const address = String(data.get('email')).trim().toLowerCase();
        const saved = await apiRequest('api/v1/auth/request-password-otp', {
          method: 'POST',
          body: { email: address },
        });
        setEmail(address);
        setMessage(saved.message);
        setStep('otp');
      } else if (step === 'otp') {
        const saved = await apiRequest('api/v1/auth/verify-password-otp', {
          method: 'POST',
          body: { email, otp: String(data.get('otp')).trim() },
        });
        setToken(saved.token);
        setMessage(saved.message);
        setStep('password');
      } else {
        const saved = await apiRequest('api/v1/auth/reset-password', {
          method: 'POST',
          body: { token, password: data.get('password') },
        });
        setToken('');
        setMessage(saved.message);
        setStep('done');
      }
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
          <h2>
            {step === 'email'
              ? 'Forgot your password?'
              : step === 'otp'
                ? 'Verify your email'
                : step === 'done'
                  ? 'Password updated'
                  : 'Set a new password'}
          </h2>
          {step === 'email' && (
            <p>
              Enter your college email to receive a six-digit verification code.
            </p>
          )}
          {step === 'otp' && (
            <p>Enter the code sent to {email}. It expires in 10 minutes.</p>
          )}
          <form className={styles.form} onSubmit={submit} key={step}>
            {step === 'email' && (
              <div className={styles.field}>
                <label htmlFor="recovery-email">College email</label>
                <div className={styles.inputWrap}>
                  <input
                    id="recovery-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    defaultValue={email}
                  />
                </div>
              </div>
            )}
            {step === 'otp' && (
              <div className={styles.field}>
                <label htmlFor="recovery-otp">Verification code</label>
                <div className={styles.inputWrap}>
                  <input
                    id="recovery-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                  />
                </div>
              </div>
            )}
            {step === 'password' && token && (
              <>
                {[
                  ['password', 'New password'],
                  ['confirmPassword', 'Confirm password'],
                ].map(([name, label]) => (
                  <div className={styles.field} key={name}>
                    <label htmlFor={name}>{label}</label>
                    <div className={styles.inputWrap}>
                      <input
                        id={name}
                        name={name}
                        type="password"
                        required
                        minLength={6}
                        maxLength={72}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
            {step === 'password' && !token && (
              <p role="alert">
                This reset link is missing its token. Request a new verification
                code.
              </p>
            )}
            {message && <p role="status">{message}</p>}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {step !== 'done' && (
              <button
                className={styles.submit}
                disabled={busy || (step === 'password' && !token)}
              >
                {busy
                  ? 'Please wait…'
                  : step === 'email'
                    ? 'Send verification code'
                    : step === 'otp'
                      ? 'Verify code'
                      : 'Update password'}
              </button>
            )}
            {step === 'otp' && (
              <button
                type="button"
                disabled={busy}
                className={styles.textLink}
                onClick={() => {
                  setStep('email');
                  setError('');
                  setMessage('');
                }}
              >
                Change email or request a new code
              </button>
            )}
            {step === 'password' && !token && (
              <Link to="/forgot-password">Request a new code</Link>
            )}
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
