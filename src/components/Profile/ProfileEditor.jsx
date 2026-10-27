import { useEffect, useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { fetchDepartments, updateProfile } from '../../services/auth';

export default function ProfileEditor({ user }) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [homeUnitId, setHomeUnitId] = useState(
    user?.home_unit_id ? String(user.home_unit_id) : '',
  );
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setHomeUnitId(user.home_unit_id ? String(user.home_unit_id) : '');
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    fetchDepartments().then((data) => {
      if (active && Array.isArray(data)) {
        setDepartments(data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleStartEdit = () => {
    setFullName(user?.full_name || '');
    setHomeUnitId(user?.home_unit_id ? String(user.home_unit_id) : '');
    setStatusMsg({ type: '', text: '' });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFullName(user?.full_name || '');
    setHomeUnitId(user?.home_unit_id ? String(user.home_unit_id) : '');
    setStatusMsg({ type: '', text: '' });
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setStatusMsg({ type: 'error', text: 'Full name cannot be blank.' });
      return;
    }
    setSaving(true);
    setStatusMsg({ type: '', text: '' });
    const res = await updateProfile({
      full_name: fullName.trim(),
      home_unit_id: homeUnitId ? Number(homeUnitId) : null,
    });
    setSaving(false);
    if (res.ok) {
      setStatusMsg({ type: 'success', text: 'Profile successfully updated.' });
      setIsEditing(false);
    } else {
      setStatusMsg({
        type: 'error',
        text: res.message || 'Failed to update profile.',
      });
    }
  };

  return (
    <section className="panel profile-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span className="profile-initial">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </span>
          <div>
            <h2>{user?.full_name}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {user?.user_type === 'approver'
                ? 'Campus Approver & Reviewer'
                : 'Campus Applicant'}{' '}
              · {user?.email}
            </p>
          </div>
        </div>
        {!isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              className="booking-status status-approved"
              style={{ fontSize: 11, padding: '6px 12px' }}
            >
              ● {user?.is_active ? 'Active Account' : 'Inactive'}
            </span>
            <button className="button secondary" onClick={handleStartEdit}>
              <Edit2 size={15} />
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {statusMsg.text && (
        <p
          className={`notice ${statusMsg.type}`}
          role={statusMsg.type === 'error' ? 'alert' : 'status'}
        >
          {statusMsg.text}
        </p>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 20 }}>
          <div className="form-two-col">
            <label>
              Full Name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Jane Doe"
                required
                maxLength={150}
              />
            </label>

            <label>
              Department / Unit
              <select
                value={homeUnitId}
                onChange={(e) => setHomeUnitId(e.target.value)}
              >
                <option value="">No department assigned</option>
                {departments.map((dept) => (
                  <option key={dept.unit_id} value={dept.unit_id}>
                    {dept.unit_name}{' '}
                    {dept.unit_code ? `(${dept.unit_code})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-two-col">
            <label>
              Email Address
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{
                  background: '#f8f7fa',
                  color: '#7a7287',
                  cursor: 'not-allowed',
                }}
              />
              <small className="muted">
                Campus email address cannot be changed.
              </small>
            </label>

            <label>
              Account Role
              <input
                type="text"
                value={
                  user?.user_type === 'approver'
                    ? 'Approver / Faculty'
                    : 'Applicant / Student'
                }
                disabled
                style={{
                  background: '#f8f7fa',
                  color: '#7a7287',
                  cursor: 'not-allowed',
                }}
              />
              <small className="muted">Assigned during registration.</small>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X size={15} />
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              <Save size={15} />
              {saving ? 'Saving changes…' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <dl className="detail-grid">
          <div>
            <dt>Full Name</dt>
            <dd>
              <strong>{user?.full_name}</strong>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd style={{ textTransform: 'capitalize' }}>
              {user?.user_type}
            </dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{user?.unit_name || 'Not assigned'}</dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>{user?.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
        </dl>
      )}

      <hr />

      <h3>Approval groups</h3>
      {user?.approval_groups?.length ? (
        <ul className="group-list">
          {user.approval_groups.map((group) => (
            <li key={group.access_id}>
              <strong>{group.group_name}</strong>
              <span>
                {group.member_role} ·{' '}
                {group.can_approve ? 'Can review' : 'Member'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No approval groups assigned.</p>
      )}
      <p className="muted">
        Contact the campus administrator to assign approval permissions or
        change your institutional credentials.
      </p>
    </section>
  );
}
