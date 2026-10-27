import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import AuthProvider from './components/Auth/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { clearSession, dashboardForRole } from './services/auth';
import Login from './pages/Login';
import CreateAccount from './pages/CreateAccount';
import {
  Dashboard,
  Venues,
  Bookings,
  Schedule,
  Profile,
} from './pages/PortalPages';
import BookVenue from './pages/BookVenue';
import BookingDetails from './pages/BookingDetails';
import './layouts/Portal.css';

function ProtectedRoute({ role, children }) {
  const { session, loading, error, retry } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="session-state" role="status">
        Checking your account…
      </div>
    );
  if (!session)
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (error)
    return (
      <div className="session-state" role="alert">
        <p>{error}</p>
        <button onClick={retry}>Try again</button>
        <button onClick={clearSession}>Return to sign in</button>
      </div>
    );
  if (session.role !== role)
    return <Navigate to={dashboardForRole(session.role)} replace />;
  return (
    <div style={{ width: '100%' }} key={`${session.user.user_id}/${role}`}>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<CreateAccount />} />
          {['applicant', 'approver'].map((role) => (
            <Route key={role} path={`/${role}`}>
              <Route
                index
                element={
                  <ProtectedRoute role={role}>
                    <Navigate to={`/${role}/dashboard`} replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute role={role}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="venues"
                element={
                  <ProtectedRoute role={role}>
                    <Venues />
                  </ProtectedRoute>
                }
              />
              <Route
                path={role === 'approver' ? 'approvals' : 'applications'}
                element={
                  <ProtectedRoute role={role}>
                    <Bookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bookings/:bookingId"
                element={
                  <ProtectedRoute role={role}>
                    <BookingDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="schedule"
                element={
                  <ProtectedRoute role={role}>
                    <Schedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute role={role}>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="book"
                element={
                  <ProtectedRoute role={role}>
                    <BookVenue />
                  </ProtectedRoute>
                }
              />
            </Route>
          ))}
          <Route
            path="/approvers"
            element={<Navigate to="/approver/dashboard" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
