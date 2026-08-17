import type { Message } from '@/lib/types'

// Rough token estimates (conservative)
const AVG_CHARS_PER_TOKEN = 3.5
const SYSTEM_PROMPT_RESERVE = 4_000   // tokens reserved for system prompt + memory
const RESPONSE_RESERVE      = 8_096   // tokens reserved for response
const CONTEXT_WINDOW        = 180_000 // safe limit (under 200k)

const USABLE_TOKENS = CONTEXT_WINDOW - SYSTEM_PROMPT_RESERVE - RESPONSE_RESERVE

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
}

export interface ContextResult {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  included_count: number
  total_count: number
  estimated_tokens: number
  truncated: boolean
}

/**
 * Builds a token-aware message context for the AI API.
 * Strategy:
 *   1. Always include the first message (context anchor)
 *   2. Always include the last N messages (recency)
 *   3. Fill remaining budget from middle, newest first
 *   4. Inject a "gap" marker when messages are omitted
 */
export function buildContextWindow(
  messages: Message[],
  systemPromptLength = 0
): ContextResult {
  const historyMessages = messages.filter(
    m => m.role === 'user' || m.role === 'assistant'
  )

  if (historyMessages.length === 0) {
    return { messages: [], included_count: 0, total_count: 0, estimated_tokens: 0, truncated: false }
  }

  const systemReserve = Math.ceil(systemPromptLength / AVG_CHARS_PER_TOKEN)
  const budget = USABLE_TOKENS - systemReserve

  // Check if all messages fit
  const totalText = historyMessages.map(m => m.content).join('')
  const totalTokens = estimateTokens(totalText)

  if (totalTokens <= budget) {
    return {
      messages: historyMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      included_count: historyMessages.length,
      total_count: historyMessages.length,
      estimated_tokens: totalTokens,
      truncated: false,
    }
  }

  // Need to truncate — keep first + last N
  const ANCHOR = 1    // first message always included
  const RECENT = 10   // last 10 messages always included

  const anchorMsgs = historyMessages.slice(0, ANCHOR)
  const recentMsgs = historyMessages.slice(-RECENT)
  const middleMsgs = historyMessages.slice(ANCHOR, historyMessages.length - RECENT)

  let usedTokens = estimateTokens(anchorMsgs.map(m => m.content).join(''))
    + estimateTokens(recentMsgs.map(m => m.content).join(''))

  // Fill from middle, newest first (closer to recent = more relevant)
  const includedMiddle: Message[] = []
  for (let i = middleMsgs.length - 1; i >= 0; i--) {
    const t = estimateTokens(middleMsgs[i].content)
    if (usedTokens + t > budget - 200) break  // 200 token buffer for gap marker
    includedMiddle.unshift(middleMsgs[i])
    usedTokens += t
  }

  // Build final ordered list
  const omittedCount = middleMsgs.length - includedMiddle.length
  const finalMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  for (const m of anchorMsgs) {
    finalMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }

  if (omittedCount > 0) {
    // Gap marker — injected as assistant message to not confuse the model
    finalMessages.push({
      role: 'assistant',
      content: `[Context summary: ${omittedCount} earlier message${omittedCount !== 1 ? 's' : ''} omitted to fit context window. Conversation continues below.]`,
    })
  }

  for (const m of includedMiddle) {
    finalMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }

  for (const m of recentMsgs) {
    finalMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }

  return {
    messages: finalMessages,
    included_count: anchorMsgs.length + includedMiddle.length + recentMsgs.length,
    total_count: historyMessages.length,
    estimated_tokens: usedTokens,
    truncated: omittedCount > 0,
  }
}

/**
 * Summarizes a long conversation into a compact work context string.
 * Used when building handoff work packages.
 */
export function summarizeRecentWork(messages: Message[], maxChars = 1200): string {
  const assistantMsgs = messages
    .filter(m => m.role === 'assistant')
    .slice(-6)

  if (!assistantMsgs.length) return ''

  const combined = assistantMsgs
    .map(m => m.content.slice(0, 300))
    .join('\n\n---\n\n')

  return combined.length > maxChars
    ? combined.slice(0, maxChars) + '…'
    : combined
}
