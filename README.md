# Outbounder AI — Lead Feed

An Intercom-style lead feed inbox for managing warm leads from outbound sales campaigns. Receives leads via webhook from GetSales.io (forwarded through n8n) and displays them in a three-panel queue to work through daily.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Railway (standalone Docker build)

## Getting Started

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration SQL in the Supabase SQL Editor:
   - `supabase/migrations/001_create_tables.sql` — Creates `leads` and `messages` tables
3. (Optional) Run `supabase/seed.sql` to populate with 10 sample leads and conversations

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (for webhook) |
| `WEBHOOK_API_KEY` | Secret key for authenticating webhook requests |

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Webhook Endpoint

**POST** `/api/webhooks/getsales`

Headers:
- `x-api-key: <your WEBHOOK_API_KEY>`
- `Content-Type: application/json`

Example payload:
```json
{
  "first_name": "Alexandra",
  "last_name": "Anholt",
  "email": "alexandra@company.com",
  "title": "Head of Marketing",
  "company": "Acme Corp",
  "linkedin_url": "https://linkedin.com/in/alexandraanholt",
  "company_website": "https://acmecorp.com",
  "campaign_name": "Q1 Biotech Outreach",
  "channel": "linkedin",
  "messages": [
    {
      "direction": "outbound",
      "content": "Hi Alexandra, I noticed your work at Acme Corp...",
      "timestamp": "2025-01-10T14:30:00Z"
    },
    {
      "direction": "inbound",
      "content": "Hey! Thanks for reaching out.",
      "timestamp": "2025-01-11T09:15:00Z"
    }
  ]
}
```

The endpoint:
- Validates the API key header
- Checks for duplicate leads (by LinkedIn URL or email)
- Creates or updates the lead and appends messages
- Returns `{ success: true, action: "created"|"updated", lead_id: "..." }`

## Deploying to Railway

1. Push your code to a Git repository
2. Create a new project in Railway and connect the repo
3. Add all environment variables in Railway's "Variables" tab
4. Railway will auto-detect the Dockerfile and build
5. Your webhook URL will be: `https://<your-app>.up.railway.app/api/webhooks/getsales`

## Features

- **Three-panel Intercom-style layout** — Sidebar, Conversation, Detail panels
- **Lead stages** — Lead Feed, Snoozed, Meeting Booked, Closed Won, Closed Lost
- **Snooze leads** — 1 day, 2 days, 1 week, or custom date/time
- **Internal notes** — Add notes that appear in the conversation timeline
- **Stage transitions** — Move leads through the pipeline with auto-generated system notes
- **Webhook ingestion** — Receive leads from GetSales.io via n8n
- **Auto-unsnooze** — Expired snoozed leads automatically return to Lead Feed
- **Seed data** — 10 realistic B2B leads with conversation threads included

## Project Structure

```
app/
  layout.tsx                 — Root layout
  page.tsx                   — Main lead feed page (client component)
  api/
    webhooks/getsales/       — Webhook endpoint
    leads/                   — Leads CRUD + counts
    messages/                — Messages CRUD
components/
  layout/                    — Sidebar, ConversationPanel, DetailPanel
  leads/                     — LeadListItem, LeadStageSelector
  conversation/              — MessageBubble, ConversationThread, MessageComposer
  snooze/                    — SnoozePopover
  ui/                        — Avatar, Badge, Toast, ChannelIcon
lib/
  supabase.ts                — Supabase client (lazy-initialized)
  types.ts                   — TypeScript interfaces
  utils.ts                   — Helper functions
supabase/
  migrations/                — SQL migration files
  seed.sql                   — Sample data
```
