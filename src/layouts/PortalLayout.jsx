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
  ];
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
          {reviewer ? 'APPROVER WORKSPACE' : 'APPLICANT WORKSPACE'}
        </p>
        <nav aria-label="Main navigation">
          {links.map(([path, label, Icon]) => (
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
          <span>{reviewer ? 'Approver' : 'Applicant'} portal</span>
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
