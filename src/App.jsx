import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './App.css';

// Approver Portal Pages
import ApproverDashboard from './pages/ApproverDashboard.jsx';
import ApproverApprovals from './pages/ApproverApprovals.jsx';
import ApproverSchedule from './pages/ApproverSchedule.jsx';

// Applicant Portal Pages
import ApplicantDashboard from './pages/ApplicantDashboard.jsx';
import ApplicantVenues from './pages/ApplicantVenues.jsx';
import ApplicantBookVenue from './pages/ApplicantBookVenue.jsx';
import ApplicantApplications from './pages/ApplicantApplications.jsx';
import ApplicantSchedule from './pages/ApplicantSchedule.jsx';
import ApplicantSettings from './pages/ApplicantSettings.jsx';

// Central Data Service
import { getAllBookings, updateBookingStatus } from './services/bookingService';

/**
 * Connected Approver Dashboard Route
 */
const ApproverDashboardRoute = () => {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());
    window.addEventListener('coep_bookings_changed', handleUpdate);
    return () => window.removeEventListener('coep_bookings_changed', handleUpdate);
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

/**
 * Connected Approver Approvals Route
 */
const ApproverApprovalsRoute = () => {
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());
    window.addEventListener('coep_bookings_changed', handleUpdate);
    return () => window.removeEventListener('coep_bookings_changed', handleUpdate);
  }, []);

  return (
    <ApproverApprovals
      requests={allBookings}
      onApprove={async (req, notes) => {
        updateBookingStatus(req.id, 'Approved', notes, 'Dr. Sharma (Academic Affairs)');
        return true;
      }}
      onDecline={async (req, notes) => {
        updateBookingStatus(req.id, 'Rejected', notes, 'Dr. Sharma (Academic Affairs)');
        return true;
      }}
    />
  );
};

/**
 * Connected Approver Schedule Route
 */
const ApproverScheduleRoute = () => {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState(() => getAllBookings());

  useEffect(() => {
    const handleUpdate = () => setAllBookings(getAllBookings());
    window.addEventListener('coep_bookings_changed', handleUpdate);
    return () => window.removeEventListener('coep_bookings_changed', handleUpdate);
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default Landing: Applicant Dashboard */}
        <Route path="/" element={<Navigate to="/applicant/dashboard" replace />} />
        <Route path="/applicant" element={<Navigate to="/applicant/dashboard" replace />} />

        {/* Applicant Portal Routes */}
        <Route path="/applicant/dashboard" element={<ApplicantDashboard />} />
        <Route path="/applicant/venues" element={<ApplicantVenues />} />
        <Route path="/applicant/book" element={<ApplicantBookVenue />} />
        <Route path="/applicant/applications" element={<ApplicantApplications />} />
        <Route path="/applicant/schedule" element={<ApplicantSchedule />} />
        <Route path="/applicant/settings" element={<ApplicantSettings />} />

        {/* Approver Portal Routes */}
        <Route path="/approver" element={<Navigate to="/approver/dashboard" replace />} />
        <Route path="/approvers" element={<Navigate to="/approver/dashboard" replace />} />
        <Route path="/approver/dashboard" element={<ApproverDashboardRoute />} />
        <Route path="/approver/approvals" element={<ApproverApprovalsRoute />} />
        <Route path="/approver/schedule" element={<ApproverScheduleRoute />} />

        {/* Approver Redirects for unfinished subpages */}
        <Route
          path="/approver/venues"
          element={<Navigate to="/approver/dashboard" replace />}
        />
        <Route
          path="/approver/settings"
          element={<Navigate to="/approver/dashboard" replace />}
        />

        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/applicant/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
