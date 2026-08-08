CREATE TABLE commitments (
    id                SERIAL PRIMARY KEY,
    ledger_id         INTEGER NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    nature            tx_nature NOT NULL DEFAULT 'EXPENSE',
    due_day           SMALLINT NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
    source_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    target_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    sub_category_id   INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
    principal_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    interest_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes             TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    start_month       DATE,
    end_month         DATE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ledger_id, name)
);

-- A commitment is "paid" for a month when a row exists here. transaction_id
-- cascades on purpose: deleting the generated transaction from the Transactions
-- page must flip the commitment back to Due rather than leave a dangling "paid".
CREATE TABLE commitment_payments (
    id             SERIAL PRIMARY KEY,
    ledger_id      INTEGER NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    commitment_id  INTEGER NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
    period         DATE NOT NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    amount         NUMERIC(12,2) NOT NULL,
    paid_on        DATE NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(commitment_id, period)
);

CREATE INDEX idx_commitments_ledger_id ON commitments(ledger_id);
CREATE INDEX idx_commitment_payments_period ON commitment_payments(ledger_id, period);
