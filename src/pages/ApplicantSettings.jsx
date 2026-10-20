import { useEffect, useState } from 'react';
import {
  UserCircle,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import {
  CURRENT_APPLICANT,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/bookingService';
import { useNotifications } from '../hooks/useBookingData';
import styles from './ApplicantSettings.module.css';

const PREFERENCES_KEY = 'coep_venueflow_demo_preferences_v1';
const readPreferences = () => {
  const defaults = { emailDigests: true, eventReminders: true };
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || 'null');
    return {
      emailDigests: typeof saved?.emailDigests === 'boolean' ? saved.emailDigests : defaults.emailDigests,
      eventReminders: typeof saved?.eventReminders === 'boolean' ? saved.eventReminders : defaults.eventReminders,
    };
  } catch {
    return defaults;
  }
};

export default function ApplicantSettings() {
  const notifications = useNotifications();
  const [preferences, setPreferences] = useState(readPreferences);
  const { emailDigests, eventReminders } = preferences;

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences stay usable for this visit when browser storage is unavailable.
    }
  }, [preferences]);

  const handleMarkAsRead = (id) => {
    markNotificationAsRead(id);
  };

  const handleMarkAll = () => {
    markAllNotificationsAsRead();
  };

  return (
    <ApplicantLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>Applicant Profile &amp; Notifications</h1>
          <p className={styles.subtitle}>
            Manage your student credentials, organization contact points, and in-app alert preferences.
          </p>
        </header>

        <div className={styles.grid2}>
          {/* Profile Card */}
          <section className={styles.card} aria-label="Student profile details">
            <div className={styles.cardTitleGroup}>
              <UserCircle size={20} color="var(--color-accent-purple)" />
              <h2 className={styles.cardTitle}>Student &amp; Club Identity</h2>
            </div>

            <div className={styles.avatarRow}>
              <img
                src={CURRENT_APPLICANT.avatar}
                alt={CURRENT_APPLICANT.name}
                className={styles.avatarLarge}
              />
              <div className={styles.avatarInfo}>
                <span className={styles.profileName}>{CURRENT_APPLICANT.name}</span>
                <span className={styles.roleBadge}>{CURRENT_APPLICANT.role}</span>
              </div>
            </div>

            <div className={styles.fieldList}>
              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>Permanent Reg. No (PRN)</span>
                <span className={styles.fieldVal}>{CURRENT_APPLICANT.prn}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>College Email</span>
                <span className={styles.fieldVal}>{CURRENT_APPLICANT.email}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>Academic Department</span>
                <span className={styles.fieldVal}>{CURRENT_APPLICANT.department}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>Affiliated Organization</span>
                <span className={styles.fieldVal}>{CURRENT_APPLICANT.club}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>Emergency Mobile Contact</span>
                <span className={styles.fieldVal}>{CURRENT_APPLICANT.phone}</span>
              </div>
            </div>

            {/* Preferences */}
            <div className={styles.preferencesSection}>
              <h3 className={styles.preferencesTitle}>Notification Preferences</h3>
              <p className={styles.demoNote}>These preferences are saved in this browser for the demo and are not synced to a server.</p>

              <label className={styles.preferenceOption}>
                <input
                  type="checkbox"
                  checked={emailDigests}
                  onChange={(e) => setPreferences((current) => ({ ...current, emailDigests: e.target.checked }))}
                />
                Receive booking decision email alerts
              </label>

              <label className={styles.preferenceOption}>
                <input
                  type="checkbox"
                  checked={eventReminders}
                  onChange={(e) => setPreferences((current) => ({ ...current, eventReminders: e.target.checked }))}
                />
                24-Hour prior venue key collection reminder
              </label>
            </div>
          </section>

          {/* In-App Notifications Center */}
          <section className={styles.card} aria-label="Notifications center">
            <div className={styles.notifHeader}>
              <div className={styles.cardTitleGroup}>
                <Bell size={20} color="var(--color-accent-purple)" />
                <h2 className={styles.cardTitle}>In-App Notifications</h2>
              </div>

              {notifications.some((n) => !n.read) && (
                <button type="button" className={styles.markAllBtn} onClick={handleMarkAll}>
                  Mark all as read
                </button>
              )}
            </div>

            <div className={styles.notifList}>
              {notifications.length === 0 ? (
                <p className={styles.emptyNotifications}>
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n) => {
                  const icon =
                    n.type === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : n.type === 'warning' ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <Info size={16} />
                    );

                  const iconClass =
                    n.type === 'success'
                      ? styles.icon_success
                      : n.type === 'warning'
                      ? styles.icon_warning
                      : styles.icon_info;

                  return (
                    <button
                      type="button"
                      key={n.id}
                      className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}
                      onClick={() => handleMarkAsRead(n.id)}
                      aria-label={`${n.read ? 'Read' : 'Mark as read'}: ${n.title}`}
                    >
                      <div className={`${styles.notifIconWrap} ${iconClass}`}>{icon}</div>

                      <div className={styles.notifContent}>
                        <span className={styles.notifTitle}>{n.title}</span>
                        <p className={styles.notifMessage}>{n.message}</p>
                        <span className={styles.notifDate}>
                          {new Date(n.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {!n.read && <span className={styles.unreadDot} title="Unread" />}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </ApplicantLayout>
  );
}
