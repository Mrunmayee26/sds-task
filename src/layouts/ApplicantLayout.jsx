import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  LayoutDashboard,
  Building2,
  CalendarPlus,
  ClipboardList,
  CalendarDays,
  UserCircle,
  LogOut,
  GraduationCap,
  Bell,
  ArrowRightLeft,
} from 'lucide-react';
import { Sidebar } from '../components';
import {
  CURRENT_APPLICANT,
  getApplicantBookings,
  getNotifications,
} from '../services/bookingService';
import styles from './ApplicantLayout.module.css';

const ApplicantLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Sync pending count & unread notifications
  useEffect(() => {
    const updateCounts = () => {
      const myBookings = getApplicantBookings();
      const pending = myBookings.filter((b) => b.status === 'Pending').length;
      setPendingCount(pending);

      const notifs = getNotifications();
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadNotifCount(unread);
    };

    updateCounts();

    const handleBookingsChanged = () => updateCounts();
    const handleNotifsChanged = () => updateCounts();

    window.addEventListener('coep_bookings_changed', handleBookingsChanged);
    window.addEventListener('coep_notifications_changed', handleNotifsChanged);

    return () => {
      window.removeEventListener('coep_bookings_changed', handleBookingsChanged);
      window.removeEventListener('coep_notifications_changed', handleNotifsChanged);
    };
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={19} />,
      path: '/applicant/dashboard',
    },
    {
      id: 'venues',
      label: 'Browse Venues',
      icon: <Building2 size={19} />,
      path: '/applicant/venues',
    },
    {
      id: 'book',
      label: 'Book a Venue',
      icon: <CalendarPlus size={19} />,
      path: '/applicant/book',
    },
    {
      id: 'applications',
      label: 'My Applications',
      icon: <ClipboardList size={19} />,
      badge: pendingCount > 0 ? pendingCount : undefined,
      path: '/applicant/applications',
    },
    {
      id: 'schedule',
      label: 'My Schedule',
      icon: <CalendarDays size={19} />,
      path: '/applicant/schedule',
    },
  ];

  // Determine current active item
  const currentPath = location.pathname;
  let activeId = 'dashboard';
  if (currentPath.startsWith('/applicant/venues')) activeId = 'venues';
  else if (currentPath.startsWith('/applicant/book')) activeId = 'book';
  else if (currentPath.startsWith('/applicant/applications')) activeId = 'applications';
  else if (currentPath.startsWith('/applicant/schedule')) activeId = 'schedule';
  else if (currentPath.startsWith('/applicant/settings')) activeId = 'settings';

  const sidebarFooter = (
    <div className={styles.footerNav}>
      <button
        type="button"
        className={`${styles.footerBtn} ${
          activeId === 'settings' ? styles.footerBtnActive : ''
        }`}
        onClick={() => navigate('/applicant/settings')}
        aria-label="Profile and Settings"
      >
        <UserCircle size={19} />
        <span className={styles.footerBtnLabel}>Profile &amp; Settings</span>
      </button>

      <button
        type="button"
        className={styles.footerBtn}
        onClick={() => navigate('/approver/dashboard')}
        aria-label="Switch to Approver Portal"
        title="View system as Approver (Faculty / Academic Affairs)"
      >
        <ArrowRightLeft size={19} />
        <span className={styles.footerBtnLabel}>Approver Portal</span>
      </button>

      <button
        type="button"
        className={styles.footerBtn}
        onClick={() => {
          if (window.confirm('Sign out of COEP Venue Booking System?')) {
            navigate('/applicant/dashboard');
          }
        }}
        aria-label="Sign out"
      >
        <LogOut size={19} />
        <span className={styles.footerBtnLabel}>Sign out</span>
      </button>
    </div>
  );

  return (
    <div className={styles.appShell}>
      <Sidebar
        logoIcon={<GraduationCap size={22} />}
        logoText="COEP VenueFlow"
        items={navItems}
        activeId={activeId}
        onSelect={(id, item) => {
          if (item?.path) {
            navigate(item.path);
          }
        }}
        footerSlot={sidebarFooter}
      />

      <div className={styles.mainWrapper}>
        {/* Top Portal Banner */}
        <header className={styles.portalBanner}>
          <div className={styles.bannerLeft}>
            <span className={styles.portalBannerDot} aria-hidden="true" />
            <span className={styles.portalBannerText}>
              Viewing as Applicant Portal
            </span>
            <span className={styles.bannerSubText}>
              • {CURRENT_APPLICANT.club} ({CURRENT_APPLICANT.name})
            </span>
          </div>

          <div className={styles.bannerRight}>
            <button
              type="button"
              className={styles.switchPortalBtn}
              onClick={() => navigate('/approver/dashboard')}
              title="Test role switching between Applicant and Approver"
            >
              <ArrowRightLeft size={14} />
              Switch to Approver
            </button>

            <button
              type="button"
              className={styles.notifBtn}
              onClick={() => navigate('/applicant/settings')}
              aria-label={`Notifications (${unreadNotifCount} unread)`}
              title="View in-app notifications"
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span className={styles.notifBadge}>{unreadNotifCount}</span>
              )}
            </button>

            <button
              type="button"
              className={styles.userPill}
              onClick={() => navigate('/applicant/settings')}
              aria-label="View user profile"
            >
              <img
                src={CURRENT_APPLICANT.avatar}
                alt={CURRENT_APPLICANT.name}
                className={styles.userAvatar}
              />
              <span className={styles.userName}>{CURRENT_APPLICANT.name}</span>
            </button>
          </div>
        </header>

        <main className={styles.mainContent} id="applicant-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};

ApplicantLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ApplicantLayout;
