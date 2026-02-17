-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  company_website TEXT,
  stage TEXT NOT NULL DEFAULT 'lead_feed'
    CHECK (stage IN ('lead_feed', 'snoozed', 'meeting_booked', 'closed_won', 'closed_lost')),
  snoozed_until TIMESTAMPTZ,
  source TEXT,
  campaign_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'linkedin'
    CHECK (channel IN ('linkedin', 'email', 'phone', 'text')),
  direction TEXT NOT NULL
    CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  is_note BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_last_activity ON leads(last_activity DESC);
CREATE INDEX idx_leads_snoozed_until ON leads(snoozed_until);
CREATE INDEX idx_leads_linkedin_url ON leads(linkedin_url);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- Enable Row Level Security (permissive for MVP — tighten later with auth)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon users (MVP)
CREATE POLICY "Allow all access to leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);
