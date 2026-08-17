'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MOBILE_TABS = [
  { key: 'chat',     icon: '💬', label: 'Chat',    href: '' },
  { key: 'tasks',    icon: '✅', label: 'Tasks',   href: '/tasks' },
  { key: 'files',    icon: '📁', label: 'Files',   href: '/files' },
  { key: 'memory',   icon: '🧠', label: 'Memory',  href: '/memory' },
  { key: 'handoffs', icon: '🔀', label: 'Handoff', href: '/handoffs' },
]

interface MobileTabBarProps {
  workspaceId: string
}

export function MobileTabBar({ workspaceId }: MobileTabBarProps) {
  const pathname = usePathname()
  const base = `/workspace/${workspaceId}`

  const activeKey = MOBILE_TABS.find(t => {
    if (t.href === '') return pathname === base
    return pathname.startsWith(base + t.href)
  })?.key ?? 'chat'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)',
      flexShrink: 0,
    }}>
      {MOBILE_TABS.map(tab => {
        const isActive = tab.key === activeKey
        return (
          <Link
            key={tab.key}
            href={`${base}${tab.href}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 0 10px',
              gap: 3,
              textDecoration: 'none',
              color: isActive ? 'var(--accent-hover)' : 'var(--text-muted)',
              background: isActive ? 'var(--accent-muted)' : 'transparent',
              transition: 'all 0.12s',
              fontSize: '0.6rem',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
