import { SelectHTMLAttributes, forwardRef, useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hideLabel?: boolean;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hideLabel, options, placeholder, hint, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="form-field">
        {label && (
          <label htmlFor={selectId} className={hideLabel ? 'visually-hidden' : 'form-label'}>
            {label}
          </label>
        )}
        <select ref={ref} id={selectId} className={`select ${className}`} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && <span className="form-hint">{hint}</span>}
      </div>
    );
  },
);
Select.displayName = 'Select';
