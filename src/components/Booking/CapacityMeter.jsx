export default function CapacityMeter({
  selected,
  attendance,
  exceedsCapacity,
  nearCapacity,
  fillPercentage,
}) {
  if (!selected?.capacity || attendance <= 0) return null;

  return (
    <div style={{ margin: '10px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        <span>Capacity utilization</span>
        <strong
          style={{
            color: exceedsCapacity
              ? '#b02c48'
              : nearCapacity
                ? '#a96d0e'
                : '#22815d',
          }}
        >
          {attendance} / {selected.capacity} ({fillPercentage}%)
        </strong>
      </div>
      <div
        style={{
          background: '#eee8f5',
          borderRadius: 6,
          height: 7,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, (attendance / selected.capacity) * 100)}%`,
            height: '100%',
            background: exceedsCapacity
              ? '#ff4d5b'
              : nearCapacity
                ? '#f2c080'
                : '#80c8a7',
            borderRadius: 6,
            transition: 'width 0.2s',
          }}
        />
      </div>
      {exceedsCapacity ? (
        <small
          style={{
            color: '#b02c48',
            display: 'block',
            marginTop: 5,
            fontWeight: 600,
          }}
        >
          Exceeds by {attendance - selected.capacity} seats
        </small>
      ) : nearCapacity ? (
        <small
          style={{
            color: '#a96d0e',
            display: 'block',
            marginTop: 5,
          }}
        >
          Near venue capacity
        </small>
      ) : null}
    </div>
  );
}
