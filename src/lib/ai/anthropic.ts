import Anthropic from '@anthropic-ai/sdk'
import type { Message, Worker, Effort } from '@/lib/types'

// Support both Anthropic and Z.ai (Anthropic-compatible endpoint)
// Set Z_AI_API_KEY in Vercel env vars to use Z.ai instead of Anthropic
const isZai = !!process.env.Z_AI_API_KEY

const anthropic = new Anthropic({
  apiKey: isZai ? process.env.Z_AI_API_KEY! : process.env.ANTHROPIC_API_KEY!,
  baseURL: isZai ? 'https://api.z.ai/api/anthropic' : undefined,
})

export interface SendMessageParams {
  worker: Worker
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  onChunk?: (text: string) => void
  onUsage?: (usage: { input_tokens: number; output_tokens: number }) => void
  signal?: AbortSignal
}

function effortToBudget(effort: Effort): number | undefined {
  const map: Record<Effort, number | undefined> = {
    low: 1024,
    medium: 5000,
    high: 16000,
    auto: undefined,
  }
  return map[effort]
}

export async function streamAnthropicMessage(params: SendMessageParams): Promise<{
  full_text: string
  input_tokens: number
  output_tokens: number
  stop_reason: string
}> {
  const { worker, messages, onChunk, onUsage, signal } = params

  const model = worker.model || 'claude-sonnet-4-6'
  const supportsExtendedThinking = model.includes('opus') || model.includes('sonnet')
  const budgetTokens = supportsExtendedThinking ? effortToBudget(worker.effort) : undefined

  const requestParams: Anthropic.MessageCreateParamsStreaming = {
    model,
    max_tokens: 8096,
    system: worker.system_instructions || undefined,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    ...(budgetTokens !== undefined
      ? {
          thinking: {
            type: 'adaptive' as const,
            budget_tokens: budgetTokens,
          },
        }
      : {}),
  }

  let full_text = ''
  let input_tokens = 0
  let output_tokens = 0
  let stop_reason = 'end_turn'

  const stream = await anthropic.messages.stream(requestParams, { signal })

  for await (const event of stream) {
    if (signal?.aborted) break

    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        full_text += event.delta.text
        onChunk?.(event.delta.text)
      }
    }

    if (event.type === 'message_delta') {
      if (event.usage) {
        output_tokens = event.usage.output_tokens
      }
      if (event.delta.stop_reason) {
        stop_reason = event.delta.stop_reason
      }
    }

    if (event.type === 'message_start') {
      if (event.message.usage) {
        input_tokens = event.message.usage.input_tokens
      }
    }
  }

  onUsage?.({ input_tokens, output_tokens })

  return { full_text, input_tokens, output_tokens, stop_reason }
}

export function estimateCost(
  model: string,
  input_tokens: number,
  output_tokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 0.000015, output: 0.000075 },
    'claude-sonnet-4-6': { input: 0.000003, output: 0.000015 },
    'claude-haiku-4-5': { input: 0.00000025, output: 0.00000125 },
    'glm-5.2': { input: 0.0000014, output: 0.0000044 },
    'glm-5.1': { input: 0.0000012, output: 0.000004 },
  }
  const price = pricing[model] ?? pricing['claude-sonnet-4-6']
  return input_tokens * price.input + output_tokens * price.output
}
