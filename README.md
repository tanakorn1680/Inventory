# 🏢 AI Office

An AI workspace platform with smart workers, intelligent handoffs, and seamless task management.

## Features

- **AI Workers** — configure workers with roles, models, and thinking effort
- **Streaming Chat** — real-time Claude responses with markdown rendering
- **Context Window Management** — smart truncation for long conversations
- **Handoff System** — hand off tasks between workers with full context packages
- **Work Package** — auto-generated briefings for incoming workers
- **Project Memory** — persistent knowledge injected into every conversation
- **AI Intelligence** — auto-suggest tasks and extract memory from conversations
- **Files** — upload and share files with your AI team
- **Tasks** — Kanban board with AI-suggested items
- **Usage Tracking** — cost monitoring with daily/monthly budgets
- **Rate Limiting** — per-user limits via Upstash Redis

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
# Run supabase/schema-complete.sql in Supabase SQL Editor
npm run dev
```

See [DEPLOY.md](./DEPLOY.md) for full deployment guide.

## Stack

Next.js 14 · TypeScript · Supabase · Anthropic Claude · Zustand · Vercel

## License

MIT
