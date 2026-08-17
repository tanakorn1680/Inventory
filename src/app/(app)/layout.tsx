'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { WorkerPanel } from '@/components/layout/WorkerPanel'
import { useUIStore } from '@/lib/store'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { sidebarOpen, workerPanelOpen } = useUIStore()
  const [mounted, setMounted] = useState(false)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Workspace pages own their entire layout including sidebar
  const isWorkspace = pathname.startsWith('/workspace/')

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!mounted) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)',
      }}>
        <div className="animate-pulse-slow" style={{ fontSize: '0.875rem' }}>Loading…</div>
      </div>
    )
  }

  // Workspace pages handle their own layout
  if (isWorkspace) return <>{children}</>

  if (isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 52, background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0,
        }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setMobileSidebar(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span style={{ fontWeight: 700, color: '#fff' }}>AI Office</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
        {mobileSidebar && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }} onClick={() => setMobileSidebar(false)} />
            <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', zIndex: 50 }}>
              <Sidebar onClose={() => setMobileSidebar(false)} />
            </div>
          </>
        )}
      </div>
    )
  }

  // Desktop: sidebar + main (no worker panel on non-workspace pages)
  const cols = sidebarOpen ? 'var(--sidebar-width) 1fr' : '0 1fr'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: cols,
      height: '100dvh',
      transition: 'grid-template-columns 0.2s ease',
      overflow: 'hidden',
    }}>
      <div style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {sidebarOpen && <Sidebar />}
      </div>
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
