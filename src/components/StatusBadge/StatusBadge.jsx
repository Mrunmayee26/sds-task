import PropTypes from 'prop-types';
import styles from './StatusBadge.module.css';

/**
 * StatusBadge - Small pill-shaped indicator used in timelines, status rows, and tables.
 * Maps 'Booked' to the orange/red gradient and 'Free' to solid purple.
 */
const StatusBadge = ({
  status,
  children,
  size = 'md',
  className = '',
  ...rest
}) => {
  const normalizedStatus = String(status || '').toLowerCase().trim();

  let statusClass = styles.default;
  if (normalizedStatus === 'booked') {
    statusClass = styles.booked;
  } else if (normalizedStatus === 'free' || normalizedStatus === 'available') {
    statusClass = styles.free;
  } else if (normalizedStatus === 'in use') {
    statusClass = styles.inUse;
  } else if (normalizedStatus === 'unavailable') {
    statusClass = styles.unavailable;
  } else if (normalizedStatus === 'approved') {
    statusClass = styles.approved;
  } else if (normalizedStatus === 'rejected') {
    statusClass = styles.rejected;
  } else if (normalizedStatus === 'cancelled') {
    statusClass = styles.cancelled;
  } else if (normalizedStatus === 'completed') {
    statusClass = styles.completed;
  } else if (normalizedStatus === 'pending') {
    statusClass = styles.pending;
  }

  const badgeClasses = [
    styles.badge,
    statusClass,
    styles[size] || styles.md,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={badgeClasses} {...rest}>
      {children !== undefined ? children : status}
    </span>
  );
};

StatusBadge.propTypes = {
  /** The status string: 'Booked' (orange/red gradient), 'Free' (solid purple), or custom */
  status: PropTypes.string.isRequired,
  /** Optional custom content or icon inside the badge. If omitted, `status` is rendered */
  children: PropTypes.node,
  /** Size variant of the badge */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Additional CSS class for overrides */
  className: PropTypes.string,
};

export default StatusBadge;
