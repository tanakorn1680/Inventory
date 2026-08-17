'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Worker } from '@/lib/types'
import { ContextWindowBadge } from '@/components/chat/ContextWindowBadge'

interface ChatComposerProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  worker?: Worker | null
  conversationId?: string
  messageCount?: number
}

export function ChatComposer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = 'Message…',
  worker,
  conversationId,
  messageCount = 0,
}: ChatComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftKey = conversationId ? `ai-office:draft:${conversationId}` : null

  // Restore draft on mount
  useEffect(() => {
    if (!draftKey) return
    const saved = localStorage.getItem(draftKey)
    if (saved) {
      setValue(saved)
      // Resize to match content
      setTimeout(() => {
        const el = textareaRef.current
        if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' }
      }, 0)
    }
  }, [draftKey])

  // Persist draft on change
  useEffect(() => {
    if (!draftKey) return
    if (value) localStorage.setItem(draftKey, value)
    else localStorage.removeItem(draftKey)
  }, [value, draftKey])

  function handleSend() {
    const content = value.trim()
    if (!content || isStreaming || disabled) return
    setValue('')
    if (draftKey) localStorage.removeItem(draftKey)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSend(content)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Cmd/Ctrl+Enter also sends
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const canSend = value.trim().length > 0 && !isStreaming && !disabled

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onFocusCapture={e => {
        e.currentTarget.style.borderColor = 'var(--accent-border)'
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)'
      }}
      onBlurCapture={e => {
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '12px 14px 4px',
          color: 'var(--text-primary)',
          fontSize: '0.9375rem',
          lineHeight: 1.55,
          resize: 'none',
          fontFamily: 'inherit',
          maxHeight: 200,
          overflowY: 'auto',
          display: 'block',
        }}
      />

      {/* Bottom toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 10px 10px',
        gap: 6,
      }}>
        {/* Worker + model info */}
        {worker && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            flex: 1,
          }}>
            <span>{worker.avatar}</span>
            <span>{worker.name}</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>{worker.model.split('-').slice(1, 3).join(' ')}</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>{worker.effort} effort</span>
          </div>
        )}

        {!worker && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flex: 1 }}>
            {value.length > 0 ? `${value.length} chars` : 'Enter to send · Shift+Enter for new line'}
          </span>
        )}

        <ContextWindowBadge conversationId={conversationId} messageCount={messageCount} />

        {/* Stop / Send */}
        {isStreaming ? (
          <button
            className="btn btn-danger btn-sm"
            onClick={onStop}
            style={{ gap: 5, flexShrink: 0 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSend}
            disabled={!canSend}
            style={{ gap: 5, flexShrink: 0, opacity: canSend ? 1 : 0.4, cursor: canSend ? 'pointer' : 'default' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            Send
          </button>
        )}
      </div>
    </div>
  )
}
