import { AlertTriangle } from 'lucide-react';

export default function AttendanceNotice({
  selected,
  attendance,
  exceedsCapacity,
  nearCapacity,
  fillPercentage,
  suggestedVenues = [],
  onSelectVenue,
}) {
  if (!selected?.capacity) return null;

  if (exceedsCapacity) {
    return (
      <div
        className="notice error"
        style={{
          margin: 0,
          display: 'grid',
          gap: 10,
          borderRadius: 10,
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle
            size={18}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <strong>Capacity Exceeded:</strong> You entered {attendance}{' '}
            attendees, but {selected.venue_name} only accommodates up to{' '}
            {selected.capacity} seats ({attendance - selected.capacity} seats
            over capacity).
          </div>
        </div>
        {suggestedVenues.length > 0 ? (
          <div
            style={{
              borderTop: '1px solid #ffd4dc',
              paddingTop: 8,
              fontSize: 11,
            }}
          >
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
              Suggested venues that fit your attendance:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestedVenues.slice(0, 3).map((v) => (
                <button
                  key={v.venue_id}
                  type="button"
                  className="button secondary"
                  style={{
                    minHeight: 32,
                    padding: '5px 12px',
                    fontSize: 11,
                    background: '#fff',
                  }}
                  onClick={() => onSelectVenue && onSelectVenue(String(v.venue_id))}
                >
                  Switch to {v.venue_name} ({v.capacity} seats)
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 11 }}>
            Please reduce the expected attendance to reserve this space.
          </p>
        )}
      </div>
    );
  }

  if (nearCapacity) {
    return (
      <p
        className="notice warning"
        style={{ margin: 0, padding: '10px 14px', fontSize: 11 }}
      >
        ℹ️ Note: This booking utilizes {fillPercentage}% of{' '}
        {selected.venue_name}'s capacity ({selected.capacity} seats).
      </p>
    );
  }

  return null;
}
