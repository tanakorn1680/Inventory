import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCost(amount: number): string {
  if (amount < 0.01) return `$${(amount * 1000).toFixed(2)}m`
  return `$${amount.toFixed(4)}`
}

export function formatCostShort(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`
  if (amount >= 0.01) return `$${amount.toFixed(3)}`
  return `<$0.01`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function estimateEnergy(
  inputTokensToday: number,
  outputTokensToday: number,
  model: string
): number {
  // Rough daily token budget per model tier
  const budgets: Record<string, number> = {
    'claude-opus-4-6': 200_000,
    'claude-sonnet-4-6': 500_000,
    'claude-haiku-4-5': 2_000_000,
  }
  const budget = budgets[model] ?? 500_000
  const used = inputTokensToday + outputTokensToday
  const remaining = Math.max(0, budget - used)
  return Math.round((remaining / budget) * 100)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
