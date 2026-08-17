'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useWorkerStore } from '@/lib/store'
import { useWorkerEnergy, useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'
import { ENERGY_CONFIG, getEnergyStatus, ANTHROPIC_MODELS } from '@/lib/types'
import type { Worker } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { formatCostShort } from '@/lib/utils'

export default function WorkspaceWorkersPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const { workers, setWorkers } = useWorkerStore()
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [currentWorkerId, setCurrentWorkerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()

  const modelMap = Object.fromEntries(workers.map(w => [w.id, w.model]))
  useWorkerEnergy(workers.map(w => w.id), modelMap)

  const load = useCallback(async () => {
    const supabase = createClient()

    const [{ data: allWorkers }, { data: assigned }, { data: ws }] = await Promise.all([
      supabase.from('workers').select('*').eq('is_deleted', false).order('created_at'),
      supabase.from('workspace_workers').select('worker_id').eq('workspace_id', workspaceId),
      supabase.from('workspaces').select('current_worker_id').eq('id', workspaceId).single(),
    ])

    if (allWorkers) setWorkers(allWorkers)
    if (assigned) setAssignedIds(new Set(assigned.map((r: any) => r.worker_id)))
    if (ws) setCurrentWorkerId(ws.current_worker_id)
    setLoading(false)
  }, [workspaceId, setWorkers])

  useEffect(() => { load() }, [load])

  async function toggleAssign(worker: Worker) {
    setSaving(worker.id)
    const supabase = createClient()
    const isAssigned = assignedIds.has(worker.id)

    if (isAssigned) {
      const { error } = await supabase
        .from('workspace_workers')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('worker_id', worker.id)
      if (error) { toastError('Failed to unassign worker'); setSaving(null); return }
      setAssignedIds(prev => { const next = new Set(prev); next.delete(worker.id); return next })
      toastSuccess(`${worker.name} removed from workspace`)
    } else {
      const { error } = await supabase
        .from('workspace_workers')
        .insert({ workspace_id: workspaceId, worker_id: worker.id })
      if (error && !error.message.includes('duplicate')) {
        toastError('Failed to assign worker'); setSaving(null); return
      }
      setAssignedIds(prev => new Set([...prev, worker.id]))
      toastSuccess(`${worker.name} added to workspace`)
    }
    setSaving(null)
  }

  async function setActive(worker: Worker) {
    setSaving(worker.id)
    const supabase = createClient()

    // Ensure assigned first
    if (!assignedIds.has(worker.id)) {
      await supabase.from('workspace_workers').insert({ workspace_id: workspaceId, worker_id: worker.id })
      setAssignedIds(prev => new Set([...prev, worker.id]))
    }

    const { error } = await supabase
      .from('workspaces')
      .update({ current_worker_id: worker.id })
      .eq('id', workspaceId)

    if (error) { toastError('Failed to set active worker'); setSaving(null); return }
    setCurrentWorkerId(worker.id)
    toastSuccess(`${worker.name} is now the active worker`)
    setSaving(null)
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: 22, height: 22, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} className="animate-spin" />
      </div>
    )
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
          Workspace Workers
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
            {assignedIds.size} assigned
          </span>
        </span>
        <Link href="/workers" className="btn btn-secondary btn-sm">
          Manage All Workers →
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {workers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>👥</div>
            <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', margin: 0 }}>No workers yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
              Create workers first, then assign them to this workspace.
            </p>
            <Link href="/workers" className="btn btn-primary btn-md">Create Workers</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Assign workers to this workspace, then set one as active. The active worker handles all conversations and receives memory context automatically.
            </p>
            {workers.map(worker => (
              <WorkerAssignRow
                key={worker.id}
                worker={worker}
                isAssigned={assignedIds.has(worker.id)}
                isActive={worker.id === currentWorkerId}
                isSaving={saving === worker.id}
                onToggleAssign={() => toggleAssign(worker)}
                onSetActive={() => setActive(worker)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WorkerAssignRow({
  worker, isAssigned, isActive, isSaving, onToggleAssign, onSetActive,
}: {
  worker: Worker
  isAssigned: boolean
  isActive: boolean
  isSaving: boolean
  onToggleAssign: () => void
  onSetActive: () => void
}) {
  const energy = useWorkerEnergyData(worker.id)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]
  const model = ANTHROPIC_MODELS.find(m => m.id === worker.model)

  return (
    <div
      className="card"
      style={{
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderColor: isActive ? 'var(--accent-border)' : isAssigned ? 'var(--border-default)' : 'var(--border-subtle)',
        background: isActive ? 'var(--accent-muted)' : 'var(--bg-elevated)',
        transition: 'all 0.15s',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg-overlay)',
        border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 19, flexShrink: 0,
      }}>
        {worker.avatar}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9375rem' }}>{worker.name}</span>
          {isActive && (
            <span className="badge badge-accent" style={{ fontSize: '0.625rem', padding: '1px 6px' }}>Active</span>
          )}
          {isAssigned && !isActive && (
            <span className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '1px 6px' }}>Assigned</span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {worker.role} · {model?.name ?? worker.model} · {worker.effort} effort
        </div>
        {/* Energy mini bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <div style={{ flex: 1, maxWidth: 100, height: 3, background: 'var(--bg-overlay)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: '0.6875rem', color: cfg.color, fontWeight: 600 }}>{pct}%</span>
          {energy && energy.estimated_cost_today > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              · {formatCostShort(energy.estimated_cost_today)} today
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!isActive && isAssigned && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onSetActive}
            disabled={isSaving}
            style={{ fontSize: '0.75rem' }}
          >
            Set Active
          </button>
        )}
        {!isAssigned && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onSetActive}
            disabled={isSaving}
            style={{ fontSize: '0.75rem' }}
          >
            {isSaving ? '…' : 'Assign & Activate'}
          </button>
        )}
        {isAssigned && !isActive && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleAssign}
            disabled={isSaving}
            style={{ fontSize: '0.75rem', color: 'var(--danger)' }}
          >
            Remove
          </button>
        )}
        {isActive && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleAssign}
            disabled={isSaving}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.5 }}
            title="Cannot remove the active worker"
          >
            Active
          </button>
        )}
      </div>
    </div>
  )
}
