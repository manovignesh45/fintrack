/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from 'react';
import { commitmentsApi } from '../api/client';
import type { CommitmentStatus, CommitmentsMonthResponse, PayCommitmentInput } from '../api/types';
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

export type CommitmentUrgency = 'overdue' | 'due_soon' | 'upcoming' | 'paid' | 'inactive';

export interface DueInfo {
  urgency: CommitmentUrgency;
  label: string;
  badge?: {
    text: string;
    className: string;
  };
}

export function getDueInfo(item: CommitmentStatus, month: string): DueInfo {
  if (item.status === 'INACTIVE') {
    return {
      urgency: 'inactive',
      label: 'Paused',
    };
  }

  if (item.status === 'PAID') {
    let dateStr = '';
    if (item.payment?.paid_on) {
      const parts = item.payment.paid_on.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      }
    }
    return {
      urgency: 'paid',
      label: dateStr ? `Paid ${dateStr}` : 'Paid',
    };
  }

  // Status is DUE
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currMonth = currentMonthKey();
  const [y, m, d] = item.due_date.split('-').map(Number);
  const dueDate = new Date(y, m - 1, d);
  dueDate.setHours(0, 0, 0, 0);

  const diffMs = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (month < currMonth || (month === currMonth && diffDays < 0)) {
    let label = '';
    if (diffDays === -1) {
      label = `Due yesterday · overdue`;
    } else if (diffDays < -1) {
      label = `${Math.abs(diffDays)} days overdue`;
    } else {
      label = `Due ${d} · overdue`;
    }
    return {
      urgency: 'overdue',
      label,
      badge: {
        text: 'Overdue',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      },
    };
  }

  if (month === currMonth && diffDays <= 7) {
    let label = '';
    let badgeText = '';
    if (diffDays === 0) {
      label = 'Due today';
      badgeText = 'Today';
    } else if (diffDays === 1) {
      label = 'Due tomorrow';
      badgeText = 'Tomorrow';
    } else {
      label = `In ${diffDays} days (Due ${d})`;
    }
    return {
      urgency: 'due_soon',
      label,
      badge: badgeText
        ? {
            text: badgeText,
            className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
          }
        : undefined,
    };
  }

  // Upcoming
  return {
    urgency: 'upcoming',
    label: `Due ${dueDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
  };
}

export function isOverdue(item: CommitmentStatus, month: string) {
  return getDueInfo(item, month).urgency === 'overdue';
}

/**
 * Loads one month of commitments and exposes the actions that mutate them.
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
        throw err instanceof Error ? err : new Error(failure);
      } finally {
        setBusyId(null);
      }
    },
    [invalidateDependents, reload]
  );

  const pay = useCallback(
    (item: CommitmentStatus, input?: PayCommitmentInput) =>
      run(
        item.id,
        () =>
          commitmentsApi.pay(item.id, {
            month,
            amount: input?.amount,
            transaction_date: input?.transaction_date,
            notes: input?.notes,
          }),
        'Failed to mark as paid'
      ),
    [month, run]
  );

  const unpay = useCallback(
    (item: CommitmentStatus) =>
      run(item.id, () => commitmentsApi.unpay(item.id, month), 'Failed to undo payment'),
    [month, run]
  );

  const remove = useCallback(
    (item: CommitmentStatus) =>
      run(item.id, () => commitmentsApi.delete(item.id), 'Failed to delete commitment'),
    [run]
  );

  const groups = useMemo(() => {
    const overdue: CommitmentStatus[] = [];
    const dueSoon: CommitmentStatus[] = [];
    const upcoming: CommitmentStatus[] = [];
    const paid: CommitmentStatus[] = [];
    const inactive: CommitmentStatus[] = [];

    for (const item of data.items) {
      const info = getDueInfo(item, month);
      switch (info.urgency) {
        case 'overdue':
          overdue.push(item);
          break;
        case 'due_soon':
          dueSoon.push(item);
          break;
        case 'upcoming':
          upcoming.push(item);
          break;
        case 'paid':
          paid.push(item);
          break;
        case 'inactive':
          inactive.push(item);
          break;
      }
    }

    // Sort overdue by due_date ascending
    overdue.sort((a, b) => a.due_date.localeCompare(b.due_date));
    // Sort dueSoon by due_date ascending
    dueSoon.sort((a, b) => a.due_date.localeCompare(b.due_date));
    // Sort upcoming by due_date ascending
    upcoming.sort((a, b) => a.due_date.localeCompare(b.due_date));
    // Sort paid by paid_on desc, then due_date
    paid.sort((a, b) => (b.payment?.paid_on || '').localeCompare(a.payment?.paid_on || ''));

    const active = data.items.filter((i) => i.status !== 'INACTIVE');
    const paused = data.items.filter((i) => i.status === 'INACTIVE');

    const totalActiveCount = overdue.length + dueSoon.length + upcoming.length + paid.length;
    const paidCount = paid.length;
    const countPercent = totalActiveCount > 0 ? Math.round((paidCount / totalActiveCount) * 100) : 0;
    const amountPercent = data.total > 0 ? Math.round((data.paid_total / data.total) * 100) : 0;

    return {
      overdue,
      dueSoon,
      upcoming,
      paid,
      inactive,
      active,
      paused,
      stats: {
        totalActiveCount,
        paidCount,
        dueCount: overdue.length + dueSoon.length + upcoming.length,
        countPercent,
        amountPercent,
      },
    };
  }, [data.items, data.paid_total, data.total, month]);

  return { data, loading, reload, busyId, pay, unpay, remove, ...groups };
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

export function CommitmentRow({
  item,
  month,
  busy,
  onPay,
  onUnpay,
  onEdit,
  onDelete,
}: RowProps) {
  const isPaid = item.status === 'PAID';
  const isInactive = item.status === 'INACTIVE';
  const isDue = item.status === 'DUE';

  const dueInfo = getDueInfo(item, month);
  const amount = isPaid && item.payment ? item.payment.amount : item.amount;

  // Touch gesture state for swipe-to-pay
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDue || busy) return;
    if ((e.target as HTMLElement)?.closest('button, a, input, select, [data-no-swipe]')) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null || !isDue || busy) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

    if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (deltaX > 20) {
      setIsSwiping(true);
      const clamped = Math.min(100, Math.max(0, deltaX));
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) {
      setTouchStartX(null);
      setTouchStartY(null);
      setSwipeOffset(0);
      return;
    }

    if (swipeOffset >= 75) {
      if ('vibrate' in navigator) navigator.vibrate(40);
      onPay(item);
    }
    setSwipeOffset(0);
    setIsSwiping(false);
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // Card border and background styles based on urgency
  const cardStyles =
    dueInfo.urgency === 'overdue'
      ? 'border-red-300 dark:border-red-900/60 bg-red-50/25 dark:bg-red-950/15'
      : dueInfo.urgency === 'due_soon'
      ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-950/10'
      : isPaid
      ? 'border-gray-200 dark:border-gray-700/60 bg-white/70 dark:bg-gray-800/60 opacity-90'
      : isInactive
      ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 opacity-75'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';

  return (
    <div data-no-swipe="true" className="relative overflow-hidden rounded-xl">
      {/* Background reveal action for Swipe-to-Pay (Mobile) */}
      {isDue && (
        <div
          className={`absolute inset-0 pointer-events-none bg-emerald-600 dark:bg-emerald-500 rounded-xl flex items-center pl-4 text-white text-xs font-semibold gap-1.5 transition-opacity ${
            swipeOffset > 0 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{swipeOffset >= 75 ? 'Release to Pay' : 'Swipe to Pay'}</span>
        </div>
      )}

      {/* Foreground Row Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
        className={`relative z-10 rounded-xl border p-3 flex items-center gap-2 sm:gap-3 transition-colors ${cardStyles}`}
      >
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
              {item.name}
            </span>
            {item.nature === 'EMI_PAYMENT' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
                EMI
              </span>
            )}
            {dueInfo.badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${dueInfo.badge.className}`}>
                {dueInfo.badge.text}
              </span>
            )}
          </div>
          <p
            className={`text-xs mt-0.5 truncate ${
              dueInfo.urgency === 'overdue'
                ? 'text-red-600 dark:text-red-400 font-medium'
                : dueInfo.urgency === 'due_soon'
                ? 'text-amber-700 dark:text-amber-400 font-medium'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {dueInfo.label}
          </p>
        </div>

        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap shrink-0">
          {fmtAmount(amount)}
        </span>

        {/* Action Button */}
        {isInactive ? (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md whitespace-nowrap shrink-0">
            Paused
          </span>
        ) : isPaid ? (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onUnpay(item);
            }}
            disabled={busy}
            title="Click to undo payment"
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all disabled:opacity-50 whitespace-nowrap shrink-0 flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{busy ? '...' : 'Paid'}</span>
          </button>
        ) : (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPay(item);
            }}
            disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm shadow-blue-500/20 disabled:opacity-50 whitespace-nowrap shrink-0 transition-all flex items-center gap-1 cursor-pointer"
          >
            {busy ? (
              <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Pay</span>
                <span className="text-[10px]">›</span>
              </>
            )}
          </button>
        )}

        {/* Edit & Delete Controls (Only in Edit Mode) */}
        {onEdit && onDelete && (
          <div
            data-no-swipe="true"
            onTouchStart={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 border-l border-gray-100 dark:border-gray-700 pl-1.5 shrink-0"
          >
            <button
              type="button"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 cursor-pointer"
              title="Edit Commitment"
              aria-label="Edit"
            >
              <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              type="button"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 cursor-pointer"
              title="Delete Commitment"
              aria-label="Delete"
            >
              <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
