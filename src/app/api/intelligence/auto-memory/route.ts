import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiError, apiOk, parseBody, requireFields } from '@/lib/utils/api'
import { isValidUUID, sanitizeText } from '@/lib/utils/sanitize'
import { checkApiRateLimit } from '@/lib/utils/ratelimit'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MEMORY_TYPES = ['goal', 'requirement', 'decision', 'architecture', 'known_issue', 'note'] as const
type MemType = typeof MEMORY_TYPES[number]

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
    .order('created_at', { ascending: false }).limit(30)

  if (!messages?.length) return apiOk({ memories: [], saved: 0 })

  const { data: existing } = await supabase
    .from('project_memories').select('type, content').eq('workspace_id', workspace_id)

  const existingSummary = existing?.length
    ? existing.map(m => `[${m.type}] ${m.content.slice(0, 100)}`).join('\n')
    : 'None yet'

  const conversation = messages.reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${String(m.content).slice(0, 500)}`)
    .join('\n\n')

  const prompt = `Extract important project knowledge from this conversation.

ALREADY SAVED:
${existingSummary}

CONVERSATION:
${conversation}

Return JSON array (max 6 items), no markdown:
[{"type":"goal|requirement|decision|architecture|known_issue|note","content":"concise 1-2 sentence summary"}]

Only extract genuinely important lasting knowledge not already saved. Return [] if nothing new.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const items = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(items) || !items.length) return apiOk({ memories: [], saved: 0 })

    const validated = items.slice(0, 6)
      .filter((m: any) => MEMORY_TYPES.includes(m.type) && typeof m.content === 'string' && m.content.length > 10)
      .map((m: any) => ({
        workspace_id,
        type: m.type as MemType,
        content: sanitizeText(m.content, 500),
        update_mode: 'auto',
        approved: false,
        last_updated_by: 'ai',
      }))

    if (!validated.length) return apiOk({ memories: [], saved: 0 })

    const { data: saved } = await supabase.from('project_memories').insert(validated).select()

    await supabase.from('usage_logs').insert({
      user_id: user.id, workspace_id,
      provider: 'anthropic', model: 'claude-haiku-4-5',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost: (response.usage.input_tokens * 0.00000025) + (response.usage.output_tokens * 0.00000125),
      request_type: 'intelligence', feature: 'auto_memory',
    })

    return apiOk({ memories: saved ?? [], saved: saved?.length ?? 0 })
  } catch (err) {
    console.error('[auto-memory]', err)
    return apiOk({ memories: [], saved: 0 })
  }
}
