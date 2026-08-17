import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildContextWindow } from '@/lib/ai/context'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversation_id, system_prompt_length } = await req.json()
  if (!conversation_id) return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversation_id)
    .order('created_at')

  if (!messages) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = buildContextWindow(messages as any, system_prompt_length ?? 0)

  return NextResponse.json({
    total_messages: result.total_count,
    included_messages: result.included_count,
    estimated_tokens: result.estimated_tokens,
    truncated: result.truncated,
    capacity_percent: Math.round((result.estimated_tokens / 180_000) * 100),
  })
}
