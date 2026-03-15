-- Daily Lead Feed V1.1:
-- - Rename archived status to closed
-- - Add closed_at timestamp for Closed queue sorting/display

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Drop any existing status constraint first so we can safely normalize values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_status_check'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT leads_status_check;
  END IF;
END $$;

-- Backfill newly closed timestamp for existing archived rows.
UPDATE leads
SET closed_at = COALESCE(closed_at, updated_at, NOW())
WHERE status = 'archived';

-- Rename archived -> closed before enforcing the new constraint.
UPDATE leads
SET status = 'closed'
WHERE status = 'archived';

-- Normalize any unexpected legacy statuses to active so the constraint can be added safely.
UPDATE leads
SET status = CASE
  WHEN stage = 'snoozed' THEN 'snoozed'
  ELSE 'active'
END
WHERE status IS NOT NULL
  AND status NOT IN ('active', 'snoozed', 'closed');

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('active', 'snoozed', 'closed'));
