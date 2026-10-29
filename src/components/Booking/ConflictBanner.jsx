import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { dateLabel, timeLabel } from "../../services/format";

export default function ConflictBanner({
  conflicts = [],
  sessionRole = "applicant",
}) {
  if (!conflicts.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 18px",
        borderRadius: "10px",
        background: "#fff9e6",
        border: "1px solid #fed7aa",
        color: "#9a3412",
        marginBottom: "20px",
        fontSize: "13px",
      }}
    >
      <AlertTriangle
        size={20}
        style={{ color: "#ea580c", flexShrink: 0, marginTop: "2px" }}
      />
      <div>
        <strong style={{ fontSize: "14px" }}>
          Existing Confirmed Reservation Conflict
        </strong>
        <p style={{ margin: "4px 0 8px 0", lineHeight: "1.4" }}>
          This time slot overlaps with {conflicts.length} confirmed booking:
        </p>
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {conflicts.map((c) => (
            <li key={c.application_id} style={{ marginBottom: "4px" }}>
              Confirmed reservation: {dateLabel(c.start_time)} ·{" "}
              {timeLabel(c.start_time)} – {timeLabel(c.end_time)}.
              {sessionRole === "admin" && (
                <Link to={`/admin/bookings/${c.application_id}`}>
                  {" "}
                  View request
                </Link>
              )}
            </li>
          ))}
        </ul>
        {sessionRole === "approver" && (
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "12px",
              color: "#c2410c",
              fontStyle: "italic",
            }}
          >
            Note: If this pending request is deemed higher priority, an approver
            can revoke the confirmed booking to trigger dynamic reassignment,
            allowing this request to be approved.
          </p>
        )}
      </div>
    </div>
  );
}
