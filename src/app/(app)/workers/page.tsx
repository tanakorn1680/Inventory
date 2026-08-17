'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkerStore } from '@/lib/store'
import type { Worker, WorkerTemplate } from '@/lib/types'
import {
  WORKER_TEMPLATES, ANTHROPIC_MODELS, DEFAULT_PERMISSIONS,
  type Effort, type WorkerRole, type Provider, ENERGY_CONFIG, getEnergyStatus,
} from '@/lib/types'
import { PROVIDER_MODELS } from '@/lib/ai/provider'
import { formatCostShort } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { useWorkerEnergy, useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'

export default function WorkersPage() {
  const { workers, setWorkers, addWorker, updateWorker, removeWorker } = useWorkerStore()
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Worker | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()
  const confirm = useConfirm()

  // Use energy hook from store
  const modelMap = Object.fromEntries(workers.map(w => [w.id, w.model]))
  useWorkerEnergy(workers.map(w => w.id), modelMap)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at')
    if (data) setWorkers(data)
    setLoading(false)
  }, [setWorkers])

  useEffect(() => { load() }, [load])

  async function handleDelete(worker: Worker) {
    const ok = await confirm({
      title: 'Delete Worker',
      message: `Delete "${worker.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    const supabase = createClient()
    const { error } = await supabase.from('workers').update({ is_deleted: true }).eq('id', worker.id)
    if (error) { toastError('Failed to delete worker'); return }
    removeWorker(worker.id)
    toastSuccess(`${worker.name} deleted`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="main-header" style={{ flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>
          Workers
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: '0.875rem' }}>
            {workers.length} total
          </span>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Worker
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <WorkersSkeleton />
        ) : workers.length === 0 ? (
          <EmptyWorkers onNew={() => setShowCreate(true)} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {workers.map(w => (
              <WorkerCard
                key={w.id}
                worker={w}
                onEdit={() => setEditTarget(w)}
                onDelete={() => handleDelete(w)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <WorkerModal
          onClose={() => setShowCreate(false)}
          onSaved={(w) => { addWorker(w); setShowCreate(false) }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <WorkerModal
          worker={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(w) => { updateWorker(w.id, w); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

// ─── WORKER CARD ──────────────────────────────────────────────────────────────

function WorkerCard({
  worker, onEdit, onDelete,
}: {
  worker: Worker
  onEdit: () => void
  onDelete: () => void
}) {
  const energyData = useWorkerEnergyData(worker.id)
  const energy = energyData?.energy_percent ?? 100
  const status = getEnergyStatus(energy)
  const cfg = ENERGY_CONFIG[status]
  const model = ANTHROPIC_MODELS.find(m => m.id === worker.model)

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {worker.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9375rem' }}>{worker.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
            {worker.role} · {model?.name ?? worker.model}
          </div>
        </div>
        <span className={`badge ${worker.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
          {worker.status}
        </span>
      </div>

      {/* Instructions preview */}
      {worker.system_instructions && (
        <div style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          padding: '8px 10px',
          background: 'var(--bg-overlay)',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}>
          {worker.system_instructions}
        </div>
      )}

      {/* Energy */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Energy today</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cfg.color }}>{energy}%</span>
        </div>
        <div className="energy-bar-track">
          <div className="energy-bar-fill" style={{ width: `${energy}%`, background: cfg.color }} />
        </div>
      </div>

      {/* Effort badge */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="badge badge-accent">⚡ {worker.effort}</span>
        {worker.provider === 'anthropic' && <span className="badge badge-neutral">Anthropic</span>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ flex: 1 }}>
          Edit
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── WORKER MODAL ─────────────────────────────────────────────────────────────

interface WorkerModalProps {
  worker?: Worker
  onClose: () => void
  onSaved: (worker: Worker) => void
}

const AVATARS = ['👨‍💻', '🧠', '🔍', '📚', '✍️', '📊', '🤖', '⚡', '🎯', '🔧', '🚀', '🎨']

function WorkerModal({ worker, onClose, onSaved }: WorkerModalProps) {
  const isEdit = !!worker
  const [step, setStep] = useState<'template' | 'config'>(isEdit ? 'config' : 'template')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkerTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState(worker?.name ?? '')
  const [avatar, setAvatar] = useState(worker?.avatar ?? '🤖')
  const [provider, setProvider] = useState<Provider>(worker?.provider ?? 'anthropic')
  const [model, setModel] = useState(worker?.model ?? 'claude-sonnet-4-6')
  const [apiKey, setApiKey] = useState(worker?.api_key ?? '')
  const [apiBaseUrl, setApiBaseUrl] = useState(worker?.api_base_url ?? '')
  const [effort, setEffort] = useState<Effort>(worker?.effort ?? 'medium')
  const [instructions, setInstructions] = useState(worker?.system_instructions ?? '')
  const [role, setRole] = useState<WorkerRole>(worker?.role ?? 'custom')

  // When provider changes, reset model to first available
  function handleProviderChange(p: Provider) {
    setProvider(p)
    const models = PROVIDER_MODELS[p]
    if (models && models.length > 0) setModel(models[0].id)
    else setModel('')
    setApiBaseUrl('')
  }

  function applyTemplate(t: WorkerTemplate) {
    setSelectedTemplate(t)
    setName(prev => prev || t.name)
    setAvatar(t.avatar)
    setProvider('anthropic')
    setModel(t.recommended_model)
    setEffort(t.recommended_effort)
    setInstructions(t.default_instructions)
    setRole(t.role)
    setStep('config')
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: name.trim(),
      avatar,
      provider,
      model,
      api_key: apiKey.trim() || null,
      api_base_url: apiBaseUrl.trim() || null,
      role,
      system_instructions: instructions,
      effort,
      permissions: DEFAULT_PERMISSIONS,
      status: 'active' as const,
      is_deleted: false,
    }

    if (isEdit && worker) {
      const { data } = await supabase
        .from('workers').update(payload).eq('id', worker.id).select().single()
      if (data) onSaved(data)
    } else {
      const { data } = await supabase
        .from('workers').insert(payload).select().single()
      if (data) onSaved(data)
    }
    setSaving(false)
  }

  const selectedModel = provider === 'anthropic' ? ANTHROPIC_MODELS.find(m => m.id === model) : null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-panel"
        style={{ maxWidth: step === 'template' ? 580 : 520, maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
            {isEdit ? `Edit ${worker.name}` : step === 'template' ? 'Choose Template' : 'Configure Worker'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Template selection */}
        {step === 'template' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, overflowY: 'auto' }}>
              {WORKER_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 6, padding: '12px 14px',
                    background: 'var(--bg-overlay)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10, cursor: 'pointer',
                    transition: 'all 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-border)'
                    e.currentTarget.style.background = 'var(--accent-muted)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-default)'
                    e.currentTarget.style.background = 'var(--bg-overlay)'
                  }}
                >
                  <span style={{ fontSize: 22 }}>{t.avatar}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>{t.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: 14, alignSelf: 'center' }}>
              Cancel
            </button>
          </>
        )}

        {/* Config form */}
        {step === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {/* Avatar picker */}
            <div>
              <label className="label">Avatar</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AVATARS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, fontSize: 18,
                      background: avatar === a ? 'var(--accent-muted)' : 'var(--bg-overlay)',
                      border: avatar === a ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >{a}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Senior Developer" autoFocus />
            </div>

            {/* Provider */}
            <div>
              <label className="label">Provider</label>
              <select className="input" value={provider} onChange={e => handleProviderChange(e.target.value as Provider)}>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="label">Model</label>
              {PROVIDER_MODELS[provider]?.length > 0 ? (
                <select className="input" value={model} onChange={e => setModel(e.target.value)}>
                  {PROVIDER_MODELS[provider].map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="e.g. glm-4-plus, mistral-large, llama-3..."
                />
              )}
            </div>

            {/* API Key per worker */}
            <div>
              <label className="label">
                API Key
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: '0.75rem' }}>
                  (ใส่ key ของ worker นี้โดยเฉพาะ)
                </span>
              </label>
              <input
                className="input"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={
                  provider === 'anthropic' ? 'sk-ant-...' :
                  provider === 'openai' ? 'sk-...' :
                  provider === 'google' ? 'AIza...' :
                  'API Key...'
                }
              />
            </div>

            {/* Base URL — required for custom, optional for others */}
            {(provider === 'custom' || apiBaseUrl) && (
              <div>
                <label className="label">
                  Base URL
                  {provider !== 'custom' && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: '0.75rem' }}>(optional override)</span>
                  )}
                </label>
                <input
                  className="input"
                  value={apiBaseUrl}
                  onChange={e => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}
            {provider === 'custom' && !apiBaseUrl && (
              <div>
                <label className="label">Base URL <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>*required</span></label>
                <input
                  className="input"
                  value={apiBaseUrl}
                  onChange={e => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.z.ai/api/paas/v4"
                />
              </div>
            )}

            {selectedModel?.supports_effort && (
              <div>
                <label className="label">Thinking Effort</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['low', 'medium', 'high'] as Effort[]).map(e => (
                    <button
                      key={e}
                      onClick={() => setEffort(e)}
                      style={{
                        flex: 1, padding: '7px 0',
                        borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500,
                        background: effort === e ? 'var(--accent-muted)' : 'var(--bg-overlay)',
                        border: effort === e ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
                        color: effort === e ? 'var(--accent-hover)' : 'var(--text-secondary)',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >{e}</button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {effort === 'low' && 'Fast, fewer tokens. Good for simple tasks.'}
                  {effort === 'medium' && 'Balanced. Recommended for most tasks.'}
                  {effort === 'high' && 'Deep reasoning. Best for complex problems, costs more.'}
                </div>
              </div>
            )}

            <div>
              <label className="label">System Instructions</label>
              <textarea
                className="input"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Describe this worker's role, expertise, and behavior…"
                rows={5}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              {!isEdit && (
                <button className="btn btn-ghost btn-md" onClick={() => setStep('template')} style={{ flex: 1 }}>
                  ← Back
                </button>
              )}
              <button className="btn btn-ghost btn-md" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-md"
                onClick={handleSave}
                disabled={!name.trim() || saving}
                style={{ flex: 2 }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Worker'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyWorkers({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 4 }}>👥</div>
      <h2 style={{ fontWeight: 700, color: '#fff', fontSize: '1.25rem', margin: 0 }}>No workers yet</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0, maxWidth: 300, lineHeight: 1.6 }}>
        Workers are your AI team members. Each has a role, model, and instructions.
      </p>
      <button className="btn btn-primary btn-md" onClick={onNew} style={{ marginTop: 4 }}>
        Create First Worker
      </button>
    </div>
  )
}

function WorkersSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg-overlay)' }} className="animate-pulse-slow" />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, background: 'var(--bg-overlay)', borderRadius: 4, width: '60%', marginBottom: 8 }} className="animate-pulse-slow" />
              <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: '40%' }} className="animate-pulse-slow" />
            </div>
          </div>
          <div style={{ height: 40, background: 'var(--bg-overlay)', borderRadius: 6 }} className="animate-pulse-slow" />
          <div style={{ height: 4, background: 'var(--bg-overlay)', borderRadius: 99 }} className="animate-pulse-slow" />
        </div>
      ))}
    </div>
  )
}
