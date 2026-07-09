-- 009_add_ledgers.down.sql

-- Re-add user_id columns
ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE sub_categories ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE transaction_templates ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Restore user_id from ledgers
UPDATE accounts SET user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = accounts.ledger_id);
UPDATE categories SET user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = categories.ledger_id);
UPDATE sub_categories SET user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = sub_categories.ledger_id);
UPDATE transactions SET user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = transactions.ledger_id);
UPDATE transaction_templates SET user_id = (SELECT l.user_id FROM ledgers l WHERE l.id = transaction_templates.ledger_id);

-- Force NOT NULL
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sub_categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transaction_templates ALTER COLUMN user_id SET NOT NULL;

-- Restore constraints
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_ledger_id_name_nature_key;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_nature_key UNIQUE (user_id, name, nature);

-- Drop ledger_id columns
ALTER TABLE accounts DROP COLUMN ledger_id;
ALTER TABLE categories DROP COLUMN ledger_id;
ALTER TABLE sub_categories DROP COLUMN ledger_id;
ALTER TABLE transactions DROP COLUMN ledger_id;
ALTER TABLE transaction_templates DROP COLUMN ledger_id;

-- Drop new indexes
DROP INDEX IF EXISTS idx_accounts_ledger_id;
DROP INDEX IF EXISTS idx_categories_ledger_id;
DROP INDEX IF EXISTS idx_sub_categories_ledger_id;
DROP INDEX IF EXISTS idx_transactions_ledger_id;
DROP INDEX IF EXISTS idx_transaction_templates_ledger_id;

-- Restore old indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_user_id ON sub_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_templates_user_id ON transaction_templates(user_id);

-- Drop ledgers table
DROP TABLE IF EXISTS ledgers;
