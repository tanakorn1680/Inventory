import type { Message, Task, Worker } from '@/lib/types'

interface Memory {
  id: string
  type: string
  content: string
  [key: string]: any
}

export interface WorkPackageData {
  goal: string
  completed: string[]
  in_progress: string[]
  pending: string[]
  important_decisions: string[]
  known_issues: string[]
  recent_results: string
  context_for_next_worker: string
}

/**
 * Builds a structured work package from workspace data.
 * Used to brief a new worker during handoff.
 */
export function buildWorkPackageSummary(params: {
  messages: Message[]
  tasks: Task[]
  memories: Memory[]
  fromWorker: Worker
  toWorker: Worker
  goal?: string
}): WorkPackageData {
  const { messages, tasks, memories, fromWorker, toWorker, goal } = params

  // Extract tasks by status
  const doneTasks = tasks.filter(t => t.status === 'done').map(t => t.title)
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').map(t => t.title)
  const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'review').map(t => t.title)

  // Extract key memories
  const decisions = memories.filter(m => m.type === 'decision').map(m => m.content.slice(0, 120))
  const knownIssues = memories.filter(m => m.type === 'known_issue').map(m => m.content.slice(0, 120))
  const goals = memories.filter(m => m.type === 'goal').map(m => m.content).join('\n')

  // Summarize recent messages (last 10 assistant messages)
  const recentAssistant = messages
    .filter(m => m.role === 'assistant')
    .slice(-5)
    .map(m => m.content.slice(0, 200))
    .join('\n---\n')

  const projectGoal = goal ?? goals ?? 'Continue the project work'

  const contextForNext = buildContextPrompt({
    goal: projectGoal,
    doneTasks,
    inProgressTasks,
    pendingTasks,
    decisions,
    knownIssues,
    recentResults: recentAssistant,
    fromWorker,
    toWorker,
  })

  return {
    goal: projectGoal,
    completed: doneTasks,
    in_progress: inProgressTasks,
    pending: pendingTasks,
    important_decisions: decisions,
    known_issues: knownIssues,
    recent_results: recentAssistant,
    context_for_next_worker: contextForNext,
  }
}

function buildContextPrompt(p: {
  goal: string
  doneTasks: string[]
  inProgressTasks: string[]
  pendingTasks: string[]
  decisions: string[]
  knownIssues: string[]
  recentResults: string
  fromWorker: Worker
  toWorker: Worker
}): string {
  const sections: string[] = [
    `# Work Handoff — Context Briefing`,
    ``,
    `You are **${p.toWorker.name}** taking over from **${p.fromWorker.name}**.`,
    ``,
    `## Project Goal`,
    p.goal,
  ]

  if (p.doneTasks.length) {
    sections.push(``, `## Completed`, p.doneTasks.map(t => `- ✅ ${t}`).join('\n'))
  }

  if (p.inProgressTasks.length) {
    sections.push(``, `## In Progress`, p.inProgressTasks.map(t => `- ⚡ ${t}`).join('\n'))
  }

  if (p.pendingTasks.length) {
    sections.push(``, `## Pending`, p.pendingTasks.map(t => `- 📋 ${t}`).join('\n'))
  }

  if (p.decisions.length) {
    sections.push(``, `## Key Decisions Made`, p.decisions.map(d => `- ${d}`).join('\n'))
  }

  if (p.knownIssues.length) {
    sections.push(``, `## Known Issues`, p.knownIssues.map(i => `- ⚠️ ${i}`).join('\n'))
  }

  if (p.recentResults) {
    sections.push(``, `## Recent Work (from ${p.fromWorker.name})`, p.recentResults)
  }

  sections.push(``, `---`, `Pick up where ${p.fromWorker.name} left off. Continue the work efficiently.`)

  return sections.join('\n')
}

// ─── Detect if a message indicates the worker is running low ──────────────────

export function detectHandoffTrigger(message: string, energyPercent: number): {
  shouldSuggest: boolean
  reason: string
} {
  const lowEnergy = energyPercent <= 15
  const criticalEnergy = energyPercent <= 5

  const lowPhrases = [
    'i need to hand off',
    'hand this off',
    'switching worker',
    'another worker',
    'take over',
    'continue from here',
  ]

  const msgLower = message.toLowerCase()
  const mentionsHandoff = lowPhrases.some(p => msgLower.includes(p))

  if (criticalEnergy) return { shouldSuggest: true, reason: 'Worker energy critical — handoff recommended' }
  if (lowEnergy) return { shouldSuggest: true, reason: 'Worker energy low — consider handoff soon' }
  if (mentionsHandoff) return { shouldSuggest: true, reason: 'Handoff requested' }

  return { shouldSuggest: false, reason: '' }
}
