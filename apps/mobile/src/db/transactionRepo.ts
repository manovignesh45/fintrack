import type { SQLiteDatabase } from 'expo-sqlite';
import type { FilterState } from '@fintrack/shared';
import type { LocalTransaction, CreateTransactionPayload } from './localTypes';

function rowToLocal(row: Record<string, unknown>): LocalTransaction {
  return {
    id: row.id as number | null,
    local_id: row.local_id as string,
    ledger_id: row.ledger_id as number | null,
    title: row.title as string,
    amount: row.amount as number,
    nature: row.nature as LocalTransaction['nature'],
    source_account_id: row.source_account_id as number,
    target_account_id: row.target_account_id as number | undefined,
    sub_category_id: row.sub_category_id as number | undefined,
    payment_method: row.payment_method as string | undefined,
    notes: row.notes as string | undefined,
    principal_amount: (row.principal_amount as number) ?? 0,
    interest_amount: (row.interest_amount as number) ?? 0,
    transaction_date: row.transaction_date as string,
    created_at: row.created_at as string,
    sync_status: row.sync_status as LocalTransaction['sync_status'],
    sync_error: row.sync_error as string | undefined,
    deleted_locally: (row.deleted_locally as number) === 1,
  };
}

export const transactionRepo = {
  async insertPending(
    db: SQLiteDatabase,
    localId: string,
    payload: CreateTransactionPayload,
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO transactions
        (local_id, title, amount, nature, source_account_id, target_account_id,
         sub_category_id, payment_method, notes, principal_amount,
         interest_amount, transaction_date, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        localId,
        payload.title,
        payload.amount,
        payload.nature,
        payload.source_account_id,
        payload.target_account_id ?? null,
        payload.sub_category_id ?? null,
        payload.payment_method ?? null,
        payload.notes ?? null,
        payload.principal_amount,
        payload.interest_amount,
        payload.transaction_date,
      ],
    );
  },

  async clearAll(db: SQLiteDatabase): Promise<void> {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM sync_queue');
  },

  async getAll(
    db: SQLiteDatabase,
    filters: Partial<FilterState> = {},
    ledgerId?: number,
  ): Promise<LocalTransaction[]> {
    const conditions: string[] = ['deleted_locally = 0'];
    const params: (string | number)[] = [];

    if (ledgerId) {
      conditions.push('(ledger_id = ? OR ledger_id IS NULL)');
      params.push(ledgerId);
    }


    if (filters.nature) {
      conditions.push('nature = ?');
      params.push(filters.nature);
    }
    if (filters.date_from) {
      conditions.push('transaction_date >= ?');
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push('transaction_date <= ?');
      params.push(filters.date_to);
    }
    if (filters.search) {
      conditions.push('title LIKE ?');
      params.push(`%${filters.search}%`);
    }
    if (filters.sub_category_id) {
      conditions.push('sub_category_id = ?');
      params.push(filters.sub_category_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM transactions ${where} ORDER BY transaction_date DESC, datetime(created_at) DESC LIMIT 200`,
      params,
    );
    return rows.map(rowToLocal);
  },

  async getByLocalId(db: SQLiteDatabase, localId: string): Promise<LocalTransaction | null> {
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM transactions WHERE local_id = ?',
      [localId],
    );
    return row ? rowToLocal(row) : null;
  },

  async markSynced(db: SQLiteDatabase, localId: string, serverId: number): Promise<void> {
    await db.runAsync(
      `UPDATE transactions SET id = ?, local_id = ?, sync_status = 'synced', sync_error = NULL WHERE local_id = ?`,
      [serverId, `server_${serverId}`, localId],
    );
  },

  async markFailed(db: SQLiteDatabase, localId: string, error: string): Promise<void> {
    await db.runAsync(
      `UPDATE transactions SET sync_status = 'failed', sync_error = ? WHERE local_id = ?`,
      [error, localId],
    );
  },

  async softDelete(db: SQLiteDatabase, localId: string): Promise<void> {
    await db.runAsync(
      `UPDATE transactions SET deleted_locally = 1 WHERE local_id = ?`,
      [localId],
    );
  },

  async deleteByServerId(db: SQLiteDatabase, serverId: number): Promise<void> {
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [serverId]);
  },

  async countPending(db: SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE sync_status = 'pending' AND deleted_locally = 0`,
    );
    return row?.count ?? 0;
  },
};

export const syncQueue = {
  async enqueue(
    db: SQLiteDatabase,
    localId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload: CreateTransactionPayload,
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO sync_queue (local_id, operation, payload) VALUES (?, ?, ?)`,
      [localId, operation, JSON.stringify(payload)],
    );
  },

  async getPending(
    db: SQLiteDatabase,
    limit = 50,
  ): Promise<Array<{ id: number; local_id: string; operation: string; payload: string; attempts: number }>> {
    return db.getAllAsync<{ id: number; local_id: string; operation: string; payload: string; attempts: number }>(
      `SELECT id, local_id, operation, payload, attempts FROM sync_queue
       WHERE attempts < 5 ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
  },

  async incrementAttempts(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync(
      `UPDATE sync_queue SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?`,
      [id],
    );
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  },

  async countPending(db: SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue WHERE attempts < 5',
    );
    return row?.count ?? 0;
  },
};
