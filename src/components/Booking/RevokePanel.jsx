import { useState } from "react";

export default function RevokePanel({ withinDeadline, busy, onRevoke }) {
  const [showForm, setShowForm] = useState(false);
  const [remarks, setRemarks] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!remarks.trim()) return;
    onRevoke(remarks.trim());
  };

  return (
    <section
      className="panel detail-panel"
      style={{ border: "1px solid #ffd8a8", background: "#fffdfa" }}
    >
      <div className="section-heading">
        <div>
          <h2 style={{ color: "#9a3412" }}>Approver Revocation</h2>
          <p
            className="muted"
            style={{ margin: "4px 0 0 0", fontSize: "12px" }}
          >
            Revoking an assigned class frees the venue slot and prompts the
            applicant for dynamic reassignment.
          </p>
        </div>
      </div>
      {withinDeadline ? (
        <p className="muted" style={{ color: "#b45309", fontWeight: "500" }}>
          Revocation is blocked because the event is less than eight hours away
          (Eight-hour deadline).
        </p>
      ) : !showForm ? (
        <button
          className="button danger"
          disabled={busy}
          onClick={() => setShowForm(true)}
        >
          Revoke this Booking
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: "12px" }}>
          <label>
            Reason for Revocation (Required)
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain why this class or event booking is being revoked..."
              rows={3}
              required
            />
          </label>
          <div className="form-actions" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowForm(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button danger"
              disabled={busy || !remarks.trim()}
            >
              {busy ? "Revoking…" : "Confirm Revoke & Trigger Reassignment"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
