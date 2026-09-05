import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, block, className = '', children, disabled, ...rest }, ref) => {
    const classes = [
      'btn',
      `btn-${variant}`,
      size === 'sm' ? 'btn-sm' : '',
      block ? 'btn-block' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={classes} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...rest}>
        {isLoading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
