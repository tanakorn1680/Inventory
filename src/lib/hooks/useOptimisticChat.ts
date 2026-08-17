'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import type { Message } from '@/lib/types'
import { generateId } from '@/lib/utils'

/**
 * Adds an optimistic user message instantly (before DB save),
 * then replaces it with the real saved one.
 */
export function useOptimisticChat(conversationId: string, workspaceId: string) {
  const { appendMessage, updateMessage } = useChatStore()

  const addOptimisticUserMessage = useCallback(
    (content: string, workerId?: string): string => {
      const tempId = `optimistic-${generateId()}`
      const msg: Message = {
        id: tempId,
        conversation_id: conversationId,
        workspace_id: workspaceId,
        worker_id: workerId,
        role: 'user',
        content,
        content_type: 'text',
        is_edited: false,
        created_at: new Date().toISOString(),
      }
      appendMessage(conversationId, msg)
      return tempId
    },
    [conversationId, workspaceId, appendMessage]
  )

  const replaceOptimistic = useCallback(
    (tempId: string, realMessage: Message) => {
      // Remove the temp message and add the real one
      updateMessage(conversationId, tempId, {
        id: realMessage.id,
        created_at: realMessage.created_at,
      })
    },
    [conversationId, updateMessage]
  )

  return { addOptimisticUserMessage, replaceOptimistic }
}
