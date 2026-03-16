-- Store lead phone numbers as a JSONB array.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS phone_numbers JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'phone_numbers'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE leads
      ALTER COLUMN phone_numbers DROP DEFAULT;

    ALTER TABLE leads
      ALTER COLUMN phone_numbers TYPE JSONB
      USING CASE
        WHEN phone_numbers IS NULL THEN '[]'::jsonb
        ELSE to_jsonb(phone_numbers)
      END;

    ALTER TABLE leads
      ALTER COLUMN phone_numbers SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
