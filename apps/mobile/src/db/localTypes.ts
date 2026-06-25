import type { TxNature, EntityType } from '@fintrack/shared';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface LocalTransaction {
  id: number | null;
  local_id: string;
  user_id: number | null;
  title: string;
  amount: number;
  nature: TxNature;
  source_account_id: number;
  target_account_id?: number;
  sub_category_id?: number;
  entity: EntityType;
  payment_method?: string;
  notes?: string;
  principal_amount: number;
  interest_amount: number;
  transaction_date: string;
  created_at: string;
  sync_status: SyncStatus;
  sync_error?: string;
  deleted_locally: boolean;
}

export interface CreateTransactionPayload {
  title: string;
  amount: number;
  nature: TxNature;
  source_account_id: number;
  target_account_id?: number;
  sub_category_id?: number;
  entity: EntityType;
  payment_method?: string;
  notes?: string;
  principal_amount: number;
  interest_amount: number;
  transaction_date: string;
}
