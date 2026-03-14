-- Daily Lead Feed V1 migration:
-- - Adds spec-aligned fields to leads
-- - Adds activities table
-- - Backfills activities from existing messages
-- - Preserves legacy columns/tables for compatibility

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#6366F1',
  ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS deal_size NUMERIC,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_unread BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS rep_id UUID;

-- Ensure status/deal_stage constraints exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_status_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_status_check
      CHECK (status IN ('active', 'snoozed', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_deal_stage_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_deal_stage_check
      CHECK (deal_stage IN ('lead', 'conversation', 'demo_scheduled', 'proposal_sent', 'contract_sent'));
  END IF;
END $$;

-- Backfill leads values from legacy schema
UPDATE leads
SET
  name = COALESCE(name, NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')),
  status = COALESCE(
    status,
    CASE
      WHEN stage = 'snoozed' THEN 'snoozed'
      ELSE 'active'
    END
  ),
  snooze_until = COALESCE(snooze_until, snoozed_until),
  lead_source = COALESCE(lead_source, source),
  last_activity_at = COALESCE(last_activity_at, last_activity, updated_at, created_at),
  avatar_color = COALESCE(avatar_color, '#6366F1'),
  deal_stage = COALESCE(deal_stage, 'lead');

-- If status was defaulted before legacy values were copied, correct it.
UPDATE leads
SET status = CASE
  WHEN stage = 'snoozed' THEN 'snoozed'
  ELSE 'active'
END
WHERE status NOT IN ('active', 'snoozed', 'archived');

-- Compute last inbound timestamp from existing messages.
WITH inbound_by_lead AS (
  SELECT lead_id, MAX(timestamp) AS max_inbound_at
  FROM messages
  WHERE direction = 'inbound'
  GROUP BY lead_id
)
UPDATE leads l
SET
  last_inbound_at = COALESCE(l.last_inbound_at, i.max_inbound_at),
  has_unread = COALESCE(l.has_unread, FALSE)
FROM inbound_by_lead i
WHERE l.id = i.lead_id;

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'email_sent', 'email_received',
      'linkedin_sent', 'linkedin_received',
      'call',
      'text_sent', 'text_received',
      'note'
    )
  ),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'call', 'text', 'note')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_snooze_until ON leads(snooze_until);
CREATE INDEX IF NOT EXISTS idx_leads_has_unread ON leads(has_unread);
CREATE INDEX IF NOT EXISTS idx_leads_last_inbound_at ON leads(last_inbound_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_activity_at ON leads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

-- Backfill activities from legacy messages.
INSERT INTO activities (lead_id, type, channel, direction, content, metadata, created_at)
SELECT
  m.lead_id,
  CASE
    WHEN m.is_note THEN 'note'
    WHEN m.channel = 'email' AND m.direction = 'inbound' THEN 'email_received'
    WHEN m.channel = 'email' AND m.direction = 'outbound' THEN 'email_sent'
    WHEN m.channel = 'linkedin' AND m.direction = 'inbound' THEN 'linkedin_received'
    WHEN m.channel = 'linkedin' AND m.direction = 'outbound' THEN 'linkedin_sent'
    WHEN m.channel = 'text' AND m.direction = 'inbound' THEN 'text_received'
    WHEN m.channel = 'text' AND m.direction = 'outbound' THEN 'text_sent'
    ELSE 'call'
  END AS type,
  CASE
    WHEN m.is_note THEN 'note'
    WHEN m.channel = 'phone' THEN 'call'
    ELSE m.channel
  END AS channel,
  CASE
    WHEN m.is_note THEN 'internal'
    ELSE m.direction
  END AS direction,
  m.content,
  CASE
    WHEN m.external_id IS NULL THEN NULL
    ELSE jsonb_build_object('external_id', m.external_id)
  END AS metadata,
  m.timestamp
FROM messages m
WHERE NOT EXISTS (
  SELECT 1
  FROM activities a
  WHERE a.lead_id = m.lead_id
    AND a.created_at = m.timestamp
    AND a.content = m.content
);
