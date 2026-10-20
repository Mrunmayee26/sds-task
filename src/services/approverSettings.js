const PROFILE_KEY = 'venueflow_approver_profile_demo_v1';

export const EMPTY_APPROVER_PROFILE = Object.freeze({
  fullName: '',
  department: '',
  designation: '',
  contactNumber: '',
});

function readStoredProfile() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || 'null');
    return parsed && typeof parsed === 'object'
      ? { ...EMPTY_APPROVER_PROFILE, ...parsed }
      : { ...EMPTY_APPROVER_PROFILE };
  } catch {
    return { ...EMPTY_APPROVER_PROFILE };
  }
}

export function getApproverProfile() {
  return readStoredProfile();
}

export function saveApproverProfile(profile) {
  const safeProfile = Object.fromEntries(
    Object.keys(EMPTY_APPROVER_PROFILE).map((key) => [key, String(profile[key] || '').trim()])
  );
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(safeProfile));
  } catch {
    // The page can still use the returned value for the current visit.
  }
  return safeProfile;
}
