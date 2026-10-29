import { apiRequest } from './apiClient.js';

const SESSION_KEY = 'venueflow_session_v1';
const TOKEN_KEY = 'venueflow_auth_token_v1';
export const canApprove = (user) =>
  user?.approval_groups?.some((group) => group.can_approve);
export const dashboardForRole = (role) =>
  `/${['approver', 'admin'].includes(role) ? role : 'applicant'}/dashboard`;

export function getSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token || session?.mode !== 'authenticated' || !session.user)
      return null;
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    if (payload.exp * 1000 <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession(user, token, role = 'applicant') {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ mode: 'authenticated', user, role }),
  );
  window.dispatchEvent(new Event('venueflow_auth_changed'));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('venueflow_auth_changed'));
}

export function switchPortal(role) {
  const session = getSession();
  if (session && (role === 'applicant' || canApprove(session.user))) {
    saveSession(session.user, sessionStorage.getItem(TOKEN_KEY), role);
  }
}

export async function authenticate(email, password, role) {
  try {
    const data = await apiRequest('api/v1/auth/login', {
      method: 'POST',
      body: { email, password, role },
    });
    saveSession(data.user, data.access_token, role);
    return { ok: true, user: { ...data.user, role } };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function requestRegistrationOtp(form) {
  try {
    const data = await apiRequest('api/v1/auth/register', {
      method: 'POST',
      body: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: 'applicant',
      },
    });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function verifyRegistrationOtp(email, otp) {
  try {
    const data = await apiRequest('api/v1/auth/verify-otp', {
      method: 'POST',
      body: { email, otp },
    });
    saveSession(data.user, data.access_token);
    return { ok: true, user: { ...data.user, role: 'applicant' } };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export async function resendRegistrationOtp(email) {
  try {
    return {
      ok: true,
      ...(await apiRequest('api/v1/auth/resend-otp', {
        method: 'POST',
        body: { email },
      })),
    };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
