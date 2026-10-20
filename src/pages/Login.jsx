import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';
import {
  authenticate,
  dashboardForRole,
  getDemoSession,
  isDevelopmentMockAuthEnabled,
} from '../services/demoAuth.js';
import { AuthBrandPanel } from '../components';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentSession = getDemoSession();
  const mockAuthEnabled = isDevelopmentMockAuthEnabled();
  const [role, setRole] = useState('applicant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentSession) return <Navigate to={dashboardForRole(currentSession.role)} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your college email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!mockAuthEnabled) {
      setError('Backend authentication is not configured for this build.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticate(email, password, role);
      if (!result.ok) {
        const messages = {
          invalid_credentials: 'Invalid email or password. Please try again.',
          role_not_allowed: 'Your account does not have access to the selected role.',
          session_unavailable: 'This browser could not save the temporary development session.',
          unavailable: 'Backend authentication is not configured for this build.',
        };
        setError(messages[result.reason] || 'Unable to sign in. Please try again.');
        return;
      }

      setPassword('');
      const requestedPath = location.state?.from;
      const authenticatedRole = result.user.role;
      const rolePrefix = authenticatedRole === 'approver' ? '/approver' : '/applicant';
      navigate(
        typeof requestedPath === 'string' && requestedPath.startsWith(`${rolePrefix}/`)
          ? requestedPath
          : dashboardForRole(authenticatedRole),
        { replace: true }
      );
    } catch (authError) {
      setError(authError.message || 'Unable to start the development preview.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <AuthBrandPanel />

      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.formContent}>
          <p className={styles.welcomeLabel}>WELCOME BACK</p>
          <h2 id="login-title">Sign in to VenueFlow</h2>
          <p className={styles.formSubtitle}>
            {mockAuthEnabled
              ? 'Use your local development test account to continue.'
              : 'Backend sign-in is not configured in this build.'}
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="login-email">College email</label>
              <div className={styles.inputWrap}>
                <Mail size={17} aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.inputWrap}>
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  className={styles.showPassword}
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <fieldset className={styles.roleFieldset}>
              <legend>Sign in as</legend>
              <div className={styles.roleOptions}>
                <label className={`${styles.roleCard} ${role === 'applicant' ? styles.roleCardSelected : ''}`}>
                  <input
                    className={styles.roleRadio}
                    type="radio"
                    name="role"
                    value="applicant"
                    checked={role === 'applicant'}
                    onChange={() => { setRole('applicant'); setError(''); }}
                  />
                  <span className={styles.roleIcon}><UserRound size={18} aria-hidden="true" /></span>
                  <span className={styles.roleCopy}><strong>Applicant</strong><small>Book spaces</small></span>
                </label>
                <label className={`${styles.roleCard} ${role === 'approver' ? styles.roleCardSelected : ''}`}>
                  <input
                    className={styles.roleRadio}
                    type="radio"
                    name="role"
                    value="approver"
                    checked={role === 'approver'}
                    onChange={() => { setRole('approver'); setError(''); }}
                  />
                  <span className={styles.roleIcon}><BadgeCheck size={18} aria-hidden="true" /></span>
                  <span className={styles.roleCopy}><strong>Approver</strong><small>Review requests</small></span>
                </label>
              </div>
            </fieldset>

            <div className={styles.formOptions}>
              <label className={styles.keepSignedIn}>
                <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} aria-describedby="session-note" />
                <span>Keep me signed in</span>
              </label>
            </div>
            <p className={styles.sessionNote} id="session-note">
              {mockAuthEnabled
                ? 'Development-only mock accounts; this is not real authentication. Sessions last for this tab.'
                : 'The development role preview is disabled. Login will be available when backend authentication is connected.'}
            </p>

            {error && <p className={styles.error} id="login-error" role="alert">{error}</p>}

            <button className={styles.submit} type="submit" disabled={!mockAuthEnabled || isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'} <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>

          <p className={styles.createAccount}>
            New to VenueFlow?{' '}
            <Link to="/register" className={styles.textLink}>
              Create an account
            </Link>
          </p>
          <p className={styles.demoDisclaimer}>
            {mockAuthEnabled
              ? 'Local development preview only. This is not secure authentication.'
              : 'Authentication is unavailable until the backend login service is connected.'}
          </p>
        </div>
      </section>
    </main>
  );
}
