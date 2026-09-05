import { TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, hideLabel, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const areaId = id ?? generatedId;
    const hintId = hint ? `${areaId}-hint` : undefined;
    const errorId = error ? `${areaId}-error` : undefined;

    return (
      <div className="form-field">
        {label && (
          <label htmlFor={areaId} className={hideLabel ? 'visually-hidden' : 'form-label'}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={`textarea ${error ? 'has-error' : ''} ${className}`}
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
Textarea.displayName = 'Textarea';
