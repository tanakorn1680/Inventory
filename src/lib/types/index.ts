// ─── ENUMS ────────────────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom'
export type WorkerStatus = 'active' | 'paused' | 'exhausted'
export type WorkerRole = 'developer' | 'reviewer' | 'researcher' | 'writer' | 'analyst' | 'architect' | 'custom'
export type Effort = 'low' | 'medium' | 'high' | 'auto'
export type WorkspaceStatus = 'active' | 'archived'
export type MessageRole = 'user' | 'assistant' | 'system'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type EnergyStatus = 'healthy' | 'moderate' | 'low' | 'critical' | 'exhausted' | 'unknown'
export type HandoffReason = 'limit' | 'manual' | 'auto' | 'error'
export type HandoffStatus = 'pending' | 'completed' | 'failed'

// ─── WORKER ───────────────────────────────────────────────────────────────────

export interface Worker {
  id: string
  user_id: string
  name: string
  avatar: string
  provider: Provider
  model: string
  role: WorkerRole
  template?: string
  system_instructions: string
  effort: Effort
  permissions: WorkerPermissions
  api_key?: string
  api_base_url?: string
  status: WorkerStatus
  is_deleted: boolean
  created_at: string
  updated_at: string
  // Computed
  energy?: number
  energy_status?: EnergyStatus
  estimated_energy?: boolean
}

export interface WorkerPermissions {
  can_read_files: boolean
  can_write_files: boolean
  can_update_tasks: boolean
  can_update_memory: boolean
  can_create_handoff: boolean
}

export const DEFAULT_PERMISSIONS: WorkerPermissions = {
  can_read_files: true,
  can_write_files: false,
  can_update_tasks: true,
  can_update_memory: false,
  can_create_handoff: true,
}

// ─── WORKER TEMPLATES ─────────────────────────────────────────────────────────

export interface WorkerTemplate {
  id: WorkerRole
  name: string
  avatar: string
  role: WorkerRole
  default_instructions: string
  recommended_model: string
  recommended_effort: Effort
  description: string
}

export const WORKER_TEMPLATES: WorkerTemplate[] = [
  {
    id: 'developer',
    name: 'Developer',
    avatar: '👨‍💻',
    role: 'developer',
    description: 'Writes and reviews production-ready code',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'high',
    default_instructions: 'You are a Senior Full-Stack Developer. Write production-ready, clean, and secure code. Prioritize maintainability and best practices. Always consider edge cases and error handling.',
  },
  {
    id: 'architect',
    name: 'Architect',
    avatar: '🧠',
    role: 'architect',
    description: 'System design and technical decisions',
    recommended_model: 'claude-opus-4-6',
    recommended_effort: 'high',
    default_instructions: 'You are a Senior Software Architect. Focus on system design, scalability, and technical decisions. Consider long-term maintainability and performance implications of all recommendations.',
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    avatar: '🔍',
    role: 'reviewer',
    description: 'Code quality and security audits',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'medium',
    default_instructions: 'You are a Senior Code Reviewer. Analyze code for bugs, security vulnerabilities, performance issues, and maintainability concerns. Provide specific, actionable feedback.',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    avatar: '📚',
    role: 'researcher',
    description: 'Deep research and information synthesis',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'high',
    default_instructions: 'You are a Research Specialist. Gather, analyze, and synthesize information thoroughly. Provide well-sourced, comprehensive research with clear conclusions and recommendations.',
  },
  {
    id: 'writer',
    name: 'Writer',
    avatar: '✍️',
    role: 'writer',
    description: 'Content creation and documentation',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'medium',
    default_instructions: 'You are a Professional Writer and Content Specialist. Create clear, engaging, and well-structured content. Adapt tone and style to the audience and purpose.',
  },
  {
    id: 'analyst',
    name: 'Analyst',
    avatar: '📊',
    role: 'analyst',
    description: 'Data analysis and business insights',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'medium',
    default_instructions: 'You are a Data and Business Analyst. Analyze data, identify patterns, and provide actionable insights. Present findings clearly with supporting evidence.',
  },
  {
    id: 'custom',
    name: 'Custom Worker',
    avatar: '🤖',
    role: 'custom',
    description: 'Define your own role and instructions',
    recommended_model: 'claude-sonnet-4-6',
    recommended_effort: 'medium',
    default_instructions: '',
  },
]

// ─── MODELS ───────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string
  name: string
  provider: Provider
  context_window: number
  supports_effort: boolean
  effort_levels: Effort[]
  cost_per_1k_input: number
  cost_per_1k_output: number
  description: string
}

export const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    context_window: 200000,
    supports_effort: true,
    effort_levels: ['low', 'medium', 'high'],
    cost_per_1k_input: 0.015,
    cost_per_1k_output: 0.075,
    description: 'Most powerful — complex reasoning and architecture',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    context_window: 200000,
    supports_effort: true,
    effort_levels: ['low', 'medium', 'high'],
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    description: 'Balanced — fast and capable for most tasks',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    context_window: 200000,
    supports_effort: false,
    effort_levels: ['medium'],
    cost_per_1k_input: 0.00025,
    cost_per_1k_output: 0.00125,
    description: 'Fastest — lightweight tasks and quick answers',
  },
]

// ─── WORKSPACE ────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  user_id: string
  name: string
  description?: string
  icon: string
  current_worker_id?: string
  current_task_id?: string
  status: WorkspaceStatus
  is_deleted: boolean
  created_at: string
  updated_at: string
  // Relations
  current_worker?: Worker
  current_task?: Task
  message_count?: number
}

// ─── CONVERSATION & MESSAGES ──────────────────────────────────────────────────

export interface Conversation {
  id: string
  workspace_id: string
  worker_id: string
  title: string
  status: 'active' | 'archived' | 'handoff'
  created_at: string
  updated_at: string
  worker?: Worker
}

export interface Message {
  id: string
  conversation_id: string
  workspace_id: string
  worker_id?: string
  role: MessageRole
  content: string
  content_type: 'text' | 'file' | 'image'
  metadata?: MessageMetadata
  is_edited: boolean
  created_at: string
}

export interface MessageMetadata {
  model?: string
  input_tokens?: number
  output_tokens?: number
  estimated_cost?: number
  effort?: Effort
  stop_reason?: string
}

// ─── TASK ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  workspace_id: string
  title: string
  description?: string
  status: TaskStatus
  assigned_worker_id?: string
  suggested_by: 'user' | 'ai'
  priority: number
  progress: number
  created_at: string
  updated_at: string
  assigned_worker?: Worker
}

// ─── USAGE ────────────────────────────────────────────────────────────────────

export interface UsageLog {
  id: string
  user_id: string
  workspace_id: string
  worker_id: string
  conversation_id?: string
  provider: Provider
  model: string
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  request_type: string
  created_at: string
}

export interface UsageSummary {
  today_cost: number
  month_cost: number
  today_requests: number
  month_requests: number
  today_input_tokens: number
  today_output_tokens: number
  month_input_tokens: number
  month_output_tokens: number
}

// ─── ENERGY ───────────────────────────────────────────────────────────────────

export interface WorkerEnergy {
  worker_id: string
  energy_percent: number
  status: EnergyStatus
  is_estimated: boolean
  input_tokens_today: number
  output_tokens_today: number
  requests_today: number
  estimated_cost_today: number
}

export function getEnergyStatus(percent: number): EnergyStatus {
  if (percent >= 70) return 'healthy'
  if (percent >= 40) return 'moderate'
  if (percent >= 15) return 'low'
  if (percent >= 1) return 'critical'
  return 'exhausted'
}

export const ENERGY_CONFIG = {
  healthy: { label: 'Healthy', color: '#22c55e', bg: 'bg-green-500' },
  moderate: { label: 'Moderate', color: '#eab308', bg: 'bg-yellow-500' },
  low: { label: 'Low', color: '#f97316', bg: 'bg-orange-500' },
  critical: { label: 'Critical', color: '#ef4444', bg: 'bg-red-500' },
  exhausted: { label: 'Exhausted', color: '#6b7280', bg: 'bg-gray-500' },
  unknown: { label: 'Unknown', color: '#6b7280', bg: 'bg-gray-400' },
}

// ─── USER SETTINGS ────────────────────────────────────────────────────────────

export interface UserSettings {
  id: string
  user_id: string
  daily_budget: number
  monthly_budget: number
  budget_warning_threshold: number
  advanced_mode: boolean
  auto_handoff: boolean
  created_at: string
  updated_at: string
}

// ─── HANDOFF ─────────────────────────────────────────────────────────────────

export interface Handoff {
  id: string
  workspace_id: string
  from_worker_id: string
  to_worker_id: string
  from_conversation_id: string
  to_conversation_id?: string
  reason: HandoffReason
  status: HandoffStatus
  context_snapshot: HandoffContext
  created_at: string
  completed_at?: string
}

export interface HandoffContext {
  current_task?: string
  memory_snapshot?: string
  relevant_messages?: Message[]
  work_summary?: string
}

// ─── API RESPONSE ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

export interface StreamChunk {
  type: 'text' | 'usage' | 'done' | 'error'
  content?: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  error?: string
  message_id?: string
}
