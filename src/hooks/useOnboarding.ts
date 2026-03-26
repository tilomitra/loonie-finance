import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { sendMessage, type ChatMessage } from '@/lib/openai'
import { ONBOARDING_SYSTEM_PROMPT } from '@/lib/onboarding-prompt'
import { OnboardingResultSchema, type OnboardingResult } from '@/lib/onboarding-schema'
import { db } from '@/db/database'
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'
import type { AccountType } from '@/types'

export type OnboardingState = 'chatting' | 'generating' | 'reviewing' | 'saving' | 'done'

function extractJsonFromMessage(content: string): string | null {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/)
  if (match) return match[1]
  return null
}

export function useOnboarding(apiKey: string | undefined) {
  const [state, setState] = useState<OnboardingState>('chatting')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedResult, setParsedResult] = useState<OnboardingResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Track full streamed content in a ref to avoid stale closures
  const streamedContentRef = useRef('')

  const sendOnboardingMessage = useCallback(async (userText: string) => {
    if (!apiKey || isStreaming) return

    setError(null)
    setParseError(null)

    const userMessage: ChatMessage = { role: 'user', content: userText }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsStreaming(true)
    setState('generating')

    const allMessages: ChatMessage[] = [
      { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
      ...updatedMessages,
    ]

    streamedContentRef.current = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      await sendMessage(apiKey, allMessages, {
        onToken: (token) => {
          streamedContentRef.current += token
          const content = streamedContentRef.current
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content }
            return updated
          })
        },
        onDone: () => {
          setIsStreaming(false)
          const finalContent = streamedContentRef.current

          // Check if the AI has outputted a JSON block
          const jsonStr = extractJsonFromMessage(finalContent)
          if (jsonStr) {
            try {
              const raw = JSON.parse(jsonStr)
              const result = OnboardingResultSchema.parse(raw)
              setParsedResult(result)
              setState('reviewing')
            } catch (e) {
              setParseError(
                e instanceof Error
                  ? `Failed to parse plan: ${e.message}`
                  : 'Failed to parse the AI-generated plan. Please try again.'
              )
              setState('chatting')
            }
          } else {
            setState('chatting')
          }
        },
        onError: (err) => {
          setIsStreaming(false)
          setState('chatting')
          setError(err.message)
        },
      })
    } catch (err) {
      setIsStreaming(false)
      setState('chatting')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [apiKey, isStreaming, messages])

  const saveData = useCallback(async () => {
    if (!parsedResult) return

    setState('saving')
    setError(null)

    try {
      const now = Date.now()

      // Save user profile
      const existing = await db.userProfile.get('singleton')
      await db.userProfile.put({
        id: 'singleton',
        dateOfBirth: parsedResult.userProfile.dateOfBirth,
        province: parsedResult.userProfile.province,
        annualIncome: parsedResult.userProfile.annualIncome,
        yearsContributedCPP: parsedResult.userProfile.yearsContributedCPP,
        tfsaCumulativeContributions: parsedResult.userProfile.tfsaCumulativeContributions,
        rrspCumulativeContributions: parsedResult.userProfile.rrspCumulativeContributions,
        fhsaCumulativeContributions: parsedResult.userProfile.fhsaCumulativeContributions,
        fhsaFirstHomeOwner: parsedResult.userProfile.fhsaFirstHomeOwner,
        openaiApiKey: existing?.openaiApiKey,
        partnerProfile: parsedResult.partnerProfile ?? undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })

      // Save accounts
      if (parsedResult.accounts.length > 0) {
        const accountsToSave = parsedResult.accounts.map(acc => ({
          id: uuidv4(),
          name: acc.name,
          type: acc.type as AccountType,
          balance: acc.balance,
          currency: 'CAD' as const,
          institution: '',
          expectedReturnRate: DEFAULT_RETURN_RATES[acc.type as AccountType] ?? '5.0',
          contributionRoom: null,
          interestRate: null,
          notes: '',
          owner: (acc.owner ?? 'self') as 'self' | 'partner' | 'joint',
          createdAt: now,
          updatedAt: now,
        }))
        await db.accounts.bulkPut(accountsToSave)
      }

      // Save life events
      if (parsedResult.lifeEvents.length > 0) {
        const eventsToSave = parsedResult.lifeEvents.map(evt => ({
          id: uuidv4(),
          name: evt.name,
          type: evt.type,
          amount: evt.amount,
          startAge: evt.startAge,
          endAge: evt.endAge,
          person: evt.person,
        }))
        await db.lifeEvents.bulkPut(eventsToSave)
      }

      setState('done')
    } catch (err) {
      setState('reviewing')
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    }
  }, [parsedResult])

  const updateParsedResult = useCallback((updater: (prev: OnboardingResult) => OnboardingResult) => {
    setParsedResult(prev => prev ? updater(prev) : prev)
  }, [])

  const reset = useCallback(() => {
    setState('chatting')
    setMessages([])
    setIsStreaming(false)
    setError(null)
    setParsedResult(null)
    setParseError(null)
    streamedContentRef.current = ''
  }, [])

  return {
    state,
    messages,
    isStreaming,
    error,
    parseError,
    parsedResult,
    sendMessage: sendOnboardingMessage,
    saveData,
    updateParsedResult,
    reset,
  }
}
