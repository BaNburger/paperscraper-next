import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border border-input bg-background accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}
