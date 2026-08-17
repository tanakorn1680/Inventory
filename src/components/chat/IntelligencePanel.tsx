'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface SuggestedTask {
  title: string
  description: string | null
  priority: 0 | 1 | 2
  status: 'todo' | 'in_progress'
}

interface SuggestedMemory {
  id: string
  type: string
  content: string
  approved: boolean
}

interface IntelligencePanelProps {
  workspaceId: string
  conversationId: string
  onTasksAdded?: (count: number) => void
  onMemoriesApproved?: (count: number) => void
}

const PRIORITY_LABELS = ['Normal', 'High', 'Critical']
const PRIORITY_COLORS = ['var(--text-muted)', '#f59e0b', '#ef4444']

const MEMORY_TYPE_ICONS: Record<string, string> = {
  goal: '🎯', requirement: '📋', decision: '⚖️',
  architecture: '🏗️', known_issue: '⚠️', note: '📝',
}

export function IntelligencePanel({
  workspaceId, conversationId, onTasksAdded, onMemoriesApproved,
}: IntelligencePanelProps) {
  const [open, setOpen] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingMemory, setLoadingMemory] = useState(false)
  const [tasks, setTasks] = useState<SuggestedTask[]>([])
  const [memories, setMemories] = useState<SuggestedMemory[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set())
  const [savingTasks, setSavingTasks] = useState(false)
  const [savingMemories, setSavingMemories] = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()

  const suggestTasks = useCallback(async () => {
    setLoadingTasks(true)
    try {
      const res = await fetch('/api/intelligence/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, workspace_id: workspaceId }),
      })
      const data = await res.json()
      setTasks(data.tasks ?? [])
      setSelectedTasks(new Set(data.tasks.map((_: any, i: number) => i)))
    } catch {
      toastError('Failed to suggest tasks')
    } finally {
      setLoadingTasks(false)
    }
  }, [conversationId, workspaceId, toastError])

  const extractMemory = useCallback(async () => {
    setLoadingMemory(true)
    try {
      const res = await fetch('/api/intelligence/auto-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, workspace_id: workspaceId }),
      })
      const data = await res.json()
      const mems = (data.memories ?? []).map((m: any) => ({ ...m, approved: false }))
      setMemories(mems)
      setSelectedMemories(new Set(mems.map((m: any) => m.id)))
    } catch {
      toastError('Failed to extract memory')
    } finally {
      setLoadingMemory(false)
    }
  }, [conversationId, workspaceId, toastError])

  async function saveTasks() {
    const toSave = tasks.filter((_, i) => selectedTasks.has(i))
    if (!toSave.length) return
    setSavingTasks(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('tasks')
      .insert(toSave.map(t => ({
        workspace_id: workspaceId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        progress: 0,
        suggested_by: 'ai',
      })))
      .select()
    setSavingTasks(false)
    if (error) { toastError('Failed to save tasks'); return }
    toastSuccess(`${data?.length ?? 0} task${data?.length !== 1 ? 's' : ''} added`)
    onTasksAdded?.(data?.length ?? 0)
    setTasks([])
  }

  async function approveMemories() {
    const toApprove = memories.filter(m => selectedMemories.has(m.id))
    if (!toApprove.length) return
    setSavingMemories(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('project_memories')
      .update({ approved: true })
      .in('id', toApprove.map(m => m.id))
    setSavingMemories(false)
    if (error) { toastError('Failed to approve memories'); return }
    toastSuccess(`${toApprove.length} memor${toApprove.length !== 1 ? 'ies' : 'y'} saved`)
    onMemoriesApproved?.(toApprove.length)
    setMemories([])
  }

  const toggleTask = (i: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleMemory = (id: string) => {
    setSelectedMemories(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setOpen(!open)}
        title="AI Intelligence"
        style={{
          color: open ? 'var(--accent-hover)' : 'var(--text-muted)',
          background: open ? 'var(--accent-muted)' : 'transparent',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          <path d="M12 6v6l4 2" />
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
            width: 340,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            zIndex: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            animation: 'slideUp 0.15s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>✨</span>
              <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', flex: 1 }}>AI Intelligence</span>
              <button className="btn btn-ghost btn-icon" style={{ padding: 2 }} onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>

              {/* ─── Task Suggestions ─────────────────────────── */}
              <Section
                title="Task Suggestions"
                description="Extract actionable tasks from this conversation"
                icon="✅"
                onRun={suggestTasks}
                loading={loadingTasks}
                buttonLabel="Suggest Tasks"
                hasResults={tasks.length > 0}
              >
                {tasks.length > 0 && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                      {tasks.map((task, i) => (
                        <label
                          key={i}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '7px 9px', borderRadius: 7,
                            background: selectedTasks.has(i) ? 'var(--accent-muted)' : 'var(--bg-overlay)',
                            border: `1px solid ${selectedTasks.has(i) ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer', transition: 'all 0.1s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTasks.has(i)}
                            onChange={() => toggleTask(i)}
                            style={{ marginTop: 2, accentColor: 'var(--accent-primary)', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                                {task.description}
                              </div>
                            )}
                          </div>
                          {task.priority > 0 && (
                            <span style={{ fontSize: '0.625rem', color: PRIORITY_COLORS[task.priority], fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>
                              {PRIORITY_LABELS[task.priority].toUpperCase()}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={saveTasks}
                      disabled={savingTasks || selectedTasks.size === 0}
                      style={{ width: '100%' }}
                    >
                      {savingTasks ? 'Adding…' : `Add ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
                    </button>
                  </>
                )}
              </Section>

              {/* ─── Memory Extraction ────────────────────────── */}
              <Section
                title="Extract Memory"
                description="Save project knowledge from this conversation"
                icon="🧠"
                onRun={extractMemory}
                loading={loadingMemory}
                buttonLabel="Extract Knowledge"
                hasResults={memories.length > 0}
              >
                {memories.length > 0 && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                      {memories.map(mem => (
                        <label
                          key={mem.id}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '7px 9px', borderRadius: 7,
                            background: selectedMemories.has(mem.id) ? 'rgba(99,102,241,0.1)' : 'var(--bg-overlay)',
                            border: `1px solid ${selectedMemories.has(mem.id) ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer', transition: 'all 0.1s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMemories.has(mem.id)}
                            onChange={() => toggleMemory(mem.id)}
                            style={{ marginTop: 2, accentColor: 'var(--accent-primary)', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                              <span style={{ fontSize: 11 }}>{MEMORY_TYPE_ICONS[mem.type] ?? '📌'}</span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--accent-hover)', fontWeight: 600, textTransform: 'capitalize' }}>{mem.type}</span>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                              {mem.content}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={approveMemories}
                      disabled={savingMemories || selectedMemories.size === 0}
                      style={{ width: '100%' }}
                    >
                      {savingMemories ? 'Saving…' : `Save ${selectedMemories.size} Memor${selectedMemories.size !== 1 ? 'ies' : 'y'}`}
                    </button>
                  </>
                )}
              </Section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Section({
  title, description, icon, onRun, loading, buttonLabel, hasResults, children,
}: {
  title: string
  description: string
  icon: string
  onRun: () => void
  loading: boolean
  buttonLabel: string
  hasResults: boolean
  children?: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--bg-overlay)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      padding: '10px 11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: hasResults ? 10 : 7 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8125rem' }}>{title}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        </div>
        {!hasResults && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRun}
            disabled={loading}
            style={{ fontSize: '0.75rem', flexShrink: 0, padding: '4px 9px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />
                Analyzing…
              </span>
            ) : buttonLabel}
          </button>
        )}
        {hasResults && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRun}
            disabled={loading}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 6px' }}
            title="Re-run"
          >
            ↻
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
