'use client'

import { useEffect, useState } from 'react'

interface ContextWindowBadgeProps {
  conversationId: string | undefined
  messageCount: number
}

interface ContextStats {
  total_messages: number
  included_messages: number
  estimated_tokens: number
  capacity_percent: number
  truncated: boolean
}

export function ContextWindowBadge({ conversationId, messageCount }: ContextWindowBadgeProps) {
  const [stats, setStats] = useState<ContextStats | null>(null)

  useEffect(() => {
    if (!conversationId || messageCount < 20) {
      setStats(null)
      return
    }

    async function check() {
      const res = await fetch('/api/intelligence/context-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, system_prompt_length: 2000 }),
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    }

    check()
  }, [conversationId, messageCount])

  if (!stats) return null

  const pct = stats.capacity_percent
  const color = pct >= 80 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e'
  const label = pct >= 80 ? 'Context near limit' : pct >= 60 ? 'Context filling up' : null

  if (!label && !stats.truncated) return null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 8px', borderRadius: 6,
        background: `${color}14`,
        border: `1px solid ${color}28`,
        fontSize: '0.6875rem', color,
        fontWeight: 500,
      }}
      title={`Context window: ${stats.estimated_tokens.toLocaleString()} tokens (${pct}%). ${stats.truncated ? `${stats.total_messages - stats.included_messages} older messages hidden.` : ''}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
      {stats.truncated
        ? `${stats.total_messages - stats.included_messages} msgs hidden (${pct}%)`
        : label}
    </div>
  )
}
