'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

type MemoryType = 'goal' | 'requirement' | 'decision' | 'architecture' | 'known_issue' | 'todo' | 'note'

interface Memory {
  id: string
  workspace_id: string
  type: MemoryType
  content: string
  update_mode: string
  approved: boolean
  last_updated_by: string
  created_at: string
  updated_at: string
}

const MEMORY_TYPES: { type: MemoryType; label: string; icon: string; color: string }[] = [
  { type: 'goal',         label: 'Goal',          icon: '🎯', color: '#6366f1' },
  { type: 'requirement',  label: 'Requirement',   icon: '📋', color: '#3b82f6' },
  { type: 'decision',     label: 'Decision',      icon: '⚖️',  color: '#f59e0b' },
  { type: 'architecture', label: 'Architecture',  icon: '🏗️', color: '#8b5cf6' },
  { type: 'known_issue',  label: 'Known Issue',   icon: '⚠️',  color: '#ef4444' },
  { type: 'todo',         label: 'To Do',         icon: '✅', color: '#22c55e' },
  { type: 'note',         label: 'Note',          icon: '📝', color: '#6b7280' },
]

const ALL_FILTER = '__all__'

export default function MemoryPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>(ALL_FILTER)
  const [showCreate, setShowCreate] = useState(false)
  const [editMemory, setEditMemory] = useState<Memory | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('project_memories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('type')
      .order('created_at', { ascending: false })
    if (data) setMemories(data)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Delete Memory', message: 'Delete this memory entry? This cannot be undone.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    const supabase = createClient()
    const { error } = await supabase.from('project_memories').delete().eq('id', id)
    if (error) { toastError('Failed to delete'); return }
    setMemories(prev => prev.filter(m => m.id !== id))
    toastSuccess('Memory entry deleted')
  }

  const filtered = filter === ALL_FILTER
    ? memories
    : memories.filter(m => m.type === filter)

  const counts: Record<string, number> = {}
  for (const m of memories) counts[m.type] = (counts[m.type] ?? 0) + 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>
            Project Memory
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
              {memories.length} entries
            </span>
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Entry
          </button>
        </div>

        {/* Type filters */}
        {/* Pending AI-suggested memories banner */}
        {memories.filter(m => !m.approved).length > 0 && (
          <div style={{
            padding: '8px 12px', marginBottom: 8,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid var(--accent-border)',
            borderRadius: 8, fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'var(--accent-hover)', flex: 1 }}>
              ✨ {memories.filter(m => !m.approved).length} AI-extracted memor{memories.filter(m => !m.approved).length !== 1 ? 'ies' : 'y'} pending approval
            </span>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
              onClick={async () => {
                const supabase = createClient()
                const pendingIds = memories.filter(m => !m.approved).map(m => m.id)
                await supabase.from('project_memories').update({ approved: true }).in('id', pendingIds)
                setMemories(prev => prev.map(m => pendingIds.includes(m.id) ? { ...m, approved: true } : m))
              }}
            >
              Approve All
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 8px', color: 'var(--text-muted)' }}
              onClick={async () => {
                const supabase = createClient()
                const pendingIds = memories.filter(m => !m.approved).map(m => m.id)
                await supabase.from('project_memories').delete().in('id', pendingIds)
                setMemories(prev => prev.filter(m => !pendingIds.includes(m.id)))
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter(ALL_FILTER)}
            className="btn btn-sm"
            style={{
              background: filter === ALL_FILTER ? 'var(--accent-muted)' : 'var(--bg-overlay)',
              color: filter === ALL_FILTER ? 'var(--accent-hover)' : 'var(--text-secondary)',
              border: filter === ALL_FILTER ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
            }}
          >
            All ({memories.length})
          </button>
          {MEMORY_TYPES.map(mt => {
            const count = counts[mt.type] ?? 0
            if (count === 0) return null
            const isActive = filter === mt.type
            return (
              <button
                key={mt.type}
                onClick={() => setFilter(mt.type)}
                className="btn btn-sm"
                style={{
                  background: isActive ? `${mt.color}22` : 'var(--bg-overlay)',
                  color: isActive ? mt.color : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? mt.color + '44' : 'var(--border-subtle)'}`,
                }}
              >
                {mt.icon} {mt.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <MemorySkeleton />
        ) : filtered.length === 0 ? (
          <EmptyMemory onAdd={() => setShowCreate(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
            {filtered.map(mem => (
              <MemoryCard
                key={mem.id}
                memory={mem}
                onEdit={() => setEditMemory(mem)}
                onDelete={() => handleDelete(mem.id)}
              />
            ))}
          </div>
        )}
      </div>

      {(showCreate || editMemory) && (
        <MemoryModal
          memory={editMemory ?? undefined}
          workspaceId={workspaceId}
          onClose={() => { setShowCreate(false); setEditMemory(null) }}
          onSaved={(m) => {
            if (editMemory) {
              setMemories(prev => prev.map(x => x.id === m.id ? m : x))
            } else {
              setMemories(prev => [m, ...prev])
            }
            setShowCreate(false)
            setEditMemory(null)
          }}
        />
      )}
    </div>
  )
}

function MemoryCard({ memory, onEdit, onDelete }: { memory: Memory; onEdit: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const mt = MEMORY_TYPES.find(t => t.type === memory.type) ?? MEMORY_TYPES[6]
  const isLong = memory.content.length > 200

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        borderColor: hover ? 'var(--border-default)' : 'var(--border-subtle)',
        transition: 'all 0.12s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Type badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          background: `${mt.color}18`,
          border: `1px solid ${mt.color}33`,
          borderRadius: 99,
          flexShrink: 0,
          marginTop: 1,
        }}>
          <span style={{ fontSize: 11 }}>{mt.icon}</span>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: mt.color }}>{mt.label}</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            overflow: expanded ? 'visible' : 'hidden',
            maxHeight: expanded ? 'none' : '4.5em',
          }}>
            {memory.content}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-hover)', fontSize: '0.75rem', padding: '3px 0', marginTop: 2 }}
            >
              {expanded ? '↑ Show less' : '↓ Show more'}
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {memory.last_updated_by ? `by ${memory.last_updated_by}` : ''} {formatRelativeTime(memory.updated_at)}
            </span>
            {!memory.approved && (
              <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>Pending</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 3, opacity: hover ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} title="Delete" style={{ color: 'var(--danger)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function MemoryModal({
  memory, workspaceId, onClose, onSaved,
}: {
  memory?: Memory
  workspaceId: string
  onClose: () => void
  onSaved: (m: Memory) => void
}) {
  const [type, setType] = useState<MemoryType>(memory?.type ?? 'goal')
  const [content, setContent] = useState(memory?.content ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      workspace_id: workspaceId,
      type,
      content: content.trim(),
      update_mode: 'auto',
      approved: true,
      last_updated_by: user?.email ?? 'user',
    }

    if (memory) {
      const { data } = await supabase.from('project_memories').update(payload).eq('id', memory.id).select().single()
      if (data) onSaved(data)
    } else {
      const { data } = await supabase.from('project_memories').insert(payload).select().single()
      if (data) onSaved(data)
    }
    setSaving(false)
  }

  const mt = MEMORY_TYPES.find(t => t.type === type)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
            {memory ? 'Edit Memory' : 'Add Memory Entry'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {MEMORY_TYPES.map(mt => (
                <button
                  key={mt.type}
                  onClick={() => setType(mt.type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 99, fontSize: '0.8125rem',
                    background: type === mt.type ? `${mt.color}22` : 'var(--bg-overlay)',
                    border: `1px solid ${type === mt.type ? mt.color + '44' : 'var(--border-subtle)'}`,
                    color: type === mt.type ? mt.color : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  {mt.icon} {mt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Content</label>
            <textarea
              className="input"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={getPlaceholder(type)}
              rows={5}
              autoFocus
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost btn-md" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary btn-md" onClick={handleSave} disabled={!content.trim() || saving} style={{ flex: 2 }}>
            {saving ? 'Saving…' : memory ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getPlaceholder(type: MemoryType): string {
  const map: Record<MemoryType, string> = {
    goal: 'What is the main goal of this project?',
    requirement: 'Describe a specific requirement or constraint…',
    decision: 'What decision was made and why?',
    architecture: 'Describe the architecture, stack, or design pattern…',
    known_issue: 'Describe the known issue or bug…',
    todo: 'What still needs to be done?',
    note: 'Any other notes or context…',
  }
  return map[type]
}

function EmptyMemory({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 4 }}>🧠</div>
      <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', margin: 0 }}>No memory yet</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6, maxWidth: 300 }}>
        Store goals, decisions, and architecture notes here. Workers can reference this context during conversations.
      </p>
      <button className="btn btn-primary btn-md" onClick={onAdd}>Add First Entry</button>
    </div>
  )
}

function MemorySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ padding: '14px 16px', height: 80 }} >
          <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: '30%', marginBottom: 10 }} className="animate-pulse-slow" />
          <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: '80%', marginBottom: 6 }} className="animate-pulse-slow" />
          <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: '60%' }} className="animate-pulse-slow" />
        </div>
      ))}
    </div>
  )
}
