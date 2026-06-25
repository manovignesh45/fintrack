import type { SQLiteDatabase } from 'expo-sqlite';
import { transactionsApi } from '@/src/api/client';
import { transactionRepo, syncQueue } from '@/src/db/transactionRepo';
import type { CreateTransactionPayload } from '@/src/db/localTypes';

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

export async function syncPendingTransactions(db: SQLiteDatabase): Promise<SyncResult> {
  const items = await syncQueue.getPending(db, 50);
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const payload = JSON.parse(item.payload) as CreateTransactionPayload;

    try {
      const created = await transactionsApi.create({
        title: payload.title,
        amount: payload.amount,
        nature: payload.nature,
        source_account_id: payload.source_account_id,
        target_account_id: payload.target_account_id,
        sub_category_id: payload.sub_category_id,
        entity: payload.entity,
        payment_method: payload.payment_method,
        notes: payload.notes,
        principal_amount: payload.principal_amount,
        interest_amount: payload.interest_amount,
        transaction_date: payload.transaction_date,
      });

      await transactionRepo.markSynced(db, item.local_id, created.id);
      await syncQueue.remove(db, item.id);
      synced++;
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && err.message.toLowerCase().includes('network'));

      if (isNetworkError) {
        // Stop processing — network unavailable, retry on next trigger
        await syncQueue.incrementAttempts(db, item.id);
        break;
      }

      // 4xx or other non-retryable error
      const message = err instanceof Error ? err.message : 'Unknown error';
      await transactionRepo.markFailed(db, item.local_id, message);
      await syncQueue.remove(db, item.id);
      failed++;
    }
  }

  const remaining = await syncQueue.countPending(db);
  return { synced, failed, remaining };
}
