'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceStore, useWorkerStore, useUIStore } from '@/lib/store'
import { WorkerPanel } from '@/components/layout/WorkerPanel'
import { Sidebar } from '@/components/layout/Sidebar'
import { WorkerSelector } from '@/components/workers/WorkerSelector'
import { HandoffModal } from '@/components/workers/HandoffModal'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { useWorkerEnergy } from '@/lib/hooks/useWorkerEnergy'
import { useChatStore } from '@/lib/store'
import type { Workspace, Worker } from '@/lib/types'

const TABS = [
  { key: 'chat',     label: 'Chat',     icon: '💬', href: '' },
  { key: 'files',    label: 'Files',    icon: '📁', href: '/files' },
  { key: 'tasks',    label: 'Tasks',    icon: '✅', href: '/tasks' },
  { key: 'memory',   label: 'Memory',   icon: '🧠', href: '/memory' },
  { key: 'handoffs', label: 'Handoffs', icon: '🔀', href: '/handoffs' },
  { key: 'workers',  label: 'Workers',  icon: '👥', href: '/workers' },
  { key: 'activity', label: 'Activity', icon: '📋', href: '/activity' },
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()

  const { setCurrentWorkspace } = useWorkspaceStore()
  const { workers, setWorkers, getActiveWorker, setActiveWorker } = useWorkerStore()
  const { sidebarOpen, workerPanelOpen, setSidebarOpen, setWorkerPanelOpen, toggleSidebar } = useUIStore()
  const { messages } = useChatStore()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [mobilePanel, setMobilePanel] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showHandoff, setShowHandoff] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const modelMap = Object.fromEntries(workers.map(w => [w.id, w.model]))
  useWorkerEnergy(workers.map(w => w.id), modelMap)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const init = useCallback(async () => {
    const supabase = createClient()
    const { data: ws } = await supabase.from('workspaces').select('*').eq('id', id).eq('is_deleted', false).single()
    if (!ws) { router.push('/office'); return }
    setWorkspace(ws)
    setCurrentWorkspace(ws)

    const { data: wkrs } = await supabase.from('workers').select('*').eq('is_deleted', false).order('created_at')
    if (wkrs) {
      setWorkers(wkrs)
      // Set active worker for this workspace
      if (!getActiveWorker(id)) {
        const defaultWorker = ws.current_worker_id
          ? wkrs.find((w: Worker) => w.id === ws.current_worker_id) ?? wkrs[0]
          : wkrs[0]
        if (defaultWorker) setActiveWorker(id, defaultWorker.id)
      }
    }

    // Load active conversation id
    const { data: conv } = await supabase
      .from('conversations').select('id').eq('workspace_id', id).eq('status', 'active').order('updated_at', { ascending: false }).limit(1).single()
    if (conv) setActiveConversationId(conv.id)
  }, [id, router, setCurrentWorkspace, setWorkers, getActiveWorker, setActiveWorker])

  useEffect(() => { init() }, [init])

  const activeWorker = getActiveWorker(id)

  async function handleWorkerSelect(worker: Worker) {
    setActiveWorker(id, worker.id)
    const supabase = createClient()
    await supabase.from('workspaces').update({ current_worker_id: worker.id }).eq('id', id)
  }

  function handleHandoffComplete(toWorker: Worker, newConvId: string) {
    setActiveWorker(id, toWorker.id)
    setActiveConversationId(newConvId)
    setShowHandoff(false)
    // Navigate to chat tab to see new conversation
    router.push(`/workspace/${id}`)
    router.refresh()
  }

  const base = `/workspace/${id}`
  const activeTab = TABS.find(t => {
    if (t.href === '') return pathname === base
    return pathname.startsWith(base + t.href)
  })?.key ?? 'chat'

  // Current conversation messages (for handoff context)
  const currentMessages = activeConversationId ? (messages[activeConversationId] ?? []) : []

  if (!mounted) return null

  const header = (
    <div style={{
      height: 52,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      padding: '0 4px 0 0',
      gap: 0, flexShrink: 0,
    }}>
      {/* Sidebar toggle (desktop) / menu (mobile) */}
      {isMobile ? (
        <button className="btn btn-ghost btn-icon" onClick={() => setMobileSidebar(true)} style={{ flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
        </button>
      ) : (
        <button className="btn btn-ghost btn-icon" onClick={toggleSidebar} style={{ flexShrink: 0 }} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />
          </svg>
        </button>
      )}

      {/* Workspace name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexShrink: 0, maxWidth: isMobile ? 120 : 180 }}>
        <span style={{ fontSize: 16 }}>{workspace?.icon ?? '📁'}</span>
        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {workspace?.name ?? '…'}
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', marginRight: 4, flexShrink: 0 }} />

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflowX: 'auto', minWidth: 0 }}>
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`${base}${tab.href}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: isMobile ? '6px 8px' : '6px 11px',
              borderRadius: 7, fontSize: '0.8125rem', fontWeight: 500,
              textDecoration: 'none',
              color: activeTab === tab.key ? 'var(--accent-hover)' : 'var(--text-secondary)',
              background: activeTab === tab.key ? 'var(--accent-muted)' : 'transparent',
              border: activeTab === tab.key ? '1px solid var(--accent-border)' : '1px solid transparent',
              transition: 'all 0.12s', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12 }}>{tab.icon}</span>
            {!isMobile && tab.label}
          </Link>
        ))}
      </div>

      {/* Right: worker selector + panel toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', flexShrink: 0 }}>
        <WorkerSelector
          workers={workers}
          activeWorkerId={activeWorker?.id}
          workspaceId={id}
          onSelect={handleWorkerSelect}
        />

        {/* Panel toggle (desktop) / worker icon (mobile) */}
        {isMobile ? (
          <button className="btn btn-ghost btn-icon" onClick={() => setMobilePanel(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0112 0v2" />
            </svg>
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setWorkerPanelOpen(!workerPanelOpen)}
            title={workerPanelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0112 0v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
        <MobileTabBar workspaceId={id} />

        {mobileSidebar && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }} onClick={() => setMobileSidebar(false)} />
            <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', zIndex: 50 }}>
              <Sidebar onClose={() => setMobileSidebar(false)} />
            </div>
          </>
        )}
        {mobilePanel && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }} onClick={() => setMobilePanel(false)} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 280, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)', zIndex: 50 }}>
              <WorkerPanel workspace={workspace} activeWorkerId={activeWorker?.id} onHandoff={() => { setMobilePanel(false); setShowHandoff(true) }} />
            </div>
          </>
        )}

        {showHandoff && activeWorker && activeConversationId && (
          <HandoffModal
            workspaceId={id}
            conversationId={activeConversationId}
            fromWorker={activeWorker}
            allWorkers={workers}
            messages={currentMessages}
            onClose={() => setShowHandoff(false)}
            onHandoffComplete={handleHandoffComplete}
          />
        )}
      </div>
    )
  }

  const cols = sidebarOpen && workerPanelOpen
    ? 'var(--sidebar-width) 1fr var(--worker-panel-width)'
    : sidebarOpen ? 'var(--sidebar-width) 1fr 0'
    : workerPanelOpen ? '0 1fr var(--worker-panel-width)'
    : '0 1fr 0'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gridTemplateRows: '1fr', height: '100dvh', transition: 'grid-template-columns 0.2s ease', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {sidebarOpen && <Sidebar />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {header}
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      </div>

      <div style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {workerPanelOpen && (
          <WorkerPanel
            workspace={workspace}
            activeWorkerId={activeWorker?.id}
            onHandoff={() => setShowHandoff(true)}
          />
        )}
      </div>

      {showHandoff && activeWorker && activeConversationId && (
        <HandoffModal
          workspaceId={id}
          conversationId={activeConversationId}
          fromWorker={activeWorker}
          allWorkers={workers}
          messages={currentMessages}
          onClose={() => setShowHandoff(false)}
          onHandoffComplete={handleHandoffComplete}
        />
      )}
    </div>
  )
}
