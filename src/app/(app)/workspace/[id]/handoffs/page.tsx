'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'

interface HandoffRecord {
  id: string
  from_worker_id: string
  to_worker_id: string
  reason: string
  status: string
  context_snapshot: Record<string, any>
  created_at: string
  completed_at: string | null
  from_worker: { name: string; avatar: string } | null
  to_worker:   { name: string; avatar: string } | null
  work_package: {
    goal: string
    completed: string[]
    in_progress: string[]
    pending: string[]
    important_decisions: string[]
    known_issues: string[]
  } | null
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  manual:  { label: 'Manual',   color: '#6366f1' },
  limit:   { label: 'Energy Low', color: '#f59e0b' },
  auto:    { label: 'Auto',     color: '#22c55e' },
  error:   { label: 'Error',    color: '#ef4444' },
}

export default function HandoffsPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HandoffRecord | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('handoffs')
      .select(`
        *,
        from_worker:workers!handoffs_from_worker_id_fkey(name, avatar),
        to_worker:workers!handoffs_to_worker_id_fkey(name, avatar),
        work_package:work_packages(goal, completed, in_progress, pending, important_decisions, known_issues)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setHandoffs(data as any)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

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
          Handoff History
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
            {handoffs.length} handoff{handoffs.length !== 1 ? 's' : ''}
          </span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ color: 'var(--text-secondary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Handoff list */}
        <div style={{
          width: selected ? 320 : '100%',
          borderRight: selected ? '1px solid var(--border-subtle)' : 'none',
          overflowY: 'auto',
          padding: '16px',
          flexShrink: 0,
          transition: 'width 0.2s ease',
        }}>
          {loading ? (
            <HandoffSkeleton />
          ) : handoffs.length === 0 ? (
            <EmptyHandoffs />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {handoffs.map(h => (
                <HandoffCard
                  key={h.id}
                  handoff={h}
                  isSelected={selected?.id === h.id}
                  onClick={() => setSelected(selected?.id === h.id ? null : h)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Work package detail panel */}
        {selected && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <WorkPackageDetail handoff={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Handoff Card ─────────────────────────────────────────────────────────────

function HandoffCard({
  handoff, isSelected, onClick,
}: {
  handoff: HandoffRecord
  isSelected: boolean
  onClick: () => void
}) {
  const reasonCfg = REASON_LABELS[handoff.reason] ?? { label: handoff.reason, color: '#6b7280' }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '14px 16px',
        background: isSelected ? 'var(--accent-muted)' : 'var(--bg-elevated)',
        border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
        borderRadius: 10,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.borderColor = 'var(--border-default)' } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' } }}
    >
      {/* Workers row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WorkerChip name={handoff.from_worker?.name ?? '?'} avatar={handoff.from_worker?.avatar ?? '🤖'} />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <WorkerChip name={handoff.to_worker?.name ?? '?'} avatar={handoff.to_worker?.avatar ?? '🤖'} />
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: '0.6875rem', fontWeight: 600,
          padding: '2px 7px', borderRadius: 99,
          background: `${reasonCfg.color}18`,
          color: reasonCfg.color,
          border: `1px solid ${reasonCfg.color}33`,
        }}>
          {reasonCfg.label}
        </span>
      </div>

      {/* Goal preview */}
      {handoff.work_package?.goal && (
        <div style={{
          fontSize: '0.8125rem', color: 'var(--text-secondary)',
          lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {handoff.work_package.goal}
        </div>
      )}

      {/* Stats + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {handoff.work_package && (
          <>
            <StatPill label="Done" value={handoff.work_package.completed?.length ?? 0} color="#22c55e" />
            <StatPill label="Pending" value={handoff.work_package.pending?.length ?? 0} color="#6366f1" />
          </>
        )}
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {formatRelativeTime(handoff.created_at)}
        </span>
        <span className={`badge ${handoff.status === 'completed' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
          {handoff.status}
        </span>
      </div>
    </button>
  )
}

function WorkerChip({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 14 }}>{avatar}</span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 99,
      background: `${color}14`,
      border: `1px solid ${color}28`,
      color,
    }}>
      <strong>{value}</strong> {label}
    </div>
  )
}

// ─── Work Package Detail ──────────────────────────────────────────────────────

function WorkPackageDetail({ handoff, onClose }: { handoff: HandoffRecord; onClose: () => void }) {
  const pkg = handoff.work_package
  const snap = handoff.context_snapshot

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
            Work Package
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>{handoff.from_worker?.avatar}</span>
            <span>{handoff.from_worker?.name}</span>
            <span>→</span>
            <span>{handoff.to_worker?.avatar}</span>
            <span>{handoff.to_worker?.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(handoff.created_at)}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Goal */}
      {pkg?.goal && (
        <Section title="🎯 Goal">
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {pkg.goal}
          </p>
        </Section>
      )}

      {/* Tasks grid */}
      {pkg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <TaskGroup label="✅ Completed" items={pkg.completed ?? []} color="#22c55e" />
          <TaskGroup label="⚡ In Progress" items={pkg.in_progress ?? []} color="#6366f1" />
          <TaskGroup label="📋 Pending" items={pkg.pending ?? []} color="#6b7280" />
        </div>
      )}

      {/* Decisions */}
      {(pkg?.important_decisions?.length ?? 0) > 0 && (
        <Section title="⚖️ Key Decisions">
          <ul style={{ margin: 0, paddingLeft: '1.2em', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(pkg?.important_decisions ?? []).map((d, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{d}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Known Issues */}
      {(pkg?.known_issues?.length ?? 0) > 0 && (
        <Section title="⚠️ Known Issues">
          <ul style={{ margin: 0, paddingLeft: '1.2em', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(pkg?.known_issues ?? []).map((issue, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: '#fca5a5', lineHeight: 1.5 }}>{issue}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Full context snapshot */}
      {snap?.context_for_next_worker && (
        <Section title="📄 Full Briefing">
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '12px 14px',
            fontSize: '0.8125rem', color: 'var(--text-secondary)',
            lineHeight: 1.7, whiteSpace: 'pre-wrap',
            maxHeight: 300, overflowY: 'auto',
            fontFamily: 'monospace',
          }}>
            {snap.context_for_next_worker}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function TaskGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-overlay)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color, marginBottom: 7 }}>{label} ({items.length})</div>
      {items.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1em', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyHandoffs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 44 }}>🔀</div>
      <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', margin: 0 }}>No handoffs yet</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6, maxWidth: 300 }}>
        When you hand off a task to another worker, the full work package will appear here.
      </p>
    </div>
  )
}

function HandoffSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card animate-pulse-slow" style={{ padding: '14px 16px', height: 100 }} />
      ))}
    </div>
  )
}
