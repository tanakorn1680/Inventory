'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useChatStore, useWorkerStore } from '@/lib/store'
import type { Worker, Message, Conversation } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ConversationList } from '@/components/conversation/ConversationList'
import { IntelligencePanel } from '@/components/chat/IntelligencePanel'
import { detectHandoffTrigger } from '@/lib/ai/workpackage'
import { useWorkerEnergyData } from '@/lib/hooks/useWorkerEnergy'
import { useToast } from '@/components/ui/Toast'

export default function WorkspaceChatPage() {
  const { id } = useParams<{ id: string }>()
  const { getActiveWorker, workers } = useWorkerStore()
  const {
    messages, setMessages, appendMessage,
    isStreaming, streamingContent, streamingMessageId,
    setStreaming, setStreamingContent, appendStreamingContent,
    setStreamingMessageId, setAbortController, stopStream,
  } = useChatStore()
  const { error: toastError } = useToast()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [handoffHint, setHandoffHint] = useState('')
  const [showConvList, setShowConvList] = useState(false)
  const [taskRefresh, setTaskRefresh] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeWorker = getActiveWorker(id)
  const energy = useWorkerEnergyData(activeWorker?.id ?? '')
  const convMessages = conversation ? (messages[conversation.id] ?? []) : []

  const loadConversation = useCallback(async (convId?: string) => {
    const supabase = createClient()
    if (convId) {
      const { data } = await supabase.from('conversations').select('*').eq('id', convId).single()
      if (data) {
        setConversation(data)
        if (!messages[data.id]) {
          const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', data.id).order('created_at')
          if (msgs) setMessages(data.id, msgs)
        }
        return
      }
    }

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)

    let conv: Conversation | null = convs?.[0] ?? null
    if (!conv && activeWorker) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ workspace_id: id, worker_id: activeWorker.id, title: 'New conversation', status: 'active' })
        .select().single()
      conv = newConv
    }
    if (conv) {
      setConversation(conv)
      if (!messages[conv.id]) {
        const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at')
        if (msgs) setMessages(conv.id, msgs)
      }
    }
  }, [id, activeWorker?.id, messages, setMessages])

  useEffect(() => {
    setLoading(true)
    loadConversation().finally(() => setLoading(false))
  }, [id, activeWorker?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convMessages.length, streamingContent])

  useEffect(() => {
    if (!activeWorker || !energy) return
    const { shouldSuggest, reason } = detectHandoffTrigger('', energy.energy_percent)
    setHandoffHint(shouldSuggest ? reason : '')
  }, [energy?.energy_percent, activeWorker?.id])

  async function newConversation() {
    if (!activeWorker) return
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .insert({ workspace_id: id, worker_id: activeWorker.id, title: 'New conversation', status: 'active' })
      .select().single()
    if (data) {
      setConversation(data)
      setMessages(data.id, [])
      setShowConvList(false)
    }
  }

  async function handleSend(content: string) {
    if (!content.trim() || isStreaming || !activeWorker) return
    const supabase = createClient()

    let conv = conversation
    if (!conv) {
      const { data } = await supabase
        .from('conversations')
        .insert({ workspace_id: id, worker_id: activeWorker.id, title: 'New conversation', status: 'active' })
        .select().single()
      if (!data) return
      conv = data
      setConversation(data)
    }
    if (!conv) return

    const { data: savedUser } = await supabase
      .from('messages')
      .insert({ conversation_id: conv.id, workspace_id: id, worker_id: activeWorker.id, role: 'user', content, content_type: 'text' })
      .select().single()
    if (savedUser) appendMessage(conv.id, savedUser)

    const assistantId = generateId()
    setStreamingMessageId(assistantId)
    setStreamingContent('')
    setStreaming(true)
    const controller = new AbortController()
    setAbortController(controller)

    try {
      const history = [...convMessages, savedUser]
        .filter(Boolean)
        .filter((m): m is Message => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker: activeWorker, messages: history, workspace_id: id, conversation_id: (conv as any).id }),
        signal: controller.signal,
      })

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let savedMsgId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true }).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const chunk = JSON.parse(raw)
            if (chunk.type === 'text') { fullText += chunk.content; appendStreamingContent(chunk.content) }
            if (chunk.type === 'done') savedMsgId = chunk.message_id ?? null
            if (chunk.type === 'error') throw new Error(chunk.error)
          } catch {}
        }
      }

      appendMessage((conv as any).id, {
        id: savedMsgId ?? assistantId,
        conversation_id: (conv as any).id,
        workspace_id: id,
        worker_id: activeWorker.id,
        role: 'assistant',
        content: fullText,
        content_type: 'text',
        is_edited: false,
        created_at: new Date().toISOString(),
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Something went wrong'
        setError(msg)
        toastError(msg)
        setTimeout(() => setError(''), 6000)
      }
    } finally {
      setStreaming(false)
      setStreamingMessageId(null)
      setStreamingContent('')
      setAbortController(null)
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
        <div style={{ width: 22, height: 22, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} className="animate-spin" />
        <span style={{ fontSize: '0.875rem' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Conversation sidebar (collapsible) */}
      {showConvList && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
            onClick={() => setShowConvList(false)}
          />
          <div style={{
            width: 220, flexShrink: 0,
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            zIndex: 20, position: 'relative',
          }}>
            <ConversationList
              workspaceId={id}
              activeConversationId={conversation?.id ?? null}
              onSelect={(cid) => { loadConversation(cid); setShowConvList(false) }}
              onNew={() => { newConversation() }}
            />
          </div>
        </>
      )}

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Chat sub-header */}
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0, background: 'var(--bg-base)',
        }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowConvList(!showConvList)}
            title="Conversations"
            style={{ color: showConvList ? 'var(--accent-hover)' : 'var(--text-muted)', padding: 5 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation?.title ?? 'New conversation'}
          </span>

          {conversation && (
            <span className="badge badge-neutral" style={{ fontSize: '0.625rem', padding: '1px 6px', flexShrink: 0 }}>
              {convMessages.length} msgs
            </span>
          )}

          {conversation && (
            <IntelligencePanel
              workspaceId={id}
              conversationId={conversation.id}
              onTasksAdded={() => setTaskRefresh(r => r + 1)}
              onMemoriesApproved={() => {}}
            />
          )}

          <button className="btn btn-ghost btn-icon" onClick={newConversation} title="New conversation" style={{ color: 'var(--text-muted)', flexShrink: 0, padding: 5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
          {convMessages.length === 0 && !isStreaming && (
            <WelcomeState worker={activeWorker} onSend={handleSend} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760, margin: '0 auto' }}>
            {convMessages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                worker={msg.worker_id ? workers.find(w => w.id === msg.worker_id) ?? activeWorker : activeWorker}
              />
            ))}

            {isStreaming && streamingContent && (
              <MessageBubble
                message={{ id: streamingMessageId ?? '_stream', conversation_id: conversation?.id ?? '', workspace_id: id, role: 'assistant', content: streamingContent, content_type: 'text', is_edited: false, created_at: new Date().toISOString() }}
                worker={activeWorker}
                isStreaming
              />
            )}

            {isStreaming && !streamingContent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {activeWorker?.avatar ?? '🤖'}
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `dotpulse 1.2s ease ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Banners */}
        {handoffHint && !isStreaming && (
          <div style={{ padding: '7px 14px', margin: '0 20px 4px', maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: '0.8125rem', color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>⚠️ {handoffHint}</span>
            <button onClick={() => setHandoffHint('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 14px', margin: '0 auto 4px', maxWidth: 760, width: 'calc(100% - 40px)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: '0.875rem', color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {error}
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* Composer */}
        <div style={{ flexShrink: 0, padding: '0 20px 16px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <ChatComposer
            onSend={handleSend}
            onStop={stopStream}
            isStreaming={isStreaming}
            disabled={!activeWorker}
            placeholder={activeWorker ? `Message ${activeWorker.name}…` : 'Select a worker to start chatting'}
            worker={activeWorker}
            conversationId={conversation?.id}
          />
        </div>
      </div>

      <style>{`@keyframes dotpulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  )
}

function WelcomeState({ worker, onSend }: { worker: Worker | undefined; onSend: (m: string) => void }) {
  const starters = ['What should we work on first?', 'Give me a project overview', 'Help me plan the next steps', 'What are the known issues?']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 16, textAlign: 'center', padding: '0 20px', maxWidth: 760, margin: '0 auto 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
        {worker?.avatar ?? '🤖'}
      </div>
      <div>
        <h2 style={{ fontWeight: 700, color: '#fff', margin: '0 0 4px', fontSize: '1.125rem' }}>
          {worker ? `${worker.name} is ready` : 'Select a worker'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
          {worker ? `${worker.role} · ${worker.model.split('-').slice(1, 3).join(' ')} · ${worker.effort} effort` : 'Use the worker selector in the header'}
        </p>
      </div>
      {worker && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
          {starters.map(s => <button key={s} className="btn btn-secondary btn-sm" onClick={() => onSend(s)} style={{ fontSize: '0.8125rem' }}>{s}</button>)}
        </div>
      )}
    </div>
  )
}
