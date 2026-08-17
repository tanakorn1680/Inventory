'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCostShort, formatNumber, formatRelativeTime } from '@/lib/utils'
import type { UsageLog } from '@/lib/types'

interface DailyStat {
  date: string
  cost: number
  requests: number
  input_tokens: number
  output_tokens: number
}

interface WorkerStat {
  worker_id: string
  worker_name: string
  worker_avatar: string
  cost: number
  requests: number
  tokens: number
}

export default function UsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d'>('7d')

  const load = useCallback(async () => {
    const supabase = createClient()
    const days = range === '7d' ? 7 : 30
    const from = new Date()
    from.setDate(from.getDate() - days)

    const { data } = await supabase
      .from('usage_logs')
      .select(`
        *,
        workers (name, avatar)
      `)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })

    if (data) setLogs(data as any)
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  // Aggregate stats
  const totalCost = logs.reduce((s, l) => s + (l.estimated_cost || 0), 0)
  const totalRequests = logs.length
  const totalTokens = logs.reduce((s, l) => s + (l.input_tokens || 0) + (l.output_tokens || 0), 0)

  // Today stats
  const today = new Date().toISOString().split('T')[0]
  const todayLogs = logs.filter(l => l.created_at.startsWith(today))
  const todayCost = todayLogs.reduce((s, l) => s + (l.estimated_cost || 0), 0)

  // Daily breakdown
  const dailyMap: Record<string, DailyStat> = {}
  for (const log of logs) {
    const date = log.created_at.split('T')[0]
    if (!dailyMap[date]) {
      dailyMap[date] = { date, cost: 0, requests: 0, input_tokens: 0, output_tokens: 0 }
    }
    dailyMap[date].cost += log.estimated_cost || 0
    dailyMap[date].requests++
    dailyMap[date].input_tokens += log.input_tokens || 0
    dailyMap[date].output_tokens += log.output_tokens || 0
  }
  const dailyStats = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date))

  // Worker breakdown
  const workerMap: Record<string, WorkerStat> = {}
  for (const log of logs as any[]) {
    const id = log.worker_id
    if (!workerMap[id]) {
      workerMap[id] = {
        worker_id: id,
        worker_name: log.workers?.name ?? 'Unknown',
        worker_avatar: log.workers?.avatar ?? '🤖',
        cost: 0, requests: 0, tokens: 0,
      }
    }
    workerMap[id].cost += log.estimated_cost || 0
    workerMap[id].requests++
    workerMap[id].tokens += (log.input_tokens || 0) + (log.output_tokens || 0)
  }
  const workerStats = Object.values(workerMap).sort((a, b) => b.cost - a.cost)

  // Chart max
  const maxCost = Math.max(...dailyStats.map(d => d.cost), 0.001)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="main-header" style={{ flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>Usage & Costs</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['7d', '30d'] as const).map(r => (
            <button
              key={r}
              className="btn btn-sm"
              onClick={() => setRange(r)}
              style={{
                background: range === r ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: range === r ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: range === r ? 'transparent' : 'var(--border-default)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <UsageSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <SummaryCard label="Today's Cost" value={formatCostShort(todayCost)} sub={`${todayLogs.length} requests`} color="var(--accent-hover)" />
              <SummaryCard label={`${range} Cost`} value={formatCostShort(totalCost)} sub={`${totalRequests} total requests`} color="var(--success)" />
              <SummaryCard label="Total Tokens" value={formatNumber(totalTokens)} sub={`${range} window`} color="var(--info)" />
              <SummaryCard label="Avg / Request" value={totalRequests > 0 ? formatCostShort(totalCost / totalRequests) : '$0'} sub="estimated" color="var(--warning)" />
            </div>

            {/* Daily chart */}
            {dailyStats.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 14, fontSize: '0.9375rem' }}>
                  Daily Cost
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100, overflowX: 'auto' }}>
                  {dailyStats.slice().reverse().map(d => {
                    const heightPct = maxCost > 0 ? (d.cost / maxCost) * 100 : 0
                    return (
                      <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto', minWidth: 36 }}>
                        <div
                          title={`${d.date}: ${formatCostShort(d.cost)}`}
                          style={{
                            width: 28,
                            height: Math.max(3, heightPct) + '%',
                            background: 'var(--accent-primary)',
                            borderRadius: '4px 4px 2px 2px',
                            opacity: d.date === today ? 1 : 0.6,
                            transition: 'height 0.4s ease',
                            cursor: 'default',
                          }}
                        />
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', transform: 'rotate(-45deg)', transformOrigin: 'top', whiteSpace: 'nowrap' }}>
                          {d.date.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Worker breakdown */}
            {workerStats.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 14, fontSize: '0.9375rem' }}>
                  By Worker
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {workerStats.map(ws => {
                    const pct = totalCost > 0 ? (ws.cost / totalCost) * 100 : 0
                    return (
                      <div key={ws.worker_id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{ws.worker_avatar}</span>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem', flex: 1 }}>
                            {ws.worker_name}
                          </span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {ws.requests} req
                          </span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-hover)', minWidth: 60, textAlign: 'right' }}>
                            {formatCostShort(ws.cost)}
                          </span>
                        </div>
                        <div className="energy-bar-track">
                          <div className="energy-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent-primary)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent logs */}
            {logs.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 14, fontSize: '0.9375rem' }}>
                  Recent Activity
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {logs.slice(0, 50).map(log => (
                    <LogRow key={log.id} log={log as any} />
                  ))}
                </div>
              </div>
            )}

            {logs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No usage data yet. Start chatting with a worker to see costs here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function LogRow({ log }: { log: any }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px', borderRadius: 6,
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{log.workers?.avatar ?? '🤖'}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.workers?.name ?? 'Worker'}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        {formatNumber((log.input_tokens || 0) + (log.output_tokens || 0))} tok
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--accent-hover)', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
        {formatCostShort(log.estimated_cost || 0)}
      </span>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
        {formatRelativeTime(log.created_at)}
      </span>
    </div>
  )
}

function UsageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 14, height: 80 }} />
        ))}
      </div>
      <div className="card animate-pulse-slow" style={{ height: 160 }} />
    </div>
  )
}
