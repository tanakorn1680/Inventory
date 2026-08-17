'use client'

import { useState, useEffect } from 'react'
import type { Worker, Message, Task } from '@/lib/types'
import { ENERGY_CONFIG, getEnergyStatus } from '@/lib/types'
import { buildWorkPackageSummary } from '@/lib/ai/workpackage'
import { useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'
import { createClient } from '@/lib/supabase/client'

interface HandoffModalProps {
  workspaceId: string
  conversationId: string
  fromWorker: Worker
  allWorkers: Worker[]
  messages: Message[]
  onClose: () => void
  onHandoffComplete: (toWorker: Worker, newConversationId: string) => void
}

export function HandoffModal({
  workspaceId,
  conversationId,
  fromWorker,
  allWorkers,
  messages,
  onClose,
  onHandoffComplete,
}: HandoffModalProps) {
  const [toWorker, setToWorker] = useState<Worker | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [memories, setMemories] = useState<any[]>([])
  const [workPackage, setWorkPackage] = useState<ReturnType<typeof buildWorkPackageSummary> | null>(null)
  const [step, setStep] = useState<'select' | 'preview' | 'executing'>('select')
  const [executing, setExecuting] = useState(false)
  const [customNote, setCustomNote] = useState('')

  const availableWorkers = allWorkers.filter(w => w.id !== fromWorker.id && w.status !== 'exhausted')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('priority', { ascending: false }),
        supabase.from('project_memories').select('*').eq('workspace_id', workspaceId),
      ])
      if (t) setTasks(t)
      if (m) setMemories(m)
    }
    load()
  }, [workspaceId])

  function handleSelectWorker(w: Worker) {
    setToWorker(w)
    const pkg = buildWorkPackageSummary({
      messages,
      tasks,
      memories,
      fromWorker,
      toWorker: w,
      goal: memories.find(m => m.type === 'goal')?.content,
    })
    setWorkPackage(pkg)
    setStep('preview')
  }

  async function executeHandoff() {
    if (!toWorker || !workPackage) return
    setExecuting(true)
    setStep('executing')

    const supabase = createClient()

    // Build full context message for new worker
    const contextMessage = workPackage.context_for_next_worker +
      (customNote ? `\n\n## Additional Note from User\n${customNote}` : '')

    // Save work package
    const { data: pkg } = await supabase
      .from('work_packages')
      .insert({
        workspace_id: workspaceId,
        goal: workPackage.goal,
        completed: workPackage.completed,
        in_progress: workPackage.in_progress,
        pending: workPackage.pending,
        important_decisions: workPackage.important_decisions,
        known_issues: workPackage.known_issues,
        recent_results: workPackage.recent_results,
        last_worker_id: fromWorker.id,
      })
      .select().single()

    // Create new conversation for new worker
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        worker_id: toWorker.id,
        title: `Handoff from ${fromWorker.name}`,
        status: 'active',
      })
      .select().single()

    if (!newConv) { setExecuting(false); return }

    // Inject context as system message
    await supabase.from('messages').insert({
      conversation_id: newConv.id,
      workspace_id: workspaceId,
      worker_id: toWorker.id,
      role: 'user',
      content: contextMessage,
      content_type: 'text',
      metadata: { is_handoff_context: true },
    })

    // Archive old conversation
    await supabase
      .from('conversations')
      .update({ status: 'handoff' })
      .eq('id', conversationId)

    // Record handoff
    await supabase.from('handoffs').insert({
      workspace_id: workspaceId,
      work_package_id: pkg?.id ?? null,
      from_worker_id: fromWorker.id,
      to_worker_id: toWorker.id,
      from_conversation_id: conversationId,
      to_conversation_id: newConv.id,
      reason: 'manual',
      status: 'completed',
      context_snapshot: workPackage,
      completed_at: new Date().toISOString(),
    })

    // Update workspace current worker
    await supabase
      .from('workspaces')
      .update({ current_worker_id: toWorker.id, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    onHandoffComplete(toWorker, newConv.id)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-panel"
        style={{ maxWidth: step === 'preview' ? 600 : 460, maxHeight: '90dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
              {step === 'select' ? 'Hand Off Task' : step === 'preview' ? 'Review Handoff' : 'Executing…'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {step === 'select' && `From ${fromWorker.avatar} ${fromWorker.name} → new worker`}
              {step === 'preview' && `Handoff to ${toWorker?.avatar} ${toWorker?.name}`}
            </p>
          </div>
          {!executing && (
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Step: Select Worker */}
        {step === 'select' && (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {availableWorkers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>No other workers available</div>
                <div style={{ fontSize: '0.875rem' }}>
                  <a href="/workers" style={{ color: 'var(--accent-hover)' }}>Create more workers</a> to enable handoffs
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {availableWorkers.map(w => (
                  <HandoffWorkerOption
                    key={w.id}
                    worker={w}
                    onClick={() => handleSelectWorker(w)}
                  />
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: '100%', marginTop: 12 }}>
              Cancel
            </button>
          </div>
        )}

        {/* Step: Preview Work Package */}
        {step === 'preview' && workPackage && toWorker && (
          <>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                <StatBox label="Done" value={workPackage.completed.length} color="var(--success)" />
                <StatBox label="In Progress" value={workPackage.in_progress.length} color="var(--accent-primary)" />
                <StatBox label="Pending" value={workPackage.pending.length} color="var(--text-muted)" />
              </div>

              {/* Context preview */}
              <div style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: 12,
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                maxHeight: 220,
                overflowY: 'auto',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                marginBottom: 12,
              }}>
                {workPackage.context_for_next_worker.slice(0, 800)}
                {workPackage.context_for_next_worker.length > 800 && '…'}
              </div>

              {/* Optional note */}
              <div>
                <label className="label">Add a note for {toWorker.name} <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Any specific instructions for the next worker…"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-md" onClick={() => setStep('select')} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary btn-md" onClick={executeHandoff} style={{ flex: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
                </svg>
                Hand Off to {toWorker.name}
              </button>
            </div>
          </>
        )}

        {/* Step: Executing */}
        {step === 'executing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: 14 }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--border-default)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} className="animate-spin" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>Creating handoff…</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Briefing {toWorker?.avatar} {toWorker?.name} on the project
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HandoffWorkerOption({ worker, onClick }: { worker: Worker; onClick: () => void }) {
  const energy = useWorkerEnergyData(worker.id)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: 'var(--bg-overlay)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.12s', width: '100%',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--accent-muted)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-overlay)' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {worker.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{worker.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{worker.role}</div>
        <div style={{ marginTop: 5 }}>
          <div style={{ height: 3, background: 'var(--bg-base)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99 }} />
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: cfg.color }}>{pct}%</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>energy</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--bg-overlay)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}
