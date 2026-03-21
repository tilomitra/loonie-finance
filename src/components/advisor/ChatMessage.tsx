import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const html = useMemo(() => {
    if (role === 'user') return ''
    return DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
  }, [role, content])

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-white px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[70%] text-[14px] leading-relaxed">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'bg-surface border border-border px-4 py-3 rounded-sm rounded-r-2xl rounded-bl-2xl max-w-[80%] text-[14px] leading-relaxed',
          'prose prose-sm prose-neutral dark:prose-invert max-w-none',
          '[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5',
          '[&_strong]:text-text [&_code]:text-[13px] [&_code]:bg-surface-hover [&_code]:px-1 [&_code]:rounded',
          isStreaming && 'after:content-["▋"] after:ml-0.5 after:animate-pulse after:text-text-secondary'
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
