import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
  }

  return (
    <div className="border-t border-border px-6 py-3">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput() }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-surface border border-border rounded-xl px-4 py-3 text-[14px] text-text',
            'placeholder:text-text-secondary/50',
            'focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent/40',
            'disabled:opacity-50'
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            value.trim() && !disabled
              ? 'bg-text text-white hover:bg-text/90'
              : 'bg-surface-hover text-text-secondary'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
