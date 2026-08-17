'use client'

import { useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useWorkerStore } from '@/lib/store'
import { useWorkerEnergy, useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'
import type { Worker, Workspace } from '@/lib/types'
import { ENERGY_CONFIG, getEnergyStatus, ANTHROPIC_MODELS } from '@/lib/types'
import { formatCostShort } from '@/lib/utils'

interface WorkerPanelProps {
  workspace?: Workspace | null
  activeWorkerId?: string
  onHandoff?: () => void
}

export function WorkerPanel({ workspace, activeWorkerId, onHandoff }: WorkerPanelProps) {
  const { workers, setWorkers } = useWorkerStore()

  const modelMap = Object.fromEntries(workers.map(w => [w.id, w.model]))
  useWorkerEnergy(workers.map(w => w.id), modelMap)

  const loadWorkers = useCallback(async () => {
    if (workers.length) return
    const supabase = createClient()
    const { data } = await supabase.from('workers').select('*').eq('is_deleted', false).order('created_at')
    if (data) setWorkers(data)
  }, [workers.length, setWorkers])

  useEffect(() => { loadWorkers() }, [loadWorkers])

  const effectiveWorkerId = activeWorkerId ?? workspace?.current_worker_id
  const activeWorker = effectiveWorkerId ? workers.find(w => w.id === effectiveWorkerId) : workers[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Active Worker Section */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Active Worker
        </div>

        {activeWorker ? (
          <ActiveWorkerCard worker={activeWorker} onHandoff={onHandoff} />
        ) : (
          <div style={{ padding: '14px 12px', background: 'var(--bg-overlay)', borderRadius: 8, textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            No worker assigned.{' '}
            <Link href="/workers" style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>Create one →</Link>
          </div>
        )}
      </div>

      {/* All Workers */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px 6px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          Team ({workers.length})
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {workers.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <Link href="/workers" style={{ color: 'var(--accent-hover)', textDecoration: 'none' }}>Create your first worker →</Link>
            </div>
          ) : (
            workers.map(w => (
              <WorkerRow key={w.id} worker={w} isActive={w.id === activeWorker?.id} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Active Worker Card ───────────────────────────────────────────────────────

function ActiveWorkerCard({ worker, onHandoff }: { worker: Worker; onHandoff?: () => void }) {
  const energy = useWorkerEnergyData(worker.id)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]
  const model = ANTHROPIC_MODELS.find(m => m.id === worker.model)

  return (
    <div>
      {/* Worker header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
          {worker.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9375rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {worker.name}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', marginTop: 2 }}>
            {model?.name ?? worker.model} · {worker.effort}
          </div>
        </div>
        <span className={`badge ${worker.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.625rem', padding: '1px 6px' }}>
          {worker.status}
        </span>
      </div>

      {/* Energy */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Energy</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: cfg.color }}>{pct}%</span>
        </div>
        <div className="energy-bar-track" style={{ height: 5 }}>
          <div className="energy-bar-fill" style={{ width: `${pct}%`, background: cfg.color }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {cfg.label}
            {pct <= 15 && ' ⚠️'}
          </span>
          {energy && energy.estimated_cost_today > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {formatCostShort(energy.estimated_cost_today)} today
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {energy && energy.requests_today > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
          <MiniStat label="Requests" value={energy.requests_today.toString()} />
          <MiniStat label="Tokens" value={fmtTok(energy.input_tokens_today + energy.output_tokens_today)} />
        </div>
      )}

      {/* Low energy warning */}
      {pct <= 15 && (
        <div style={{
          padding: '7px 10px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.18)', borderRadius: 7,
          fontSize: '0.75rem', color: '#f87171', marginBottom: 8, lineHeight: 1.4,
        }}>
          ⚠️ Energy low — consider handoff to another worker
        </div>
      )}

      {/* Handoff */}
      {onHandoff && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={onHandoff}
          style={{ width: '100%', gap: 5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          Hand Off Task
        </button>
      )}
    </div>
  )
}

// ─── Worker Row ───────────────────────────────────────────────────────────────

function WorkerRow({ worker, isActive }: { worker: Worker; isActive: boolean }) {
  const energy = useWorkerEnergyData(worker.id)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 8, marginBottom: 2,
      background: isActive ? 'var(--accent-muted)' : 'transparent',
      border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
      transition: 'all 0.1s',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
        {worker.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {worker.name}
        </div>
        <div style={{ height: 3, background: 'var(--bg-overlay)', borderRadius: 99, marginTop: 4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99, transition: 'width 0.5s ease' }} />
        </div>
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: cfg.color, flexShrink: 0 }}>
        {pct}%
      </span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-overlay)', borderRadius: 6, padding: '5px 8px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{value}</div>
    </div>
  )
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}
