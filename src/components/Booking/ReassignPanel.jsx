import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { dateKey } from '../../services/format';

export default function ReassignPanel({ booking, venueList = [], busy, onReassign }) {
  const [form, setForm] = useState({
    venue_id: '',
    date: '',
    start_time: '',
    end_time: '',
    remarks: '',
  });
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (booking) {
      const firstSlot = booking.slots?.[0];
      const d = firstSlot ? new Date(firstSlot.start_time) : new Date();
      const sTime = firstSlot
        ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(firstSlot.start_time))
        : '09:00';
      const eTime = firstSlot
        ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(firstSlot.end_time))
        : '10:00';

      setForm({
        venue_id: String(booking.venue_id),
        date: dateKey(d),
        start_time: sTime,
        end_time: eTime,
        remarks: '',
      });
    }
  }, [booking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const { venue_id, date, start_time, end_time, remarks } = form;
    if (!venue_id || !date || !start_time || !end_time) {
      setValidationError('Please complete all venue, date, and time fields.');
      return;
    }
    if (end_time <= start_time) {
      setValidationError('End time must be strictly after start time.');
      return;
    }

    // Dynamic Reassignment Rule: Force venue change OR time change
    const firstSlot = booking?.slots?.[0];
    const venueChanged = Number(venue_id) !== booking?.venue_id;

    let timeChanged = true;
    if (firstSlot) {
      const originalDate = dateKey(new Date(firstSlot.start_time));
      const origStart = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(firstSlot.start_time));
      const origEnd = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(firstSlot.end_time));
      timeChanged = date !== originalDate || start_time !== origStart || end_time !== origEnd;
    }

    if (!venueChanged && !timeChanged) {
      setValidationError('Dynamic Reassignment requires changing either the venue or the event timing.');
      return;
    }

    onReassign(form);
  };

  return (
    <>
      {/* Alert Banner for Reassignment */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          padding: '18px 20px',
          borderRadius: '12px',
          background: '#fff5f0',
          border: '1px solid #ffcca3',
          color: '#b03d00',
          marginBottom: '24px',
        }}
      >
        <AlertCircle size={24} style={{ color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#9a3412' }}>
            Booking Revoked by Approver — Dynamic Reassignment Required
          </h3>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: '#7c2d12' }}>
            An approver has revoked this assigned class/booking. To reschedule, you must dynamically reassign by selecting <strong>either a different venue or a different time slot</strong>.
          </p>
        </div>
      </div>

      {/* Dynamic Reassignment Form */}
      <section className="panel detail-panel" style={{ border: '2px solid #ea580c', background: '#fffcfb' }}>
        <div className="section-heading">
          <div>
            <h2 style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} style={{ color: '#ea580c' }} />
              Submit Dynamic Reassignment
            </h2>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              Reassignment requires changing <strong>either the venue or the event timing</strong>.
            </p>
          </div>
        </div>

        {validationError && (
          <p className="notice error" role="alert" style={{ marginTop: '12px' }}>
            {validationError}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <label>
              Select Venue
              <select
                value={form.venue_id}
                onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
                required
              >
                <option value="">Select a venue</option>
                {venueList.map((v) => (
                  <option key={v.venue_id} value={v.venue_id}>
                    {v.venue_name} {v.venue_id === booking.venue_id ? '(Current Venue)' : ''} {v.capacity ? `· ${v.capacity} seats` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-two-col">
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  min={dateKey()}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label>
                  Start Time
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    required
                  />
                </label>
                <label>
                  End Time
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    required
                  />
                </label>
              </div>
            </div>

            <label>
              Reassignment Note (Optional)
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Add a note explaining the updated arrangement..."
                rows={2}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Reassign & Restart Multi-Level Approval'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}
