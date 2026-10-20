import { useState } from 'react';
import { BriefcaseBusiness, Check, Mail, Phone, UserCircle, UserRound } from 'lucide-react';
import ApproverLayout from '../layouts/ApproverLayout';
import { getApproverProfile, saveApproverProfile } from '../services/approverSettings.js';
import styles from './ApproverSettings.module.css';

const validateProfile = (profile) => {
  const errors = {};
  if (!profile.fullName.trim()) errors.fullName = 'Enter your name.';
  if (!profile.department.trim()) errors.department = 'Enter your department.';
  if (!profile.designation.trim()) errors.designation = 'Enter your designation.';
  if (profile.contactNumber && !/^[+\d()\s-]{7,20}$/.test(profile.contactNumber)) {
    errors.contactNumber = 'Enter a valid contact number.';
  }
  return errors;
};

export default function ApproverSettings() {
  const [profile, setProfile] = useState(getApproverProfile);
  const [draft, setDraft] = useState(getApproverProfile);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState('');

  const startEditing = () => {
    setDraft({ ...profile });
    setErrors({});
    setFeedback('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft({ ...profile });
    setErrors({});
    setFeedback('');
    setEditing(false);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = saveApproverProfile(draft);
    setProfile(saved);
    setDraft(saved);
    setEditing(false);
    setFeedback('Profile updated in this browser. Changes have not been sent to a server.');
  };

  const display = (value) => value || 'Not provided';
  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '—';

  return (
    <ApproverLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>Approver Profile &amp; Settings</h1>
          <p className={styles.subtitle}>Manage your staff profile and contact information.</p>
        </header>

        <section className={styles.card} aria-labelledby="approver-info-title">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <UserCircle size={20} aria-hidden="true" />
              <h2 id="approver-info-title" className={styles.cardTitle}>Approver Information</h2>
            </div>
            {!editing && <button type="button" className={styles.secondaryButton} onClick={startEditing}>Edit Profile</button>}
          </div>

          <div className={styles.identityRow}>
            <div className={styles.avatar} aria-label={profile.fullName ? `${profile.fullName} initials` : 'Profile details not provided'}>{initials}</div>
            <div>
              <h3 className={styles.profileName}>{profile.fullName || 'Approver profile not configured'}</h3>
              <span className={styles.roleBadge}>Approver</span>
            </div>
          </div>

          {editing ? (
            <form className={styles.profileForm} onSubmit={saveProfile} noValidate>
              <label className={styles.field}>
                <span>Full name <b aria-hidden="true">*</b></span>
                <input autoComplete="name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'profile-name-error' : undefined} />
                {errors.fullName && <small id="profile-name-error" className={styles.fieldError}>{errors.fullName}</small>}
              </label>
              <label className={styles.field}>
                <span>Official college email</span>
                <input value="Not provided" readOnly aria-readonly="true" />
              </label>
              <label className={styles.field}>
                <span>Employee / staff ID</span>
                <input value="Not provided" readOnly aria-readonly="true" />
              </label>
              <label className={styles.field}>
                <span>Department <b aria-hidden="true">*</b></span>
                <input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} aria-invalid={Boolean(errors.department)} aria-describedby={errors.department ? 'profile-department-error' : undefined} />
                {errors.department && <small id="profile-department-error" className={styles.fieldError}>{errors.department}</small>}
              </label>
              <label className={styles.field}>
                <span>Designation <b aria-hidden="true">*</b></span>
                <input value={draft.designation} onChange={(event) => setDraft({ ...draft, designation: event.target.value })} aria-invalid={Boolean(errors.designation)} aria-describedby={errors.designation ? 'profile-designation-error' : undefined} />
                {errors.designation && <small id="profile-designation-error" className={styles.fieldError}>{errors.designation}</small>}
              </label>
              <label className={styles.field}>
                <span>Contact number</span>
                <input type="tel" autoComplete="tel" value={draft.contactNumber} onChange={(event) => setDraft({ ...draft, contactNumber: event.target.value })} aria-invalid={Boolean(errors.contactNumber)} aria-describedby={errors.contactNumber ? 'profile-contact-error' : undefined} />
                {errors.contactNumber && <small id="profile-contact-error" className={styles.fieldError}>{errors.contactNumber}</small>}
              </label>
              <div className={styles.formActions}>
                <button type="button" className={styles.secondaryButton} onClick={cancelEditing}>Cancel</button>
                <button type="submit" className={styles.primaryButton}><Check size={16} aria-hidden="true" /> Save Profile</button>
              </div>
            </form>
          ) : (
            <dl className={styles.profileGrid}>
              <div className={styles.detail}><dt><Mail size={14} aria-hidden="true" /> Official college email</dt><dd>{display(null)}</dd></div>
              <div className={styles.detail}><dt><UserRound size={14} aria-hidden="true" /> Employee / staff ID</dt><dd>{display(null)}</dd></div>
              <div className={styles.detail}><dt><BriefcaseBusiness size={14} aria-hidden="true" /> Department</dt><dd>{display(profile.department)}</dd></div>
              <div className={styles.detail}><dt><BriefcaseBusiness size={14} aria-hidden="true" /> Designation</dt><dd>{display(profile.designation)}</dd></div>
              <div className={styles.detail}><dt><Phone size={14} aria-hidden="true" /> Contact number</dt><dd>{display(profile.contactNumber)}</dd></div>
            </dl>
          )}
          {feedback && <p className={styles.successMessage} role="status">{feedback}</p>}
          <p className={styles.demoNote}>Profile details are optional development data stored in this browser only. They do not change account permissions or sync to a server.</p>
        </section>

      </div>
    </ApproverLayout>
  );
}
