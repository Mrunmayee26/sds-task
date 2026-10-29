import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import PortalLayout from "../layouts/PortalLayout";
import { DataState, PageHeading, Status } from "../components/BookingUI";
import { useAuth } from "../hooks/useAuth";
import {
  cancelBooking,
  decideBooking,
  getBooking,
} from "../services/bookingService";
import { dateLabel, timeLabel } from "../services/format";
import { revokeBooking, reassignBooking } from "../services/bookingService";
import { useBookingData } from "../hooks/useBookingData";
import { campusTimestamp } from "../services/format";
import ApprovalStepper from "../components/Booking/ApprovalStepper";
import RevokePanel from "../components/Booking/RevokePanel";
import ReassignPanel from "../components/Booking/ReassignPanel";
import GuardrailNotice from "../components/Booking/GuardrailNotice";
import ConflictBanner from "../components/Booking/ConflictBanner";
export default function BookingDetails() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const venues = useBookingData("venues");
  const { user, session } = useAuth();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [remarks, setRemarks] = useState("");
  const [replaceConflicts, setReplaceConflicts] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(Date.now);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    getBooking(bookingId, controller.signal)
      .then((saved) => {
        if (!controller.signal.aborted) {
          setBooking(saved);
          setError("");
          setNow(Date.now());
          if (saved.status !== "submitted") setMessage("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [bookingId, version]);
  useEffect(() => {
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  async function act(action, details) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const saved =
        action === "revoke"
          ? await revokeBooking(bookingId, details)
          : action === "reassign"
            ? await reassignBooking(bookingId, {
                venue_id: Number(details.venue_id),
                start_time: campusTimestamp(details.date, details.start_time),
                end_time: campusTimestamp(details.date, details.end_time),
                remarks: details.remarks,
              })
            : action === "cancelled"
              ? await cancelBooking(bookingId)
              : await decideBooking(
                  bookingId,
                  action,
                  remarks,
                  replaceConflicts,
                );
      if (action === "reassign") {
        navigate(`/${session.role}/bookings/${saved.application_id}`, {
          state: {
            message:
              "Reassignment submitted as a new request. The original approval history is preserved.",
          },
        });
      }
      setBooking(saved);
      setRemarks("");
      setMessage(
        action === "cancelled"
          ? "Your booking has been cancelled."
          : saved.status === "submitted"
            ? "Your decision was recorded. Further approvals are required."
            : `Booking ${saved.status}.`,
      );
    } catch (failure) {
      setActionError(failure.message);
      refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const isOwner = booking?.applicant_user_id === user.user_id;
  const pending =
    booking?.approvals.filter((approval) => approval.status === "pending") ||
    [];
  const firstStep = pending.length
    ? Math.min(...pending.map((approval) => approval.approval_step))
    : null;
  const myGroups = user.approval_groups
    .filter((group) => group.can_approve)
    .map((group) => group.access_id);
  const myTurn =
    !isOwner &&
    booking?.status === "submitted" &&
    pending.some(
      (approval) =>
        approval.approval_step === firstStep &&
        myGroups.includes(approval.access_id) &&
        (approval.group_name !== "Faculty Advisors Committee" ||
          !booking.faculty_advisor_id ||
          booking.faculty_advisor_id === user.user_id) &&
        !booking.events.some(
          (event) =>
            event.approval_id === approval.approval_id &&
            event.actor_user_id === user.user_id,
        ),
    );
  const assignedReviewer =
    !isOwner &&
    booking?.approvals.some(
      (a) =>
        myGroups.includes(a.access_id) &&
        (a.group_name !== "Faculty Advisors Committee" ||
          !booking.faculty_advisor_id ||
          booking.faculty_advisor_id === user.user_id),
    );
  const withinDeadline =
    !!booking?.cancellation_deadline &&
    new Date(booking.cancellation_deadline).getTime() < now;
  const future =
    booking?.slots.length &&
    booking.slots.every((slot) => new Date(slot.start_time).getTime() > now);
  return (
    <PortalLayout>
      <PageHeading
        title={booking?.purpose || "Booking details."}
        action={
          <Link
            className="button secondary"
            to={`/${session.role}/${session.role === "admin" ? "bookings" : session.role === "approver" ? "approvals" : "applications"}`}
          >
            Back to requests
          </Link>
        }
      >
        Request #{bookingId}
      </PageHeading>
      <DataState loading={!booking && !error} error={error} refresh={refresh} />
      {booking && !error && (
        <>
          {message && (
            <p className="notice success" role="status">
              {message}
            </p>
          )}
          <section className="panel detail-panel">
            <div className="section-heading">
              <h2>{booking.venue_name}</h2>
              <Status value={booking.status} />
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Applicant</dt>
                <dd>{booking.applicant_name}</dd>
              </div>
              <div>
                <dt>Event type</dt>
                <dd>{booking.application_type}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{dateLabel(booking.submitted_at)}</dd>
              </div>
              <div>
                <dt>Time zone</dt>
                <dd>India Standard Time (IST)</dd>
              </div>
            </dl>
            <h3>Description</h3>
            <p className="description-text">
              {booking.description || "No additional description."}
            </p>
            <h3>Reserved time</h3>
            {booking.slots.map((slot) => (
              <p key={slot.slot_id}>
                {dateLabel(slot.start_time)} · {timeLabel(slot.start_time)} –{" "}
                {timeLabel(slot.end_time)}
              </p>
            ))}
          </section>
          <ApprovalStepper
            approvals={booking.approvals}
            facultyAdvisorName={booking.faculty_advisor_name}
          />
          <ConflictBanner
            conflicts={booking.conflicts}
            sessionRole={session.role}
          />
          <GuardrailNotice
            withinDeadline={withinDeadline}
            future={future}
            status={booking.status}
          />
          {assignedReviewer && booking.status === "approved" && (
            <RevokePanel
              withinDeadline={withinDeadline}
              busy={busy}
              onRevoke={(remarks) => act("revoke", remarks)}
            />
          )}
          {isOwner && booking.status === "needs_reassignment" && (
            <ReassignPanel
              key={booking.application_id}
              booking={booking}
              venueList={venues.data}
              busy={busy}
              onReassign={(form) => act("reassign", form)}
            />
          )}
          {booking.workflow_events?.length > 0 && (
            <section className="panel detail-panel">
              <h2>Booking changes</h2>
              <ul className="history-list">
                {booking.workflow_events.map((e) => (
                  <li key={e.event_id}>
                    <strong>
                      {e.action.replaceAll("_", " ")} · {e.actor_name} ·{" "}
                      {dateLabel(e.created_at)} {timeLabel(e.created_at)}
                    </strong>
                    <span>{e.details}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {booking.events.length > 0 && (
            <section className="panel detail-panel">
              <h2>Decision history</h2>
              <ul className="group-list">
                {booking.events.map((event) => (
                  <li key={event.event_id}>
                    <strong>
                      {event.decision
                        ? "Approval recorded"
                        : "Rejection recorded"}{" "}
                      · {dateLabel(event.created_at)}{" "}
                      {timeLabel(event.created_at)}
                    </strong>
                    <span>{event.remarks || "No remarks."}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {actionError && (
            <p className="notice error" role="alert">
              {actionError}
            </p>
          )}
          {(isOwner ||
            session.role === "approver" ||
            session.role === "admin") &&
            ["submitted", "approved", "needs_reassignment"].includes(
              booking.status,
            ) &&
            future && (
              <section className="panel detail-panel">
                <h2>Change of plans?</h2>
                <p className="muted">
                  Cancellation closes eight hours before the event. This cannot
                  be undone.
                </p>
                <button
                  className="button danger"
                  disabled={busy || !booking.can_cancel}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Cancel this booking and release its time slot?",
                      )
                    )
                      act("cancelled");
                  }}
                >
                  {busy ? "Saving…" : "Cancel booking"}
                </button>
              </section>
            )}
          {session.role === "approver" && booking.status === "submitted" && (
            <section className="panel detail-panel">
              <h2>Review this request</h2>
              {myTurn && future ? (
                <>
                  <label>
                    Reviewer remarks
                    <textarea
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Add a note for the applicant"
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={replaceConflicts}
                      onChange={(e) => setReplaceConflicts(e.target.checked)}
                      style={{ width: 20 }}
                    />
                    Give this request priority and cancel conflicting approved
                    bookings (eight-hour deadline applies)
                  </label>
                  <div className="form-actions">
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => act("rejected")}
                    >
                      Reject request
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => act("approved")}
                    >
                      {busy ? "Saving…" : "Approve request"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">
                  {isOwner
                    ? "You cannot review your own request."
                    : !future
                      ? "This booking has already started and cannot be reviewed."
                      : "Waiting for another reviewer or an earlier approval stage."}
                </p>
              )}
            </section>
          )}
          {isOwner && booking.status === "rejected" && (
            <Link
              className="button primary"
              to={`/applicant/book?venue=${booking.venue_id}`}
            >
              Create a new request
            </Link>
          )}
        </>
      )}
    </PortalLayout>
  );
}
