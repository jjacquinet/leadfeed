-- Track sender profile context directly on activity records.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS sender_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_profile_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_profile_identity TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_sender_profile_id
  ON activities(sender_profile_id);
