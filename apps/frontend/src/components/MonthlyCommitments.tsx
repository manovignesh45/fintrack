import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { commitmentsApi } from '../api/client';
import type { CommitmentStatus, CommitmentsMonthResponse } from '../api/types';
import { invalidateCache, useCachedList } from '../hooks/useCachedList';

const EMPTY: CommitmentsMonthResponse = {
  month: '',
  total: 0,
  paid_total: 0,
  due_total: 0,
  items: [],
};

export const currentMonthKey = () => monthKey(new Date());

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export const fmtAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Loads one month of commitments and exposes the actions that mutate them.
 * Paying writes a real transaction, so the transactions and summary caches are
 * dropped alongside the commitment ones.
 */
export function useCommitmentsMonth(month: string) {
  const { data, loading, reload } = useCachedList<CommitmentsMonthResponse>(
    `commitments:${month}`,
    () => commitmentsApi.list(month),
    EMPTY
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const invalidateDependents = useCallback(() => {
    invalidateCache('commitments:');
    invalidateCache('transactions:');
    invalidateCache('summary:');
  }, []);

  const run = useCallback(
    async (id: number, action: () => Promise<unknown>, failure: string) => {
      setBusyId(id);
      try {
        await action();
        invalidateDependents();
        await reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : failure);
      } finally {
        setBusyId(null);
      }
    },
    [invalidateDependents, reload]
  );

  const pay = useCallback(
    (item: CommitmentStatus) =>
      run(item.id, () => commitmentsApi.pay(item.id, { month }), 'Failed to mark as paid'),
    [month, run]
  );

  const unpay = useCallback(
    (item: CommitmentStatus) => {
      if (!confirm(`Undo the payment for "${item.name}"? The transaction it created will be deleted.`)) return;
      return run(item.id, () => commitmentsApi.unpay(item.id, month), 'Failed to undo payment');
    },
    [month, run]
  );

  const remove = useCallback(
    (item: CommitmentStatus) => {
      if (!confirm(`Delete "${item.name}"? Its payment history is removed, but transactions already created stay.`)) return;
      return run(item.id, () => commitmentsApi.delete(item.id), 'Failed to delete commitment');
    },
    [run]
  );

  const groups = useMemo(
    () => ({
      active: data.items.filter((i) => i.status !== 'INACTIVE'),
      paused: data.items.filter((i) => i.status === 'INACTIVE'),
    }),
    [data.items]
  );

  return { data, loading, reload, busyId, pay, unpay, remove, ...groups };
}

export function isOverdue(item: CommitmentStatus, month: string) {
  return (
    item.status === 'DUE' &&
    month === currentMonthKey() &&
    item.due_date < new Date().toISOString().slice(0, 10)
  );
}

interface RowProps {
  item: CommitmentStatus;
  month: string;
  busy: boolean;
  onPay: (item: CommitmentStatus) => void;
  onUnpay: (item: CommitmentStatus) => void;
  /** Edit/Delete controls; omitted on the Templates tab, which is record-only. */
  onEdit?: (item: CommitmentStatus) => void;
  onDelete?: (item: CommitmentStatus) => void;
}

export function CommitmentRow({ item, month, busy, onPay, onUnpay, onEdit, onDelete }: RowProps) {
  const paid = item.status === 'PAID';
  const overdue = isOverdue(item, month);
  const amount = paid && item.payment ? item.payment.amount : item.amount;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border p-3 flex items-center gap-3 ${
        overdue ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">{item.name}</span>
          {item.nature === 'EMI_PAYMENT' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              EMI
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          Due {item.due_date.slice(8)}
          {overdue && ' · overdue'}
          {paid && item.payment && ` · paid ${item.payment.paid_on.slice(8)}`}
        </p>
      </div>

      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
        {fmtAmount(amount)}
      </span>

      {item.status === 'INACTIVE' ? (
        <span className="text-[11px] text-gray-400 whitespace-nowrap">Paused</span>
      ) : paid ? (
        <button
          onClick={() => onUnpay(item)}
          disabled={busy}
          className="text-[11px] font-semibold px-2 py-1.5 rounded-md bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? '...' : '✓ Paid'}
        </button>
      ) : (
        <button
          onClick={() => onPay(item)}
          disabled={busy}
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? '...' : 'Mark Paid'}
        </button>
      )}

      {onEdit && onDelete && (
        <div className="flex flex-col gap-1">
          <button onClick={() => onEdit(item)} className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            Edit
          </button>
          <button onClick={() => onDelete(item)} className="text-[11px] text-red-500 font-medium">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact current-month view for the Templates tab: record-only, no month
 * stepper and no create/edit affordances — those live on the manage page.
 */
export function CommitmentsSection() {
  const month = currentMonthKey();
  const { data, loading, busyId, pay, unpay, active } = useCommitmentsMonth(month);

  if (loading || active.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {monthLabel(month)} · commitments
        </h3>
        <Link to="/commitments" className="text-xs text-blue-600 dark:text-blue-400 font-medium">
          Manage ›
        </Link>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="text-green-600 dark:text-green-400 font-semibold">{fmtAmount(data.paid_total)}</span> paid ·{' '}
        <span className="text-red-600 dark:text-red-400 font-semibold">{fmtAmount(data.due_total)}</span> remaining
        {' '}of {fmtAmount(data.total)}
      </p>

      {active.map((item) => (
        <CommitmentRow
          key={item.id}
          item={item}
          month={month}
          busy={busyId === item.id}
          onPay={pay}
          onUnpay={unpay}
        />
      ))}
    </div>
  );
}
