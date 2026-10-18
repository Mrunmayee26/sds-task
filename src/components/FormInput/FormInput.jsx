import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import styles from './FormInput.module.css';

/**
 * FormInput - Reusable input field matching the "Event Name" design in the mockup.
 * Features rounded corners, subtle border, smooth purple focus ring, and clear internal padding.
 */
const FormInput = forwardRef(function FormInput(
  {
    label,
    id,
    name,
    type = 'text',
    placeholder,
    value,
    defaultValue,
    onChange,
    required = false,
    disabled = false,
    error,
    helperText,
    className = '',
    containerClassName = '',
    ...rest
  },
  ref
) {
  const inputId = id || name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${styles.container} ${containerClassName}`.trim()}>
      {label && (
        <div className={styles.labelWrapper}>
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        </div>
      )}
      <div className={styles.inputWrapper}>
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`${styles.input} ${error ? styles.hasError : ''} ${className}`.trim()}
          {...rest}
        />
      </div>
      {error ? (
        <p className={styles.errorMessage} role="alert">{error}</p>
      ) : helperText ? (
        <p className={styles.helperText}>{helperText}</p>
      ) : null}
    </div>
  );
});

FormInput.propTypes = {
  /** Label text placed above the input field */
  label: PropTypes.string,
  /** HTML id attribute */
  id: PropTypes.string,
  /** HTML name attribute */
  name: PropTypes.string,
  /** Input type (e.g. text, email, number, date, time) */
  type: PropTypes.string,
  /** Placeholder text inside the input */
  placeholder: PropTypes.string,
  /** Controlled input value */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Uncontrolled default value */
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Callback fired when input changes */
  onChange: PropTypes.func,
  /** Marks input as required with asterisk */
  required: PropTypes.bool,
  /** Disables input interactions */
  disabled: PropTypes.bool,
  /** Error message to display below input in red */
  error: PropTypes.string,
  /** Contextual helper text beneath input */
  helperText: PropTypes.string,
  /** Extra CSS class for the input element */
  className: PropTypes.string,
  /** Extra CSS class for the outer container */
  containerClassName: PropTypes.string,
};

export default FormInput;
