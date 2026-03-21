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
