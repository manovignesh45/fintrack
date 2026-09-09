import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi, categoriesApi, paymentMethodsApi, transactionsApi } from '../api/client';
import type { Account, Category, TxNature, PaymentMethod, TransactionSuggestion } from '../api/types';
import { NATURES } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useCachedList } from '../hooks/useCachedList';
import MerchantAutocomplete from './MerchantAutocomplete';

export interface TransactionFormData {
  title: string;
  amount: string;
  nature: TxNature;
  source_account_id: string;
  target_account_id: string;
  sub_category_id: string;
  payment_method_id: string;
  notes: string;
  principal_amount: string;
  interest_amount: string;
  transaction_date: string;
}

const emptyForm = (): TransactionFormData => ({
  title: '',
  amount: '',
  nature: 'EXPENSE',
  source_account_id: '',
  target_account_id: '',
  sub_category_id: '',
  payment_method_id: '',
  notes: '',
  principal_amount: '0',
  interest_amount: '0',
  transaction_date: new Date().toISOString().split('T')[0],
});

interface Props {
  initial?: TransactionFormData;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  submitLabel: string;
  enableAutoSuggestions?: boolean;
}

export { emptyForm };

export default function TransactionForm({ initial, onSubmit, submitLabel, enableAutoSuggestions = true }: Props) {
  const { editMode } = useAuth();
  const [form, setForm] = useState<TransactionFormData>(initial ?? emptyForm());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-suggestion state tracking
  const autoFillingRef = useRef(false);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const [userTouchedPaymentMethod, setUserTouchedPaymentMethod] = useState(false);
  const [userTouchedAmount, setUserTouchedAmount] = useState(false);
  const [autoFillNotice, setAutoFillNotice] = useState<{
    merchant: string;
    amount?: number;
    isTemplate?: boolean;
    categoryName?: string;
    subCategoryName?: string;
    paymentMethodName?: string;
    prev: {
      title: string;
      amount: string;
      nature: TxNature;
      categoryId: string;
      subCategoryId: string;
      paymentMethodId: string;
    };
  } | null>(null);

  // Suggestions list with offline localStorage caching for PWA
  const { data: suggestions } = useCachedList<TransactionSuggestion[]>(
    'transaction-suggestions',
    async () => {
      if (!enableAutoSuggestions) return [];
      try {
        const fetched = await transactionsApi.suggestions();
        if (fetched && fetched.length > 0) {
          localStorage.setItem('fintrack_suggestions', JSON.stringify(fetched));
        }
        return fetched || [];
      } catch {
        const stored = localStorage.getItem('fintrack_suggestions');
        if (stored) {
          try {
            return JSON.parse(stored) as TransactionSuggestion[];
          } catch {
            return [];
          }
        }
        return [];
      }
    },
    (() => {
      try {
        const stored = localStorage.getItem('fintrack_suggestions');
        return stored ? (JSON.parse(stored) as TransactionSuggestion[]) : [];
      } catch {
        return [];
      }
    })()
  );

  const handleSelectSuggestion = (s: TransactionSuggestion, isExplicit = false) => {
    const shouldFillCategory = isExplicit || !userTouchedCategory;
    const shouldFillPayment = isExplicit || !userTouchedPaymentMethod;
    const shouldFillAmount =
      s.is_template &&
      s.amount !== undefined &&
      s.amount > 0 &&
      (isExplicit || !userTouchedAmount || !form.amount || parseFloat(form.amount) === 0);

    if (!shouldFillCategory && !shouldFillPayment && !shouldFillAmount && !isExplicit) {
      return;
    }

    const prev = {
      title: form.title,
      amount: form.amount,
      nature: form.nature,
      categoryId: selectedCategoryId,
      subCategoryId: form.sub_category_id,
      paymentMethodId: form.payment_method_id,
    };

    autoFillingRef.current = true;

    let targetCategoryId = selectedCategoryId;
    let targetSubCategoryId = form.sub_category_id;
    let targetPaymentMethodId = form.payment_method_id;
    let targetNature = form.nature;
    let targetAmount = form.amount;

    if (s.nature && s.nature !== form.nature) {
      targetNature = s.nature;
    }

    if (shouldFillAmount) {
      targetAmount = s.amount!.toString();
    }

    if (shouldFillCategory) {
      if (s.category_id) {
        targetCategoryId = s.category_id.toString();
      }
      if (s.sub_category_id) {
        targetSubCategoryId = s.sub_category_id.toString();
        if (!s.category_id) {
          const matchedCategory = categories.find((c) =>
            c.sub_categories?.some((sc) => sc.id === s.sub_category_id)
          );
          if (matchedCategory) {
            targetCategoryId = matchedCategory.id.toString();
          }
        }
      } else if (!s.category_id) {
        targetSubCategoryId = '';
      }
    }

    if (shouldFillPayment) {
      if (s.payment_method_id) {
        targetPaymentMethodId = s.payment_method_id.toString();
      }
    }

    setSelectedCategoryId(targetCategoryId);
    setForm((f) => ({
      ...f,
      title: s.title,
      amount: targetAmount,
      nature: targetNature,
      sub_category_id: targetSubCategoryId,
      payment_method_id: targetPaymentMethodId,
    }));

    const cat = categories.find((c) => c.id.toString() === targetCategoryId);
    const subCat = cat?.sub_categories?.find((sc) => sc.id.toString() === targetSubCategoryId);
    const pm = paymentMethods.find((p) => p.id.toString() === targetPaymentMethodId);

    setAutoFillNotice({
      merchant: s.title,
      amount: s.is_template && s.amount !== undefined ? s.amount : undefined,
      isTemplate: s.is_template,
      categoryName: cat?.name,
      subCategoryName: subCat?.name,
      paymentMethodName: pm?.name,
      prev,
    });
  };

  const handleUndoAutoFill = () => {
    if (!autoFillNotice) return;
    const { prev } = autoFillNotice;
    setSelectedCategoryId(prev.categoryId);
    setForm((f) => ({
      ...f,
      title: prev.title,
      amount: prev.amount,
      nature: prev.nature,
      sub_category_id: prev.subCategoryId,
      payment_method_id: prev.paymentMethodId,
    }));
    setAutoFillNotice(null);
  };

  // Custom Prompt Modal State
  const [promptConfig, setPromptConfig] = useState<{
    visible: boolean;
    title: string;
    placeholder: string;
    configurePath?: string;
    onSubmit: (val: string) => Promise<void>;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((data) => setAccounts(data || [])).catch(() => setAccounts([]));
    paymentMethodsApi.list().then((data) => setPaymentMethods(data || [])).catch(() => setPaymentMethods([]));
  }, []);

  useEffect(() => {
    categoriesApi.list({ nature: form.nature }).then((data) => setCategories(data || [])).catch(() => setCategories([]));
    if (autoFillingRef.current) {
      return;
    }
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
    if (autoFillingRef.current) {
      autoFillingRef.current = false;
      return;
    }
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
      setForm((f) => ({ ...f, payment_method_id: '' }));
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
    setUserTouchedCategory(true);
    setAutoFillNotice(null);
    setSelectedCategoryId(categoryId);
    // Reset sub-category when category changes
    set('sub_category_id', '');
  };

  const handleCreateCategory = () => {
    setPromptConfig({
      visible: true,
      title: `New ${form.nature.toLowerCase()} category`,
      placeholder: 'Category name',
      configurePath: '/categories',
      onSubmit: async (name) => {
        const newCat = await categoriesApi.create({ name, nature: form.nature });
        setCategories([...categories, newCat]);
        handleCategoryChange(newCat.id.toString());
      }
    });
  };

  const handleCreateSubCategory = () => {
    if (!selectedCategoryId) return;
    setPromptConfig({
      visible: true,
      title: 'New sub-category',
      placeholder: 'Sub-category name',
      configurePath: '/categories',
      onSubmit: async (name) => {
        await categoriesApi.createSub(parseInt(selectedCategoryId), { name });
        const updatedCategories = await categoriesApi.list({ nature: form.nature });
        setCategories(updatedCategories || []);
        const newSc = updatedCategories.find(c => c.id.toString() === selectedCategoryId)?.sub_categories?.find(sc => sc.name.toLowerCase() === name.toLowerCase());
        if (newSc) set('sub_category_id', newSc.id.toString());
      }
    });
  };

  const handleCreatePaymentMethod = () => {
    setPromptConfig({
      visible: true,
      title: 'New payment method',
      placeholder: 'Method Name (e.g. Credit Card)',
      configurePath: '/payment-methods',
      onSubmit: async (name) => {
        const newPm = await paymentMethodsApi.create({ name });
        setPaymentMethods([...paymentMethods, newPm]);
        set('payment_method_id', newPm.id.toString());
      }
    });
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
              onClick={() => {
                setUserTouchedCategory(false);
                setUserTouchedPaymentMethod(false);
                setAutoFillNotice(null);
                set('nature', n);
              }}
              className={`py-2 rounded-lg text-xs font-medium ${
                form.nature === n ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {n === 'EMI_PAYMENT' ? 'EMI' : n === 'LOAN_DISBURSEMENT' ? 'LOAN' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Title with Smart Auto-Suggestions */}
      {enableAutoSuggestions ? (
        <MerchantAutocomplete
          value={form.title}
          onChange={(val) => {
            set('title', val);
            if (autoFillNotice && val.trim().toLowerCase() !== autoFillNotice.merchant.toLowerCase()) {
              setAutoFillNotice(null);
            }
          }}
          onSelectSuggestion={handleSelectSuggestion}
          suggestions={suggestions}
          categories={categories}
          paymentMethods={paymentMethods}
          autoFillNotice={autoFillNotice}
          onUndoAutoFill={handleUndoAutoFill}
        />
      ) : (
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
      )}

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
            onChange={(e) => {
              setUserTouchedAmount(true);
              set('amount', e.target.value);
            }}
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400">Category *</label>
              {editMode && (
                <button type="button" onClick={handleCreateCategory} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">+ Add</button>
              )}
            </div>
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400">Sub-category</label>
              {selectedCategoryId && editMode && (
                <button type="button" onClick={handleCreateSubCategory} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">+ Add</button>
              )}
            </div>
            <select
              value={form.sub_category_id}
              onChange={(e) => {
                setUserTouchedCategory(true);
                setAutoFillNotice(null);
                set('sub_category_id', e.target.value);
              }}
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
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400">Payment Method</label>
            {editMode && (
              <button type="button" onClick={handleCreatePaymentMethod} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">+ Add</button>
            )}
          </div>
          <select
            value={form.payment_method_id}
            onChange={(e) => {
              setUserTouchedPaymentMethod(true);
              setAutoFillNotice(null);
              set('payment_method_id', e.target.value);
            }}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value="">No payment method</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
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

      {/* Custom Prompt Modal */}
      {promptConfig?.visible && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPromptConfig(null);
              setPromptValue('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{promptConfig.title}</h3>
            </div>
            <div className="p-5">
              <input
                type="text"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPromptConfig(null);
                    setPromptValue('');
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (promptValue.trim()) {
                      document.getElementById('prompt-submit-btn')?.click();
                    }
                  }
                }}
                placeholder={promptConfig.placeholder}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
              {promptConfig.configurePath ? (
                <button
                  type="button"
                  onClick={() => navigate(promptConfig.configurePath!)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Configure more
                </button>
              ) : <div></div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPromptConfig(null);
                    setPromptValue('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="prompt-submit-btn"
                onClick={async () => {
                  if (promptValue.trim()) {
                    setPromptSubmitting(true);
                    try {
                      await promptConfig.onSubmit(promptValue.trim());
                      setPromptConfig(null);
                      setPromptValue('');
                    } catch (err: any) {
                      setError(err.message || 'Failed to create');
                    } finally {
                      setPromptSubmitting(false);
                    }
                  }
                }}
                disabled={promptSubmitting || !promptValue.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
              >
                  {promptSubmitting ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
