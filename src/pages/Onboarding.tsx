import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Send, CheckCircle, Clock, Circle, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ChatMessage } from '@/components/advisor/ChatMessage'
import { useUserProfile } from '@/db/hooks'
import { useOnboarding } from '@/hooks/useOnboarding'
import type { OnboardingResult } from '@/lib/onboarding-schema'
import type { Province } from '@/types'

const STEPS = ['Basics', 'Accounts', 'Income', 'Expenses', 'Goals']

const provinceOptions = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

const PROVINCE_LABELS: Record<string, string> = Object.fromEntries(
  provinceOptions.map(p => [p.value, p.label])
)

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  tfsa: 'TFSA',
  rrsp: 'RRSP',
  fhsa: 'FHSA',
  'non-registered': 'Non-Registered',
  cash: 'Cash / Savings',
  property: 'Real Estate',
  crypto: 'Cryptocurrency',
  pension: 'Pension',
  'debt-mortgage': 'Mortgage',
  'debt-loc': 'Line of Credit',
  'debt-credit': 'Credit Card',
  'debt-other': 'Other Debt',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  'one-time': 'One-time',
}

// ── Chat Input ────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (msg: string) => void
  disabled?: boolean
}

function OnboardingChatInput({ onSend, disabled }: ChatInputProps) {
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
    <div className="border-t border-border px-5 py-3 bg-white">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput() }}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-surface border border-border rounded-xl px-4 py-3 text-[14px] text-text',
            'placeholder:text-text-secondary/50',
            'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
            'disabled:opacity-50'
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            value.trim() && !disabled
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-surface-hover text-text-secondary'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'complete' | 'in-progress' | 'pending' }) {
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" />
        Complete
      </span>
    )
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary bg-surface border border-border px-2 py-0.5 rounded-full">
      <Circle className="w-3 h-3" />
      Pending
    </span>
  )
}

// ── Live Preview Panel ────────────────────────────────────────────────────────

interface PreviewPanelProps {
  result: OnboardingResult | null
  isStreaming: boolean
  isReviewing: boolean
  onUpdate: (updater: (prev: OnboardingResult) => OnboardingResult) => void
}

function PreviewPanel({ result, isStreaming, isReviewing, onUpdate }: PreviewPanelProps) {
  const profileStatus = result?.userProfile?.dateOfBirth ? 'complete' : isStreaming ? 'in-progress' : 'pending'
  const accountsStatus = result?.accounts?.length ? 'complete' : isStreaming ? 'in-progress' : 'pending'
  const incomeStatus = result?.userProfile?.annualIncome ? 'complete' : isStreaming ? 'in-progress' : 'pending'
  const eventsStatus = result?.lifeEvents?.length ? 'complete' : isStreaming ? 'in-progress' : 'pending'

  const calcAge = (dob: string) => {
    if (!dob) return null
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-text">Building Your Plan...</h2>
        <p className="text-[12px] text-text-secondary mt-0.5">
          {isReviewing ? 'Review and edit before saving.' : 'Filling in as we chat.'}
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="mb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px]">Profile</CardTitle>
            <StatusBadge status={profileStatus} />
          </div>
        </CardHeader>
        {result?.userProfile ? (
          isReviewing ? (
            <div className="space-y-3">
              <Input
                label="Date of Birth"
                type="date"
                value={result.userProfile.dateOfBirth}
                onChange={e => onUpdate(prev => ({
                  ...prev,
                  userProfile: { ...prev.userProfile, dateOfBirth: e.target.value },
                }))}
              />
              <Select
                label="Province"
                value={result.userProfile.province}
                onChange={e => onUpdate(prev => ({
                  ...prev,
                  userProfile: { ...prev.userProfile, province: e.target.value as Province },
                }))}
                options={provinceOptions}
              />
              <Input
                label="Annual Income"
                type="number"
                value={result.userProfile.annualIncome}
                onChange={e => onUpdate(prev => ({
                  ...prev,
                  userProfile: { ...prev.userProfile, annualIncome: e.target.value },
                }))}
              />
              <Input
                label="Years Contributed to CPP"
                type="number"
                value={result.userProfile.yearsContributedCPP.toString()}
                onChange={e => onUpdate(prev => ({
                  ...prev,
                  userProfile: { ...prev.userProfile, yearsContributedCPP: parseInt(e.target.value) || 0 },
                }))}
              />
            </div>
          ) : (
            <div className="space-y-1.5 text-[13px]">
              {result.userProfile.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Age</span>
                  <span className="font-medium">{calcAge(result.userProfile.dateOfBirth)} years old</span>
                </div>
              )}
              {result.userProfile.province && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Province</span>
                  <span className="font-medium">{PROVINCE_LABELS[result.userProfile.province] ?? result.userProfile.province}</span>
                </div>
              )}
              {result.userProfile.annualIncome && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Income</span>
                  <span className="font-medium">{formatCurrency(result.userProfile.annualIncome)}/yr</span>
                </div>
              )}
              {result.partnerProfile && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Partner</span>
                  <span className="font-medium">{result.partnerProfile.name}</span>
                </div>
              )}
            </div>
          )
        ) : (
          <p className="text-[12px] text-text-secondary italic">Waiting for your info...</p>
        )}
      </Card>

      {/* Accounts Card */}
      <Card>
        <CardHeader className="mb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px]">Accounts</CardTitle>
            <StatusBadge status={accountsStatus} />
          </div>
        </CardHeader>
        {result?.accounts?.length ? (
          <div className="space-y-1.5">
            {result.accounts.map((acc, i) => (
              isReviewing ? (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label={i === 0 ? 'Name' : undefined}
                      value={acc.name}
                      onChange={e => onUpdate(prev => {
                        const accounts = [...prev.accounts]
                        accounts[i] = { ...accounts[i], name: e.target.value }
                        return { ...prev, accounts }
                      })}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label={i === 0 ? 'Balance' : undefined}
                      type="number"
                      value={acc.balance}
                      onChange={e => onUpdate(prev => {
                        const accounts = [...prev.accounts]
                        accounts[i] = { ...accounts[i], balance: e.target.value }
                        return { ...prev, accounts }
                      })}
                    />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-between text-[13px]">
                  <span className="text-text-secondary">
                    {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                    {acc.owner === 'partner' ? ' (partner)' : ''}
                  </span>
                  <span className="font-medium">{formatCurrency(acc.balance)}</span>
                </div>
              )
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-text-secondary italic">Waiting for account details...</p>
        )}
      </Card>

      {/* Income Card */}
      <Card>
        <CardHeader className="mb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px]">Income & CPP</CardTitle>
            <StatusBadge status={incomeStatus} />
          </div>
        </CardHeader>
        {result?.userProfile?.annualIncome ? (
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-text-secondary">Annual income</span>
              <span className="font-medium">{formatCurrency(result.userProfile.annualIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">CPP years</span>
              <span className="font-medium">{result.userProfile.yearsContributedCPP} yrs</span>
            </div>
            {result.partnerProfile?.annualIncome && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Partner income</span>
                <span className="font-medium">{formatCurrency(result.partnerProfile.annualIncome)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-text-secondary italic">Waiting for income details...</p>
        )}
      </Card>

      {/* Life Events Card */}
      <Card>
        <CardHeader className="mb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px]">Life Events & Goals</CardTitle>
            <StatusBadge status={eventsStatus} />
          </div>
        </CardHeader>
        {result?.lifeEvents?.length ? (
          <div className="space-y-1.5">
            {result.lifeEvents.map((evt, i) => (
              <div key={i} className="flex justify-between text-[13px]">
                <div>
                  <span className="text-text">{evt.name}</span>
                  <span className="ml-1.5 text-[11px] text-text-secondary">
                    ({EVENT_TYPE_LABELS[evt.type]}, age {evt.startAge}{evt.endAge ? `–${evt.endAge}` : ''})
                  </span>
                </div>
                <span className="font-medium shrink-0 ml-2">{formatCurrency(evt.amount)}/mo</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-text-secondary italic">Waiting for goals...</p>
        )}
      </Card>
    </div>
  )
}

// ── Main Onboarding Page ──────────────────────────────────────────────────────

export function Onboarding() {
  const navigate = useNavigate()
  const profile = useUserProfile()
  const apiKey = profile?.openaiApiKey

  const {
    state,
    messages,
    isStreaming,
    error,
    parseError,
    parsedResult,
    sendMessage,
    saveData,
    updateParsedResult,
    reset,
  } = useOnboarding(apiKey)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Redirect when done
  useEffect(() => {
    if (state === 'done') {
      navigate('/')
    }
  }, [state, navigate])

  // Send initial greeting when page loads and we have an API key
  const hasGreeted = useRef(false)
  useEffect(() => {
    if (apiKey && !hasGreeted.current && messages.length === 0) {
      hasGreeted.current = true
      sendMessage("Hello! I'm ready to set up my financial plan.")
    }
  }, [apiKey, sendMessage, messages.length])

  const handleSave = async () => {
    setIsSaving(true)
    await saveData()
    setIsSaving(false)
  }

  const isReviewing = state === 'reviewing'

  // No API key state
  if (profile !== undefined && !apiKey) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-purple-700 font-bold text-lg">AI</span>
          </div>
          <h2 className="font-serif text-xl mb-2">Set up your API key first</h2>
          <p className="text-[13px] text-text-secondary mb-6">
            The AI onboarding uses OpenAI to have a conversation with you and build your financial profile.
            Add your OpenAI API key in Settings to get started.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/settings">
              <Button>Go to Settings</Button>
            </Link>
            <Link to="/">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -mt-8 -mx-10 overflow-hidden">
      {/* Left Panel — Chat */}
      <div className="w-[52%] flex flex-col bg-white border-r border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-lg">Set Up Your Financial Plan</h1>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Answer a few questions to get personalized projections
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="text-[12px] text-text-secondary hover:text-text flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Start over
              </button>
            )}
          </div>

          {/* Step progress (decorative) */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-1">
                <div className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors',
                  i === 0
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary'
                )}>
                  {step}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          {(error || parseError) && (
            <div className="text-[13px] text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2">
              {error || parseError}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reviewing action area */}
        {isReviewing && (
          <div className="px-6 py-4 border-t border-border bg-emerald-50/50 shrink-0">
            <p className="text-[13px] text-text-secondary mb-3">
              Your plan looks ready! Review the details on the right, then save to get started.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save & Go to Dashboard'}
              </Button>
              <Button variant="secondary" onClick={reset}>
                Start Over
              </Button>
            </div>
          </div>
        )}

        {/* Chat input */}
        {!isReviewing && (
          <OnboardingChatInput onSend={sendMessage} disabled={isStreaming} />
        )}
      </div>

      {/* Right Panel — Live Preview */}
      <div className="flex-1 bg-surface-alt overflow-hidden">
        <PreviewPanel
          result={parsedResult}
          isStreaming={isStreaming}
          isReviewing={isReviewing}
          onUpdate={updateParsedResult}
        />
      </div>
    </div>
  )
}
