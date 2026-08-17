'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, truncate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

interface ConversationItem {
  id: string
  title: string
  status: string
  worker_id: string | null
  created_at: string
  updated_at: string
  worker: { name: string; avatar: string } | null
  message_count?: number
}

interface ConversationListProps {
  workspaceId: string
  activeConversationId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function ConversationList({
  workspaceId,
  activeConversationId,
  onSelect,
  onNew,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const { success: toastSuccess } = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select('*, worker:workers(name, avatar)')
      .eq('workspace_id', workspaceId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(30)

    if (data) setConversations(data as any)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleArchive(conv: ConversationItem) {
    const ok = await confirm({
      title: 'Archive Conversation',
      message: `Archive "${conv.title}"? It will be hidden but not deleted.`,
      confirmLabel: 'Archive',
    })
    if (!ok) return
    const supabase = createClient()
    await supabase.from('conversations').update({ status: 'archived' }).eq('id', conv.id)
    setConversations(prev => prev.filter(c => c.id !== conv.id))
    toastSuccess('Conversation archived')
    if (conv.id === activeConversationId && conversations.length > 1) {
      const next = conversations.find(c => c.id !== conv.id)
      if (next) onSelect(next.id)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 }}>
          Conversations
        </span>
        <button
          className="btn btn-ghost btn-icon"
          style={{ padding: 3, color: 'var(--text-muted)' }}
          onClick={onNew}
          title="New conversation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '4px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--bg-overlay)' }} className="animate-pulse-slow" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No conversations yet
          </div>
        ) : (
          conversations.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConversationId}
              onSelect={() => onSelect(conv.id)}
              onArchive={() => handleArchive(conv)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ConvItem({
  conv, isActive, onSelect, onArchive,
}: {
  conv: ConversationItem
  isActive: boolean
  onSelect: () => void
  onArchive: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 8px',
        borderRadius: 8,
        background: isActive ? 'var(--accent-muted)' : hover ? 'var(--bg-hover)' : 'transparent',
        border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
        cursor: 'pointer', marginBottom: 2,
        transition: 'all 0.1s',
      }}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Worker avatar */}
      <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.7 }}>
        {conv.worker?.avatar ?? '💬'}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {truncate(conv.title, 32)}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {conv.worker?.name ? `${conv.worker.name} · ` : ''}{formatRelativeTime(conv.updated_at)}
        </div>
      </div>

      {/* Handoff badge */}
      {conv.status === 'handoff' && (
        <span style={{ fontSize: '0.5625rem', padding: '1px 4px', borderRadius: 3, background: 'rgba(99,102,241,0.15)', color: 'var(--accent-hover)', border: '1px solid var(--accent-border)', flexShrink: 0 }}>
          HO
        </span>
      )}

      {/* Archive button on hover */}
      {hover && !isActive && (
        <button
          onClick={e => { e.stopPropagation(); onArchive() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px 2px', flexShrink: 0, lineHeight: 1 }}
          title="Archive"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </button>
      )}
    </div>
  )
}
