import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionsApi, paymentMethodsApi, categoriesApi, accountsApi, tagsApi } from '../api/client';
import type { Transaction, TxNature, PaymentMethod, Category, Account, Tag } from '../api/types';
import { useAuth } from '../context/AuthContext';
import TransactionFilter, { DEFAULT_FILTERS, countActiveFilters, DATE_PRESET_LABELS } from '../components/TransactionFilter';
import type { FilterState } from '../components/TransactionFilter';
import { useCachedList } from '../hooks/useCachedList';
import GettingStartedCard from '../components/GettingStartedCard';
const natureColors: Record<TxNature, string> = {
  INCOME: 'text-green-600 dark:text-green-400',
  EXPENSE: 'text-red-600 dark:text-red-400',
  TRANSFER: 'text-blue-600 dark:text-blue-400',
  EMI_PAYMENT: 'text-orange-600 dark:text-orange-400',
  LOAN_DISBURSEMENT: 'text-emerald-700 dark:text-emerald-400',
};

const natureBadgeStyles: Record<TxNature, string> = {
  INCOME: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  EXPENSE: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  TRANSFER: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  EMI_PAYMENT: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
  LOAN_DISBURSEMENT: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
};

const natureLabels: Record<TxNature, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  EMI_PAYMENT: 'EMI Payment',
  LOAN_DISBURSEMENT: 'Loan Disbursement',
};

function getWarrantyStatus(warrantyUntilStr?: string) {
  if (!warrantyUntilStr) return null;
  const expiry = new Date(warrantyUntilStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const monthsAgo = Math.floor(absDays / 30);
    const label = monthsAgo > 1 ? `Expired ${monthsAgo} mos ago` : `Expired ${absDays} days ago`;
    return {
      status: 'expired' as const,
      label,
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    };
  } else if (diffDays <= 30) {
    return {
      status: 'expiring' as const,
      label: `Expiring Soon (${diffDays} days left)`,
      badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    };
  } else {
    const monthsLeft = Math.round(diffDays / 30);
    const label = monthsLeft > 1 ? `Active (${monthsLeft} months left)` : `Active (${diffDays} days left)`;
    return {
      status: 'active' as const,
      label,
      badgeClass: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    };
  }
}

function filterParams(f: FilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.nature) params.nature = f.nature;
  if (f.category_id) params.category_id = f.category_id;
  if (f.sub_category_id) params.sub_category_id = f.sub_category_id;
  if (f.date_from) params.date_from = f.date_from;
  if (f.date_to) params.date_to = f.date_to;
  if (f.search) params.search = f.search;
  if (f.tag_id) params.tag_id = f.tag_id;
  return params;
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { editMode } = useAuth();

  const { data: transactions, loading, reload: load } = useCachedList<Transaction[]>(
    `transactions:${JSON.stringify(filters)}`,
    () => transactionsApi.list(filterParams(filters)),
    []
  );
  const { data: paymentMethods } = useCachedList<PaymentMethod[]>(
    'payment-methods',
    () => paymentMethodsApi.list(),
    []
  );
  const { data: categories } = useCachedList<Category[]>(
    'categories',
    () => categoriesApi.list(),
    []
  );
  const { data: accounts } = useCachedList<Account[]>(
    'accounts',
    () => accountsApi.list(),
    []
  );
  const { data: tags } = useCachedList<Tag[]>(
    'tags',
    () => tagsApi.list(),
    []
  );

  const summary = transactions.reduce(
    (acc, t) => {
      if (t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') {
        acc.income += t.amount;
      } else if (t.nature === 'EXPENSE' || t.nature === 'EMI_PAYMENT') {
        acc.expense += t.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const getCategoryLabel = (t: Transaction) => {
    if (t.sub_category_id) {
      for (const cat of categories) {
        const sub = cat.sub_categories?.find((s) => s.id === t.sub_category_id);
        if (sub) {
          return `${cat.name} · ${sub.name}`;
        }
      }
    }
    return '';
  };

  const getFullCategoryInfo = (t: Transaction) => {
    let catName = '';
    let subName = '';
    if (t.sub_category_id) {
      for (const cat of categories) {
        const sub = cat.sub_categories?.find((s) => s.id === t.sub_category_id);
        if (sub) {
          catName = cat.name;
          subName = sub.name;
          break;
        }
      }
    }
    if (!catName && (t as any).category_id) {
      const cat = categories.find((c) => c.id === (t as any).category_id);
      if (cat) catName = cat.name;
    }
    return { catName, subName };
  };

  const getAccountOrPaymentMethodInfo = (t: Transaction) => {
    if (t.nature === 'TRANSFER') {
      const src = accounts.find((a) => a.id === t.source_account_id)?.name || 'Account';
      const dst = t.target_account_id ? accounts.find((a) => a.id === t.target_account_id)?.name || 'Account' : null;
      return {
        label: 'Transfer Accounts',
        value: dst ? `${src} → ${dst}` : src,
      };
    }
    if (t.nature === 'LOAN_DISBURSEMENT') {
      const acc = accounts.find((a) => a.id === t.source_account_id)?.name;
      return {
        label: 'Loan Account',
        value: acc || 'Not recorded',
      };
    }
    if (t.nature === 'EMI_PAYMENT') {
      const loanAcc = t.target_account_id ? accounts.find((a) => a.id === t.target_account_id)?.name : null;
      const pm = t.payment_method_id ? paymentMethods.find((p) => p.id === t.payment_method_id)?.name : null;
      const src = t.source_account_id ? accounts.find((a) => a.id === t.source_account_id)?.name : null;
      return {
        label: loanAcc ? `Loan: ${loanAcc}` : 'Account',
        value: pm ? `Via ${pm}` : src ? `From ${src}` : null,
      };
    }
    const pm = t.payment_method_id ? paymentMethods.find((p) => p.id === t.payment_method_id)?.name : null;
    const acc = t.source_account_id ? accounts.find((a) => a.id === t.source_account_id)?.name : null;
    if (pm) return { label: 'Payment Method', value: pm };
    if (acc) return { label: 'Account', value: acc };
    return { label: 'Payment Method', value: null };
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await transactionsApi.delete(id);
      if (expandedId === id) {
        setExpandedId(null);
      }
      load();
    } catch {
      alert('Failed to delete');
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    const params = new URLSearchParams();
    if (filters.nature) params.set('nature', filters.nature);
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.sub_category_id) params.set('sub_category_id', filters.sub_category_id);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.search) params.set('search', filters.search);
    if (filters.tag_id) params.set('tag_id', filters.tag_id);

    const token = localStorage.getItem('fintrack_token');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const url = `${baseUrl}/transactions/export/${format}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute(
        'download',
        `transactions_${filters.date_from || new Date().toISOString().slice(0, 7)}.${format === 'csv' ? 'csv' : 'xlsx'}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      <GettingStartedCard />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Transactions</h2>
        <div className="flex items-center gap-2 relative">
          {/* Export dropdown */}
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 font-medium transition-colors"
          >
            Export
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform ${showExportOptions ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExportOptions && (
            <div className="absolute top-full right-8 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 overflow-hidden">
              <button
                onClick={() => {
                  handleExport('csv');
                  setShowExportOptions(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
              >
                As CSV
              </button>
              <button
                onClick={() => {
                  handleExport('excel');
                  setShowExportOptions(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                As Excel
              </button>
            </div>
          )}

          {/* Filter icon button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className="relative p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {countActiveFilters(filters) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {countActiveFilters(filters)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter pills */}
      {countActiveFilters(filters) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.search && (
            <FilterPill label={`"${filters.search}"`} onRemove={() => setFilters((f) => ({ ...f, search: '' }))} />
          )}
          {filters.nature && (
            <FilterPill label={filters.nature.replace('_', ' ')} onRemove={() => setFilters((f) => ({ ...f, nature: '' }))} />
          )}
          {filters.category_id && (
            <FilterPill
              label={categories.find((c) => String(c.id) === filters.category_id)?.name || `Cat #${filters.category_id}`}
              onRemove={() => setFilters((f) => ({ ...f, category_id: '', sub_category_id: '' }))}
            />
          )}
          {filters.sub_category_id && (
            <FilterPill label={`Sub #${filters.sub_category_id}`} onRemove={() => setFilters((f) => ({ ...f, sub_category_id: '' }))} />
          )}
          {filters.tag_id && (
            <FilterPill
              label={`🏷️ ${tags.find((tg) => String(tg.id) === filters.tag_id)?.name || `Tag #${filters.tag_id}`}`}
              onRemove={() => setFilters((f) => ({ ...f, tag_id: '' }))}
            />
          )}
          {filters.date_from && !filters.datePreset && (
            <FilterPill label={`From ${filters.date_from}`} onRemove={() => setFilters((f) => ({ ...f, date_from: '' }))} />
          )}
          {filters.date_to && !filters.datePreset && (
            <FilterPill label={`To ${filters.date_to}`} onRemove={() => setFilters((f) => ({ ...f, date_to: '' }))} />
          )}
          {filters.datePreset && (
            <FilterPill
              label={DATE_PRESET_LABELS[filters.datePreset] ?? filters.datePreset}
              onRemove={() => setFilters((f) => ({ ...f, datePreset: '', date_from: '', date_to: '' }))}
            />
          )}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Income</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">₹{summary.income.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center border-x border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Expense</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">₹{summary.expense.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Diff</p>
            <p className={`text-sm font-bold ${summary.income - summary.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              ₹{(summary.income - summary.expense).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => {
            const catLabel = getCategoryLabel(t);
            const pmName = t.payment_method_id
              ? paymentMethods.find((p) => p.id === t.payment_method_id)?.name
              : null;
            const isPositive = t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT';
            const isExpanded = expandedId === t.id;
            const warranty = getWarrantyStatus(t.warranty_until);
            const { catName, subName } = getFullCategoryInfo(t);
            const acctInfo = getAccountOrPaymentMethodInfo(t);

            return (
              <div
                key={t.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border p-3 transition-all ${
                  isExpanded
                    ? 'border-blue-400 dark:border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xs'
                }`}
              >
                {/* Clickable Header Row */}
                <div
                  onClick={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                  className="cursor-pointer group select-none"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId((prev) => (prev === t.id ? null : t.id));
                    }
                  }}
                >
                  {/* Line 1: Title + Indicators (Left) & Amount (Right) */}
                  <div className="flex justify-between items-baseline gap-3 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">
                        {t.title}
                      </p>
                      {t.warranty_until && (
                        <span className="text-xs shrink-0" title={`Warranty: ${t.warranty_until}`}>
                          🛡️
                        </span>
                      )}
                      {t.tags && t.tags.length > 0 && (
                        <span className="text-xs shrink-0" title={`${t.tags.length} tag(s)`}>
                          🏷️
                        </span>
                      )}
                    </div>
                    <p className={`font-semibold shrink-0 text-sm ${natureColors[t.nature]}`}>
                      {isPositive ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                    </p>
                  </div>

                  {/* Line 2: Date · Category / Nature [· Payment Method] (Left) & Expand Indicator (Right) */}
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <p className="truncate min-w-0 flex-1 mr-2">
                      <span>{t.transaction_date}</span>
                      <span className="mx-1">·</span>
                      <span className={catLabel ? 'text-gray-700 dark:text-gray-300 font-medium' : ''}>
                        {catLabel || natureLabels[t.nature]}
                      </span>
                      {pmName && (
                        <>
                          <span className="mx-1">·</span>
                          <span>{pmName}</span>
                        </>
                      )}
                    </p>
                    <div
                      className={`flex items-center gap-1 shrink-0 font-medium transition-colors ${
                        isExpanded
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                      }`}
                    >
                      <span className="text-[11px]">{isExpanded ? 'Hide' : 'Details'}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div
                    className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/70 space-y-3 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Nature & Date Header */}
                    <div className="flex items-center justify-between text-xs">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${natureBadgeStyles[t.nature]}`}>
                        {natureLabels[t.nature]}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-[11px]">
                        {t.transaction_date}
                      </span>
                    </div>

                    {/* Core Classification Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Category */}
                      <div className="bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-lg">
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider block">
                          Category
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 mt-0.5 block">
                          {catName ? (
                            <>
                              {catName}
                              {subName && (
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate">
                                  ↳ {subName}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </span>
                      </div>

                      {/* Payment Method / Account */}
                      <div className="bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-lg">
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider block">
                          {acctInfo.label}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 mt-0.5 block truncate">
                          {acctInfo.value || <span className="text-gray-400 italic">Not recorded</span>}
                        </span>
                      </div>
                    </div>

                    {/* EMI Principal & Interest Breakdown */}
                    {t.nature === 'EMI_PAYMENT' && (
                      <div className="p-2.5 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 rounded-lg space-y-1">
                        <p className="text-[10px] font-semibold text-orange-900 dark:text-orange-300 uppercase tracking-wider">
                          Loan EMI Breakdown
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Principal</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">
                              ₹{t.principal_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Interest</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">
                              ₹{t.interest_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tags Section */}
                    {t.tags && t.tags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                          Tags & Events
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                            >
                              <span className="text-[10px]">🏷️</span>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warranty & Guarantee Section */}
                    {(t.warranty_until || t.warranty_notes) && (
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-lg space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-[10px] tracking-wider flex items-center gap-1">
                            <span>🛡️</span> Warranty / Guarantee
                          </span>
                          {warranty && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${warranty.badgeClass}`}>
                              {warranty.label}
                            </span>
                          )}
                        </div>
                        {t.warranty_until && (
                          <div className="text-gray-600 dark:text-gray-300">
                            <span className="text-gray-400">Valid Until: </span>
                            <span className="font-medium">{t.warranty_until}</span>
                          </div>
                        )}
                        {t.warranty_notes && (
                          <div className="text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200/80 dark:border-gray-600">
                            <span className="text-[10px] text-gray-400 block mb-0.5">Details / Serial / Terms</span>
                            {t.warranty_notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes Section */}
                    {t.notes && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                          Notes
                        </p>
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {t.notes}
                        </div>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                      {editMode && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(t.id);
                            }}
                            className="py-1.5 px-3 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/edit/${t.id}`);
                            }}
                            className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(null);
                        }}
                        className="py-1.5 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                      >
                        Collapse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/add')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-colors z-20"
        aria-label="Add Transaction"
      >
        +
      </button>

      {/* Filter panel */}
      <TransactionFilter
        isOpen={isFilterOpen}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
        onClose={() => setIsFilterOpen(false)}
      />
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-100" aria-label="Remove filter">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
