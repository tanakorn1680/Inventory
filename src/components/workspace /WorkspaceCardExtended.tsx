'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Workspace } from '@/lib/types'
import { formatCostShort, formatRelativeTime } from '@/lib/utils'

interface WorkspaceStats {
  message_count: number
  file_count: number
  task_count: number
  tasks_done: number
  handoff_count: number
  cost_total: number
}

interface WorkspaceCardExtendedProps {
  workspace: Workspace
}

export function WorkspaceCardExtended({ workspace }: WorkspaceCardExtendedProps) {
  const [stats, setStats] = useState<WorkspaceStats | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [
        { count: msgCount },
        { count: fileCount },
        { data: tasks },
        { count: handoffCount },
        { data: usage },
      ] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
        supabase.from('files').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
        supabase.from('tasks').select('status').eq('workspace_id', workspace.id),
        supabase.from('handoffs').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id).eq('status', 'completed'),
        supabase.from('usage_logs').select('estimated_cost').eq('workspace_id', workspace.id),
      ])

      setStats({
        message_count: msgCount ?? 0,
        file_count: fileCount ?? 0,
        task_count: tasks?.length ?? 0,
        tasks_done: tasks?.filter(t => t.status === 'done').length ?? 0,
        handoff_count: handoffCount ?? 0,
        cost_total: usage?.reduce((s, u) => s + (u.estimated_cost ?? 0), 0) ?? 0,
      })
    }
    load()
  }, [workspace.id])

  return (
    <Link href={`/workspace/${workspace.id}`} style={{ textDecoration: 'none' }}>
      <div
        className="card card-hover"
        style={{ padding: 16, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {workspace.icon || '📁'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workspace.name}
            </div>
            {workspace.description && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspace.description}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <MiniStat icon="💬" value={stats.message_count} label="msgs" />
            <MiniStat icon="✅" value={`${stats.tasks_done}/${stats.task_count}`} label="tasks" />
            <MiniStat icon="📁" value={stats.file_count} label="files" />
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatRelativeTime(workspace.updated_at)}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {stats && stats.handoff_count > 0 && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--accent-hover)', background: 'var(--accent-muted)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--accent-border)' }}>
                🔀 {stats.handoff_count}
              </span>
            )}
            {stats && stats.cost_total > 0 && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {formatCostShort(stats.cost_total)}
              </span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

function MiniStat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div style={{
      background: 'var(--bg-overlay)', borderRadius: 6,
      padding: '5px 7px', display: 'flex', alignItems: 'center', gap: 5,
      border: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
