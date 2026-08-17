'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceStore, useUIStore } from '@/lib/store'
import type { Workspace } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'
import { WorkspaceCardExtended } from '@/components/workspace/WorkspaceCardExtended'

const ICONS = ['📁', '🚀', '🎯', '💻', '🔥', '⚡', '🎨', '📊', '🛠️', '🌟', '🏗️', '🔬']

export default function OfficePage() {
  const { workspaces, setWorkspaces, addWorkspace } = useWorkspaceStore()
  const { setSidebarOpen, setWorkerPanelOpen } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIcon, setNewIcon] = useState('📁')

  useEffect(() => {
    setSidebarOpen(true)
    setWorkerPanelOpen(true)
  }, [setSidebarOpen, setWorkerPanelOpen])

  const loadWorkspaces = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
    if (data) setWorkspaces(data)
    setLoading(false)
  }, [setWorkspaces])

  useEffect(() => { loadWorkspaces() }, [loadWorkspaces])

  async function createWorkspace() {
    if (!newName.trim()) return
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
        icon: newIcon,
        status: 'active',
        is_deleted: false,
      })
      .select()
      .single()

    if (data) {
      addWorkspace(data)
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      setNewIcon('📁')
    }
    setCreating(false)
  }

  return (
    <div style={{
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
    }}>
      {/* Header */}
      <div className="main-header">
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: '#fff' }}>Office</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.875rem' }}>
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Workspace
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {workspaces.map(ws => (
              <WorkspaceCardExtended key={ws.id} workspace={ws} />
            ))}
            <NewWorkspaceCard onClick={() => setShowCreate(true)} />
          </div>
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="dialog-overlay" onClick={() => setShowCreate(false)}>
          <div className="dialog-panel" onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>
              New Workspace
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Icon picker */}
              <div>
                <label className="label">Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewIcon(icon)}
                      style={{
                        width: 36, height: 36,
                        borderRadius: 8,
                        fontSize: 18,
                        background: newIcon === icon ? 'var(--accent-muted)' : 'var(--bg-overlay)',
                        border: newIcon === icon ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  placeholder="e.g. Mayor Service v3"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && createWorkspace()}
                />
              </div>

              <div>
                <label className="label">Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  className="input"
                  placeholder="Brief description of this workspace"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                className="btn btn-ghost btn-md"
                onClick={() => setShowCreate(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-md"
                onClick={createWorkspace}
                disabled={!newName.trim() || creating}
                style={{ flex: 2 }}
              >
                {creating ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function NewWorkspaceCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px dashed var(--border-default)',
        borderRadius: 12,
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 100,
        transition: 'all 0.15s',
        color: 'var(--text-muted)',
        width: '100%',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-border)'
        e.currentTarget.style.background = 'var(--accent-muted)'
        e.currentTarget.style.color = 'var(--accent-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>New Workspace</span>
    </button>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      gap: 12,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 4 }}>🏢</div>
      <h2 style={{ fontWeight: 700, color: '#fff', fontSize: '1.25rem', margin: 0 }}>
        Your office is empty
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
        Create your first workspace to start working with AI workers.
      </p>
      <button className="btn btn-primary btn-md" onClick={onNew} style={{ marginTop: 4 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create Workspace
      </button>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-overlay)' }} className="animate-pulse-slow" />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, background: 'var(--bg-overlay)', borderRadius: 4, width: '70%', marginBottom: 6 }} className="animate-pulse-slow" />
          <div style={{ height: 12, background: 'var(--bg-overlay)', borderRadius: 4, width: '50%' }} className="animate-pulse-slow" />
        </div>
      </div>
    </div>
  )
}
