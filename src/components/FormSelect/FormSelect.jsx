import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';
import styles from './FormSelect.module.css';

/**
 * FormSelect - Reusable select/dropdown matching the "Club/Dept" field on the right panel.
 * Features rounded corners, custom dropdown indicator, and clean focus states.
 */
const FormSelect = forwardRef(function FormSelect(
  {
    label,
    id,
    name,
    options = [],
    placeholder = 'Select an option...',
    value,
    defaultValue,
    onChange,
    required = false,
    disabled = false,
    error,
    helperText,
    children,
    className = '',
    containerClassName = '',
    ...rest
  },
  ref
) {
  const selectId = id || name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${styles.container} ${containerClassName}`.trim()}>
      {label && (
        <div className={styles.labelWrapper}>
          <label htmlFor={selectId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        </div>
      )}
      <div className={styles.selectWrapper}>
        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`${styles.select} ${error ? styles.hasError : ''} ${className}`.trim()}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden={required}>
              {placeholder}
            </option>
          )}

          {children
            ? children
            : options.map((opt, index) => {
                if (typeof opt === 'string') {
                  return (
                    <option key={`${opt}-${index}`} value={opt}>
                      {opt}
                    </option>
                  );
                }
                return (
                  <option
                    key={opt.value ?? index}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label ?? opt.value}
                  </option>
                );
              })}
        </select>
        <span className={styles.chevronIcon} aria-hidden="true">
          <ChevronDown size={18} strokeWidth={2.2} />
        </span>
      </div>
      {error ? (
        <p className={styles.errorMessage} role="alert">{error}</p>
      ) : helperText ? (
        <p className={styles.helperText}>{helperText}</p>
      ) : null}
    </div>
  );
});

FormSelect.propTypes = {
  /** Label text placed above the dropdown */
  label: PropTypes.string,
  /** HTML id attribute */
  id: PropTypes.string,
  /** HTML name attribute */
  name: PropTypes.string,
  /**
   * Array of options. Can be an array of strings: `['Club A', 'Club B']`
   * or objects: `[{ value: 'club-a', label: 'Club A', disabled: false }]`
   */
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        label: PropTypes.string,
        disabled: PropTypes.bool,
      }),
    ])
  ),
  /** Placeholder label when no value is chosen */
  placeholder: PropTypes.string,
  /** Controlled select value */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Uncontrolled default value */
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Callback fired when an option is selected */
  onChange: PropTypes.func,
  /** Marks select as required with asterisk */
  required: PropTypes.bool,
  /** Disables select interactions */
  disabled: PropTypes.bool,
  /** Error message to display below select in red */
  error: PropTypes.string,
  /** Contextual helper text beneath select */
  helperText: PropTypes.string,
  /** Direct <option> nodes can be passed instead of or alongside options prop */
  children: PropTypes.node,
  /** Extra CSS class for the select element */
  className: PropTypes.string,
  /** Extra CSS class for the outer container */
  containerClassName: PropTypes.string,
};

export default FormSelect;
