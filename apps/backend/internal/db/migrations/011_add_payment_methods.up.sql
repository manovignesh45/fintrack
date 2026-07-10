CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    ledger_id INTEGER NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ledger_id, name)
);

ALTER TABLE transactions ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE transaction_templates ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL;

-- Migrate existing string payment_methods to the new table
INSERT INTO payment_methods (ledger_id, name)
SELECT DISTINCT ledger_id, payment_method
FROM transactions
WHERE payment_method IS NOT NULL AND payment_method != ''
ON CONFLICT (ledger_id, name) DO NOTHING;

INSERT INTO payment_methods (ledger_id, name)
SELECT DISTINCT ledger_id, payment_method
FROM transaction_templates
WHERE payment_method IS NOT NULL AND payment_method != ''
ON CONFLICT (ledger_id, name) DO NOTHING;

-- Map transactions to the new payment methods
UPDATE transactions t
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE t.ledger_id = pm.ledger_id AND t.payment_method = pm.name;

-- Map templates to the new payment methods
UPDATE transaction_templates tt
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE tt.ledger_id = pm.ledger_id AND tt.payment_method = pm.name;

-- Drop old string columns
ALTER TABLE transactions DROP COLUMN payment_method;
ALTER TABLE transaction_templates DROP COLUMN payment_method;
