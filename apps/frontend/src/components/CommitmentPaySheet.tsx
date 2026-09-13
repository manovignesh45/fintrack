import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommitmentStatus, PayCommitmentInput } from '../api/types';
import { fmtAmount } from './MonthlyCommitments';

interface CommitmentPaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: CommitmentStatus | null;
  month: string;
  onConfirm: (data: PayCommitmentInput) => Promise<void>;
}

export default function CommitmentPaySheet({
  isOpen,
  onClose,
  item,
  month,
  onConfirm,
}: CommitmentPaySheetProps) {
  if (!isOpen || !item) return null;

  return (
    <CommitmentPaySheetContent
      onClose={onClose}
      item={item}
      month={month}
      onConfirm={onConfirm}
    />
  );
}

function CommitmentPaySheetContent({
  onClose,
  item,
  month,
  onConfirm,
}: {
  onClose: () => void;
  item: CommitmentStatus;
  month: string;
  onConfirm: (data: PayCommitmentInput) => Promise<void>;
}) {
  const now = new Date();
  const todayLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const [amount, setAmount] = useState(item.amount.toString());
  const [txDate, setTxDate] = useState(todayLocalDate);
  const [notes, setNotes] = useState(item.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEmi = item.nature === 'EMI_PAYMENT';
  const numAmount = parseFloat(amount || '0');
  const principal = item.principal_amount || 0;
  const computedInterest = isEmi ? Math.max(0, numAmount - principal) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!txDate) {
      setError('Please enter a payment date');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        month,
        amount: numAmount,
        transaction_date: txDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={submitting ? undefined : onClose}
      />

      {/* Sheet panel */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-t-2xl z-50 shadow-2xl p-5 flex flex-col max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
              <span>Pay: {item.name}</span>
              {isEmi && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  EMI
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Due on {item.due_date} · Standard amount {fmtAmount(item.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* EMI breakdown note */}
        {isEmi && (
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3 my-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">Principal:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtAmount(principal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-600 dark:text-gray-300">Interest portion:</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{fmtAmount(computedInterest)}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/30 p-2.5 rounded-lg">
            {error}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Amount to Pay (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:text-white"
                placeholder="0.00"
              />
            </div>
            {isEmi && (
              <p className="text-[11px] text-gray-400 mt-1">
                Any difference from scheduled amount is absorbed by the interest portion.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via UPI, Ref #1234"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                `Confirm Payment (${fmtAmount(numAmount || item.amount)})`
              )}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}
