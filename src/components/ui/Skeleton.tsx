import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 14, borderRadius = 4, style }: SkeletonProps) {
  return (
    <div
      className="animate-pulse-slow"
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--bg-overlay)',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// ─── Pre-built skeleton patterns ──────────────────────────────────────────────

export function MessageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Skeleton width={30} height={30} borderRadius={8} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="15%" height={10} />
            <Skeleton width={`${50 + i * 15}%`} height={13} />
            <Skeleton width={`${30 + i * 10}%`} height={13} />
            {i === 2 && <Skeleton width="45%" height={13} />}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Skeleton width={40} height={40} borderRadius={10} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="65%" height={13} />
              <Skeleton width="45%" height={11} />
            </div>
          </div>
          <Skeleton height={40} borderRadius={6} />
          <Skeleton height={4} borderRadius={99} />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
          <Skeleton width={24} height={24} borderRadius={6} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Skeleton width={`${35 + (i % 3) * 15}%`} height={12} />
            <Skeleton width={`${20 + (i % 2) * 10}%`} height={10} />
          </div>
          <Skeleton width={50} height={12} />
        </div>
      ))}
    </div>
  )
}

export function WorkerPanelSkeleton() {
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Skeleton width={38} height={38} borderRadius={10} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width="60%" height={13} />
          <Skeleton width="40%" height={11} />
        </div>
      </div>
      <Skeleton height={5} borderRadius={99} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Skeleton height={42} borderRadius={6} />
        <Skeleton height={42} borderRadius={6} />
      </div>
      <Skeleton height={32} borderRadius={8} />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 8px', alignItems: 'center' }}>
          <Skeleton width={16} height={16} borderRadius={4} style={{ flexShrink: 0 }} />
          <Skeleton width="30%" height={12} />
          <Skeleton width="20%" height={12} />
          <div style={{ flex: 1 }} />
          <Skeleton width={60} height={12} />
        </div>
      ))}
    </div>
  )
}
