import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError, apiOk, parseBody, requireFields } from '@/lib/utils/api'
import { isValidUUID, sanitizeShort } from '@/lib/utils/sanitize'
import { checkApiRateLimit } from '@/lib/utils/ratelimit'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('UNAUTHORIZED', 'Not authenticated')

  const rl = await checkApiRateLimit(user.id)
  if (!rl.success) return apiError('RATE_LIMITED', 'Too many requests')

  const [body, bodyErr] = await parseBody<{ conversation_id?: string; workspace_id?: string }>(req)
  if (bodyErr) return bodyErr

  const fieldErr = requireFields(body!, ['conversation_id', 'workspace_id'])
  if (fieldErr) return fieldErr

  if (!isValidUUID(body!.conversation_id) || !isValidUUID(body!.workspace_id)) {
    return apiError('BAD_REQUEST', 'Invalid UUID')
  }

  const { conversation_id, workspace_id } = body!

  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('id', workspace_id).eq('user_id', user.id).single()
  if (!ws) return apiError('NOT_FOUND', 'Workspace not found')

  const { data: messages } = await supabase
    .from('messages').select('role, content')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!messages?.length) return apiOk({ tasks: [] })

  const { data: existingTasks } = await supabase
    .from('tasks').select('title').eq('workspace_id', workspace_id).neq('status', 'done')

  const existingTitles = existingTasks?.map(t => t.title).join(', ') ?? 'none'
  const recentConversation = messages
    .reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content).slice(0, 400)}`)
    .join('\n\n')

  const prompt = `Analyze this conversation and extract actionable tasks.

EXISTING TASKS (do not duplicate): ${existingTitles}

CONVERSATION:
${recentConversation}

Return a JSON array of up to 5 tasks:
[{"title":"short action-oriented title max 80 chars","description":"1-2 sentences or null","priority":0|1|2,"status":"todo"|"in_progress"}]

Only include concrete actionable items. Return [] if nothing new. JSON only, no markdown.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const tasks = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(tasks)) return apiOk({ tasks: [] })

    const validated = tasks.slice(0, 5).map((t: any) => ({
      title: sanitizeShort(t.title, 80),
      description: t.description ? sanitizeShort(t.description, 200) : null,
      priority: [0, 1, 2].includes(Number(t.priority)) ? Number(t.priority) : 0,
      status: t.status === 'in_progress' ? 'in_progress' : 'todo',
    })).filter((t: any) => t.title.length > 3)

    await supabase.from('usage_logs').insert({
      user_id: user.id, workspace_id,
      provider: 'anthropic', model: 'claude-haiku-4-5',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost: (response.usage.input_tokens * 0.00000025) + (response.usage.output_tokens * 0.00000125),
      request_type: 'intelligence', feature: 'suggest_tasks',
    })

    return apiOk({ tasks: validated })
  } catch (err) {
    console.error('[suggest-tasks]', err)
    return apiOk({ tasks: [] })
  }
}
