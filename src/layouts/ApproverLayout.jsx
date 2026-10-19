import { useState } from 'react';
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

/**
 * Navigation items for the main section of the Approver sidebar.
 * The badge on "Approvals" shows the current pending-approval count.
 */
const APPROVER_NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',  icon: <LayoutDashboard size={19} /> },
  { id: 'approvals', label: 'Approvals', icon: <CheckSquare size={19} />, badge: 3 },
  { id: 'venues',    label: 'Venues',    icon: <Building2 size={19} /> },
  { id: 'schedule',  label: 'Schedule',  icon: <CalendarDays size={19} /> },
];

/**
 * ApproverLayout
 *
 * A reusable shell for all Approver-role pages. Composes the existing
 * Sidebar component with Approver-specific navigation, branding, and a
 * scrollable main content region that renders the `children` prop.
 *
 * React Router integration: replace the `activeNav` useState with
 * `useLocation()` / `<NavLink>` when routing is added. The `onSelect`
 * callback already provides the item `id` needed to drive navigation.
 *
 * @param {React.ReactNode} children - Page content rendered inside the layout.
 */
const ApproverLayout = ({ children }) => {
  const [activeNav, setActiveNav] = useState('overview');

  /**
   * Footer slot rendered at the bottom of the sidebar.
   * Uses inline layout only — all colour tokens come from index.css.
   */
  const sidebarFooter = (
    <div className={styles.footerNav}>
      <button
        type="button"
        className={`${styles.footerBtn} ${activeNav === 'profile' ? styles.footerBtnActive : ''}`}
        onClick={() => setActiveNav('profile')}
        aria-label="Profile and Settings"
      >
        <UserCircle size={19} />
        <span className={styles.footerBtnLabel}>Profile &amp; Settings</span>
      </button>

      <button
        type="button"
        className={styles.footerBtn}
        onClick={() => {
          /* Sign-out handler: wire to auth provider when available */
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
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <Sidebar
        logoIcon={<ShieldCheck size={22} />}
        logoText="VenueFlow"
        items={APPROVER_NAV_ITEMS}
        activeId={activeNav}
        onSelect={(id) => setActiveNav(id)}
        footerSlot={sidebarFooter}
      />

      {/* ── Main region ─────────────────────────────────────────────── */}
      <div className={styles.mainWrapper}>
        {/* Portal identity banner — sits just below the sidebar header visually */}
        <div className={styles.portalBanner}>
          <span className={styles.portalBannerDot} aria-hidden="true" />
          <span className={styles.portalBannerText}>Viewing as Approver portal</span>
        </div>

        {/* Scrollable page content */}
        <main className={styles.mainContent} id="approver-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};

ApproverLayout.propTypes = {
  /** Page-level content — headings, tables, cards etc. */
  children: PropTypes.node.isRequired,
};

export default ApproverLayout;
