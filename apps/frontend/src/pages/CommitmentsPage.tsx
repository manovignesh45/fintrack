import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CommitmentRow,
  currentMonthKey,
  fmtAmount,
  monthLabel,
  shiftMonth,
  useCommitmentsMonth,
} from '../components/MonthlyCommitments';
import type { CommitmentStatus, PayCommitmentInput } from '../api/types';
import MonthPickerModal from '../components/MonthPickerModal';
import CommitmentPaySheet from '../components/CommitmentPaySheet';
import ConfirmModal from './../components/ConfirmModal';

interface ToastState {
  message: string;
  item: CommitmentStatus;
}

export default function CommitmentsPage() {
  const navigate = useNavigate();
  const { editMode } = useAuth();
  const [month, setMonth] = useState(currentMonthKey);

  // Month Picker Modal state
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Pay sheet state
  const [payingItem, setPayingItem] = useState<CommitmentStatus | null>(null);

  // Confirm dialogs state
  const [unpayingItem, setUnpayingItem] = useState<CommitmentStatus | null>(null);
  const [deletingItem, setDeletingItem] = useState<CommitmentStatus | null>(null);

  // Collapsible groups
  const [collapsePaid, setCollapsePaid] = useState(false);
  const [collapseInactive, setCollapseInactive] = useState(false);

  // Toast with undo
  const [toast, setToast] = useState<ToastState | null>(null);

  const {
    data,
    loading,
    busyId,
    pay,
    unpay,
    remove,
    overdue,
    dueSoon,
    upcoming,
    paid,
    inactive,
    stats,
  } = useCommitmentsMonth(month);

  const today = currentMonthKey();
  const isCurrentMonth = month === today;

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleConfirmPay = async (input: PayCommitmentInput) => {
    if (!payingItem) return;
    const item = payingItem;
    await pay(item, input);
    if ('vibrate' in navigator) navigator.vibrate(50);
    setToast({
      message: `"${item.name}" marked paid (${fmtAmount(input.amount ?? item.amount)})`,
      item,
    });
  };

  const handleUndoFromToast = async () => {
    if (!toast) return;
    const itemToUndo = toast.item;
    setToast(null);
    try {
      await unpay(itemToUndo);
    } catch {
      // unpay will rethrow if failed
    }
  };

  const handleConfirmUnpay = async () => {
    if (!unpayingItem) return;
    try {
      await unpay(unpayingItem);
      setUnpayingItem(null);
    } catch {
      // error handled in hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await remove(deletingItem);
      setDeletingItem(null);
    } catch {
      // error handled in hook
    }
  };

  const rowProps = {
    month,
    onPay: (item: CommitmentStatus) => setPayingItem(item),
    onUnpay: (item: CommitmentStatus) => setUnpayingItem(item),
    ...(editMode
      ? {
          onEdit: (item: CommitmentStatus) => navigate(`/commitments/${item.id}/edit`),
          onDelete: (item: CommitmentStatus) => setDeletingItem(item),
        }
      : {}),
  };

  return (
    <div className="space-y-4">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Link to="/more" className="text-lg font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          More
        </Link>
        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</span>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Monthly Commitments</h2>
      </div>

      {/* Tappable Month Stepper & Grid Opener */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-xs">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="px-3 py-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-lg transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowMonthPicker(true)}
            className="flex items-center justify-center gap-1.5 font-bold text-gray-800 dark:text-gray-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-all cursor-pointer"
            title="Open month picker"
          >
            <span>{monthLabel(month)}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => setMonth(today)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium block mx-auto -mt-0.5"
            >
              Jump to current
            </button>
          )}
        </div>

        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="px-3 py-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-lg transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Progress & Totals Card */}
      {!loading && stats.totalActiveCount > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3.5 shadow-xs">
          {/* Progress Header */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {fmtAmount(data.paid_total)} / {fmtAmount(data.total)} paid
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.amountPercent}%
                </span>
                <span className="text-gray-400 text-[11px]">
                  ({stats.paidCount}/{stats.totalActiveCount} items)
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, stats.amountPercent))}%` }}
              />
            </div>
          </div>

          {/* Amount Breakdown Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/80">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{fmtAmount(data.total)}</p>
            </div>
            <div className="text-center border-x border-gray-100 dark:border-gray-700/80">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Paid</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtAmount(data.paid_total)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Remaining</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtAmount(data.due_total)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content / Smart Groups */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm">Loading commitments...</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No commitments yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-sm mx-auto">
            Add recurring monthly bills, EMIs, and subscriptions to track due dates and payments effortlessly.
          </p>
          {editMode && (
            <button
              onClick={() => navigate('/commitments/new')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              + Create Commitment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. OVERDUE GROUP */}
          {overdue.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Overdue ({overdue.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {overdue.map((item) => (
                  <CommitmentRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    {...rowProps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. DUE SOON GROUP */}
          {dueSoon.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Due Soon ({dueSoon.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {dueSoon.map((item) => (
                  <CommitmentRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    {...rowProps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3. UPCOMING GROUP */}
          {upcoming.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Upcoming ({upcoming.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {upcoming.map((item) => (
                  <CommitmentRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    {...rowProps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 4. PAID GROUP */}
          {paid.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Paid ({paid.length})
                  </h3>
                </div>
                {paid.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setCollapsePaid(!collapsePaid)}
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium"
                  >
                    {collapsePaid ? `Show All (${paid.length})` : 'Collapse'}
                  </button>
                )}
              </div>
              {!collapsePaid && (
                <div className="space-y-2.5">
                  {paid.map((item) => (
                    <CommitmentRow
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      {...rowProps}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. INACTIVE / PAUSED GROUP */}
          {inactive.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Not active this month ({inactive.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCollapseInactive(!collapseInactive)}
                  className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium"
                >
                  {collapseInactive ? `Show All (${inactive.length})` : 'Collapse'}
                </button>
              </div>
              {!collapseInactive && (
                <div className="space-y-2.5">
                  {inactive.map((item) => (
                    <CommitmentRow
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      {...rowProps}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button for Create (Edit Mode) */}
      {editMode && (
        <button
          onClick={() => navigate('/commitments/new')}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-all active:scale-95 z-40"
          aria-label="Add commitment"
        >
          +
        </button>
      )}

      {/* Month Picker Modal */}
      <MonthPickerModal
        isOpen={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        selectedMonth={month}
        onSelect={(m) => setMonth(m)}
      />

      {/* Pay Confirmation Sheet */}
      <CommitmentPaySheet
        isOpen={Boolean(payingItem)}
        onClose={() => setPayingItem(null)}
        item={payingItem}
        month={month}
        onConfirm={handleConfirmPay}
      />

      {/* Styled Undo Payment Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(unpayingItem)}
        title="Undo Payment"
        message={`Undo the payment for "${unpayingItem?.name}"? The transaction it created will be deleted and balances updated.`}
        confirmLabel="Undo Payment"
        confirmVariant="warning"
        onCancel={() => setUnpayingItem(null)}
        onConfirm={handleConfirmUnpay}
        busy={busyId === unpayingItem?.id}
      />

      {/* Styled Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Delete Commitment"
        message={`Delete "${deletingItem?.name}"? Its payment history will be removed, but transactions already recorded will stay.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        busy={busyId === deletingItem?.id}
      />

      {/* Toast Notification with Undo Action */}
      {toast &&
        createPortal(
          <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-xl p-3 flex items-center justify-between gap-3 border border-gray-700 dark:border-gray-300 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-emerald-400 dark:text-emerald-600 font-bold">✓</span>
              <p className="text-xs font-medium truncate">{toast.message}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleUndoFromToast}
                className="text-xs font-bold text-amber-400 dark:text-amber-600 hover:underline px-1.5 py-0.5 rounded cursor-pointer"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-gray-400 hover:text-gray-200 dark:text-gray-600 dark:hover:text-gray-900 p-0.5 rounded cursor-pointer"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
