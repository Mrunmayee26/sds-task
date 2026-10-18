import PropTypes from 'prop-types';
import {
  GraduationCap,
  LayoutDashboard,
  CalendarPlus,
  Users,
  Calendar,
  Settings,
  HelpCircle,
} from 'lucide-react';
import styles from './Sidebar.module.css';

/**
 * Returns an appropriate icon based on the navigation item's label or id
 */
const getDefaultIcon = (identifier) => {
  const key = String(identifier || '').toLowerCase().trim();
  if (key.includes('dash')) {
    return <LayoutDashboard size={19} />;
  }
  if (key.includes('book')) {
    return <CalendarPlus size={19} />;
  }
  if (key.includes('request') || key.includes('my-requests')) {
    return <Users size={19} />;
  }
  if (key.includes('cal')) {
    return <Calendar size={19} />;
  }
  if (key.includes('set')) {
    return <Settings size={19} />;
  }
  return <HelpCircle size={19} />;
};

/**
 * Sidebar - Left-hand navigation column for Campus Hub.
 * Features the CAMPUS HUB logo header, purple active item styling, and responsive support.
 */
const Sidebar = ({
  items = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'book-venue', label: 'Book a Venue' },
    { id: 'my-requests', label: 'My Requests' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'settings', label: 'Settings' },
  ],
  activeId = 'book-venue',
  onSelect,
  logoText = '',
  logoIcon,
  footerSlot,
  className = '',
  ...rest
}) => {
  return (
    <aside className={`${styles.sidebar} ${className}`.trim()} {...rest}>
      {/* Brand Header */}
      <div className={styles.logoHeader}>
        <div className={styles.logoIcon}>
          {logoIcon || <GraduationCap size={22} />}
        </div>
        {logoText ? <span className={styles.logoText}>{logoText}</span> : null}
      </div>

      {/* Navigation Items */}
      <nav aria-label="Main Navigation" style={{ flex: 1, display: 'flex' }}>
        <ul className={styles.navList}>
          {items.map((item, index) => {
            const itemData =
              typeof item === 'string'
                ? { id: item.toLowerCase().replace(/\s+/g, '-'), label: item }
                : item;

            const itemId = itemData.id || `nav-${index}`;
            const isActive = itemId === activeId || itemData.label === activeId;
            const iconElement = itemData.icon || getDefaultIcon(itemData.id || itemData.label);

            return (
              <li key={itemId} className={styles.navItem}>
                <button
                  type="button"
                  className={`${styles.navButton} ${isActive ? styles.active : ''}`}
                  onClick={() => onSelect && onSelect(itemId, itemData)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className={styles.navIcon}>{iconElement}</span>
                  <span className={styles.navLabel}>{itemData.label}</span>
                  {itemData.badge && (
                    <span className={styles.badge}>{itemData.badge}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Optional Footer Slot */}
      {footerSlot && <div className={styles.footerArea}>{footerSlot}</div>}
    </aside>
  );
};

Sidebar.propTypes = {
  /**
   * Array of navigation items.
   * Can be strings `['Dashboard', 'Book a Venue']` or objects:
   * `[{ id: 'book-venue', label: 'Book a Venue', icon: <CustomIcon />, badge: 'New' }]`
   */
  items: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        icon: PropTypes.node,
        badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      }),
    ])
  ),
  /** The id or label of the currently active navigation item */
  activeId: PropTypes.string,
  /** Callback fired when a navigation item is clicked: (id, item) => void */
  onSelect: PropTypes.func,
  /** Title text for the brand logo */
  logoText: PropTypes.string,
  /** Custom ReactNode for the logo icon (defaults to GraduationCap) */
  logoIcon: PropTypes.node,
  /** Content placed in the sidebar footer (e.g. user profile, logout button) */
  footerSlot: PropTypes.node,
  /** Extra CSS class */
  className: PropTypes.string,
};

export default Sidebar;
