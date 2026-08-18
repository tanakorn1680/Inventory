/**
 * Multi-Provider AI Engine
 * 
 * Architecture: 1 Worker = 1 API Key = 1 Provider
 * 
 * Supported providers:
 * - anthropic   → Anthropic SDK (claude-*)
 * - openai      → OpenAI-compatible SDK (gpt-*, glm-*, gemini via proxy, etc.)
 * - google      → Google Gemini via OpenAI-compatible endpoint
 * - custom      → Any OpenAI-compatible endpoint with custom base_url
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Worker, Effort } from '@/lib/types'

export interface SendMessageParams {
  worker: Worker
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  onChunk?: (text: string) => void
  onUsage?: (usage: { input_tokens: number; output_tokens: number }) => void
  signal?: AbortSignal
}

export interface StreamResult {
  full_text: string
  input_tokens: number
  output_tokens: number
  stop_reason: string
}

// ─── EFFORT → BUDGET TOKENS (Anthropic only) ──────────────────────────────────

function effortToBudget(effort: Effort): number | undefined {
  const map: Record<Effort, number | undefined> = {
    low: 1024,
    medium: 5000,
    high: 16000,
    auto: undefined,
  }
  return map[effort]
}

// ─── ANTHROPIC PROVIDER ───────────────────────────────────────────────────────

async function streamAnthropic(params: SendMessageParams): Promise<StreamResult> {
  const { worker, messages, onChunk, onUsage, signal } = params

  // Per-worker API key → fallback to global env
  const apiKey = worker.api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No API key configured for this worker')

  const client = new Anthropic({
    apiKey,
    baseURL: worker.api_base_url || undefined,
  })

  const model = worker.model || 'claude-sonnet-4-6'
  const supportsThinking = model.includes('opus') || model.includes('sonnet')
  const budgetTokens = supportsThinking ? effortToBudget(worker.effort) : undefined

  const requestParams: Anthropic.MessageCreateParamsStreaming = {
    model,
    max_tokens: 8096,
    system: worker.system_instructions || undefined,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
    ...(budgetTokens !== undefined
      ? { thinking: { type: 'adaptive' as const, budget_tokens: budgetTokens } }
      : {}),
  }

  let full_text = ''
  let input_tokens = 0
  let output_tokens = 0
  let stop_reason = 'end_turn'

  const stream = await client.messages.stream(requestParams, { signal })

  for await (const event of stream) {
    if (signal?.aborted) break
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full_text += event.delta.text
      onChunk?.(event.delta.text)
    }
    if (event.type === 'message_start' && event.message.usage) {
      input_tokens = event.message.usage.input_tokens
    }
    if (event.type === 'message_delta') {
      if (event.usage) output_tokens = event.usage.output_tokens
      if (event.delta.stop_reason) stop_reason = event.delta.stop_reason
    }
  }

  onUsage?.({ input_tokens, output_tokens })
  return { full_text, input_tokens, output_tokens, stop_reason }
}

// ─── OPENAI-COMPATIBLE PROVIDER ───────────────────────────────────────────────
// Covers: OpenAI, Z.ai (GLM), Google Gemini proxy, Groq, Together, Ollama, etc.

async function streamOpenAICompatible(params: SendMessageParams): Promise<StreamResult> {
  const { worker, messages, onChunk, onUsage, signal } = params

  const apiKey = worker.api_key || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No API key configured for this worker')

  // Determine base URL per provider
  const providerBaseURLs: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    zai: 'https://api.z.ai/api/paas/v4',
  }

  const baseURL = worker.api_base_url
    || providerBaseURLs[worker.provider]
    || 'https://api.openai.com/v1'

  const model = worker.model || 'gpt-4o'

  const body = {
    model,
    max_tokens: 8096,
    stream: true,
    messages: [
      ...(worker.system_instructions ? [{ role: 'system', content: worker.system_instructions }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  }

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`${response.status} ${errText}`)
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full_text = ''
  let input_tokens = 0
  let output_tokens = 0
  let stop_reason = 'stop'
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || signal?.aborted) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          full_text += delta
          onChunk?.(delta)
        }
        const finishReason = json.choices?.[0]?.finish_reason
        if (finishReason) stop_reason = finishReason

        // Usage (some providers include this in the last chunk)
        if (json.usage) {
          input_tokens = json.usage.prompt_tokens ?? 0
          output_tokens = json.usage.completion_tokens ?? 0
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  // Estimate tokens if provider didn't return usage
  if (input_tokens === 0 && output_tokens === 0) {
    input_tokens = Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4)
    output_tokens = Math.ceil(full_text.length / 4)
  }

  onUsage?.({ input_tokens, output_tokens })
  return { full_text, input_tokens, output_tokens, stop_reason }
}

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────────

export async function streamMessage(params: SendMessageParams): Promise<StreamResult> {
  const { worker } = params

  switch (worker.provider) {
    case 'anthropic':
      return streamAnthropic(params)

    case 'openai':
    case 'google':
    case 'custom':
      return streamOpenAICompatible(params)

    default:
      throw new Error(`Unsupported provider: ${worker.provider}`)
  }
}

// ─── COST ESTIMATION ──────────────────────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-6':    { input: 0.000015,   output: 0.000075 },
  'claude-sonnet-4-6':  { input: 0.000003,   output: 0.000015 },
  'claude-haiku-4-5':   { input: 0.00000025, output: 0.00000125 },
  // OpenAI
  'gpt-4o':             { input: 0.0000025,  output: 0.00001 },
  'gpt-4o-mini':        { input: 0.00000015, output: 0.0000006 },
  'gpt-4-turbo':        { input: 0.00001,    output: 0.00003 },
  // Google
  'gemini-2.0-flash':   { input: 0.0000001,  output: 0.0000004 },
  'gemini-1.5-pro':     { input: 0.00000125, output: 0.000005 },
  // Z.ai GLM
  'glm-4-plus':         { input: 0.0000014,  output: 0.0000044 },
  'glm-4-flash':        { input: 0.0000001,  output: 0.0000001 },
}

export function estimateCost(model: string, input_tokens: number, output_tokens: number): number {
  const price = PRICING[model] ?? { input: 0.000003, output: 0.000015 }
  return input_tokens * price.input + output_tokens * price.output
}

// ─── AVAILABLE MODELS PER PROVIDER ───────────────────────────────────────────

export const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o',       name: 'GPT-4o' },
    { id: 'gpt-4o-mini',  name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo',  name: 'GPT-4 Turbo' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro',   name: 'Gemini 1.5 Pro' },
  ],
  custom: [],
}
