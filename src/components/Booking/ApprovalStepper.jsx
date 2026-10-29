import { Status } from "../BookingUI";

export default function ApprovalStepper({
  approvals = [],
  facultyAdvisorName = "",
}) {
  if (!approvals.length) return null;

  const stages = new Set(approvals.map((a) => a.approval_step)).size;

  return (
    <section className="panel detail-panel">
      <div className="section-heading">
        <h2>Multi-Level Approval Pipeline</h2>
        <span className="muted" style={{ fontSize: "12px" }}>
          {stages} approval stages
        </span>
      </div>
      <ol className="approval-steps" style={{ listStyle: "none", padding: 0 }}>
        {approvals.map((approval) => {
          const roleTitle = `Stage ${approval.approval_step}: ${approval.group_name}${approval.group_name === "Faculty Advisors Committee" && facultyAdvisorName ? ` (${facultyAdvisorName})` : ""}`;

          const isApproved = approval.status === "approved";
          const isRejected = approval.status === "rejected";

          return (
            <li
              key={approval.approval_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                background: isApproved
                  ? "#f6fbf8"
                  : isRejected
                    ? "#fff8f9"
                    : "#faf9fc",
                border: `1px solid ${isApproved ? "#c6eed9" : isRejected ? "#ffd4dc" : "#e7e3ef"}`,
                borderRadius: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#2b2138" }}>
                  {roleTitle}
                </strong>
                <small
                  style={{
                    display: "block",
                    color: "#736b7e",
                    marginTop: "3px",
                  }}
                >
                  {isApproved
                    ? "Approved"
                    : isRejected
                      ? "Rejected"
                      : "Pending review"}
                  {" · "}
                  {approval.approval_count} of {approval.required_approvals}{" "}
                  required approvals
                </small>
                {approval.remarks && (
                  <p
                    style={{
                      margin: "6px 0 0 0",
                      fontSize: "12px",
                      color: "#574e62",
                    }}
                  >
                    Remarks: {approval.remarks}
                  </p>
                )}
              </div>
              <Status value={approval.status} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
