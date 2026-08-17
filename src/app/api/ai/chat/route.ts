import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { streamAnthropicMessage, estimateCost } from '@/lib/ai/anthropic'
import { logActivity } from '@/lib/utils/activity'
import { buildContextWindow } from '@/lib/ai/context'
import { checkChatRateLimit } from '@/lib/utils/ratelimit'
import type { Worker } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit
  const rateResult = await checkChatRateLimit(user.id)
  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before sending another message.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateResult.reset.toString(),
          'Retry-After': Math.ceil((rateResult.reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  let body: {
    worker: Worker
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    workspace_id: string
    conversation_id: string
  }

  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const { worker, messages, workspace_id, conversation_id } = body
  if (!worker || !messages?.length || !workspace_id || !conversation_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify workspace ownership
  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('id', workspace_id).eq('user_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Budget check
  try {
    const { data: budgetRows } = await supabase.rpc('check_daily_budget', { p_user_id: user.id })
    const budget = budgetRows?.[0]
    if (budget?.is_over_daily) {
      return NextResponse.json({ error: 'Daily budget exceeded. Adjust limit in Settings.' }, { status: 402 })
    }
  } catch {
    // Budget function may not exist yet — continue
  }

  // Fetch project memory
  const { data: memories } = await supabase
    .from('project_memories')
    .select('type, content')
    .eq('workspace_id', workspace_id)
    .eq('approved', true)
    .order('type')
    .limit(20)

  const systemPrompt = buildSystemPrompt(worker, memories ?? [])
  const enrichedWorker: Worker = { ...worker, system_instructions: systemPrompt }

  // Apply context window management — smart truncation for long conversations
  const contextResult = buildContextWindow(
    messages.map((m, i) => ({
      id: `msg-${i}`,
      conversation_id,
      workspace_id,
      role: m.role,
      content: m.content,
      content_type: 'text' as const,
      is_edited: false,
      created_at: new Date().toISOString(),
    })),
    systemPrompt.length
  )
  const contextMessages = contextResult.messages

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      const abortController = new AbortController()
      req.signal.addEventListener('abort', () => abortController.abort())

      try {
        let fullText = ''
        let inputTokens = 0
        let outputTokens = 0

        await streamAnthropicMessage({
          worker: enrichedWorker,
          messages: contextMessages,
          signal: abortController.signal,
          onChunk: (text) => { fullText += text; send({ type: 'text', content: text }) },
          onUsage: (usage) => { inputTokens = usage.input_tokens; outputTokens = usage.output_tokens },
        })

        const cost = estimateCost(worker.model, inputTokens, outputTokens)

        const { data: savedMsg } = await supabase
          .from('messages')
          .insert({
            conversation_id,
            workspace_id,
            worker_id: worker.id,
            role: 'assistant',
            content: fullText,
            content_type: 'text',
            metadata: { model: worker.model, input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost: cost, effort: worker.effort, context_truncated: contextResult.truncated, context_messages: contextResult.included_count },
          })
          .select().single()

        await Promise.all([
          supabase.from('usage_logs').insert({
            user_id: user.id, workspace_id, worker_id: worker.id, conversation_id,
            provider: worker.provider, model: worker.model,
            input_tokens: inputTokens, output_tokens: outputTokens,
            estimated_cost: cost, request_type: 'chat',
          }),
          supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation_id),
          logActivity({
            supabase, workspace_id, user_id: user.id, worker_id: worker.id,
            action: 'message_received', target_type: 'message', target_id: savedMsg?.id,
            metadata: { worker_name: worker.name, model: worker.model, tokens: inputTokens + outputTokens, cost },
          }),
        ])

        send({ type: 'done', message_id: savedMsg?.id })
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[chat API]', err)
          send({ type: 'error', error: err.message || 'Stream failed' })
        }
      } finally {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-RateLimit-Limit': rateResult.limit.toString(),
      'X-RateLimit-Remaining': rateResult.remaining.toString(),
    },
  })
}

function buildSystemPrompt(worker: Worker, memories: Array<{ type: string; content: string }>): string {
  const parts: string[] = []
  if (worker.system_instructions?.trim()) parts.push(worker.system_instructions.trim())

  if (memories.length > 0) {
    const grouped: Record<string, string[]> = {}
    for (const m of memories) {
      if (!grouped[m.type]) grouped[m.type] = []
      grouped[m.type].push(m.content)
    }

    const typeLabels: Record<string, string> = {
      goal: '### Goals', requirement: '### Requirements', decision: '### Key Decisions',
      architecture: '### Architecture', known_issue: '### Known Issues', todo: '### Pending Items', note: '### Notes',
    }

    const section = ['', '---', '## Project Context', '(Auto-injected from workspace memory)']
    for (const [type, items] of Object.entries(grouped)) {
      section.push(typeLabels[type] ?? `### ${type}`)
      for (const item of items) section.push(`- ${item}`)
    }
    parts.push(section.join('\n'))
  }

  return parts.join('\n\n')
}
