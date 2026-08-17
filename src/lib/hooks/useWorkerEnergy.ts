'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkerStore } from '@/lib/store'
import { getEnergyStatus } from '@/lib/types'

const BUDGETS: Record<string, number> = {
  'claude-opus-4-6':  200_000,
  'claude-sonnet-4-6': 500_000,
  'claude-haiku-4-5': 2_000_000,
}

export function useWorkerEnergy(workerIds: string[], models: Record<string, string>) {
  const { setEnergy, getEnergy, isEnergyCacheStale } = useWorkerStore()

  const refresh = useCallback(async () => {
    if (!workerIds.length) return
    const staleIds = workerIds.filter(id => isEnergyCacheStale(id))
    if (!staleIds.length) return

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('usage_logs')
      .select('worker_id, input_tokens, output_tokens, estimated_cost, model')
      .in('worker_id', staleIds)
      .gte('created_at', `${today}T00:00:00Z`)

    if (!data) return

    for (const id of staleIds) {
      const logs = data.filter(d => d.worker_id === id)
      const input = logs.reduce((s, l) => s + (l.input_tokens ?? 0), 0)
      const output = logs.reduce((s, l) => s + (l.output_tokens ?? 0), 0)
      const cost = logs.reduce((s, l) => s + (l.estimated_cost ?? 0), 0)
      const model = models[id] ?? logs[0]?.model ?? 'claude-sonnet-4-6'
      const budget = BUDGETS[model] ?? 500_000
      const used = input + output
      const energy = Math.max(0, Math.round(((budget - used) / budget) * 100))

      setEnergy(id, {
        energy_percent: energy,
        input_tokens_today: input,
        output_tokens_today: output,
        requests_today: logs.length,
        estimated_cost_today: cost,
        last_updated: Date.now(),
      })
    }
  }, [workerIds, models, setEnergy, isEnergyCacheStale])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { refresh }
}

export function useWorkerEnergyPercent(workerId: string): number {
  const energy = useWorkerStore(s => s.getEnergy(workerId))
  return energy?.energy_percent ?? 100
}

export function useWorkerEnergyData(workerId: string) {
  return useWorkerStore(s => s.getEnergy(workerId))
}
