import { Status } from '../BookingUI';

export default function ApprovalStepper({ approvals = [], facultyAdvisorName = '' }) {
  if (!approvals.length) return null;

  const isThreeLevel = approvals.length >= 3;

  return (
    <section className="panel detail-panel">
      <div className="section-heading">
        <h2>Multi-Level Approval Pipeline</h2>
        <span className="muted" style={{ fontSize: '12px' }}>
          {isThreeLevel ? '3-Level Approval (Seminar / Large Venue)' : '2-Level Approval (Classroom / Lab)'}
        </span>
      </div>
      <ol className="approval-steps" style={{ listStyle: 'none', padding: 0 }}>
        {approvals.map((approval) => {
          let roleTitle = `Stage ${approval.approval_step}`;
          if (approval.approval_step === 1) {
            roleTitle = `Level 1: Faculty Advisor (${facultyAdvisorName || 'Assigned Faculty Advisor'})`;
          } else if (approval.approval_step === 2) {
            roleTitle = `Level 2: Head of Department (HOD) — ${approval.group_name}`;
          } else if (approval.approval_step === 3) {
            roleTitle = `Level 3: University Dean — ${approval.group_name}`;
          }

          const isApproved = approval.status === 'approved';
          const isRejected = approval.status === 'rejected';

          return (
            <li
              key={approval.approval_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: isApproved ? '#f6fbf8' : isRejected ? '#fff8f9' : '#faf9fc',
                border: `1px solid ${isApproved ? '#c6eed9' : isRejected ? '#ffd4dc' : '#e7e3ef'}`,
                borderRadius: '10px',
                marginBottom: '10px',
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', color: '#2b2138' }}>{roleTitle}</strong>
                <small style={{ display: 'block', color: '#736b7e', marginTop: '3px' }}>
                  {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending review'}
                  {' · '}
                  {approval.approval_count} of {approval.required_approvals} required approvals
                </small>
                {approval.remarks && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#574e62' }}>
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
