'use client'

import { useState, useEffect, useCallback } from 'react'

const DRAFT_PREFIX = 'ai-office:draft:'

export function useLocalDraft(conversationId: string) {
  const key = `${DRAFT_PREFIX}${conversationId}`

  const [draft, setDraft] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(key) ?? ''
  })

  const saveDraft = useCallback(
    (value: string) => {
      setDraft(value)
      if (value) {
        localStorage.setItem(key, value)
      } else {
        localStorage.removeItem(key)
      }
    },
    [key]
  )

  const clearDraft = useCallback(() => {
    setDraft('')
    localStorage.removeItem(key)
  }, [key])

  // Clear when conversation changes
  useEffect(() => {
    const saved = localStorage.getItem(key) ?? ''
    setDraft(saved)
  }, [key])

  return { draft, saveDraft, clearDraft }
}
