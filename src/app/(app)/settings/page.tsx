'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    daily_budget: 5,
    monthly_budget: 50,
    budget_warning_threshold: 80,
    advanced_mode: false,
    auto_handoff: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState('')
  const [settingsId, setSettingsId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSettings(data)
        setSettingsId(data.id)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      user_id: userId,
      daily_budget: settings.daily_budget,
      monthly_budget: settings.monthly_budget,
      budget_warning_threshold: settings.budget_warning_threshold,
      advanced_mode: settings.advanced_mode,
      auto_handoff: settings.auto_handoff,
    }

    if (settingsId) {
      await supabase.from('user_settings').update(payload).eq('id', settingsId)
    } else {
      const { data } = await supabase.from('user_settings').insert(payload).select().single()
      if (data) setSettingsId(data.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function update<K extends keyof UserSettings>(key: K, val: UserSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="main-header" style={{ flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>Settings</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
            {/* Budget */}
            <Section title="Budget Limits" icon="💰" description="Set spending limits to control AI costs">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Daily Limit ($)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.daily_budget ?? 5}
                    onChange={e => update('daily_budget', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Monthly Limit ($)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={settings.monthly_budget ?? 50}
                    onChange={e => update('monthly_budget', parseFloat(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="label">
                  Warning Threshold: <strong style={{ color: 'var(--accent-hover)' }}>{settings.budget_warning_threshold ?? 80}%</strong>
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.budget_warning_threshold ?? 80}
                  onChange={e => update('budget_warning_threshold', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  <span>50%</span><span>95%</span>
                </div>
              </div>
            </Section>

            {/* Behavior */}
            <Section title="Behavior" icon="⚙️" description="Control how AI Office behaves">
              <Toggle
                label="Auto Handoff"
                description="Automatically suggest handoff when a worker is running low on energy"
                checked={settings.auto_handoff ?? true}
                onChange={v => update('auto_handoff', v)}
              />
              <Toggle
                label="Advanced Mode"
                description="Show token counts, costs, and metadata on every message"
                checked={settings.advanced_mode ?? false}
                onChange={v => update('advanced_mode', v)}
              />
            </Section>

            {/* Danger zone */}
            <Section title="Account" icon="👤">
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 8,
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}>
                To delete your account or export your data, contact support.
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title, icon, description, children,
}: {
  title: string; icon: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: description ? 4 : 0 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9375rem' }}>{title}</span>
        </div>
        {description && (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 99, flexShrink: 0,
          background: checked ? 'var(--accent-primary)' : 'var(--bg-overlay)',
          border: '1px solid',
          borderColor: checked ? 'transparent' : 'var(--border-default)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2, left: checked ? 20 : 2,
          width: 16, height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  )
}
