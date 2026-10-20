// Development-only role preview. This marker is not identity verification or
// authorization; protected data and actions must be secured by the backend.
const SESSION_KEY = 'venueflow_development_mock_session_v1';
const LEGACY_SESSION_KEY = 'venueflow_demo_session_v1';

// Fictional local UI-test accounts only. These values are shipped to the
// browser and are not secrets or production credentials.
const DEVELOPMENT_TEST_ACCOUNTS = [
  { email: 'applicant@venueflow.test', password: 'ApplicantDemo!42', role: 'applicant' },
  { email: 'approver@venueflow.test', password: 'ApproverDemo!42', role: 'approver' },
];

export function isDevelopmentMockAuthEnabled() {
  const configuredFlag = import.meta.env.VITE_ENABLE_DEMO_AUTH;
  return import.meta.env.DEV && (configuredFlag === undefined || configuredFlag === 'true');
}

/** Replace this development implementation with the FastAPI login service. */
export async function authenticate(email, password, selectedRole) {
  if (!isDevelopmentMockAuthEnabled()) {
    return { ok: false, reason: 'unavailable' };
  }

  const account = DEVELOPMENT_TEST_ACCOUNTS.find(
    (entry) => entry.email === String(email).trim().toLowerCase()
      && entry.password === password
  );
  if (!account) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (account.role !== selectedRole) {
    return { ok: false, reason: 'role_not_allowed' };
  }

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode: 'development-mock', role: account.role }));
    return { ok: true, user: { role: account.role } };
  } catch {
    return { ok: false, reason: 'session_unavailable' };
  }
}

/** Registration stays unavailable until the backend defines a real endpoint. */
export async function registerAccount() {
  return { ok: false, reason: 'not_configured' };
}

/** Returns only a valid development mock marker; production always fails closed. */
export function getDemoSession() {
  if (!isDevelopmentMockAuthEnabled()) {
    clearDemoSession();
    return null;
  }
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return session?.mode === 'development-mock'
      && (session.role === 'applicant' || session.role === 'approver')
      ? { mode: session.mode, role: session.role }
      : null;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // An inaccessible store is treated as signed out by getDemoSession().
  }
}

export const dashboardForRole = (role) =>
  role === 'approver' ? '/approver/dashboard' : '/applicant/dashboard';
