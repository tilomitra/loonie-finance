# AI Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated AI Advisor chat page powered by OpenAI GPT-4o with web search, giving users personalized Canadian finance advice based on their stored financial data.

**Architecture:** New `/advisor` route with a chat interface. Financial context assembled from Dexie (accounts, profile, net worth) into a system prompt. OpenAI Responses API called via `fetch` with streaming (no SDK). API key stored in user profile via Settings page. Markdown rendered with `marked` + `DOMPurify`.

**Tech Stack:** React 19, TypeScript, Dexie.js, OpenAI Responses API (fetch + SSE), marked, dompurify, Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-ai-advisor-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types/index.ts` | Add `openaiApiKey?: string` to `UserProfile` |
| `src/pages/Settings.tsx` | Add "AI Integration" card with API key input |
| `src/lib/openai.ts` | Fetch wrapper for OpenAI Responses API + SSE stream parsing |
| `src/hooks/useFinancialContext.ts` | Assembles Dexie data into system prompt string |
| `src/components/advisor/ChatMessage.tsx` | Renders one message bubble with markdown |
| `src/components/advisor/ChatInput.tsx` | Text input with send button |
| `src/pages/Advisor.tsx` | Main chat page — messages state, streaming, layout |
| `src/components/layout/Sidebar.tsx` | Add "AI Advisor" nav item |
| `src/App.tsx` | Add `/advisor` route |

---

### Task 1: Add OpenAI API Key to UserProfile and Settings

**Files:**
- Modify: `src/types/index.ts:71-83` (UserProfile interface)
- Modify: `src/pages/Settings.tsx` (add AI Integration card)

- [ ] **Step 1: Add `openaiApiKey` to UserProfile interface**

In `src/types/index.ts`, add the optional field to the `UserProfile` interface:

```typescript
export interface UserProfile {
  id: string // always 'singleton'
  dateOfBirth: string // YYYY-MM-DD
  province: Province
  annualIncome: string
  yearsContributedCPP: number
  tfsaCumulativeContributions: string
  rrspCumulativeContributions: string
  fhsaCumulativeContributions: string
  fhsaFirstHomeOwner: boolean
  openaiApiKey?: string
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 2: Add API key field to Settings page**

In `src/pages/Settings.tsx`, add `openaiApiKey: ''` to the form state initial value. In the `useEffect` that loads the profile, add `openaiApiKey: profile.openaiApiKey ?? ''`. Add a new Card section after the "Registered Accounts" card:

```tsx
<Card className="mb-6">
  <CardHeader>
    <CardTitle>AI Integration</CardTitle>
    <CardDescription>Connect to OpenAI for personalized financial advice.</CardDescription>
  </CardHeader>

  <div className="space-y-4">
    <div className="relative">
      <Input
        label="OpenAI API Key"
        type={showKey ? 'text' : 'password'}
        value={form.openaiApiKey}
        onChange={(e) => setForm(f => ({ ...f, openaiApiKey: e.target.value }))}
        placeholder="sk-..."
      />
      <button
        type="button"
        onClick={() => setShowKey(k => !k)}
        className="absolute right-3 top-7 text-[12px] text-text-secondary hover:text-text"
      >
        {showKey ? 'Hide' : 'Show'}
      </button>
    </div>
    <p className="text-[12px] text-text-secondary">
      Your API key is stored locally and sent directly to OpenAI. Get one at{' '}
      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        platform.openai.com
      </a>
    </p>
  </div>
</Card>
```

Add `const [showKey, setShowKey] = useState(false)` alongside the existing state declarations. The `openaiApiKey` field is already included in the spread `...form` in `handleSave`, so no save logic changes needed.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Open Settings page. Verify the new "AI Integration" card appears below "Registered Accounts" with a password input and show/hide toggle. Type a test key, save, reload — verify it persists.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/pages/Settings.tsx
git commit -m "feat: add OpenAI API key to user profile and settings page"
```

---

### Task 2: OpenAI Responses API Streaming Client

**Files:**
- Create: `src/lib/openai.ts`
- Create: `src/lib/__tests__/openai.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/openai.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseSSEStream } from '../openai'

function createMockResponse(chunks: string[]): Response {
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
  return new Response(stream)
}

describe('parseSSEStream', () => {
  it('should yield text delta content from response.output_text.delta events', async () => {
    const chunks = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" world"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ]
    const response = createMockResponse(chunks)
    const parts: string[] = []
    for await (const text of parseSSEStream(response)) {
      parts.push(text)
    }
    expect(parts).toEqual(['Hello', ' world'])
  })

  it('should handle split chunks across SSE boundaries', async () => {
    const chunks = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hi',
      '"}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"!"}\n\n',
    ]
    const response = createMockResponse(chunks)
    const parts: string[] = []
    for await (const text of parseSSEStream(response)) {
      parts.push(text)
    }
    expect(parts).toEqual(['Hi', '!'])
  })

  it('should ignore non-delta events', async () => {
    const chunks = [
      'event: response.created\ndata: {"type":"response.created"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Only this"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ]
    const response = createMockResponse(chunks)
    const parts: string[] = []
    for await (const text of parseSSEStream(response)) {
      parts.push(text)
    }
    expect(parts).toEqual(['Only this'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/openai.test.ts`
Expected: FAIL — `parseSSEStream` is not exported / does not exist.

- [ ] **Step 3: Implement the OpenAI streaming client**

Create `src/lib/openai.ts`:

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const lines = part.split('\n')
      let eventType = ''
      let data = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) data = line.slice(6)
      }
      if (eventType === 'response.output_text.delta' && data) {
        const parsed = JSON.parse(data)
        yield parsed.delta
      }
    }
  }
}

export async function sendMessage(
  apiKey: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const systemMessage = messages.find(m => m.role === 'system')
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const input = []
  if (systemMessage) {
    input.push({ role: 'system', content: systemMessage.content })
  }
  input.push(...conversationMessages)

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input,
      tools: [{ type: 'web_search_preview' }],
      stream: true,
    }),
  })

  if (!response.ok) {
    const status = response.status
    if (status === 401) throw new Error('Invalid API key. Check your key in Settings.')
    if (status === 429) throw new Error('Rate limited. Please wait a moment and try again.')
    throw new Error(`OpenAI error (${status}). Please try again.`)
  }

  try {
    for await (const token of parseSSEStream(response)) {
      callbacks.onToken(token)
    }
    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/openai.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai.ts src/lib/__tests__/openai.test.ts
git commit -m "feat: add OpenAI Responses API streaming client with SSE parser"
```

---

### Task 3: Financial Context Hook

**Files:**
- Create: `src/hooks/useFinancialContext.ts`
- Create: `src/hooks/__tests__/useFinancialContext.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useFinancialContext.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../useFinancialContext'
import type { Account, UserProfile } from '@/types'
import Decimal from 'decimal.js'

describe('buildSystemPrompt', () => {
  it('should include user profile data in the prompt', () => {
    const profile: UserProfile = {
      id: 'singleton',
      dateOfBirth: '1990-05-15',
      province: 'ON',
      annualIncome: '85000',
      yearsContributedCPP: 10,
      tfsaCumulativeContributions: '45000',
      rrspCumulativeContributions: '30000',
      fhsaCumulativeContributions: '8000',
      fhsaFirstHomeOwner: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const accounts: Account[] = [
      {
        id: '1', name: 'TFSA', type: 'tfsa', balance: '25000', currency: 'CAD',
        institution: 'WS', assetAllocation: { stocks: 80, bonds: 10, cash: 10, other: 0 },
        contributionRoom: null, interestRate: null, notes: '', createdAt: 0, updatedAt: 0,
      },
      {
        id: '2', name: 'Mortgage', type: 'debt-mortgage', balance: '300000', currency: 'CAD',
        institution: 'TD', assetAllocation: { stocks: 0, bonds: 0, cash: 0, other: 0 },
        contributionRoom: null, interestRate: '4.8', notes: '', createdAt: 0, updatedAt: 0,
      },
    ]
    const netWorth = { netWorth: new Decimal(-275000), totalAssets: new Decimal(25000), totalDebts: new Decimal(300000) }

    const prompt = buildSystemPrompt(profile, accounts, netWorth)

    expect(prompt).toContain('Ontario')
    expect(prompt).toContain('85,000')
    expect(prompt).toContain('1990-05-15')
    expect(prompt).toContain('TFSA')
    expect(prompt).toContain('25,000')
    expect(prompt).toContain('Mortgage')
    expect(prompt).toContain('300,000')
    expect(prompt).toContain('Net Worth')
    expect(prompt).toContain('45,000')
    expect(prompt).toContain('Canadian personal finance')
  })

  it('should handle empty accounts and missing profile gracefully', () => {
    const prompt = buildSystemPrompt(undefined, [], {
      netWorth: new Decimal(0), totalAssets: new Decimal(0), totalDebts: new Decimal(0),
    })
    expect(prompt).toContain('Canadian personal finance')
    expect(prompt).toContain('No accounts')
    expect(prompt).toContain('No profile')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useFinancialContext.test.ts`
Expected: FAIL — `buildSystemPrompt` not found.

- [ ] **Step 3: Implement the financial context hook**

Create `src/hooks/useFinancialContext.ts`:

```typescript
import { useAccounts, useUserProfile, useNetWorth } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { ACCOUNT_TYPE_LABELS, isDebtType } from '@/types'
import type { Account, UserProfile } from '@/types'
import type Decimal from 'decimal.js'

const PROVINCE_NAMES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
}

export function buildSystemPrompt(
  profile: UserProfile | undefined,
  accounts: Account[],
  netWorth: { netWorth: Decimal; totalAssets: Decimal; totalDebts: Decimal }
): string {
  const profileSection = profile
    ? `Province: ${PROVINCE_NAMES[profile.province] ?? profile.province}
Annual Income: ${formatCurrency(profile.annualIncome || '0')}
Date of Birth: ${profile.dateOfBirth || 'Not set'}
Years Contributed to CPP: ${profile.yearsContributedCPP}`
    : 'No profile data configured yet.'

  const accountLines = accounts.length > 0
    ? accounts.map(a => {
        const type = ACCOUNT_TYPE_LABELS[a.type]
        const debt = isDebtType(a.type) ? ' (debt)' : ''
        const rate = a.interestRate ? ` @ ${a.interestRate}%` : ''
        return `- ${a.name} (${type}${debt}): ${formatCurrency(a.balance || '0')}${rate}`
      }).join('\n')
    : 'No accounts configured yet.'

  const contributionSection = profile
    ? `TFSA Cumulative Contributions: ${formatCurrency(profile.tfsaCumulativeContributions || '0')} (Lifetime max: $109,000)
RRSP Cumulative Contributions: ${formatCurrency(profile.rrspCumulativeContributions || '0')}
FHSA Cumulative Contributions: ${formatCurrency(profile.fhsaCumulativeContributions || '0')} (Lifetime max: $40,000)
First-Time Home Buyer: ${profile.fhsaFirstHomeOwner ? 'Yes' : 'No'}`
    : 'No profile data configured yet.'

  return `You are a knowledgeable Canadian personal finance advisor embedded in Loonie Finance, a personal finance app. You have access to the user's real financial data shown below.

Give specific, actionable advice based on their actual numbers. When relevant, cite current Canadian tax rules, contribution limits, and rates. Use web search for current interest rates, market data, or recent policy changes.

Always note that you are not a licensed financial advisor and your advice is for informational purposes.

=== USER FINANCIAL PROFILE ===
${profile ? profileSection : 'No profile configured yet.'}

=== ACCOUNTS ===
${accountLines}

=== NET WORTH ===
Total Assets: ${formatCurrency(netWorth.totalAssets.toString())}
Total Debts: ${formatCurrency(netWorth.totalDebts.toString())}
Net Worth: ${formatCurrency(netWorth.netWorth.toString())}

=== CONTRIBUTION ROOM ===
${contributionSection}`
}

export function useFinancialContext(): string {
  const profile = useUserProfile()
  const accounts = useAccounts()
  const netWorth = useNetWorth()
  return buildSystemPrompt(profile, accounts, netWorth)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useFinancialContext.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFinancialContext.ts src/hooks/__tests__/useFinancialContext.test.ts
git commit -m "feat: add useFinancialContext hook for building AI system prompt"
```

---

### Task 4: Install marked and dompurify

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install marked dompurify
npm install -D @types/dompurify
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add marked and dompurify for AI response markdown rendering"
```

---

### Task 5: ChatMessage Component

**Files:**
- Create: `src/components/advisor/ChatMessage.tsx`

- [ ] **Step 1: Create the ChatMessage component**

Create `src/components/advisor/ChatMessage.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/advisor/ChatMessage.tsx
git commit -m "feat: add ChatMessage component with markdown rendering"
```

---

### Task 6: ChatInput Component

**Files:**
- Create: `src/components/advisor/ChatInput.tsx`

- [ ] **Step 1: Create the ChatInput component**

Create `src/components/advisor/ChatInput.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/advisor/ChatInput.tsx
git commit -m "feat: add ChatInput component with auto-resize and keyboard handling"
```

---

### Task 7: Advisor Page

**Files:**
- Create: `src/pages/Advisor.tsx`
- Modify: `src/App.tsx:1-29` (add route)
- Modify: `src/components/layout/Sidebar.tsx:1-61` (add nav item)

- [ ] **Step 1: Create the Advisor page**

Create `src/pages/Advisor.tsx`:

```tsx
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
```

- [ ] **Step 2: Add the route to App.tsx**

In `src/App.tsx`, add the import and route:

```typescript
import { Advisor } from '@/pages/Advisor'
```

Add inside the `<Route element={<Layout />}>` block, before the settings route:

```tsx
<Route path="/advisor" element={<Advisor />} />
```

- [ ] **Step 3: Add nav item to Sidebar**

In `src/components/layout/Sidebar.tsx`:

Add to the lucide-react imports:
```typescript
import { BotMessageSquare } from 'lucide-react'
```

(Import it alongside the existing icons.)

Add to the `navItems` array, after the Tax item and before Settings:

```typescript
{ to: '/advisor', icon: BotMessageSquare, label: 'AI Advisor' },
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`

1. Open the app — verify "AI Advisor" appears in the sidebar between "Tax" and "Settings"
2. Click it — without an API key set, should show the "Set up your API key" prompt with link to Settings
3. Go to Settings, add an API key, save
4. Return to AI Advisor — should see the chat interface with context banner and suggested questions
5. Click a suggested question — should stream a response from GPT-4o
6. Type a follow-up question — verify conversation continues
7. Click "New Chat" — conversation clears

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass plus the new tests from Tasks 2 and 3.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Advisor.tsx src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add AI Advisor chat page with streaming responses and financial context"
```
