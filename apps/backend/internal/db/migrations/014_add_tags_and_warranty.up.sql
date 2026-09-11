-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id         SERIAL PRIMARY KEY,
    ledger_id  INTEGER NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    color      VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ledger_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_ledger_id ON tags(ledger_id);

-- Create junction table between transactions and tags
CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id         INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tx_tags_tx ON transaction_tags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_tags_tag ON transaction_tags(tag_id);

-- Add warranty columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS warranty_until DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS warranty_notes TEXT;
