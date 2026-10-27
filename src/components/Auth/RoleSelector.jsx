import { Clock, ShieldCheck, UserRound } from 'lucide-react';
import authStyles from '../../pages/Login.module.css';

export default function RoleSelector({ role, onChangeRole }) {
  return (
    <>
      <fieldset className={authStyles.roleFieldset}>
        <legend>Select account role</legend>
        <div className={authStyles.roleOptions}>
          <label
            className={`${authStyles.roleCard} ${
              role === 'applicant' ? authStyles.roleCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name="account-role"
              value="applicant"
              checked={role === 'applicant'}
              onChange={() => onChangeRole('applicant')}
              className={authStyles.roleRadio}
            />
            <span className={authStyles.roleIcon}>
              <UserRound size={18} />
            </span>
            <span className={authStyles.roleCopy}>
              <strong>Student / Applicant</strong>
              <small>Request &amp; book campus spaces</small>
            </span>
          </label>

          <label
            className={`${authStyles.roleCard} ${
              role === 'approver' ? authStyles.roleCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name="account-role"
              value="approver"
              checked={role === 'approver'}
              onChange={() => onChangeRole('approver')}
              className={authStyles.roleRadio}
            />
            <span className={authStyles.roleIcon}>
              <ShieldCheck size={18} />
            </span>
            <span className={authStyles.roleCopy}>
              <strong>Faculty / Approver</strong>
              <small>Review &amp; approve requests</small>
            </span>
          </label>
        </div>
      </fieldset>

      {role === 'approver' && (
        <div
          style={{
            background: '#f8f5ff',
            border: '1px solid rgba(112, 71, 235, 0.22)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '11.5px',
            color: '#5b21b6',
            lineHeight: '1.45',
          }}
        >
          <Clock
            size={14}
            style={{ verticalAlign: 'middle', marginRight: '6px' }}
          />
          <strong>Admin Verification:</strong> Faculty Approver accounts require
          administrator verification. Access is granted once verified.
        </div>
      )}
    </>
  );
}
