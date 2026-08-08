import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accountsApi, categoriesApi, commitmentsApi, paymentMethodsApi } from '../api/client';
import type { Account, Category, Commitment, PaymentMethod, TxNature } from '../api/types';
import { invalidateCache } from '../hooks/useCachedList';

// A commitment is a monthly bill or an EMI; the other natures don't recur.
const COMMITMENT_NATURES: TxNature[] = ['EXPENSE', 'EMI_PAYMENT'];

const inputClass =
  'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-800 dark:text-white';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'text-xs text-gray-500 dark:text-gray-400 mb-1 block';

interface FormState {
  name: string;
  amount: string;
  nature: TxNature;
  due_day: string;
  target_account_id: string;
  sub_category_id: string;
  payment_method_id: string;
  principal_amount: string;
  interest_amount: string;
  notes: string;
  is_active: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  amount: '',
  nature: 'EXPENSE',
  due_day: '1',
  target_account_id: '',
  sub_category_id: '',
  payment_method_id: '',
  principal_amount: '0',
  interest_amount: '0',
  notes: '',
  is_active: true,
});

const toForm = (c: Commitment): FormState => ({
  name: c.name,
  amount: c.amount.toString(),
  nature: c.nature,
  due_day: c.due_day.toString(),
  target_account_id: c.target_account_id?.toString() ?? '',
  sub_category_id: c.sub_category_id?.toString() ?? '',
  payment_method_id: c.payment_method_id?.toString() ?? '',
  principal_amount: c.principal_amount.toString(),
  interest_amount: c.interest_amount.toString(),
  notes: c.notes ?? '',
  is_active: c.is_active,
});

export default function CommitmentFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((d) => setAccounts(d || [])).catch(() => setAccounts([]));
    paymentMethodsApi.list().then((d) => setPaymentMethods(d || [])).catch(() => setPaymentMethods([]));
    categoriesApi.list({ nature: 'EXPENSE' }).then((d) => setCategories(d || [])).catch(() => setCategories([]));
  }, []);

  // There is no GET /commitments/{id}; the month listing already carries every
  // commitment for the ledger, so read the one being edited out of it.
  useEffect(() => {
    if (!id) return;
    commitmentsApi
      .list()
      .then((res) => {
        const found = res?.items.find((i) => i.id === Number(id));
        if (!found) {
          setError('Commitment not found');
          return;
        }
        setForm(toForm(found));
      })
      .catch(() => setError('Failed to load commitment'))
      .finally(() => setLoading(false));
  }, [id]);

  // Pre-select the parent category once both the form and categories are loaded.
  useEffect(() => {
    if (!form.sub_category_id || categories.length === 0 || selectedCategoryId) return;
    const parent = categories.find((c) =>
      c.sub_categories?.some((sc) => sc.id.toString() === form.sub_category_id)
    );
    if (parent) setSelectedCategoryId(parent.id.toString());
  }, [form.sub_category_id, categories, selectedCategoryId]);

  const availableSubCategories = useMemo(
    () => categories.find((c) => c.id.toString() === selectedCategoryId)?.sub_categories ?? [],
    [categories, selectedCategoryId]
  );

  const isEmi = form.nature === 'EMI_PAYMENT';
  // Mirrors TransactionForm: an EMI's total is the principal + interest split.
  const emiTotal = parseFloat(form.principal_amount || '0') + parseFloat(form.interest_amount || '0');
  const selectedLoan = accounts.find((a) => a.id.toString() === form.target_account_id);
  const suggestedInterest =
    selectedLoan && selectedLoan.interest_rate > 0
      ? (selectedLoan.current_balance * selectedLoan.interest_rate) / 100 / 12
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const amount = isEmi ? emiTotal : parseFloat(form.amount || '0');
    if (!(amount > 0)) {
      setError('Amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        amount,
        nature: form.nature,
        due_day: parseInt(form.due_day || '1', 10),
        // Left at 0 so the backend picks the primary asset account, matching
        // how manually entered transactions behave.
        source_account_id: 0,
        target_account_id: isEmi && form.target_account_id ? Number(form.target_account_id) : null,
        sub_category_id: !isEmi && form.sub_category_id ? Number(form.sub_category_id) : null,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : null,
        principal_amount: isEmi ? parseFloat(form.principal_amount || '0') : 0,
        interest_amount: isEmi ? parseFloat(form.interest_amount || '0') : 0,
        notes: form.notes.trim(),
        is_active: form.is_active,
      };

      if (isEdit) {
        await commitmentsApi.update(Number(id), payload);
      } else {
        await commitmentsApi.create(payload);
      }
      invalidateCache('commitments:');
      navigate('/commitments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save commitment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-center py-8">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/commitments')} className="text-gray-600 dark:text-gray-400 text-xl">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {isEdit ? 'Edit Commitment' : 'New Commitment'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">{error}</p>
        )}

        <div>
          <label className={labelClass}>Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {COMMITMENT_NATURES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set('nature', n)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  form.nature === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                {n === 'EMI_PAYMENT' ? 'Loan EMI' : 'Bill / Expense'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. BSNL Broadband, Gold loan"
            required
            autoFocus
            className={inputClass}
          />
        </div>

        {isEmi && (
          <div>
            <label className={labelClass}>Loan Account *</label>
            <select
              value={form.target_account_id}
              onChange={(e) => set('target_account_id', e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select loan account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — ₹{a.current_balance.toLocaleString('en-IN')} outstanding
                  {a.interest_rate > 0 ? ` · ${a.interest_rate}% p.a.` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {isEmi ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Principal (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.principal_amount}
                onChange={(e) => set('principal_amount', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Interest (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.interest_amount}
                onChange={(e) => set('interest_amount', e.target.value)}
                className={inputClass}
              />
              {suggestedInterest !== null && (
                <p className="text-[10px] text-orange-500 mt-0.5">
                  Suggested ₹{suggestedInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
              Monthly EMI: ₹{emiTotal.toLocaleString('en-IN')}
            </p>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Monthly Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="e.g. 700"
              required
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Due Day of Month *</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.due_day}
            onChange={(e) => set('due_day', e.target.value)}
            required
            className={inputClass}
          />
          <p className="text-[10px] text-gray-400 mt-0.5">
            A day past the end of a short month falls back to that month's last day.
          </p>
        </div>

        {!isEmi && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  set('sub_category_id', '');
                }}
                className={selectClass}
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
              <label className={labelClass}>Sub-category</label>
              <select
                value={form.sub_category_id}
                onChange={(e) => set('sub_category_id', e.target.value)}
                disabled={!selectedCategoryId}
                className={`${selectClass} disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed`}
              >
                <option value="">{selectedCategoryId ? 'Select sub-category' : 'Choose category first'}</option>
                {availableSubCategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Payment Method</label>
          <select
            value={form.payment_method_id}
            onChange={(e) => set('payment_method_id', e.target.value)}
            className={selectClass}
          >
            <option value="">None</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Optional"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          Active — include in the monthly total
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 shadow-md active:scale-[0.98] transition-all"
        >
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Commitment'}
        </button>
      </form>
    </div>
  );
}
