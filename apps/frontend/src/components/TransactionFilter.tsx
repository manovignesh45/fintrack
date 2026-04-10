import { useEffect, useRef, useState } from 'react';
import { categoriesApi } from '../api/client';
import type { Category, EntityType, TxNature } from '../api/types';
import { ENTITIES } from '../api/types';

export interface FilterState {
  search: string;
  entity: EntityType | '';
  nature: TxNature | '';
  category_id: string;
  sub_category_id: string;
  date_from: string;
  date_to: string;
  datePreset: string;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  entity: '',
  nature: '',
  category_id: '',
  sub_category_id: '',
  date_from: '',
  date_to: '',
  datePreset: '',
};

export function countActiveFilters(f: FilterState): number {
  const dateActive = f.datePreset && (f.datePreset !== 'custom' || f.date_from || f.date_to) ? 1 : 0;
  return [f.search, f.entity, f.nature, f.category_id, f.sub_category_id].filter(Boolean).length + dateActive;
}

export const DATE_PRESET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  thisweek: 'This week',
  lastweek: 'Last week',
  thismonth: 'This month',
  lastmonth: 'Last month',
  custom: 'Custom range',
};

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetDates(preset: string): { date_from: string; date_to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today': {
      const d = fmt(today);
      return { date_from: d, date_to: d };
    }
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      return { date_from: d, date_to: d };
    }
    case 'last7': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'thisweek': {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const from = new Date(today);
      from.setDate(today.getDate() + diff);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'lastweek': {
      const day = today.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { date_from: fmt(lastMonday), date_to: fmt(lastSunday) };
    }
    case 'thismonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: fmt(from), date_to: fmt(today) };
    }
    case 'lastmonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { date_from: fmt(from), date_to: fmt(to) };
    }
    default:
      return { date_from: '', date_to: '' };
  }
}

const TX_NATURES: { value: TxNature; label: string }[] = [
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'EMI_PAYMENT', label: 'EMI Payment' },
  { value: 'LOAN_DISBURSEMENT', label: 'Loan Disbursement' },
];

interface Props {
  isOpen: boolean;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

// Natures that don't require a category (structural transaction types)
const STRUCTURAL_NATURES: TxNature[] = ['TRANSFER', 'EMI_PAYMENT', 'LOAN_DISBURSEMENT'];

export default function TransactionFilter({ isOpen, filters, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<FilterState>(filters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const loaded = useRef(false);

  // Sync draft when panel is opened
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      if (!loaded.current) {
        loaded.current = true;
        setLoadingCats(true);
        categoriesApi.list().then((data) => {
          setCategories(data || []);
        }).catch(() => {
          setCategories([]);
        }).finally(() => setLoadingCats(false));
      }
    }
  }, [isOpen]);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // Cascade resets downstream
      if (key === 'entity') {
        next.nature = '';
        next.category_id = '';
        next.sub_category_id = '';
      }
      if (key === 'nature') {
        next.category_id = '';
        next.sub_category_id = '';
      }
      if (key === 'category_id') {
        next.sub_category_id = '';
      }
      if (key === 'datePreset') {
        const preset = value as string;
        if (preset === 'custom') {
          // keep existing date_from/date_to so user can refine them
        } else {
          const dates = getPresetDates(preset);
          next.date_from = dates.date_from;
          next.date_to = dates.date_to;
        }
      }
      return next;
    });
  };

  // Natures available for the selected entity (from categories + always show structural types)
  const availableNatures: TxNature[] = draft.entity
    ? [
        ...new Set([
          ...categories
            .filter((c) => c.entity === draft.entity)
            .map((c) => c.nature),
          ...STRUCTURAL_NATURES,
        ]),
      ]
    : TX_NATURES.map((n) => n.value);

  // Categories filtered by entity and nature
  const filteredCategories = categories.filter((c) => {
    if (draft.entity && c.entity !== draft.entity) return false;
    if (draft.nature && c.nature !== draft.nature) return false;
    return true;
  });

  const selectedCategory = filteredCategories.find((c) => String(c.id) === draft.category_id);
  const subCategories = selectedCategory?.sub_categories ?? [];

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[90vh] flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-base">Filter Transactions</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close filter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-3 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={draft.search}
                onChange={(e) => set('search', e.target.value)}
                placeholder="Search title or notes…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {draft.search && (
                <button
                  onClick={() => set('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Entity */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => set('entity', '')}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${draft.entity === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                All
              </button>
              {ENTITIES.map((e) => (
                <button
                  key={e}
                  onClick={() => set('entity', e)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${draft.entity === e ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Transaction Type</label>
            <select
              value={draft.nature}
              onChange={(e) => set('nature', e.target.value as TxNature | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All Types</option>
              {TX_NATURES.filter(({ value }) => availableNatures.includes(value)).map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            {loadingCats ? (
              <p className="text-xs text-gray-400">Loading categories…</p>
            ) : (
              <select
                value={draft.category_id}
                onChange={(e) => set('category_id', e.target.value)}
                disabled={filteredCategories.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {filteredCategories.length === 0 ? 'No categories for selection' : 'All Categories'}
                </option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}{!draft.entity || !draft.nature ? ` (${c.entity} · ${c.nature})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sub-category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sub-category</label>
            <select
              value={draft.sub_category_id}
              onChange={(e) => set('sub_category_id', e.target.value)}
              disabled={!draft.category_id || subCategories.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {!draft.category_id ? 'Select a category first' : 'All Sub-categories'}
              </option>
              {subCategories.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Filter</label>
            <select
              value={draft.datePreset}
              onChange={(e) => set('datePreset', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">All Time</option>
              {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Custom date inputs */}
            {draft.datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={draft.date_from}
                    onChange={(e) => setDraft((prev) => ({ ...prev, date_from: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={draft.date_to}
                    onChange={(e) => setDraft((prev) => ({ ...prev, date_to: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* bottom padding */}
          <div className="h-2" />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Reset All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 bg-blue-600 rounded-xl text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
