import type { SQLiteDatabase } from 'expo-sqlite';
import type { Account, Category } from '@fintrack/shared';

export async function clearAllUserData(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM transactions');
  await db.runAsync('DELETE FROM sync_queue');
  await db.runAsync('DELETE FROM accounts');
  await db.runAsync('DELETE FROM categories');
  await db.runAsync('DELETE FROM sub_categories');
}

export const accountRepo = {
  async upsertAll(db: SQLiteDatabase, accounts: Account[]): Promise<void> {
    if (accounts.length === 0) return;
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM accounts');
      for (const a of accounts) {
        await db.runAsync(
          `INSERT INTO accounts
            (id, user_id, name, type, initial_balance, current_balance, interest_rate, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            a.id,
            a.user_id,
            a.name,
            a.type,
            a.initial_balance,
            a.current_balance,
            a.interest_rate,
            a.is_active ? 1 : 0,
            a.created_at,
          ],
        );
      }
    });
  },

  async getAll(db: SQLiteDatabase): Promise<Account[]> {
    const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM accounts ORDER BY name ASC');
    return rows.map((r) => ({
      id: r.id as number,
      user_id: r.user_id as number,
      name: r.name as string,
      type: r.type as Account['type'],
      initial_balance: r.initial_balance as number,
      current_balance: r.current_balance as number,
      interest_rate: r.interest_rate as number,
      is_active: (r.is_active as number) === 1,
      created_at: r.created_at as string,
    }));
  },

  async getById(db: SQLiteDatabase, id: number): Promise<Account | null> {
    const r = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM accounts WHERE id = ?',
      [id],
    );
    if (!r) return null;
    return {
      id: r.id as number,
      user_id: r.user_id as number,
      name: r.name as string,
      type: r.type as Account['type'],
      initial_balance: r.initial_balance as number,
      current_balance: r.current_balance as number,
      interest_rate: r.interest_rate as number,
      is_active: (r.is_active as number) === 1,
      created_at: r.created_at as string,
    };
  },

  async getSyncedAt(db: SQLiteDatabase): Promise<Date | null> {
    const r = await db.getFirstAsync<{ synced_at: string }>(
      'SELECT synced_at FROM accounts ORDER BY synced_at ASC LIMIT 1',
    );
    return r ? new Date(r.synced_at) : null;
  },
};

export const categoryRepo = {
  async upsertAll(db: SQLiteDatabase, categories: Category[]): Promise<void> {
    if (categories.length === 0) return;
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM sub_categories');
      await db.runAsync('DELETE FROM categories');
      for (const cat of categories) {
        await db.runAsync(
          `INSERT INTO categories (id, user_id, name, entity, nature, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cat.id, cat.user_id, cat.name, cat.entity, cat.nature, cat.created_at],
        );
        for (const sub of cat.sub_categories ?? []) {
          await db.runAsync(
            `INSERT INTO sub_categories (id, category_id, user_id, name, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [sub.id, cat.id, sub.user_id, sub.name, sub.created_at],
          );
        }
      }
    });
  },

  async getAll(db: SQLiteDatabase): Promise<Category[]> {
    const cats = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM categories ORDER BY entity, nature, name',
    );
    const subs = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM sub_categories ORDER BY name',
    );

    return cats.map((c) => ({
      id: c.id as number,
      user_id: c.user_id as number,
      name: c.name as string,
      entity: c.entity as Category['entity'],
      nature: c.nature as Category['nature'],
      created_at: c.created_at as string,
      sub_categories: subs
        .filter((s) => (s.category_id as number) === (c.id as number))
        .map((s) => ({
          id: s.id as number,
          category_id: s.category_id as number,
          user_id: s.user_id as number,
          name: s.name as string,
          created_at: s.created_at as string,
        })),
    }));
  },

  async getSyncedAt(db: SQLiteDatabase): Promise<Date | null> {
    const r = await db.getFirstAsync<{ synced_at: string }>(
      'SELECT synced_at FROM categories ORDER BY synced_at ASC LIMIT 1',
    );
    return r ? new Date(r.synced_at) : null;
  },
};
