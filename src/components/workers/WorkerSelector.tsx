'use client'

import { useState } from 'react'
import type { Worker } from '@/lib/types'
import { ENERGY_CONFIG, getEnergyStatus } from '@/lib/types'
import { useWorkerStore } from '@/lib/store'
import { useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'

interface WorkerSelectorProps {
  workers: Worker[]
  activeWorkerId?: string
  workspaceId: string
  onSelect: (worker: Worker) => void
}

export function WorkerSelector({ workers, activeWorkerId, workspaceId, onSelect }: WorkerSelectorProps) {
  const [open, setOpen] = useState(false)
  const active = workers.find(w => w.id === activeWorkerId)

  if (!workers.length) {
    return (
      <a
        href="/workers"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          background: 'var(--bg-overlay)',
          border: '1px dashed var(--border-default)',
          borderRadius: 99,
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          transition: 'all 0.12s',
        }}
      >
        + Create worker
      </a>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 99,
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.12s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        {active ? (
          <>
            <span style={{ fontSize: 14 }}>{active.avatar}</span>
            <span>{active.name}</span>
            <WorkerEnergyDot workerId={active.id} />
          </>
        ) : (
          <>
            <span>👤</span>
            <span>Select Worker</span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: 4,
            minWidth: 220,
            zIndex: 30,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.12s ease',
          }}>
            <div style={{ padding: '4px 10px 6px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Switch Worker
            </div>
            {workers.map(w => (
              <WorkerOption
                key={w.id}
                worker={w}
                isActive={w.id === activeWorkerId}
                onClick={() => { onSelect(w); setOpen(false) }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WorkerOption({ worker, isActive, onClick }: { worker: Worker; isActive: boolean; onClick: () => void }) {
  const energy = useWorkerEnergyData(worker.id)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 10px', borderRadius: 7,
        background: isActive ? 'var(--accent-muted)' : 'transparent',
        border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.1s',
        marginBottom: 2,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
      }}>
        {worker.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {worker.name}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {worker.role} · {worker.model.split('-').slice(1, 3).join(' ')}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: cfg.color }}>{pct}%</span>
        <div style={{ width: 32, height: 3, background: 'var(--bg-overlay)', borderRadius: 99 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </button>
  )
}

function WorkerEnergyDot({ workerId }: { workerId: string }) {
  const energy = useWorkerEnergyData(workerId)
  const pct = energy?.energy_percent ?? 100
  const status = getEnergyStatus(pct)
  const cfg = ENERGY_CONFIG[status]

  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: cfg.color,
      flexShrink: 0,
    }} title={`Energy: ${pct}%`} />
  )
}
