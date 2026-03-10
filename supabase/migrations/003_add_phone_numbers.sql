-- Add support for up to 5 phone numbers per lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_numbers TEXT[] DEFAULT '{}'::TEXT[];

-- Backfill existing single phone values into the new array.
UPDATE leads
SET phone_numbers = ARRAY[phone]
WHERE phone IS NOT NULL
  AND btrim(phone) <> ''
  AND (phone_numbers IS NULL OR cardinality(phone_numbers) = 0);
