import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  BadgeCheck,
  Eye,
  EyeOff,
  IdCard,
  LockKeyhole,
  Mail,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';
import { AuthBrandPanel } from '../components';
import { dashboardForRole, getDemoSession, registerAccount } from '../services/demoAuth.js';
import authStyles from './Login.module.css';
import styles from './CreateAccount.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateForm = (form) => {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!form.email.trim()) errors.email = 'Enter your college email.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.identifier.trim()) errors.identifier = 'Enter your student or employee ID.';
  if (!form.password) errors.password = 'Enter a password.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};

export default function CreateAccount() {
  const session = getDemoSession();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    identifier: '',
    password: '',
    confirmPassword: '',
  });
  const [role, setRole] = useState('applicant');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) return <Navigate to={dashboardForRole(session.role)} replace />;

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setFeedback('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback('');
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // No registration endpoint is defined yet. Do not send or persist these
      // values until the backend team supplies its request contract.
      const result = await registerAccount();
      if (!result.ok) {
        setFeedback('Account registration is not available yet. The backend registration service has not been connected, and your details were not saved.');
      }
    } catch {
      setFeedback('Registration could not be completed. Please try again later. Your details were not saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (name) => errors[name]
    ? <span className={styles.fieldError} id={`register-${name}-error`} role="alert">{errors[name]}</span>
    : null;

  return (
    <main className={styles.page}>
      <AuthBrandPanel />
      <section className={`${authStyles.formPanel} ${styles.formPanel}`} aria-labelledby="create-account-title">
        <div className={`${authStyles.formContent} ${styles.formContent}`}>
          <p className={authStyles.welcomeLabel}>CREATE YOUR ACCOUNT</p>
          <h2 id="create-account-title">Join your campus workspace</h2>
          <p className={authStyles.formSubtitle}>Register with your official college email address.</p>

          <form className={`${authStyles.form} ${styles.registerForm}`} onSubmit={handleSubmit} noValidate>
            <div className={styles.nameFields}>
              <div className={authStyles.field}>
                <label htmlFor="register-first-name">First name</label>
                <div className={authStyles.inputWrap}>
                  <UserRound size={17} aria-hidden="true" />
                  <input id="register-first-name" name="firstName" autoComplete="given-name" placeholder="First name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'register-firstName-error' : undefined} />
                </div>
                {fieldError('firstName')}
              </div>
              <div className={authStyles.field}>
                <label htmlFor="register-last-name">Last name</label>
                <div className={authStyles.inputWrap}>
                  <UserRound size={17} aria-hidden="true" />
                  <input id="register-last-name" name="lastName" autoComplete="family-name" placeholder="Last name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'register-lastName-error' : undefined} />
                </div>
                {fieldError('lastName')}
              </div>
            </div>

            <div className={authStyles.field}>
              <label htmlFor="register-email">College email</label>
              <div className={authStyles.inputWrap}>
                <Mail size={17} aria-hidden="true" />
                <input id="register-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" value={form.email} onChange={(event) => updateField('email', event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} />
              </div>
              {fieldError('email')}
            </div>

            <div className={authStyles.field}>
              <label htmlFor="register-identifier">Student / employee ID</label>
              <div className={authStyles.inputWrap}>
                <IdCard size={17} aria-hidden="true" />
                <input id="register-identifier" name="identifier" autoComplete="off" placeholder="Enter your ID" value={form.identifier} onChange={(event) => updateField('identifier', event.target.value)} aria-invalid={Boolean(errors.identifier)} aria-describedby={errors.identifier ? 'register-identifier-error' : undefined} />
              </div>
              {fieldError('identifier')}
            </div>

            <div className={styles.passwordFields}>
              <div className={authStyles.field}>
                <label htmlFor="register-password">Password</label>
                <div className={authStyles.inputWrap}>
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => updateField('password', event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} />
                  <button className={authStyles.showPassword} type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                {fieldError('password')}
              </div>
              <div className={authStyles.field}>
                <label htmlFor="register-confirm-password">Confirm password</label>
                <div className={authStyles.inputWrap}>
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input id="register-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'register-confirmPassword-error' : undefined} />
                  <button className={authStyles.showPassword} type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                {fieldError('confirmPassword')}
              </div>
            </div>

            <fieldset className={authStyles.roleFieldset}>
              <legend>Account role</legend>
              <div className={authStyles.roleOptions}>
                <label className={`${authStyles.roleCard} ${role === 'applicant' ? authStyles.roleCardSelected : ''}`}>
                  <input className={authStyles.roleRadio} type="radio" name="role" value="applicant" checked={role === 'applicant'} onChange={() => setRole('applicant')} />
                  <span className={authStyles.roleIcon}><UserRound size={18} aria-hidden="true" /></span>
                  <span className={authStyles.roleCopy}><strong>Applicant</strong><small>Book spaces</small></span>
                </label>
                <label className={`${authStyles.roleCard} ${role === 'approver' ? authStyles.roleCardSelected : ''}`}>
                  <input className={authStyles.roleRadio} type="radio" name="role" value="approver" checked={role === 'approver'} onChange={() => setRole('approver')} />
                  <span className={authStyles.roleIcon}><BadgeCheck size={18} aria-hidden="true" /></span>
                  <span className={authStyles.roleCopy}><strong>Approver</strong><small>Review requests</small></span>
                </label>
              </div>
              <p className={styles.roleNotice}><strong>Approver access requires administrator approval.</strong> Choosing this role does not grant approval privileges.</p>
            </fieldset>

            {feedback && <p className={authStyles.error} role="alert">{feedback}</p>}
            <button className={authStyles.submit} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Create account'}
              {!isSubmitting && <UserRoundPlus size={17} aria-hidden="true" />}
            </button>
          </form>

          <p className={styles.signInLink}>Already have an account? <Link to="/" className={authStyles.textLink}>Sign in</Link></p>
          <p className={authStyles.demoDisclaimer}>Registration is not connected to the backend. Form details are not saved.</p>
        </div>
      </section>
    </main>
  );
}
