import { CheckCircle2, Clock } from "lucide-react";
import authStyles from "../../pages/Login.module.css";

export default function PendingApprovalScreen({
  email,
  departmentName = "your department",
  onReturnToSignIn,
}) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "#f1edff",
          color: "#7047eb",
          marginBottom: "18px",
        }}
      >
        <Clock size={32} />
      </div>

      <p className={authStyles.welcomeLabel}>REGISTRATION SUBMITTED</p>
      <h2
        style={{
          fontSize: "24px",
          color: "var(--color-text-primary)",
          marginBottom: "12px",
        }}
      >
        Pending Administrator Approval
      </h2>

      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          lineHeight: "1.6",
          marginBottom: "24px",
        }}
      >
        Your email address (<strong>{email}</strong>) has been verified
        successfully. Because you registered as an <strong>Approver</strong> for{" "}
        <strong>{departmentName}</strong>, your account must be verified by a
        campus administrator before reviewer sign-in is allowed. You can sign in
        as an applicant while the request is pending.
      </p>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "14px",
          fontSize: "12px",
          color: "#64748b",
          marginBottom: "28px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
            color: "#0f172a",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#16a34a" /> Email Verified
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#b45309",
            fontWeight: 600,
          }}
        >
          <Clock size={16} color="#d97706" /> Administrator Sign-off Pending
        </div>
      </div>

      <button
        type="button"
        className={authStyles.submit}
        onClick={onReturnToSignIn}
        style={{ width: "100%" }}
      >
        Return to Sign In
      </button>
    </div>
  );
}
