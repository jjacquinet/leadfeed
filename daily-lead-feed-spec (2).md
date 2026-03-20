# Daily Lead Feed — Product Spec & Prototype Plan

## Overview

The Daily Lead Feed is the primary operating surface for sales reps managing warm leads in Outbounder AI. A rep opens this page every morning and immediately sees a prioritized queue of tasks across their active leads. They execute everything — email, LinkedIn, text, call — without leaving the page. Every action is auto-logged. When a task is complete, the lead snoozes until the next touchpoint.

**Tech stack:** Next.js / TypeScript / Supabase / Railway
**Channels:** Email, LinkedIn (via Unipile), SMS/Voice (via Telnyx), Apollo (phone enrichment)
**Leads enter via:** GetSales webhook (rep marks a prospect as "lead")

---

## Terminology

- **Prospect**: A contact in the inbox who has NOT been promoted to lead. Lives in the inbox only.
- **Lead**: A prospect that a rep has manually promoted. Lives in the Daily Lead Feed only. Once promoted, all future inbound from this person surfaces in the lead feed, NOT the inbox.
- **Snoozed**: A lead with no task today. They have a snooze expiration date and will resurface when it expires. Snooze can be short (days) or long (months). Not visible in the active queue.
- **Archived**: A lead removed from the feed entirely. Full history preserved. If they re-engage via a future campaign, they appear in the inbox as a fresh prospect.
- **Active**: A lead with a task today (snooze expired, unread reply, cadence due, etc.). Visible in the daily queue.

---

## UI Layout — Three-Panel Intercom-Style

The page is a full-height three-panel layout with resizable panels (drag handles between panels).

### Page Header (top, white background, standard platform styling)
- Page title: "Daily Lead Feed"
- Subtitle: date + "Prioritized at [time]"
- Stats on the right: Tasks count, Needs Reply count, Done count, Snoozed count
- Refresh button to re-run prioritization

### Left Panel — Queue List (default ~300px wide, min 200, max 500)
- Scrollable list of today's active leads, ranked by priority (highest first)
- Filter tabs at top: All | Replies | Done
- Each card shows:
  - Avatar (initials + color)
  - Lead name (with unread indicator dot if has unread reply)
  - Title · Company
  - AI recommended action with sparkle icon (e.g., "✦ Respond to reply")
  - Deal stage tag (color-coded: Lead, Conversation, Demo Scheduled, Proposal Sent, Contract Sent)
  - Deal size
- Clicking a card loads that lead in the center and right panels
- Selected card has left border highlight
- Completed cards show checkmark and reduced opacity, move to bottom

### Center Panel — Activity Timeline + Compose (flexible width, fills remaining space)

**Header bar:**
- Left: Lead avatar, name, title at company
- Right: Snooze button + Archive button

**Activity timeline (scrollable area, takes up most of the panel):**
- Chronological feed of ALL touchpoints across all channels
- Chat-bubble style:
  - Outbound messages (sent by rep): right-aligned, colored background per channel
  - Inbound messages (from lead): left-aligned, white background with border
  - Calls: styled differently with outcome and duration
  - Notes: subtle styling, gray background
- Each entry shows: channel icon, label (e.g., "You sent email"), timestamp, message preview/content
- Channel colors:
  - Email sent: #6366F1 (indigo)
  - Email received: #22C55E (green)
  - Call: #F59E0B (amber)
  - LinkedIn sent: #0A66C2 (linkedin blue)
  - LinkedIn received: #22C55E (green)
  - Note: #94A3B8 (gray)

**AI Suggestion Banner (sits between timeline and compose area):**
- Light blue background (#F0F9FF)
- Sparkle icon + recommended action + channel + rationale
- Example: "✦ Respond to reply via email · Replied 2 hours ago · asking about integrations"
- NOTE: For V1 prototype, this banner is hidden/skipped since we're using rule-based sorting, not AI recommendations

**Compose area (bottom of center panel):**
- Channel tabs: Email | Call | LinkedIn | Text | Note
  - Recommended channel tab gets a sparkle icon badge (when AI is active)
  - Clicking a tab switches the compose mode
- For Email/LinkedIn/Text/Note: textarea with send button
  - V1: rep types manually (no AI draft generation)
  - Future: "Draft" button that calls Claude to generate a personalized message
- For Call: outcome buttons (Connected, Voicemail, No Answer, Meeting Booked) + call notes textarea
- Send button right-aligned at bottom

**Snooze completion flow:**
- After sending/completing a task, a green bar appears above compose:
  - "✓ Done! Snooze:"
  - Duration buttons: Tomorrow, 3 Days, 1 Week, 2 Weeks, 1 Month, 3 Months
  - "Let AI Decide" button (future feature, not V1)
  - Selecting a duration snoozes the lead and advances to next lead in queue

### Right Panel — Contact Details (default ~260px wide, min 200, max 450)

**Contact header (centered):**
- Large avatar
- Name, title, company, company size
- Deal stage tag + deal size tag

**Contact section:**
- EMAIL: value + action button (switches compose to email)
- PHONE: value + action button (switches compose to call)
- LINKEDIN: value + action button (switches compose to LinkedIn)
- LOCATION: value only

**Details section:**
- ICP FIT: percentage + progress bar (green >85%, amber >70%, red below) — future feature, skip V1
- PRIORITY: score out of 100 — future feature, skip V1
- COMPANY: size info
- SOURCE: how the lead was acquired (LinkedIn Outbound, Email Campaign, Conference, etc.)
- LEAD DATE: when they were promoted to lead
- LAST TOUCH: relative timestamp of last activity

**Notes section:**
- Freeform text showing rep notes for this lead

---

## Data Model (Supabase)

### leads table
```
id: uuid (primary key)
name: text
title: text
company: text
company_size: text (nullable)
email: text (nullable)
phone: text (nullable)
linkedin_url: text (nullable)
location: text (nullable)
avatar_color: text (hex color)
deal_stage: text (enum: 'lead', 'conversation', 'demo_scheduled', 'proposal_sent', 'contract_sent')
deal_size: decimal (nullable)
lead_source: text (e.g., 'LinkedIn Outbound', 'Email Campaign', 'Conference')
status: text (enum: 'active', 'snoozed', 'archived')
snooze_until: timestamptz (nullable — when snoozed, this is the expiration)
has_unread: boolean (default false)
last_inbound_at: timestamptz (nullable)
last_activity_at: timestamptz (nullable)
notes: text (nullable)
rep_id: uuid (foreign key to users, for multi-rep support later)
created_at: timestamptz
updated_at: timestamptz
```

### activities table
```
id: uuid (primary key)
lead_id: uuid (foreign key to leads)
type: text (enum: 'email_sent', 'email_received', 'linkedin_sent', 'linkedin_received', 'call', 'text_sent', 'text_received', 'note')
channel: text (enum: 'email', 'linkedin', 'call', 'text', 'note')
direction: text (enum: 'inbound', 'outbound', 'internal')
content: text (message body, call notes, note text)
metadata: jsonb (nullable — call duration, call outcome, etc.)
created_at: timestamptz
```

### Key indexes
- leads: status, snooze_until, has_unread, last_inbound_at
- activities: lead_id, created_at

---

## V1 Prototype — Feature Scope

### Build (Priority Order)

1. **Three-panel UI** rendering with real Supabase data
   - Left panel: query leads where status = 'active' OR (status = 'snoozed' AND snooze_until <= now())
   - Sort: has_unread DESC, last_inbound_at DESC, last_activity_at DESC
   - Center panel: load activities for selected lead, display as chat-bubble timeline
   - Right panel: display lead contact info and metadata

2. **Read/unread tracking**
   - When inbound webhook arrives for a lead: set has_unread = true, update last_inbound_at
   - When rep clicks on a lead card in the queue: set has_unread = false
   - Unread leads get a purple dot indicator and sort to top of queue

3. **Activity timeline**
   - Query activities table for selected lead, order by created_at ASC
   - Render with chat-bubble UI (inbound left, outbound right)
   - Auto-scroll to bottom (most recent) on load

4. **Multi-channel compose and send**
   - Email: compose + send via GetSales (already built)
   - LinkedIn: compose + send via GetSales (already built)
   - Text: display phone number, rep right-clicks to text via Mac native (no in-app sending needed)
   - Call: display phone number, rep right-clicks to call via Mac native (no in-app dialer needed), then log outcome (Connected, Voicemail, No Answer, Meeting Booked) + call notes in the app
   - Note: save freeform note
   - Email/LinkedIn actions auto-create an activity record in the activities table via GetSales
   - Call/text outcomes and notes are manually logged by rep and saved as activity records
   - After any action, update lead's last_activity_at

5. **Snooze with duration**
   - After completing a task, show snooze duration picker
   - Options: Tomorrow, 3 Days, 1 Week, 2 Weeks, 1 Month, 3 Months, Custom Date
   - Set lead status = 'snoozed', snooze_until = calculated timestamp
   - Snoozed leads disappear from queue
   - Cron job or Supabase edge function: runs every hour, finds leads where status = 'snoozed' AND snooze_until <= now(), flips them to status = 'active'

6. **Archive**
   - Button in center panel header
   - Sets lead status = 'archived'
   - Lead disappears from queue
   - All activity data preserved

7. **Inbound webhook handler**
   - Receives new messages from GetSales
   - If sender matches an existing lead (by email or LinkedIn): create activity record, set has_unread = true, update last_inbound_at
   - If sender does NOT match a lead: ignore (stays in inbox/prospect world)

### Skip for V1

- AI-powered prioritization scoring (use rule-based sort instead)
- AI draft message generation (rep types manually)
- AI suggestion banner (hide or show static placeholder)
- ICP fit scoring against knowledge base
- Priority score display
- Deal stage progression (allow manual setting but no auto-advance)
- Channel rotation logic (rep chooses channel manually)
- Decay scoring
- "Let AI Decide" snooze option
- Daily task caps
- Time zone awareness
- Focus mode (single-card view)
- Platform-wide AI agent panel

---

## V1 Queue Sorting Logic (Rule-Based)

```typescript
function sortLeads(leads: Lead[]): Lead[] {
  return leads.sort((a, b) => {
    // 1. Unread replies always first
    if (a.has_unread && !b.has_unread) return -1;
    if (!a.has_unread && b.has_unread) return 1;

    // 2. Among unread, sort by most recent inbound
    if (a.has_unread && b.has_unread) {
      return new Date(b.last_inbound_at).getTime() - new Date(a.last_inbound_at).getTime();
    }

    // 3. Among non-unread, sort by last activity (most stale first = needs attention)
    return new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime();
  });
}
```

---

## Future AI Prioritization (Post-V1)

When ready to add AI scoring, the system runs 1-2x daily:

**Pass 1 — Scoring (Haiku, cheap):**
- Evaluate all active/due leads
- Input: lead profile, activity timeline, client knowledge base
- Output: priority score, recommended action, recommended channel, rationale
- Cost: ~$0.02 per run

**Pass 2 — Draft generation (Sonnet, on-demand):**
- Only fires when rep clicks "Draft" button on a specific lead
- Input: single lead's timeline + notes + knowledge base
- Output: personalized message draft
- Cost: ~$0.008 per draft

**Priority scoring signals (weighted):**
1. Unread inbound reply (highest signal)
2. Deal stage (contract > proposal > demo > conversation > lead)
3. Deal size (multiplier)
4. Title fit against client ICP/knowledge base
5. Company fit against client ICP/knowledge base
6. Cadence adherence (overdue tasks get boost)
7. Rep-defined override (manual priority flag)
8. Decay from non-engagement (negative modifier, compounds over time)

**Estimated cost:** ~$10-25/client/month with on-demand drafting

---

## Key UX Behaviors

- **Selecting a lead** loads their timeline and contact details instantly
- **Sending a message** auto-logs the activity, no separate "log" step
- **Completing a task** triggers the snooze picker, then auto-advances to next lead
- **Completed leads** move to bottom of queue with reduced opacity and checkmark
- **Snooze expiration** silently flips leads back to active (cron job)
- **Inbound from a lead** sets has_unread and bumps them toward top of queue
- **Inbound from a non-lead** is ignored by the lead feed (stays in inbox)
- **Archived leads** are fully removed but data preserved
- **Panels are resizable** via drag handles between panels (left: 200-500px, right: 200-450px)

---

## UI Reference

The React mockup file `outbounder-lead-feed.jsx` in this repo is the visual reference for the three-panel layout. It contains:
- Complete three-panel structure with resizable panels
- Queue card design with all visual elements
- Chat-bubble activity timeline
- Compose area with channel tabs
- Snooze completion flow
- Contact details sidebar
- Color scheme, typography (DM Sans + DM Mono), spacing, and component patterns

Use this as the design reference when building components. The mockup uses inline styles — convert to your project's styling approach (Tailwind, CSS modules, etc.) as appropriate.

---

## Channel Integration Notes

- **Email:** Send via GetSales (already built). Inbound via GetSales webhook or Instantly inbox polling.
- **LinkedIn:** Send/receive via GetSales (already built).
- **SMS:** No in-app sending for V1. Display phone number, rep uses Mac native right-click to text. Log outcome manually in app.
- **Voice:** No in-app dialer for V1. Display phone number, rep uses Mac native right-click to call. Log call outcome + notes in app.
- **Apollo:** Phone number enrichment (already integrated).

---

## Open Questions for Future Iterations

1. How should we handle multiple leads at the same company? (Account-level grouping)
2. Should deal stage auto-advance based on activity patterns?
3. What's the right decay curve before recommending archive? (X touches, Y days, Z channels)
4. Should the "Refresh" button re-run full prioritization or just re-sort existing scores?
5. When AI scoring is active, should the rep be able to see/understand the score breakdown?
6. Should archived leads auto-re-promote if they reply to a future campaign, or go to inbox first?
