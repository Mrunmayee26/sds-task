import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login.jsx';
import CreateAccount from './pages/CreateAccount.jsx';
import { dashboardForRole, getDemoSession } from './services/demoAuth.js';

// Approver Portal Pages
import ApproverDashboard from './pages/ApproverDashboard.jsx';
import ApproverApprovals from './pages/ApproverApprovals.jsx';
import ApproverSchedule from './pages/ApproverSchedule.jsx';
import ApproverVenues from './pages/ApproverVenues.jsx';
import ApproverSettings from './pages/ApproverSettings.jsx';

// Applicant Portal Pages
import ApplicantDashboard from './pages/ApplicantDashboard.jsx';
import ApplicantVenues from './pages/ApplicantVenues.jsx';
import ApplicantBookVenue from './pages/ApplicantBookVenue.jsx';
import ApplicantApplications from './pages/ApplicantApplications.jsx';
import ApplicantSchedule from './pages/ApplicantSchedule.jsx';
import ApplicantSettings from './pages/ApplicantSettings.jsx';

// Central Data Service
import {
  getAllBookings,
  updateBookingStatus,
} from './services/bookingService';

// Connected Approver Dashboard
const ApproverDashboardRoute = () => {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());

    window.addEventListener('coep_bookings_changed', handleUpdate);

    return () => {
      window.removeEventListener('coep_bookings_changed', handleUpdate);
    };
  }, []);

  const stats = [
    {
      id: 'pending',
      label: 'Pending Approval',
      value: allBookings.filter((b) => b.status === 'Pending').length,
      colorKey: 'amber',
    },
    {
      id: 'approved',
      label: 'Approved Today',
      value: allBookings.filter((b) => b.status === 'Approved').length,
      colorKey: 'green',
    },
    {
      id: 'in-use',
      label: 'Venues in Use',
      value: 7,
      colorKey: 'purple',
    },
    {
      id: 'total',
      label: 'Total Bookings',
      value: allBookings.length,
      colorKey: 'blue',
    },
  ];

  const activity = allBookings.slice(0, 5).map((b) => ({
    id: b.id,
    event: b.eventName,
    venue: b.venue,
    date: b.date,
    status: b.status,
  }));

  return (
    <ApproverDashboard
      stats={stats}
      activity={activity}
      onReviewRequests={() => navigate('/approver/approvals')}
      onViewCalendar={() => navigate('/approver/schedule')}
      onViewAllActivity={() => navigate('/approver/approvals')}
    />
  );
};

// Connected Approver Approvals
const ApproverApprovalsRoute = () => {
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());

    window.addEventListener('coep_bookings_changed', handleUpdate);

    return () => {
      window.removeEventListener('coep_bookings_changed', handleUpdate);
    };
  }, []);

  return (
    <ApproverApprovals
      requests={allBookings}
      onApprove={async (req, notes) => {
        updateBookingStatus(
          req.id,
          'Approved',
          notes,
          'Dr. Sharma (Academic Affairs)'
        );
        return true;
      }}
      onDecline={async (req, notes) => {
        updateBookingStatus(
          req.id,
          'Rejected',
          notes,
          'Dr. Sharma (Academic Affairs)'
        );
        return true;
      }}
    />
  );
};

// Connected Approver Schedule
const ApproverScheduleRoute = () => {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());

    window.addEventListener('coep_bookings_changed', handleUpdate);

    return () => {
      window.removeEventListener('coep_bookings_changed', handleUpdate);
    };
  }, []);

  const scheduleBookings = allBookings.map((b) => ({
    id: b.id,
    eventName: b.eventName,
    venue: b.venue,
    applicant:
      typeof b.applicant === 'string'
        ? b.applicant
        : b.applicant?.name || 'Applicant',
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));

  return (
    <ApproverSchedule
      bookings={scheduleBookings}
      onReviewRequests={() => navigate('/approver/approvals')}
    />
  );
};

function ProtectedRoute({ role, children }) {
  const location = useLocation();
  const session = getDemoSession();
  if (!session) {
    return <Navigate to="/" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (session.role !== role) {
    return <Navigate to={dashboardForRole(session.role)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<CreateAccount />} />

        <Route
          path="/applicant"
          element={<ProtectedRoute role="applicant"><Navigate to="/applicant/dashboard" replace /></ProtectedRoute>}
        />

        {/* Applicant Portal Routes */}
        <Route
          path="/applicant/dashboard"
          element={<ProtectedRoute role="applicant"><ApplicantDashboard /></ProtectedRoute>}
        />
        <Route path="/applicant/venues" element={<ProtectedRoute role="applicant"><ApplicantVenues /></ProtectedRoute>} />
        <Route path="/applicant/book" element={<ProtectedRoute role="applicant"><ApplicantBookVenue /></ProtectedRoute>} />
        <Route
          path="/applicant/applications"
          element={<ProtectedRoute role="applicant"><ApplicantApplications /></ProtectedRoute>}
        />
        <Route
          path="/applicant/schedule"
          element={<ProtectedRoute role="applicant"><ApplicantSchedule /></ProtectedRoute>}
        />
        <Route
          path="/applicant/settings"
          element={<ProtectedRoute role="applicant"><ApplicantSettings /></ProtectedRoute>}
        />

        {/* Approver Portal Routes */}
        <Route
          path="/approver"
          element={<ProtectedRoute role="approver"><Navigate to="/approver/dashboard" replace /></ProtectedRoute>}
        />
        <Route
          path="/approvers"
          element={<ProtectedRoute role="approver"><Navigate to="/approver/dashboard" replace /></ProtectedRoute>}
        />
        <Route
          path="/approver/dashboard"
          element={<ProtectedRoute role="approver"><ApproverDashboardRoute /></ProtectedRoute>}
        />
        <Route
          path="/approver/approvals"
          element={<ProtectedRoute role="approver"><ApproverApprovalsRoute /></ProtectedRoute>}
        />
        <Route
          path="/approver/schedule"
          element={<ProtectedRoute role="approver"><ApproverScheduleRoute /></ProtectedRoute>}
        />
        <Route
          path="/approver/venues"
          element={<ProtectedRoute role="approver"><ApproverVenues /></ProtectedRoute>}
        />

        <Route
          path="/approver/settings"
          element={<ProtectedRoute role="approver"><ApproverSettings /></ProtectedRoute>}
        />

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
