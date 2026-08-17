import type { SupabaseClient } from '@supabase/supabase-js'

interface LogActivityParams {
  supabase: SupabaseClient
  workspace_id: string
  user_id?: string
  worker_id?: string
  action: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, any>
}

export async function logActivity({
  supabase,
  workspace_id,
  user_id,
  worker_id,
  action,
  target_type,
  target_id,
  metadata = {},
}: LogActivityParams): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      workspace_id,
      user_id: user_id ?? null,
      worker_id: worker_id ?? null,
      action,
      target_type: target_type ?? null,
      target_id: target_id ?? null,
      metadata,
    })
  } catch (err) {
    // Non-critical — never throw
    console.error('[logActivity]', err)
  }
}
