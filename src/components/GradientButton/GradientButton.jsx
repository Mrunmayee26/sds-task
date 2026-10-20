import PropTypes from 'prop-types';
import styles from './GradientButton.module.css';

/**
 * GradientButton - Reusable pill-shaped button using the vibrant orange-to-red gradient.
 * Supports both solid gradient and outlined versions with smooth micro-interactions.
 */
const GradientButton = ({
  children,
  onClick,
  variant = 'solid',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  type = 'button',
  ...rest
}) => {
  const buttonClasses = [
    styles.button,
    styles[variant] || styles.solid,
    styles[size] || styles.md,
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

GradientButton.propTypes = {
  /** Content to display inside the button */
  children: PropTypes.node.isRequired,
  /** Callback fired when the button is clicked */
  onClick: PropTypes.func,
  /** Visual variant: 'solid' uses the orange-red gradient, 'outline' uses a matching border */
  variant: PropTypes.oneOf(['solid', 'outline']),
  /** Size of the button */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Whether the button should stretch to 100% of its container */
  fullWidth: PropTypes.bool,
  /** Optional additional CSS class for custom overrides */
  className: PropTypes.string,
  /** Disables user interaction */
  disabled: PropTypes.bool,
  /** Standard HTML button type */
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default GradientButton;
