'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWorkerStore } from '@/lib/store'
import type { Task, TaskStatus, Worker } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

const COLUMNS: { status: TaskStatus; label: string; icon: string; color: string }[] = [
  { status: 'todo',        label: 'To Do',       icon: '📋', color: '#6b7280' },
  { status: 'in_progress', label: 'In Progress',  icon: '⚡',  color: '#6366f1' },
  { status: 'review',      label: 'Review',       icon: '🔍', color: '#f59e0b' },
  { status: 'done',        label: 'Done',         icon: '✅', color: '#22c55e' },
]

export default function TasksPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const { workers } = useWorkerStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const confirm = useConfirm()
  const { success: toastSuccess, error: toastError } = useToast()

  const loadTasks = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    if (data) setTasks(data)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { loadTasks() }, [loadTasks])

  async function updateStatus(task: Task, newStatus: TaskStatus) {
    const supabase = createClient()
    const progress = newStatus === 'done' ? 100 : newStatus === 'in_progress' ? 50 : task.progress
    await supabase.from('tasks').update({ status: newStatus, progress }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, progress } : t))
  }

  async function deleteTask(taskId: string) {
    const ok = await confirm({ title: 'Delete Task', message: 'Delete this task?', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toastSuccess('Task deleted')
  }

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>
          Tasks
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
            {tasks.length} total · {byStatus('done').length} done
          </span>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 20px' }}>
        {loading ? (
          <TasksSkeleton />
        ) : (
          <div style={{ display: 'flex', gap: 12, height: '100%', minWidth: 600 }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.status}
                column={col}
                tasks={byStatus(col.status)}
                workers={workers}
                onStatusChange={updateStatus}
                onEdit={setEditTask}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showCreate || editTask) && (
        <TaskModal
          task={editTask ?? undefined}
          workspaceId={workspaceId}
          workers={workers}
          onClose={() => { setShowCreate(false); setEditTask(null) }}
          onSaved={(t) => {
            if (editTask) {
              setTasks(prev => prev.map(x => x.id === t.id ? t : x))
            } else {
              setTasks(prev => [t, ...prev])
            }
            setShowCreate(false)
            setEditTask(null)
          }}
        />
      )}
    </div>
  )
}

function KanbanColumn({
  column, tasks, workers, onStatusChange, onEdit, onDelete,
}: {
  column: typeof COLUMNS[0]
  tasks: Task[]
  workers: Worker[]
  onStatusChange: (t: Task, s: TaskStatus) => void
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{
      flex: '0 0 220px',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14 }}>{column.icon}</span>
        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem', flex: 1 }}>{column.label}</span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600,
          padding: '1px 7px', borderRadius: 99,
          background: tasks.length > 0 ? `${column.color}22` : 'var(--bg-overlay)',
          color: tasks.length > 0 ? column.color : 'var(--text-muted)',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Empty
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                workers={workers}
                column={column}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({
  task, workers, column, onStatusChange, onEdit, onDelete,
}: {
  task: Task
  workers: Worker[]
  column: typeof COLUMNS[0]
  onStatusChange: (t: Task, s: TaskStatus) => void
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const assignedWorker = task.assigned_worker_id ? workers.find(w => w.id === task.assigned_worker_id) : null

  const nextStatuses = COLUMNS.filter(c => c.status !== task.status)

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 11px',
        cursor: 'pointer',
        transition: 'all 0.12s',
        borderColor: hover ? 'var(--border-default)' : 'var(--border-subtle)',
        position: 'relative',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShowMenu(false) }}
    >
      {/* Title */}
      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.8125rem', lineHeight: 1.4, marginBottom: task.description ? 5 : 8 }}>
        {task.title}
      </div>

      {task.description && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {task.description}
        </div>
      )}

      {/* Progress bar */}
      {task.progress > 0 && task.status !== 'done' && (
        <div style={{ marginBottom: 8 }}>
          <div className="energy-bar-track">
            <div className="energy-bar-fill" style={{ width: `${task.progress}%`, background: column.color }} />
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>{task.progress}%</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {assignedWorker && (
          <span title={assignedWorker.name} style={{ fontSize: 13 }}>{assignedWorker.avatar}</span>
        )}
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flex: 1 }}>
          {formatRelativeTime(task.updated_at)}
        </span>
        {task.suggested_by === 'ai' && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--accent-hover)', background: 'var(--accent-muted)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--accent-border)' }}>AI</span>
        )}

        {hover && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 3 }}
              onClick={e => { e.stopPropagation(); onEdit(task) }}
              title="Edit"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 3 }}
              onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
              title="Move"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 3, color: 'var(--danger)' }}
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              title="Delete"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Move menu */}
      {showMenu && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 20,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '4px', minWidth: 140,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600 }}>MOVE TO</div>
          {nextStatuses.map(s => (
            <button
              key={s.status}
              onClick={e => { e.stopPropagation(); onStatusChange(task, s.status); setShowMenu(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '6px 8px', borderRadius: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '0.8125rem',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: 12 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TASK MODAL ───────────────────────────────────────────────────────────────

interface TaskModalProps {
  task?: Task
  workspaceId: string
  workers: Worker[]
  onClose: () => void
  onSaved: (task: Task) => void
}

function TaskModal({ task, workspaceId, workers, onClose, onSaved }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [assignedWorker, setAssignedWorker] = useState(task?.assigned_worker_id ?? '')
  const [priority, setPriority] = useState(task?.priority ?? 0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      assigned_worker_id: assignedWorker || null,
      priority,
      progress: status === 'done' ? 100 : task?.progress ?? 0,
      suggested_by: 'user',
    }

    if (task) {
      const { data } = await supabase.from('tasks').update(payload).eq('id', task.id).select().single()
      if (data) onSaved(data)
    } else {
      const { data } = await supabase.from('tasks').insert(payload).select().single()
      if (data) onSaved(data)
    }
    setSaving(false)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
            {task ? 'Edit Task' : 'Add Task'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()} />
          </div>
          <div>
            <label className="label">Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Additional details…" rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(parseInt(e.target.value))}>
                <option value={0}>Normal</option>
                <option value={1}>High</option>
                <option value={2}>Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Assigned Worker <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <select className="input" value={assignedWorker} onChange={e => setAssignedWorker(e.target.value)}>
              <option value="">— Unassigned —</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.avatar} {w.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost btn-md" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary btn-md" onClick={handleSave} disabled={!title.trim() || saving} style={{ flex: 2 }}>
            {saving ? 'Saving…' : task ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TasksSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: '0 0 220px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-overlay)' }} className="animate-pulse-slow" />
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1, 2].map(j => (
              <div key={j} style={{ height: 70, background: 'var(--bg-overlay)', borderRadius: 8 }} className="animate-pulse-slow" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
