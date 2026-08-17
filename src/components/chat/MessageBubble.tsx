'use client'

import { useState, useEffect } from 'react'
import type { Message, Worker } from '@/lib/types'
import { formatRelativeTime, formatCostShort } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  worker?: Worker | null
  isStreaming?: boolean
}

export function MessageBubble({ message, worker, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, animationName: 'fadeIn' }} className="animate-fade-in">
        <div className="chat-bubble-user">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} className="animate-fade-in">
      {/* Worker avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, marginTop: 2,
      }}>
        {worker?.avatar ?? '🤖'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Worker name + time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {worker?.name ?? 'Assistant'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatRelativeTime(message.created_at)}
          </span>
          {message.metadata?.estimated_cost && (
            <span style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-overlay)',
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
            }}>
              {formatCostShort(message.metadata.estimated_cost)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className={`chat-bubble-assistant prose-ai ${isStreaming ? 'cursor-blink' : ''}`}>
          <MarkdownContent content={message.content} />
        </div>

        {/* Metadata */}
        {message.metadata && !isStreaming && (
          <MessageMeta metadata={message.metadata} />
        )}
      </div>
    </div>
  )
}

// ─── SIMPLE MARKDOWN RENDERER ─────────────────────────────────────────────────
// Avoids external deps — handles the most common patterns

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <div key={i} style={{ position: 'relative', margin: '8px 0' }}>
          {lang && (
            <div style={{
              fontSize: '0.6875rem', color: 'var(--text-muted)',
              padding: '4px 12px 0',
              background: 'var(--bg-base)',
              borderRadius: '8px 8px 0 0',
              border: '1px solid var(--border-default)',
              borderBottom: 'none',
              fontFamily: 'monospace',
            }}>
              {lang}
            </div>
          )}
          <pre style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: lang ? '0 0 8px 8px' : '8px',
            padding: '12px 14px',
            overflowX: 'auto',
            margin: 0,
          }}>
            <code style={{
              fontFamily: "'Geist Mono', 'Fira Code', monospace",
              fontSize: '0.8125rem',
              color: '#e2e8f0',
            }}>
              {codeLines.join('\n')}
            </code>
          </pre>
        </div>
      )
      i++
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontWeight: 600, fontSize: '1rem', color: '#fff', margin: '1em 0 0.4em' }}>{renderInline(line.slice(4))}</h3>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontWeight: 600, fontSize: '1.1rem', color: '#fff', margin: '1.2em 0 0.4em' }}>{renderInline(line.slice(3))}</h2>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontWeight: 700, fontSize: '1.25rem', color: '#fff', margin: '1.2em 0 0.4em' }}>{renderInline(line.slice(2))}</h1>)
      i++; continue
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '1em 0' }} />)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{
          borderLeft: '3px solid var(--accent-primary)',
          paddingLeft: 12, margin: '6px 0',
          color: 'var(--text-secondary)', fontStyle: 'italic',
        }}>
          {renderInline(line.slice(2))}
        </blockquote>
      )
      i++; continue
    }

    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].replace(/^[-*+] /, ''))
        i++
      }
      elements.push(
        <ul key={i} style={{ paddingLeft: '1.4em', margin: '6px 0' }}>
          {items.map((item, j) => (
            <li key={j} style={{ margin: '3px 0' }}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      elements.push(
        <ol key={i} style={{ paddingLeft: '1.4em', margin: '6px 0' }}>
          {items.map((item, j) => (
            <li key={j} style={{ margin: '3px 0' }}>{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line → paragraph break
    if (line.trim() === '') {
      i++; continue
    }

    // Paragraph
    elements.push(
      <p key={i} style={{ margin: '4px 0', lineHeight: 1.65 }}>
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** or __text__
  // Italic *text* or _text_
  // Code `text`
  // Split on these patterns
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600, color: '#fff' }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i} style={{ fontWeight: 600, color: '#fff' }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: '0.85em',
          color: '#93c5fd',
          fontFamily: "'Geist Mono', monospace",
        }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function MessageMeta({ metadata }: { metadata: NonNullable<Message['metadata']> }) {
  const [show, setShow] = useState(false)
  if (!metadata.model) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '0.6875rem',
          display: 'flex', alignItems: 'center', gap: 3, padding: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        {show ? 'Hide' : 'Details'}
      </button>

      {show && (
        <div style={{
          marginTop: 4,
          padding: '6px 10px',
          background: 'var(--bg-overlay)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex', gap: 12, flexWrap: 'wrap',
        }}>
          <span>Model: <strong style={{ color: 'var(--text-secondary)' }}>{metadata.model}</strong></span>
          {metadata.input_tokens && <span>In: <strong style={{ color: 'var(--text-secondary)' }}>{metadata.input_tokens.toLocaleString()}</strong></span>}
          {metadata.output_tokens && <span>Out: <strong style={{ color: 'var(--text-secondary)' }}>{metadata.output_tokens.toLocaleString()}</strong></span>}
          {metadata.estimated_cost && <span>Cost: <strong style={{ color: 'var(--text-secondary)' }}>{formatCostShort(metadata.estimated_cost)}</strong></span>}
          {metadata.effort && <span>Effort: <strong style={{ color: 'var(--text-secondary)' }}>{metadata.effort}</strong></span>}
        </div>
      )}
    </div>
  )
}
