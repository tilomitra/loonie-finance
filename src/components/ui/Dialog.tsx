import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'm-auto border border-border p-0 max-w-lg w-full bg-surface',
        className
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-[12px] font-semibold text-text uppercase tracking-widest">{title}</h2>
        <button
          onClick={onClose}
          className="p-1 text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5">
        {children}
      </div>
    </dialog>
  )
}
