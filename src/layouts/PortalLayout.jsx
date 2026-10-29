import { NavLink, useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserRound,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { canApprove, clearSession, switchPortal } from '../services/auth';
import './Portal.css';

export default function PortalLayout({ children }) {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const role = session.role;
  const reviewer = role === 'approver';
  const links = [
    ['dashboard', 'Overview', LayoutDashboard],
    ['venues', 'Browse venues', Building2],
    ...(!reviewer ? [['book', 'Book a venue', CalendarPlus]] : []),
    [
      reviewer ? 'approvals' : 'applications',
      reviewer ? 'Review requests' : 'My bookings',
      ClipboardList,
    ],
    ['schedule', 'Schedule', CalendarDays],
    ['settings', 'My profile', UserRound],
    ['notifications', 'Notifications', ClipboardList],
    ['access', 'Request reviewer access', UserRound],
  ];
  const navigation =
    role === 'admin'
      ? [
          ['dashboard', 'Overview', LayoutDashboard],
          ['users', 'Users & permissions', UserRound],
          ['requests', 'Reviewer requests', ClipboardList],
          ['venues', 'Manage venues', Building2],
          ['blackouts', 'Unavailable periods', CalendarDays],
          ['bookings', 'All bookings', CalendarDays],
          ['audit', 'Audit trail', ClipboardList],
          ['operations', 'Service health', LayoutDashboard],
          ['settings', 'My profile', UserRound],
        ]
      : links;
  const changePortal = () => {
    const next = reviewer ? 'applicant' : 'approver';
    switchPortal(next);
    navigate(`/${next}/dashboard`);
  };
  return (
    <div className="portal-shell">
      <a className="portal-skip" href="#portal-content">
        Skip to content
      </a>
      <aside className="portal-sidebar">
        <NavLink to={`/${role}/dashboard`} className="portal-brand">
          <Building2 size={26} />{' '}
          <span>
            VenueFlow<small>COEP CAMPUS SPACES</small>
          </span>
        </NavLink>
        <p className="portal-nav-label">
          {role === 'admin'
            ? 'ADMINISTRATOR'
            : reviewer
              ? 'APPROVER WORKSPACE'
              : 'APPLICANT WORKSPACE'}
        </p>
        <nav aria-label="Main navigation">
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/${role}/${path}`}
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="portal-sidebar-footer">
          {canApprove(user) && (
            <button onClick={changePortal}>
              <ArrowRightLeft size={17} />
              Switch to {reviewer ? 'applicant' : 'approver'}
            </button>
          )}
          <button
            onClick={() => {
              clearSession();
              navigate('/', { replace: true });
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
          <p>COEP Technological University</p>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <span>
            {role === 'admin'
              ? 'Administrator'
              : reviewer
                ? 'Approver'
                : 'Applicant'}{' '}
            portal
          </span>
          <NavLink to={`/${role}/settings`}>
            <span className="portal-avatar">
              {user.full_name.slice(0, 1).toUpperCase()}
            </span>
            {user.full_name}
          </NavLink>
        </header>
        <main id="portal-content" className="portal-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
