-- Quick notes: rough "name + amount" jottings captured on the spot and turned
-- into real transactions later. They never touch account balances or reports
-- until converted.
CREATE TABLE IF NOT EXISTS quick_notes (
    id         SERIAL PRIMARY KEY,
    ledger_id  INTEGER NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    note_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Set by clients that queue notes offline so a retried upload is not saved twice.
    client_id  VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ledger_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_quick_notes_ledger_id ON quick_notes(ledger_id);
