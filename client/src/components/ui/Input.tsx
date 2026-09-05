import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hideLabel, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="form-field">
        {label && (
          <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : 'form-label'}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${error ? 'has-error' : ''} ${className}`}
          aria-invalid={!!error || undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          {...rest}
        />
        {hint && !error && (
          <span id={hintId} className="form-hint">
            {hint}
          </span>
        )}
        {error && (
          <span id={errorId} className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
