-- Track canonical GetSales prospect/lead UUID on lead records.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS getsales_prospect_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_getsales_prospect_id
  ON leads(getsales_prospect_id);
