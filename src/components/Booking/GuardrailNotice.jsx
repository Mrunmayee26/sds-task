import { Clock } from "lucide-react";

export default function GuardrailNotice({ withinDeadline, future, status }) {
  if (
    !withinDeadline ||
    !future ||
    !["submitted", "approved"].includes(status)
  ) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 18px",
        borderRadius: "10px",
        background: "#fff8eb",
        border: "1px solid #ffd8a8",
        color: "#9c5400",
        marginBottom: "20px",
        fontSize: "13px",
        fontWeight: "500",
      }}
    >
      <Clock size={20} style={{ color: "#d97706", flexShrink: 0 }} />
      <div>
        <strong>Eight-hour deadline:</strong> Event begins in less than eight
        hours. Cancellations and approver revocations are blocked to preserve
        scheduling stability.
      </div>
    </div>
  );
}
