import { useEffect, useState } from 'react';
import { accountsApi, categoriesApi } from '../api/client';
import type { Account, Category, TxNature } from '../api/types';
import { NATURES, PAYMENT_METHODS } from '../api/types';

export interface TransactionFormData {
  title: string;
  amount: string;
  nature: TxNature;
  source_account_id: string;
  target_account_id: string;
  sub_category_id: string;
  payment_method: string;
  notes: string;
  principal_amount: string;
  interest_amount: string;
  transaction_date: string;
}

const emptyForm = (): TransactionFormData => ({
  title: '',
  amount: '',
  nature: 'EXPENSE',
  source_account_id: '1',
  target_account_id: '',
  sub_category_id: '',
  payment_method: '',
  notes: '',
  principal_amount: '0',
  interest_amount: '0',
  transaction_date: new Date().toISOString().split('T')[0],
});

interface Props {
  initial?: TransactionFormData;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  submitLabel: string;
}

export { emptyForm };

export default function TransactionForm({ initial, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<TransactionFormData>(initial ?? emptyForm());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((data) => setAccounts(data || [])).catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    categoriesApi.list({ nature: form.nature }).then((data) => setCategories(data || [])).catch(() => setCategories([]));
    // Reset category and sub-category ONLY if nature actually changes from what was in initial
    // This allows pre-population of categories when using templates or editing
    setForm((f) => {
      // If we have a sub_category_id but no selectedCategoryId yet (initial load), 
      // don't clear it yet; let the other useEffect handle it.
      if (initial?.sub_category_id === f.sub_category_id && f.sub_category_id !== '') {
        return f;
      }

      setSelectedCategoryId('');
      return { ...f, sub_category_id: '' };
    });
  }, [form.nature]);

  // Initialize selected category from initial sub_category_id
  useEffect(() => {
    if (form.sub_category_id && categories.length > 0) {
      const category = categories.find((c) =>
        c.sub_categories?.some((sc) => sc.id === parseInt(form.sub_category_id))
      );
      if (category) {
        setSelectedCategoryId(category.id.toString());
      }
    }
  }, [categories, form.sub_category_id]);

  // Auto-calc amount for EMI
  useEffect(() => {
    if (form.nature === 'EMI_PAYMENT') {
      const p = parseFloat(form.principal_amount) || 0;
      const i = parseFloat(form.interest_amount) || 0;
      setForm((f) => ({ ...f, amount: (p + i).toString() }));
    }
  }, [form.principal_amount, form.interest_amount, form.nature]);

  // Pre-fill interest_amount from selected loan account's interest_rate.
  // Depends on `accounts` so it also fires when accounts finish loading after a
  // template is pre-populated (target_account_id already set, accounts was still empty).
  useEffect(() => {
    if (form.nature !== 'EMI_PAYMENT' || !form.target_account_id) return;
    const account = accounts.find((a) => a.id.toString() === form.target_account_id);
    if (!account || account.interest_rate <= 0) return;
    const monthly = (account.current_balance * account.interest_rate) / 100 / 12;
    setForm((f) => ({ ...f, interest_amount: monthly.toFixed(2) }));
  }, [form.target_account_id, form.nature, accounts]);

  // Clear irrelevant fields when nature changes
  useEffect(() => {
    // Check if this nature change is actually a "reset" or part of the initial load from template/edit
    if (initial?.nature === form.nature && initial?.sub_category_id === form.sub_category_id) {
      return; 
    }

    if (form.nature === 'TRANSFER' || form.nature === 'EMI_PAYMENT' || form.nature === 'LOAN_DISBURSEMENT') {
      // Clear category/sub-category for TRANSFER, EMI_PAYMENT, and LOAN_DISBURSEMENT
      setSelectedCategoryId('');
      setForm((f) => ({ ...f, sub_category_id: '' }));
    }
    if (form.nature === 'INCOME' || form.nature === 'TRANSFER' || form.nature === 'LOAN_DISBURSEMENT') {
      // Clear payment method for INCOME, TRANSFER, and LOAN_DISBURSEMENT
      setForm((f) => ({ ...f, payment_method: '' }));
    }
  }, [form.nature]);

  const set = (field: keyof TransactionFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const liabilityAccounts = accounts.filter((a) => a.type === 'LIABILITY' && a.is_active);

  // All natures available for all entities
  const availableNatures = NATURES;

  // Find selected category and its sub-categories
  const selectedCategory = categories.find((c) => c.id.toString() === selectedCategoryId);
  const availableSubCategories = selectedCategory?.sub_categories ?? [];

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    // Reset sub-category when category changes
    set('sub_category_id', '');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-2 rounded">{error}</p>}

      {/* Nature selector */}
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Transaction Type *</label>
        <div className="grid grid-cols-4 gap-1">
          {availableNatures.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set('nature', n)}
              className={`py-2 rounded-lg text-xs font-medium ${
                form.nature === n ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {n === 'EMI_PAYMENT' ? 'EMI' : n === 'LOAN_DISBURSEMENT' ? 'LOAN' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Title *</label>
        <input
          type="text"
          placeholder="e.g. Groceries, Salary"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Loan Account - shown for EMI_PAYMENT and LOAN_DISBURSEMENT natures */}
      {(form.nature === 'EMI_PAYMENT' || form.nature === 'LOAN_DISBURSEMENT') && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Loan Account *</label>
          <select
            value={form.nature === 'LOAN_DISBURSEMENT' ? form.source_account_id : form.target_account_id}
            onChange={(e) => {
              if (form.nature === 'LOAN_DISBURSEMENT') {
                set('source_account_id', e.target.value);
              } else {
                set('target_account_id', e.target.value);
              }
            }}
            required
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select loan account</option>
            {liabilityAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — ₹{a.current_balance.toLocaleString('en-IN')} outstanding{a.interest_rate > 0 ? ` · ${a.interest_rate}% p.a.` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Amount (hidden for EMI_PAYMENT since it's auto-calculated) */}
      {form.nature !== 'EMI_PAYMENT' && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Amount (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 1500.00"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
          />
        </div>
      )}

      {/* EMI split: principal + interest */}
      {form.nature === 'EMI_PAYMENT' && (() => {
        const selectedLoan = accounts.find((a) => a.id.toString() === form.target_account_id);
        const suggestedInterest = selectedLoan && selectedLoan.interest_rate > 0
          ? (selectedLoan.current_balance * selectedLoan.interest_rate / 100 / 12)
          : null;
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Principal (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.principal_amount}
                onChange={(e) => set('principal_amount', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                Interest (₹)
                {suggestedInterest !== null && (
                  <span className="ml-1 text-orange-500 font-normal">
                    · {selectedLoan!.interest_rate}% p.a.
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.interest_amount}
                onChange={(e) => set('interest_amount', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
              />
              {suggestedInterest !== null && (
                <p className="text-[10px] text-orange-500 mt-0.5">
                  Suggested ₹{suggestedInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })} on ₹{selectedLoan!.current_balance.toLocaleString('en-IN')} outstanding
                </p>
              )}
            </div>
            <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
              Total EMI: ₹{(parseFloat(form.principal_amount || '0') + parseFloat(form.interest_amount || '0')).toLocaleString('en-IN')}
            </p>
          </div>
        );
      })()}

      {/* Category / Sub-category - Only for INCOME and EXPENSE */}
      {(form.nature === 'INCOME' || form.nature === 'EXPENSE') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Category</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Sub-category</label>
            <select
              value={form.sub_category_id}
              onChange={(e) => set('sub_category_id', e.target.value)}
              disabled={!selectedCategoryId}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:bg-gray-700 disabled:cursor-not-allowed dark:text-white"
            >
              <option value="">
                {selectedCategoryId ? 'Select sub-category' : 'Choose category first'}
              </option>
              {availableSubCategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Payment method - Only for EXPENSE and EMI_PAYMENT */}
      {(form.nature === 'EXPENSE' || form.nature === 'EMI_PAYMENT') && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Payment Method</label>
          <select
            value={form.payment_method}
            onChange={(e) => set('payment_method', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value="">No payment method</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Transaction Date *</label>
        <input
          type="date"
          value={form.transaction_date}
          onChange={(e) => set('transaction_date', e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          required
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes</label>
        <textarea
          placeholder="Additional notes (optional)"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none dark:bg-gray-800 dark:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
