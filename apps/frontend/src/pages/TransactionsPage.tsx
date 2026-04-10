import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionsApi } from '../api/client';
import type { Transaction, TxNature } from '../api/types';
import { useAuth } from '../context/AuthContext';
import TransactionFilter, { DEFAULT_FILTERS, countActiveFilters, DATE_PRESET_LABELS } from '../components/TransactionFilter';
import type { FilterState } from '../components/TransactionFilter';

const natureColors: Record<TxNature, string> = {
  INCOME: 'text-green-600',
  EXPENSE: 'text-red-600',
  TRANSFER: 'text-blue-600',
  EMI_PAYMENT: 'text-orange-600',
  LOAN_DISBURSEMENT: 'text-green-800',
};

const natureLabels: Record<TxNature, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  EMI_PAYMENT: 'EMI Payment',
  LOAN_DISBURSEMENT: 'Loan Disbursement',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const navigate = useNavigate();
  const { editMode } = useAuth();

  const load = async (f: FilterState = filters) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (f.entity) params.entity = f.entity;
      if (f.nature) params.nature = f.nature;
      if (f.category_id) params.category_id = f.category_id;
      if (f.sub_category_id) params.sub_category_id = f.sub_category_id;
      if (f.date_from) params.date_from = f.date_from;
      if (f.date_to) params.date_to = f.date_to;
      if (f.search) params.search = f.search;

      const data = await transactionsApi.list(params);
      setTransactions(data || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await transactionsApi.delete(id);
      load();
    } catch {
      alert('Failed to delete');
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    const params = new URLSearchParams();
    if (filters.entity) params.set('entity', filters.entity);
    if (filters.nature) params.set('nature', filters.nature);
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.sub_category_id) params.set('sub_category_id', filters.sub_category_id);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.search) params.set('search', filters.search);

    const token = localStorage.getItem('fintrack_token');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const url = `${baseUrl}/transactions/export/${format}?${params.toString()}`;

    // Create a hidden link and click it to trigger download with auth token (if using token in URL or if browser handles it)
    // Since we need to pass Authorization header, we'll fetch and create a blob
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `transactions_${filters.date_from || new Date().toISOString().slice(0, 7)}.${format === 'csv' ? 'csv' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Transactions</h2>
        <div className="flex items-center gap-2 relative">
          {/* Export dropdown */}
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1 font-medium transition-colors"
          >
            Export
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showExportOptions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExportOptions && (
            <div className="absolute top-full right-8 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
              <button
                onClick={() => { handleExport('csv'); setShowExportOptions(false); }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              >
                As CSV
              </button>
              <button
                onClick={() => { handleExport('excel'); setShowExportOptions(false); }}
                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                As Excel
              </button>
            </div>
          )}

          {/* Filter icon button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className="relative p-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
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
          {filters.entity && (
            <FilterPill label={filters.entity} onRemove={() => setFilters((f) => ({ ...f, entity: '' }))} />
          )}
          {filters.nature && (
            <FilterPill label={filters.nature.replace('_', ' ')} onRemove={() => setFilters((f) => ({ ...f, nature: '' }))} />
          )}
          {filters.category_id && (
            <FilterPill label={`Cat #${filters.category_id}`} onRemove={() => setFilters((f) => ({ ...f, category_id: '', sub_category_id: '' }))} />
          )}
          {filters.sub_category_id && (
            <FilterPill label={`Sub #${filters.sub_category_id}`} onRemove={() => setFilters((f) => ({ ...f, sub_category_id: '' }))} />
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

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg border border-gray-200 p-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {t.transaction_date} · {natureLabels[t.nature]} · {t.entity}
                    {t.payment_method && ` · ${t.payment_method}`}
                  </p>
                  {t.nature === 'EMI_PAYMENT' && (
                    <p className="text-xs text-gray-500">
                      P: ₹{t.principal_amount.toLocaleString('en-IN')} + I: ₹{t.interest_amount.toLocaleString('en-IN')}
                    </p>
                  )}
                  {t.notes && <p className="text-xs text-gray-400 mt-1">{t.notes}</p>}
                </div>
                <div className="text-right ml-3">
                  <p className={`font-semibold ${natureColors[t.nature]}`}>
                    {(t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                  </p>
                  {editMode && (
                    <div className="flex gap-1 mt-1 justify-end">
                      <button
                        onClick={() => navigate(`/edit/${t.id}`)}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Del
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/add')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition-colors z-20"
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900" aria-label="Remove filter">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
