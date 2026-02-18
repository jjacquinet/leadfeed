-- Add GetSales.io UUID to leads table for API conversation syncing
ALTER TABLE leads ADD COLUMN IF NOT EXISTS getsales_uuid TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_getsales_uuid ON leads(getsales_uuid);

-- Add getsales_message_id to messages to avoid duplicate syncs
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);
