import { apiRequest } from './apiClient.js';

const SESSION_KEY = 'venueflow_session_v1';
const LEGACY_SESSION_KEY = 'venueflow_development_mock_session_v1';
const TOKEN_KEY = 'venueflow_auth_token_v1';

// Fictional fallback test accounts for offline UI preview
const DEVELOPMENT_TEST_ACCOUNTS = [
  { email: 'applicant@venueflow.test', password: 'ApplicantDemo!42', role: 'applicant' },
  { email: 'approver@venueflow.test', password: 'ApproverDemo!42', role: 'approver' },
];

export function isDevelopmentMockAuthEnabled() {
  const configuredFlag = import.meta.env.VITE_ENABLE_DEMO_AUTH;
  return import.meta.env.DEV && (configuredFlag === undefined || configuredFlag === 'true');
}

/** Authenticate user via FastAPI backend; falls back to offline dev mock if API is down. */
export async function authenticate(email, password, selectedRole) {
  try {
    const data = await apiRequest('api/v1/auth/login', {
      method: 'POST',
      body: { email, password, role: selectedRole },
    });

    if (data?.access_token) {
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        mode: 'authenticated',
        role: data.user.user_type,
        user: data.user,
      }));
      return { ok: true, user: { role: data.user.user_type, ...data.user } };
    }
    return { ok: false, reason: 'invalid_credentials' };
  } catch (err) {
    if (err.status === 401) {
      return { ok: false, reason: 'invalid_credentials' };
    }
    if (err.status === 403) {
      return { ok: false, reason: 'role_not_allowed' };
    }

    // If API connection failed and mock auth is enabled, attempt offline mock
    if (isDevelopmentMockAuthEnabled()) {
      const account = DEVELOPMENT_TEST_ACCOUNTS.find(
        (entry) => entry.email === String(email).trim().toLowerCase()
          && entry.password === password
      );
      if (!account) return { ok: false, reason: 'invalid_credentials' };
      if (account.role !== selectedRole) return { ok: false, reason: 'role_not_allowed' };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode: 'development-mock', role: account.role }));
      return { ok: true, user: { role: account.role } };
    }

    return { ok: false, reason: 'unavailable', message: err.message };
  }
}

/** Step 1: Request 6-digit OTP for email verification */
export async function requestRegistrationOtp(formData, selectedRole = 'applicant') {
  try {
    const data = await apiRequest('api/v1/auth/register', {
      method: 'POST',
      body: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: selectedRole,
        identifier: formData.identifier,
      },
    });

    return {
      ok: true,
      status: data.status,
      message: data.message,
      email: data.email,
    };
  } catch (err) {
    if (err.status === 409) {
      return { ok: false, reason: 'email_exists', message: 'An account with this email address already exists.' };
    }
    return { ok: false, reason: 'unavailable', message: err.message || 'Registration service could not be reached.' };
  }
}

/** Step 2: Verify OTP and finalize registration */
export async function verifyRegistrationOtp(email, otp) {
  try {
    const data = await apiRequest('api/v1/auth/verify-otp', {
      method: 'POST',
      body: { email, otp },
    });

    if (data?.access_token) {
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        mode: 'authenticated',
        role: data.user.user_type,
        user: data.user,
      }));
      return { ok: true, user: { role: data.user.user_type, ...data.user } };
    }
    return { ok: false, reason: 'invalid_response', message: 'Failed to receive session token.' };
  } catch (err) {
    return {
      ok: false,
      reason: 'verification_failed',
      message: err.message || 'Invalid or expired verification code.',
    };
  }
}

/** Resend fresh OTP code */
export async function resendRegistrationOtp(email) {
  try {
    const data = await apiRequest('api/v1/auth/resend-otp', {
      method: 'POST',
      body: { email },
    });
    return {
      ok: true,
      message: data.message,
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message || 'Could not resend verification code. Please try again.',
    };
  }
}

/** Legacy wrapper */
export async function registerAccount(formData, selectedRole = 'applicant') {
  return requestRegistrationOtp(formData, selectedRole);
}

/** Returns the active session if authenticated or in dev mode. */
export function getDemoSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.role === 'applicant' || session?.role === 'approver'
      ? { mode: session.mode, role: session.role, user: session.user }
      : null;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

export const dashboardForRole = (role) =>
  role === 'approver' ? '/approver/dashboard' : '/applicant/dashboard';
