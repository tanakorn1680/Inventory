import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Workspace, Worker, Message } from '@/lib/types'

// ─── UI STATE ─────────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean
  workerPanelOpen: boolean
  activeWorkspaceId: string | null
  activeConversationId: string | null
  setSidebarOpen: (open: boolean) => void
  setWorkerPanelOpen: (open: boolean) => void
  setActiveWorkspace: (id: string | null) => void
  setActiveConversation: (id: string | null) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      workerPanelOpen: true,
      activeWorkspaceId: null,
      activeConversationId: null,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setWorkerPanelOpen: (open) => set({ workerPanelOpen: open }),
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setActiveConversation: (id) => set({ activeConversationId: id }),
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    }),
    {
      name: 'ai-office-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        workerPanelOpen: state.workerPanelOpen,
      }),
    }
  )
)

// ─── CHAT STATE ───────────────────────────────────────────────────────────────

interface ChatState {
  messages: Record<string, Message[]>
  streamingMessageId: string | null
  streamingContent: string
  isStreaming: boolean
  abortController: AbortController | null

  setMessages: (conversationId: string, messages: Message[]) => void
  appendMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  setStreaming: (streaming: boolean) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (chunk: string) => void
  setStreamingMessageId: (id: string | null) => void
  setAbortController: (controller: AbortController | null) => void
  stopStream: () => void
  clearMessages: (conversationId: string) => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: {},
  streamingMessageId: null,
  streamingContent: '',
  isStreaming: false,
  abortController: null,

  setMessages: (conversationId, messages) =>
    set((state) => ({ messages: { ...state.messages, [conversationId]: messages } })),

  appendMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), message],
      },
    })),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),
  setAbortController: (abortController) => set({ abortController }),

  stopStream: () => {
    const { abortController } = get()
    abortController?.abort()
    set({ isStreaming: false, abortController: null })
  },

  clearMessages: (conversationId) =>
    set((state) => {
      const next = { ...state.messages }
      delete next[conversationId]
      return { messages: next }
    }),
}))

// ─── WORKSPACE STATE ──────────────────────────────────────────────────────────

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setCurrentWorkspace: (workspace: Workspace | null) => void
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void
  addWorkspace: (workspace: Workspace) => void
  removeWorkspace: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  currentWorkspace: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      currentWorkspace:
        state.currentWorkspace?.id === id
          ? { ...state.currentWorkspace, ...updates }
          : state.currentWorkspace,
    })),
  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [workspace, ...state.workspaces] })),
  removeWorkspace: (id) =>
    set((state) => ({ workspaces: state.workspaces.filter((w) => w.id !== id) })),
}))

// ─── WORKER STATE ─────────────────────────────────────────────────────────────

interface EnergyData {
  energy_percent: number
  input_tokens_today: number
  output_tokens_today: number
  requests_today: number
  estimated_cost_today: number
  last_updated: number // timestamp
}

interface WorkerState {
  workers: Worker[]
  // active worker per workspace
  activeWorkerByWorkspace: Record<string, string> // workspaceId → workerId
  // energy cache
  energyCache: Record<string, EnergyData> // workerId → data
  energyCacheExpiry: number // ms

  setWorkers: (workers: Worker[]) => void
  addWorker: (worker: Worker) => void
  updateWorker: (id: string, updates: Partial<Worker>) => void
  removeWorker: (id: string) => void
  getWorker: (id: string) => Worker | undefined

  setActiveWorker: (workspaceId: string, workerId: string) => void
  getActiveWorker: (workspaceId: string) => Worker | undefined

  setEnergy: (workerId: string, data: EnergyData) => void
  getEnergy: (workerId: string) => EnergyData | undefined
  isEnergyCacheStale: (workerId: string) => boolean
}

export const useWorkerStore = create<WorkerState>()(
  persist(
    (set, get) => ({
      workers: [],
      activeWorkerByWorkspace: {},
      energyCache: {},
      energyCacheExpiry: 60_000, // 1 min

      setWorkers: (workers) => set({ workers }),
      addWorker: (worker) => set((state) => ({ workers: [worker, ...state.workers] })),
      updateWorker: (id, updates) =>
        set((state) => ({
          workers: state.workers.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        })),
      removeWorker: (id) =>
        set((state) => ({ workers: state.workers.filter((w) => w.id !== id) })),
      getWorker: (id) => get().workers.find((w) => w.id === id),

      setActiveWorker: (workspaceId, workerId) =>
        set((state) => ({
          activeWorkerByWorkspace: { ...state.activeWorkerByWorkspace, [workspaceId]: workerId },
        })),

      getActiveWorker: (workspaceId) => {
        const { workers, activeWorkerByWorkspace } = get()
        const workerId = activeWorkerByWorkspace[workspaceId]
        return workerId ? workers.find((w) => w.id === workerId) : undefined
      },

      setEnergy: (workerId, data) =>
        set((state) => ({
          energyCache: { ...state.energyCache, [workerId]: data },
        })),

      getEnergy: (workerId) => get().energyCache[workerId],

      isEnergyCacheStale: (workerId) => {
        const entry = get().energyCache[workerId]
        if (!entry) return true
        return Date.now() - entry.last_updated > get().energyCacheExpiry
      },
    }),
    {
      name: 'ai-office-workers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeWorkerByWorkspace: state.activeWorkerByWorkspace,
      }),
    }
  )
)
