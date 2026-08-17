'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceStore } from '@/lib/store'
import type { Workspace } from '@/lib/types'
import { truncate, formatRelativeTime } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/office',   icon: '🏢', label: 'Office' },
  { href: '/workers',  icon: '👥', label: 'Workers' },
  { href: '/usage',    icon: '📊', label: 'Usage' },
  { href: '/settings', icon: '⚙️',  label: 'Settings' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspaces, setWorkspaces } = useWorkspaceStore()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email ?? '')

      const { data } = await supabase
        .from('workspaces')
        .select('*')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (data) setWorkspaces(data)
    }

    load()
  }, [setWorkspaces])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/office') return pathname === '/office'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        padding: '16px 14px 12px',
        display: 'flex', alignItems: 'center',
        gap: 10, borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30,
          background: 'var(--accent-primary)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🏢</div>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', letterSpacing: '-0.02em' }}>
          AI Office
        </span>
        {onClose && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            style={{ marginLeft: 'auto', padding: '4px' }}
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Main nav */}
      <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
            onClick={onClose}
          >
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="divider" style={{ margin: '8px 0' }} />

      {/* Workspaces */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '0 12px 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Workspaces
          </span>
          <Link
            href="/office"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20,
              borderRadius: 4,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 16, lineHeight: 1,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="New workspace"
          >
            +
          </Link>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {workspaces.length === 0 ? (
            <div style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}>
              No workspaces yet
            </div>
          ) : (
            workspaces.map(ws => (
              <WorkspaceItem
                key={ws.id}
                workspace={ws}
                isActive={pathname === `/workspace/${ws.id}`}
                onClick={onClose}
              />
            ))
          )}
        </div>
      </div>

      {/* User footer */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'var(--accent-muted)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'var(--accent-hover)',
            flexShrink: 0,
          }}>
            {userEmail.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {truncate(userEmail, 24) || 'User'}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleLogout}
            title="Sign out"
            style={{ padding: 4, flexShrink: 0, color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceItem({
  workspace,
  isActive,
  onClick,
}: {
  workspace: Workspace
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={`/workspace/${workspace.id}`}
      className={`nav-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ gap: 8, padding: '6px 10px' }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{workspace.icon || '📁'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.875rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)',
        }}>
          {workspace.name}
        </div>
      </div>
    </Link>
  )
}
