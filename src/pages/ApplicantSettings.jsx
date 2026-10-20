import { useState, useEffect } from 'react';
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
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/bookingService';
import styles from './ApplicantSettings.module.css';

export default function ApplicantSettings() {
  const [notifications, setNotifications] = useState([]);
  const [emailDigests, setEmailDigests] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);

  useEffect(() => {
    const load = () => {
      setNotifications(getNotifications());
    };
    load();

    const handler = () => load();
    window.addEventListener('coep_notifications_changed', handler);
    return () => window.removeEventListener('coep_notifications_changed', handler);
  }, []);

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
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 16 }}>
              <span className={styles.fieldLabel} style={{ marginBottom: 10, display: 'block' }}>
                Notification Preferences
              </span>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13.5px', marginBottom: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emailDigests}
                  onChange={(e) => setEmailDigests(e.target.checked)}
                  style={{ accentColor: 'var(--color-accent-purple)', width: 16, height: 16 }}
                />
                Receive booking decision email alerts
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={eventReminders}
                  onChange={(e) => setEventReminders(e.target.checked)}
                  style={{ accentColor: 'var(--color-accent-purple)', width: 16, height: 16 }}
                />
                24-Hour prior venue key collection reminder
              </label>
            </div>
          </section>

          {/* In-App Notifications Center */}
          <section className={styles.card} aria-label="Notifications center">
            <div className={styles.notifHeader}>
              <div className={styles.cardTitleGroup} style={{ borderBottom: 'none', paddingBottom: 0 }}>
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
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '30px 0' }}>
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
                    <div
                      key={n.id}
                      className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}
                      onClick={() => handleMarkAsRead(n.id)}
                      style={{ cursor: 'pointer' }}
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
                    </div>
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
