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
