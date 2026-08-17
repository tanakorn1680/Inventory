# AI Office — Deployment Guide

## Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Anthropic API key
- Vercel account (free tier works)
- Upstash account (optional — for rate limiting)

---

## Step 1 — Supabase Setup

### 1.1 Create Project
1. Go to [supabase.com](https://supabase.com) → New project
2. Save your **Project URL**, **Anon Key**, and **Service Role Key**

### 1.2 Run Schema
1. Dashboard → SQL Editor → New query
2. Paste contents of `supabase/schema-complete.sql`
3. Click **Run**

### 1.3 Configure Auth
1. Dashboard → Authentication → URL Configuration
2. Set **Site URL**: `https://your-app.vercel.app`
3. Add to **Redirect URLs**: `https://your-app.vercel.app/api/auth/callback`
4. Dashboard → Authentication → Email → Enable "Confirm email" (recommended)

### 1.4 Storage (auto-created by schema)
Verify `workspace-files` bucket exists in Storage → Buckets

---

## Step 2 — Environment Variables

Create `.env.local` (copy from `.env.local.example`):

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY

# Optional — Upstash Redis for rate limiting
# Create free Redis at https://upstash.com → Redis → Create
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Step 3 — Local Development

```bash
# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local
# Fill in your values

# Run dev server
npm run dev
# → http://localhost:3000
```

---

## Step 4 — Deploy to Vercel

### 4.1 Via CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 4.2 Via Dashboard
1. [vercel.com](https://vercel.com) → Import Git Repository
2. Connect your GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Add all environment variables from `.env.local`
5. Deploy

### 4.3 After Deploy
1. Copy your Vercel deployment URL
2. Add to Supabase Auth → Redirect URLs
3. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars

---

## Step 5 — Optional: Upstash Rate Limiting

1. [upstash.com](https://upstash.com) → Redis → Create Database
2. Copy **REST URL** and **REST Token**
3. Add to Vercel environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy

Without Upstash, rate limiting is disabled (all requests allowed).

---

## Feature Checklist

After deployment, verify:

- [ ] Sign up / Sign in works
- [ ] Create a workspace
- [ ] Create a worker (try Developer template)
- [ ] Send a message → streaming response appears
- [ ] Upload a file in Files tab
- [ ] Add a task in Tasks tab
- [ ] Add memory entries in Memory tab
- [ ] Click ✨ in chat → suggest tasks works
- [ ] Click ✨ → extract memory works
- [ ] Click "Hand Off Task" in Worker Panel → handoff flow works
- [ ] Check Handoffs tab → work package visible
- [ ] Usage page shows cost data

---

## Architecture Overview

```
Vercel (Edge/Node)
├── Next.js 14 App Router
│   ├── /api/ai/chat          → Anthropic streaming (120s timeout)
│   ├── /api/intelligence/*   → Haiku-powered features
│   └── /api/auth/*           → Supabase auth callbacks
│
Supabase
├── PostgreSQL (14 tables + RLS)
├── Auth (email/password)
├── Storage (workspace-files bucket)
└── Functions (via SQL)

Upstash Redis (optional)
└── Rate limiting (20 chat req/min per user)
```

---

## Cost Estimates

| Usage Level | Anthropic | Supabase | Vercel | Total/mo |
|-------------|-----------|----------|--------|----------|
| Personal    | ~$2–5     | Free     | Free   | ~$2–5    |
| Small team  | ~$15–30   | Free     | Free   | ~$15–30  |
| Heavy use   | ~$50+     | Pro $25  | Pro $20| ~$95+    |

Models used:
- **Chat**: claude-sonnet-4-6 (~$0.003/1K input, $0.015/1K output)
- **Intelligence features**: claude-haiku-4-5 (~$0.00025/1K input)

---

## Security Notes

- Service Role Key is **never** exposed to the client
- All API routes verify user ownership before DB operations
- RLS policies enforce row-level isolation
- File storage paths include user ID prefix
- Rate limiting prevents API abuse
- Input sanitization on all user-supplied fields
- Budget guards prevent runaway costs
