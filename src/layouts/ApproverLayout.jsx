
import { useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  CalendarDays,
  UserCircle,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Sidebar } from '../components';
import styles from './ApproverLayout.module.css';

const APPROVER_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} /> },
  { id: 'approvals', label: 'Approvals', icon: <CheckSquare size={19} />, badge: 3 },
  { id: 'venues', label: 'Venues', icon: <Building2 size={19} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={19} /> },
];

const NAV_PATHS = {
  overview: '/approver/dashboard',
  approvals: '/approver/approvals',
  venues: '/approver/venues',
  schedule: '/approver/schedule',
};

const ApproverLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeNav = location.pathname.startsWith('/approver/approvals')
    ? 'approvals'
    : location.pathname.startsWith('/approver/schedule')
      ? 'schedule'
      : location.pathname.startsWith('/approver/venues')
        ? 'venues'
        : 'overview';

  const sidebarFooter = (
    <div className={styles.footerNav}>
      <button
        type="button"
        className={`${styles.footerBtn} ${
          location.pathname.startsWith('/approver/settings')
            ? styles.footerBtnActive
            : ''
        }`}
        onClick={() => navigate('/approver/settings')}
        aria-label="Profile and Settings"
      >
        <UserCircle size={19} />
        <span className={styles.footerBtnLabel}>Profile &amp; Settings</span>
      </button>

      <button
        type="button"
        className={styles.footerBtn}
        onClick={() => {
          // Connect sign-out to authentication when it is implemented.
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
        logoIcon={<ShieldCheck size={22} />}
        logoText="VenueFlow"
        items={APPROVER_NAV_ITEMS}
        activeId={activeNav}
        onSelect={(id) => {
          if (NAV_PATHS[id]) {
            navigate(NAV_PATHS[id]);
          }
        }}
        footerSlot={sidebarFooter}
      />

      <div className={styles.mainWrapper}>
        <div className={styles.portalBanner}>
          <span className={styles.portalBannerDot} aria-hidden="true" />
          <span className={styles.portalBannerText}>
            Viewing as Approver portal
          </span>
        </div>

        <main className={styles.mainContent} id="approver-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};

ApproverLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ApproverLayout;

