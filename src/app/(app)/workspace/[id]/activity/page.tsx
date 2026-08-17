'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

interface ActivityLog {
  id: string
  workspace_id: string
  worker_id: string | null
  user_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, any>
  created_at: string
  workers?: { name: string; avatar: string } | null
}

const ACTION_ICONS: Record<string, string> = {
  message_sent:        '💬',
  message_received:    '🤖',
  file_uploaded:       '📤',
  file_deleted:        '🗑️',
  task_created:        '✅',
  task_updated:        '✏️',
  task_completed:      '🎉',
  memory_added:        '🧠',
  memory_updated:      '🔄',
  handoff_initiated:   '🔀',
  handoff_completed:   '✓',
  worker_assigned:     '👥',
  workspace_updated:   '⚙️',
}

function actionLabel(action: string, metadata: Record<string, any>): string {
  const map: Record<string, string> = {
    message_sent:      'Sent a message',
    message_received:  `${metadata.worker_name ?? 'Worker'} responded`,
    file_uploaded:     `Uploaded "${metadata.file_name ?? 'file'}"`,
    file_deleted:      `Deleted "${metadata.file_name ?? 'file'}"`,
    task_created:      `Created task "${metadata.task_title ?? ''}"`,
    task_updated:      `Updated task "${metadata.task_title ?? ''}"`,
    task_completed:    `Completed task "${metadata.task_title ?? ''}"`,
    memory_added:      'Added memory entry',
    memory_updated:    'Updated memory entry',
    handoff_initiated: 'Initiated handoff',
    handoff_completed: 'Handoff completed',
    worker_assigned:   `Assigned ${metadata.worker_name ?? 'worker'}`,
    workspace_updated: 'Updated workspace settings',
  }
  return map[action] ?? action.replace(/_/g, ' ')
}

export default function ActivityPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 40

  const load = useCallback(async (offset = 0) => {
    const supabase = createClient()
    const { data, count } = await supabase
      .from('activity_logs')
      .select('*, workers(name, avatar)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (data) {
      if (offset === 0) setLogs(data as any)
      else setLogs(prev => [...prev, ...data as any])
      setHasMore((count ?? 0) > offset + PAGE_SIZE)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load(0) }, [load])

  // Group by date
  const grouped: Record<string, ActivityLog[]> = {}
  for (const log of logs) {
    const date = new Date(log.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(log)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>
          Activity
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
            {logs.length}{hasMore ? '+' : ''} events
          </span>
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => load(0)}
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Log */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <ActivitySkeleton />
        ) : logs.length === 0 ? (
          <EmptyActivity />
        ) : (
          <div style={{ maxWidth: 680 }}>
            {Object.entries(grouped).map(([date, dateLogs]) => (
              <div key={date} style={{ marginBottom: 24 }}>
                {/* Date header */}
                <div style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {date}
                  <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                </div>

                {/* Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {dateLogs.map((log, i) => (
                    <ActivityRow key={log.id} log={log} isLast={i === dateLogs.length - 1} />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => load(logs.length)}
                style={{ width: '100%', marginTop: 8 }}
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ log, isLast }: { log: ActivityLog; isLast: boolean }) {
  const icon = ACTION_ICONS[log.action] ?? '📌'
  const label = actionLabel(log.action, log.metadata ?? {})
  const actor = log.workers?.name ?? 'You'
  const avatar = log.workers?.avatar

  return (
    <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
      {/* Timeline line */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 16, top: 32, bottom: 0, width: 1,
          background: 'var(--border-subtle)',
          zIndex: 0,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
        zIndex: 1, position: 'relative',
        marginRight: 12,
      }}>
        {avatar ? <span>{avatar}</span> : <span>{icon}</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            {actor}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

function EmptyActivity() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 4 }}>📋</div>
      <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', margin: 0 }}>No activity yet</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
        Activity will appear here as you and your workers interact with this workspace.
      </p>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-overlay)', flexShrink: 0 }} className="animate-pulse-slow" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: `${40 + i * 10}%`, marginBottom: 5 }} className="animate-pulse-slow" />
            <div style={{ height: 10, background: 'var(--bg-overlay)', borderRadius: 4, width: '20%' }} className="animate-pulse-slow" />
          </div>
        </div>
      ))}
    </div>
  )
}
