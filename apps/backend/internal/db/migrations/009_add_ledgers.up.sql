-- 009_add_ledgers.up.sql

CREATE TABLE IF NOT EXISTS ledgers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

ALTER TABLE accounts ADD COLUMN ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE;
ALTER TABLE sub_categories ADD COLUMN ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE;
ALTER TABLE transaction_templates ADD COLUMN ledger_id INTEGER REFERENCES ledgers(id) ON DELETE CASCADE;

-- Create default ledger for each user
INSERT INTO ledgers (user_id, name)
SELECT id, 'Personal' FROM users;

-- Assign existing data to the new default ledger
UPDATE accounts SET ledger_id = (SELECT l.id FROM ledgers l WHERE l.user_id = accounts.user_id LIMIT 1);
UPDATE categories SET ledger_id = (SELECT l.id FROM ledgers l WHERE l.user_id = categories.user_id LIMIT 1);
UPDATE sub_categories SET ledger_id = (SELECT l.id FROM ledgers l WHERE l.user_id = sub_categories.user_id LIMIT 1);
UPDATE transactions SET ledger_id = (SELECT l.id FROM ledgers l WHERE l.user_id = transactions.user_id LIMIT 1);
UPDATE transaction_templates SET ledger_id = (SELECT l.id FROM ledgers l WHERE l.user_id = transaction_templates.user_id LIMIT 1);

-- Force NOT NULL
ALTER TABLE accounts ALTER COLUMN ledger_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN ledger_id SET NOT NULL;
ALTER TABLE sub_categories ALTER COLUMN ledger_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN ledger_id SET NOT NULL;
ALTER TABLE transaction_templates ALTER COLUMN ledger_id SET NOT NULL;

-- Update constraints
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_name_nature_key;
ALTER TABLE categories ADD CONSTRAINT categories_ledger_id_name_nature_key UNIQUE (ledger_id, name, nature);

-- Drop user_id columns as they are now redundant
ALTER TABLE accounts DROP COLUMN user_id;
ALTER TABLE categories DROP COLUMN user_id;
ALTER TABLE sub_categories DROP COLUMN user_id;
ALTER TABLE transactions DROP COLUMN user_id;
ALTER TABLE transaction_templates DROP COLUMN user_id;

-- Drop old indexes
DROP INDEX IF EXISTS idx_accounts_user_id;
DROP INDEX IF EXISTS idx_categories_user_id;
DROP INDEX IF EXISTS idx_sub_categories_user_id;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transaction_templates_user_id;

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_accounts_ledger_id ON accounts(ledger_id);
CREATE INDEX IF NOT EXISTS idx_categories_ledger_id ON categories(ledger_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_ledger_id ON sub_categories(ledger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_id ON transactions(ledger_id);
CREATE INDEX IF NOT EXISTS idx_transaction_templates_ledger_id ON transaction_templates(ledger_id);
