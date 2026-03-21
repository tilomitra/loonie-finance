import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { useUserProfile, useAccounts, useNetWorth } from '@/db/hooks'
import { useFinancialContext } from '@/hooks/useFinancialContext'
import { sendMessage, type ChatMessage as ChatMsg } from '@/lib/openai'
import { ChatMessage } from '@/components/advisor/ChatMessage'
import { ChatInput } from '@/components/advisor/ChatInput'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

const SUGGESTED_QUESTIONS = [
  'Should I prioritize TFSA or RRSP?',
  'How much CPP will I receive at 65?',
  "What's my effective tax rate?",
  'Am I on track for FIRE?',
]

export function Advisor() {
  const profile = useUserProfile()
  const accounts = useAccounts()
  const { netWorth } = useNetWorth()
  const systemPrompt = useFinancialContext()

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const apiKey = profile?.openaiApiKey

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback((content: string) => {
    if (!apiKey) return

    setError(null)
    const userMessage: ChatMsg = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setIsStreaming(true)

    const allMessages: ChatMsg[] = [
      { role: 'system', content: systemPrompt },
      ...newMessages,
    ]

    let assistantContent = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    sendMessage(apiKey, allMessages, {
      onToken: (token) => {
        assistantContent += token
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
          return updated
        })
      },
      onDone: () => {
        setIsStreaming(false)
      },
      onError: (err) => {
        setIsStreaming(false)
        setError(err.message)
      },
    })
  }, [apiKey, messages, systemPrompt])

  const handleNewChat = () => {
    setMessages([])
    setError(null)
  }

  if (!apiKey) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-serif text-2xl mb-4">AI Advisor</h1>
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 className="font-serif text-lg mb-2">Set up your API key</h2>
          <p className="text-[13px] text-text-secondary mb-4">
            To use the AI Advisor, add your OpenAI API key in Settings.
            Your key is stored locally and sent directly to OpenAI.
          </p>
          <Link to="/settings">
            <Button>Go to Settings</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] -mt-2">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-serif text-lg">AI Advisor</h1>
          <span className="text-[12px] text-text-secondary">Powered by GPT-4o · Web search enabled</span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleNewChat}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            New Chat
          </Button>
        )}
      </div>

      {/* Context banner */}
      <div className="mx-6 mt-3 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg text-[12px] text-text-secondary shrink-0">
        <span className="font-medium text-warning">Context loaded:</span>{' '}
        {accounts.length} account{accounts.length !== 1 ? 's' : ''} · Net worth{' '}
        {formatCurrency(netWorth.toString())} · Income{' '}
        {formatCurrency(profile.annualIncome || '0')} · {profile.province}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="font-serif text-lg mb-2 text-text-secondary">What would you like to know?</h2>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-[13px] px-3 py-1.5 rounded-full border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))
        )}
        {error && (
          <div className="text-[13px] text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
