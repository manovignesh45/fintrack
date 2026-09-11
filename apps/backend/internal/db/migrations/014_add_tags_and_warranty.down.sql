ALTER TABLE transactions DROP COLUMN IF EXISTS warranty_notes;
ALTER TABLE transactions DROP COLUMN IF EXISTS warranty_until;
DROP TABLE IF EXISTS transaction_tags;
DROP TABLE IF EXISTS tags;
