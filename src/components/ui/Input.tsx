import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-medium text-text-secondary uppercase tracking-widest">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 border bg-surface text-text text-[12px] transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/50',
            'placeholder:text-text-secondary/40',
            error ? 'border-danger' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
