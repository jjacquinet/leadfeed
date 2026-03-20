DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'deal_stage'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_deal_stage_check;

    UPDATE leads
    SET deal_stage = CASE
      WHEN deal_stage IN ('lead', 'conversation') THEN 'positive_reply'
      WHEN deal_stage = 'demo_scheduled' THEN 'meeting_booked'
      WHEN deal_stage = 'proposal_sent' THEN 'deal'
      WHEN deal_stage IN (
        'positive_reply',
        'meeting_booked',
        'meeting_completed',
        'deal',
        'contract_sent',
        'closed_won',
        'closed_lost'
      ) THEN deal_stage
      ELSE 'positive_reply'
    END
    WHERE deal_stage IS NULL
      OR deal_stage NOT IN (
        'positive_reply',
        'meeting_booked',
        'meeting_completed',
        'deal',
        'contract_sent',
        'closed_won',
        'closed_lost'
      );

    ALTER TABLE leads
      ALTER COLUMN deal_stage SET DEFAULT 'positive_reply';

    ALTER TABLE leads
      ADD CONSTRAINT leads_deal_stage_check
      CHECK (
        deal_stage IN (
          'positive_reply',
          'meeting_booked',
          'meeting_completed',
          'deal',
          'contract_sent',
          'closed_won',
          'closed_lost'
        )
      );
  END IF;
END $$;
